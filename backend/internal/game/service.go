package game

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/pae/backend/internal/events"
	"github.com/pae/backend/internal/models"
	"github.com/pae/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
)

// ErrSessionNotFound is returned when a session cannot be located.
var ErrSessionNotFound = errors.New("session not found")

// ErrSessionNotWaiting is returned when starting a session that is not in
// waiting state.
var ErrSessionNotWaiting = errors.New("session is not in waiting state")

// ErrSessionNotActive is returned when an action requires an active session.
var ErrSessionNotActive = errors.New("session is not active")

// ErrNoMoreQuestions is returned when next question is called past the end.
var ErrNoMoreQuestions = errors.New("no more questions")

// QuizFinder is a minimal interface the game service needs from quiz repository.
type QuizFinder interface {
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error)
}

// Service provides game session business logic and real-time event publishing.
type Service struct {
	repo         *Repository
	quizRepo     QuizFinder
	playerFinder PlayerFinder // for building leaderboards
	publisher    events.Publisher
	logger       *zap.Logger

	// Per-room question timer cancellation functions.
	roomTimers   map[string]context.CancelFunc
	roomTimersMu sync.Mutex
}

// NewService creates a new game Service.
func NewService(
	repo *Repository,
	quizRepo QuizFinder,
	playerFinder PlayerFinder,
	publisher events.Publisher,
	logger *zap.Logger,
) *Service {
	return &Service{
		repo:         repo,
		quizRepo:     quizRepo,
		playerFinder: playerFinder,
		publisher:    publisher,
		logger:       logger,
		roomTimers:   make(map[string]context.CancelFunc),
	}
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

// CreateSession generates a PIN and persists a new waiting session.
func (s *Service) CreateSession(ctx context.Context, quizID, teacherID primitive.ObjectID) (*models.QuizSession, error) {
	if _, err := s.quizRepo.FindByID(ctx, quizID); err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("quiz not found")
		}
		return nil, fmt.Errorf("game service create session quiz lookup: %w", err)
	}

	pin := utils.GeneratePIN()

	session := &models.QuizSession{
		QuizID:          quizID,
		TeacherID:       teacherID,
		PIN:             pin,
		Status:          models.StatusWaiting,
		CurrentQuestion: 0,
	}

	created, err := s.repo.Create(ctx, session)
	if err != nil {
		return nil, fmt.Errorf("game service create: %w", err)
	}

	return created, nil
}

// GetByPIN returns a session by PIN.
func (s *Service) GetByPIN(ctx context.Context, pin string) (*models.QuizSession, error) {
	session, err := s.repo.FindByPIN(ctx, pin)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("game service get by pin: %w", err)
	}
	return session, nil
}

// GetByID returns a session by its ObjectID.
func (s *Service) GetByID(ctx context.Context, id primitive.ObjectID) (*models.QuizSession, error) {
	session, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("game service get by id: %w", err)
	}
	return session, nil
}

// StartSession transitions a waiting session to active and broadcasts
// game_start + the first question via MQTT.
func (s *Service) StartSession(ctx context.Context, pin string, teacherID primitive.ObjectID) (*models.QuizSession, error) {
	session, err := s.GetByPIN(ctx, pin)
	if err != nil {
		return nil, err
	}

	if session.TeacherID != teacherID {
		return nil, errors.New("unauthorized")
	}

	if session.Status != models.StatusWaiting {
		return nil, ErrSessionNotWaiting
	}

	if err := s.repo.Start(ctx, session.ID); err != nil {
		return nil, fmt.Errorf("game service start: %w", err)
	}
	session.Status = models.StatusActive

	// Publish game_start to all room participants.
	_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin), events.EventGameStart,
		events.GameStartPayload{PIN: pin})

	// Start question 0 in a goroutine so the HTTP response is not delayed.
	go s.pushQuestion(context.Background(), pin, 0)

	return session, nil
}

// NextQuestion advances the session to the next question and broadcasts it.
func (s *Service) NextQuestion(ctx context.Context, pin string, teacherID primitive.ObjectID) (*models.QuizSession, error) {
	session, err := s.GetByPIN(ctx, pin)
	if err != nil {
		return nil, err
	}

	if session.TeacherID != teacherID {
		return nil, errors.New("unauthorized")
	}

	if session.Status != models.StatusActive {
		return nil, ErrSessionNotActive
	}

	quiz, err := s.quizRepo.FindByID(ctx, session.QuizID)
	if err != nil {
		return nil, fmt.Errorf("game service next question quiz lookup: %w", err)
	}

	next := session.CurrentQuestion + 1
	if next >= len(quiz.Questions) {
		return nil, ErrNoMoreQuestions
	}

	if err := s.repo.UpdateCurrentQuestion(ctx, session.ID, next); err != nil {
		return nil, fmt.Errorf("game service next question update: %w", err)
	}
	session.CurrentQuestion = next

	// Cancel any running timer and push the new question.
	s.cancelRoomTimer(pin)
	go s.pushQuestion(context.Background(), pin, next)

	return session, nil
}

