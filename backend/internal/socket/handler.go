package socket

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/pae/backend/internal/database"
	"github.com/pae/backend/internal/models"
	"github.com/pae/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.uber.org/zap"
)

// ─── Interfaces ───────────────────────────────────────────────────────────────

// PlayerAnswerRecorder can record a player's answer and update their score.
type PlayerAnswerRecorder interface {
	AddAnswer(ctx context.Context, playerID primitive.ObjectID, answer models.PlayerAnswer) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Player, error)
	FindBySessionID(ctx context.Context, sessionID primitive.ObjectID) ([]models.Player, error)
}

// SessionQuizLoader can load session + quiz data together.
type SessionQuizLoader interface {
	GetByPIN(ctx context.Context, pin string) (*models.QuizSession, error)
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error)
}

// SessionRepo provides session state updates triggered by socket events.
type SessionRepo interface {
	FindByPIN(ctx context.Context, pin string) (*models.QuizSession, error)
	UpdateCurrentQuestion(ctx context.Context, id primitive.ObjectID, index int) error
}

// ─── Composite loader ─────────────────────────────────────────────────────────

type sessionFinder interface {
	GetByPIN(ctx context.Context, pin string) (*models.QuizSession, error)
}

type quizFinder interface {
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error)
}

type quizLoaderImpl struct {
	sf sessionFinder
	qf quizFinder
}

// NewSessionQuizLoader builds a SessionQuizLoader from a session service and a
// quiz finder (typically quiz.Repository).
func NewSessionQuizLoader(sf sessionFinder, qf quizFinder) SessionQuizLoader {
	return &quizLoaderImpl{sf: sf, qf: qf}
}

func (q *quizLoaderImpl) GetByPIN(ctx context.Context, pin string) (*models.QuizSession, error) {
	return q.sf.GetByPIN(ctx, pin)
}

func (q *quizLoaderImpl) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error) {
	return q.qf.FindByID(ctx, id)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// answeredKey tracks which players have already answered a question.
type answeredKey struct {
	pin        string
	questionID string
}

// Handler processes incoming WebSocket events and orchestrates game flow.
type Handler struct {
	hub           *Hub
	playerRepo    PlayerAnswerRecorder
	sessionLoader SessionQuizLoader
	sessionRepo   SessionRepo
	redis         *database.RedisClient
	logger        *zap.Logger

	// Deduplication: (pin, questionID) → set of player IDs that already answered.
	answered   map[answeredKey]map[string]bool
	answeredMu sync.Mutex

	// Per-room question timer cancellation functions.
	roomTimers   map[string]context.CancelFunc
	roomTimersMu sync.Mutex
}

// NewHandler creates a new socket Handler.
func NewHandler(
	hub *Hub,
	playerRepo PlayerAnswerRecorder,
	sessionLoader SessionQuizLoader,
	sessionRepo SessionRepo,
	redis *database.RedisClient,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		hub:           hub,
		playerRepo:    playerRepo,
		sessionLoader: sessionLoader,
		sessionRepo:   sessionRepo,
		redis:         redis,
		logger:        logger,
		answered:      make(map[answeredKey]map[string]bool),
		roomTimers:    make(map[string]context.CancelFunc),
	}
}

// ─── Connection lifecycle ─────────────────────────────────────────────────────

// OnClientConnect is called right after a client is registered with the hub.
// For player clients it broadcasts player_join so the host lobby updates live.
func (h *Handler) OnClientConnect(c *Client) {
	if c.Role != "player" || c.PlayerID == "" {
		return
	}

	ctx := context.Background()
	playerOID, err := primitive.ObjectIDFromHex(c.PlayerID)
	if err != nil {
		return
	}

	player, err := h.playerRepo.FindByID(ctx, playerOID)
	if err != nil {
		h.logger.Warn("OnClientConnect: player lookup failed", zap.Error(err))
		return
	}

	h.broadcastEvent(c.PIN, EventPlayerJoin, PlayerPayload{
		ID:        player.ID.Hex(),
		Nickname:  player.Nickname,
		Score:     player.Score,
		SessionID: player.SessionID.Hex(),
		JoinedAt:  player.JoinedAt.UTC().Format(time.RFC3339),
	})
}

// OnClientDisconnect is called just before a client is unregistered.
func (h *Handler) OnClientDisconnect(c *Client) {
	if c.Role != "player" || c.PlayerID == "" {
		return
	}

	ctx := context.Background()
	playerOID, err := primitive.ObjectIDFromHex(c.PlayerID)
	nickname := c.PlayerID
	if err == nil {
		if player, err := h.playerRepo.FindByID(ctx, playerOID); err == nil {
			nickname = player.Nickname
		}
	}

	h.broadcastEvent(c.PIN, EventPlayerLeave, PlayerLeavePayload{
		PlayerID: c.PlayerID,
		Nickname: nickname,
	})
}

// ─── Message dispatcher ───────────────────────────────────────────────────────

// HandleMessage dispatches an incoming message to the appropriate handler.
func (h *Handler) HandleMessage(c *Client, msg *Message) {
	switch msg.Event {
	case EventAnswerSubmit:
		h.handleAnswerSubmit(c, msg.Payload)
	case "start_game":
		h.handleStartGame(c)
	case "next_question":
		h.handleNextQuestion(c)
	case "end_game":
		h.handleEndGame(c)
	default:
		h.logger.Debug("unhandled event", zap.String("event", msg.Event))
	}
}

// ─── Host event handlers ──────────────────────────────────────────────────────

func (h *Handler) handleStartGame(c *Client) {
	if c.Role != "host" {
		c.sendMessage(EventError, ErrorPayload{Message: "only host can start the game"})
		return
	}
	h.broadcastEvent(c.PIN, EventGameStart, GameStartPayload{PIN: c.PIN})
	h.pushQuestion(context.Background(), c.PIN, 0)
}

func (h *Handler) handleNextQuestion(c *Client) {
	if c.Role != "host" {
		c.sendMessage(EventError, ErrorPayload{Message: "only host can advance questions"})
		return
	}

	ctx := context.Background()
	h.cancelRoomTimer(c.PIN)

	session, err := h.sessionRepo.FindByPIN(ctx, c.PIN)
	if err != nil {
		h.logger.Error("handleNextQuestion: session lookup failed", zap.Error(err))
		return
	}

	nextIdx := session.CurrentQuestion + 1
	if err := h.sessionRepo.UpdateCurrentQuestion(ctx, session.ID, nextIdx); err != nil {
		h.logger.Error("handleNextQuestion: update failed", zap.Error(err))
	}

	h.pushQuestion(ctx, c.PIN, nextIdx)
}

func (h *Handler) handleEndGame(c *Client) {
	if c.Role != "host" {
		c.sendMessage(EventError, ErrorPayload{Message: "only host can end the game"})
		return
	}

	ctx := context.Background()
	h.cancelRoomTimer(c.PIN)

	session, err := h.sessionLoader.GetByPIN(ctx, c.PIN)
	if err != nil {
		h.logger.Error("handleEndGame: session lookup failed", zap.Error(err))
		return
	}

	players, _ := h.playerRepo.FindBySessionID(ctx, session.ID)
	sort.Slice(players, func(i, j int) bool { return players[i].Score > players[j].Score })

	entries := buildLeaderboard(players)
	h.broadcastEvent(c.PIN, EventGameEnd, GameEndPayload{
		PIN:              c.PIN,
		FinalLeaderboard: entries,
	})
}

// ─── Question flow ────────────────────────────────────────────────────────────

// pushQuestion loads question[idx] and broadcasts question_start + starts timer.
// If idx >= total questions the game ends automatically.
func (h *Handler) pushQuestion(ctx context.Context, pin string, idx int) {
	session, err := h.sessionLoader.GetByPIN(ctx, pin)
	if err != nil {
		h.logger.Error("pushQuestion: session lookup failed", zap.Error(err))
		return
	}

	quiz, err := h.sessionLoader.FindByID(ctx, session.QuizID)
	if err != nil {
		h.logger.Error("pushQuestion: quiz lookup failed", zap.Error(err))
		return
	}

	if idx >= len(quiz.Questions) {
		players, _ := h.playerRepo.FindBySessionID(ctx, session.ID)
		sort.Slice(players, func(i, j int) bool { return players[i].Score > players[j].Score })
		h.broadcastEvent(pin, EventGameEnd, GameEndPayload{
			PIN:              pin,
			FinalLeaderboard: buildLeaderboard(players),
		})
		return
	}

	q := quiz.Questions[idx]

	h.broadcastEvent(pin, EventQuestionStart, QuestionStartPayload{
		QuestionIndex:  idx,
		TotalQuestions: len(quiz.Questions),
		Question:       q,
		TimeLimit:      q.TimeLimit,
	})

	sessionID := session.ID
	h.startQuestionTimer(pin, q.TimeLimit, func() {
		h.broadcastEvent(pin, EventQuestionEnd, QuestionEndPayload{
			CorrectAnswer: correctAnswer(&q),
		})
		h.broadcastLeaderboard(ctx, pin, sessionID)
	})
}

// ─── Timer management ─────────────────────────────────────────────────────────

func (h *Handler) startQuestionTimer(pin string, seconds int, onEnd func()) {
	h.cancelRoomTimer(pin)

	ctx, cancel := context.WithCancel(context.Background())
	h.roomTimersMu.Lock()
	h.roomTimers[pin] = cancel
	h.roomTimersMu.Unlock()

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
				h.broadcastEvent(pin, EventTimerUpdate, TimerUpdatePayload{Remaining: remaining})
				if remaining <= 0 {
					onEnd()
					return
				}
			}
		}
	}()
}

func (h *Handler) cancelRoomTimer(pin string) {
	h.roomTimersMu.Lock()
	if cancel, ok := h.roomTimers[pin]; ok {
		cancel()
		delete(h.roomTimers, pin)
	}
	h.roomTimersMu.Unlock()
}

// ─── Answer handling ──────────────────────────────────────────────────────────