// EndSession marks the session as finished and broadcasts game_end.
func (s *Service) EndSession(ctx context.Context, pin string, teacherID primitive.ObjectID) (*models.QuizSession, error) {
	session, err := s.GetByPIN(ctx, pin)
	if err != nil {
		return nil, err
	}

	if session.TeacherID != teacherID {
		return nil, errors.New("unauthorized")
	}

	if session.Status == models.StatusFinished {
		return session, nil // idempotent
	}

	if err := s.repo.End(ctx, session.ID); err != nil {
		return nil, fmt.Errorf("game service end: %w", err)
	}
	session.Status = models.StatusFinished

	s.cancelRoomTimer(pin)

	players, _ := s.playerFinder.FindBySessionID(ctx, session.ID)
	sort.Slice(players, func(i, j int) bool { return players[i].Score > players[j].Score })
	_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin), events.EventGameEnd,
		events.GameEndPayload{
			PIN:              pin,
			FinalLeaderboard: buildLeaderboard(players),
		})

	return session, nil
}

// ListByTeacher returns sessions for a teacher.
func (s *Service) ListByTeacher(ctx context.Context, teacherID primitive.ObjectID) ([]models.QuizSession, error) {
	return s.repo.FindByTeacherID(ctx, teacherID)
}

// ─── Question flow ─────────────────────────────────────────────────────────────

// pushQuestion loads question[idx] and broadcasts question_start + starts timer.
// If idx >= total questions the game ends automatically.
func (s *Service) pushQuestion(ctx context.Context, pin string, idx int) {
	session, err := s.repo.FindByPIN(ctx, pin)
	if err != nil {
		s.logger.Error("pushQuestion: session lookup failed", zap.Error(err))
		return
	}

	quiz, err := s.quizRepo.FindByID(ctx, session.QuizID)
	if err != nil {
		s.logger.Error("pushQuestion: quiz lookup failed", zap.Error(err))
		return
	}

	if idx >= len(quiz.Questions) {
		// All questions done — auto-end the game.
		_ = s.repo.End(ctx, session.ID)
		players, _ := s.playerFinder.FindBySessionID(ctx, session.ID)
		sort.Slice(players, func(i, j int) bool { return players[i].Score > players[j].Score })
		_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin), events.EventGameEnd,
			events.GameEndPayload{
				PIN:              pin,
				FinalLeaderboard: buildLeaderboard(players),
			})
		return
	}

	q := quiz.Questions[idx]

	fmt.Printf("[Game] Publishing QUESTION_START: questionID=%s, text='%s', timeLimit=%d, points=%d\n",
		q.ID, q.Text, q.TimeLimit, q.Points)

	_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin), events.EventQuestionStart,
		events.QuestionStartPayload{
			QuestionIndex:  idx,
			TotalQuestions: len(quiz.Questions),
			Question:       q,
			TimeLimit:      q.TimeLimit,
		})

	sessionID := session.ID
	s.startQuestionTimer(pin, q.TimeLimit, func() {
		// Timer expired: broadcast question_end + leaderboard.
		_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin), events.EventQuestionEnd,
			events.QuestionEndPayload{CorrectAnswer: correctAnswer(&q)})
		s.broadcastLeaderboard(ctx, pin, sessionID)
	})
}

// ─── Timer management ─────────────────────────────────────────────────────────

func (s *Service) startQuestionTimer(pin string, seconds int, onEnd func()) {
	s.cancelRoomTimer(pin)

	ctx, cancel := context.WithCancel(context.Background())
	s.roomTimersMu.Lock()
	s.roomTimers[pin] = cancel
	s.roomTimersMu.Unlock()

	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		remaining := seconds
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				remaining--
				_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin),
					events.EventTimerUpdate,
					events.TimerUpdatePayload{Remaining: remaining})
				if remaining <= 0 {
					onEnd()
					return
				}
			}
		}
	}()
}

func (s *Service) cancelRoomTimer(pin string) {
	s.roomTimersMu.Lock()
	if cancel, ok := s.roomTimers[pin]; ok {
		cancel()
		delete(s.roomTimers, pin)
	}
	s.roomTimersMu.Unlock()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (s *Service) broadcastLeaderboard(ctx context.Context, pin string, sessionID primitive.ObjectID) {
	players, err := s.playerFinder.FindBySessionID(ctx, sessionID)
	if err != nil {
		s.logger.Error("broadcastLeaderboard: fetch failed", zap.Error(err))
		return
	}
	sort.Slice(players, func(i, j int) bool { return players[i].Score > players[j].Score })
	_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin), events.EventLeaderboard,
		events.LeaderboardPayload{Entries: buildLeaderboard(players)})
}

func buildLeaderboard(players []models.Player) []events.LeaderboardEntry {
	entries := make([]events.LeaderboardEntry, len(players))
	for i, p := range players {
		entries[i] = events.LeaderboardEntry{
			PlayerID: p.ID.Hex(),
			Nickname: p.Nickname,
			Score:    p.Score,
			Rank:     i + 1,
		}
	}
	return entries
}

func correctAnswer(q *models.Question) string {
	switch q.Type {
	case models.MultipleChoice, models.ImageBased, models.TrueFalse:
		for _, opt := range q.Options {
			if opt.IsRight {
				return opt.ID
			}
		}
	case models.FillBlank, models.MatchPair:
		return q.Answer
	}
	return ""
}