func (h *Handler) handleAnswerSubmit(c *Client, rawPayload interface{}) {
	data, err := json.Marshal(rawPayload)
	if err != nil {
		c.sendMessage(EventError, ErrorPayload{Message: "invalid payload"})
		return
	}

	var payload AnswerSubmitPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		c.sendMessage(EventError, ErrorPayload{Message: "invalid answer payload"})
		return
	}

	if payload.PlayerID == "" || payload.QuestionID == "" {
		c.sendMessage(EventError, ErrorPayload{Message: "player_id and question_id are required"})
		return
	}

	key := answeredKey{pin: c.PIN, questionID: payload.QuestionID}
	h.answeredMu.Lock()
	if _, ok := h.answered[key]; !ok {
		h.answered[key] = make(map[string]bool)
	}
	if h.answered[key][payload.PlayerID] {
		h.answeredMu.Unlock()
		c.sendMessage(EventError, ErrorPayload{Message: "already answered this question"})
		return
	}
	h.answered[key][payload.PlayerID] = true
	h.answeredMu.Unlock()

	ctx := context.Background()

	session, err := h.sessionLoader.GetByPIN(ctx, c.PIN)
	if err != nil {
		h.logger.Error("answer: session lookup failed", zap.Error(err))
		c.sendMessage(EventError, ErrorPayload{Message: "session not found"})
		return
	}

	quiz, err := h.sessionLoader.FindByID(ctx, session.QuizID)
	if err != nil {
		h.logger.Error("answer: quiz lookup failed", zap.Error(err))
		c.sendMessage(EventError, ErrorPayload{Message: "quiz not found"})
		return
	}

	var question *models.Question
	for i := range quiz.Questions {
		if quiz.Questions[i].ID == payload.QuestionID {
			question = &quiz.Questions[i]
			break
		}
	}
	if question == nil {
		c.sendMessage(EventError, ErrorPayload{Message: "question not found"})
		return
	}

	isCorrect := evaluateAnswer(question, payload.Answer)
	points := utils.CalculateScore(isCorrect, payload.TimeLeft, payload.TotalTime, question.Points)

	playerOID, err := primitive.ObjectIDFromHex(payload.PlayerID)
	if err != nil {
		c.sendMessage(EventError, ErrorPayload{Message: "invalid player_id"})
		return
	}

	ans := models.PlayerAnswer{
		QuestionID: payload.QuestionID,
		Answer:     payload.Answer,
		IsCorrect:  isCorrect,
		Points:     points,
		AnsweredAt: time.Now().UTC(),
	}
	if err := h.playerRepo.AddAnswer(ctx, playerOID, ans); err != nil {
		h.logger.Error("answer: persist failed", zap.Error(err))
	}

	scoresKey := fmt.Sprintf("room:%s:scores", c.PIN)
	player, err := h.playerRepo.FindByID(ctx, playerOID)
	if err == nil {
		_ = h.redis.ZAdd(ctx, scoresKey, float64(player.Score), fmt.Sprintf("%s:%s", player.ID.Hex(), player.Nickname))
		_ = h.redis.Expire(ctx, scoresKey, 4*time.Hour)
	}

	totalScore := 0
	if player != nil {
		totalScore = player.Score
	}
	c.sendMessage(EventAnswerResult, AnswerResultPayload{
		IsCorrect:  isCorrect,
		Points:     points,
		TotalScore: totalScore,
	})

	h.broadcastLeaderboard(ctx, c.PIN, session.ID)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (h *Handler) broadcastEvent(pin, event string, payload interface{}) {
	data, err := json.Marshal(Message{Event: event, Payload: payload})
	if err != nil {
		h.logger.Error("broadcastEvent: marshal failed", zap.Error(err))
		return
	}
	h.hub.BroadcastToRoom(pin, data)
}

func (h *Handler) broadcastLeaderboard(ctx context.Context, pin string, sessionID primitive.ObjectID) {
	players, err := h.playerRepo.FindBySessionID(ctx, sessionID)
	if err != nil {
		h.logger.Error("broadcastLeaderboard: fetch failed", zap.Error(err))
		return
	}
	sort.Slice(players, func(i, j int) bool { return players[i].Score > players[j].Score })
	h.broadcastEvent(pin, EventLeaderboard, LeaderboardPayload{Entries: buildLeaderboard(players)})
}

func buildLeaderboard(players []models.Player) []LeaderboardEntry {
	entries := make([]LeaderboardEntry, len(players))
	for i, p := range players {
		entries[i] = LeaderboardEntry{
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
	case models.MultipleChoice, models.ImageBased:
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

func evaluateAnswer(q *models.Question, answer string) bool {
	switch q.Type {
	case models.FillBlank:
		return q.Answer != "" && q.Answer == answer
	case models.MultipleChoice, models.ImageBased:
		for _, opt := range q.Options {
			if opt.ID == answer && opt.IsRight {
				return true
			}
		}
		return false
	case models.MatchPair:
		return q.Answer != "" && q.Answer == answer
	default:
		return false
	}
}
