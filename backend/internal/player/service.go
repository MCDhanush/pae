package player

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/pae/backend/internal/database"
	"github.com/pae/backend/internal/events"
	"github.com/pae/backend/internal/models"
	"github.com/pae/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ErrSessionNotFound is returned when the PIN does not match any session.
var ErrSessionNotFound = errors.New("session not found")

// ErrSessionNotJoinable is returned when a session is not in waiting state.
var ErrSessionNotJoinable = errors.New("session is not accepting players")

// ErrAlreadyAnswered is returned when a player submits a duplicate answer.
var ErrAlreadyAnswered = errors.New("already answered this question")

// ErrQuestionNotFound is returned when the question ID is not in the quiz.
var ErrQuestionNotFound = errors.New("question not found")

// Repository handles MongoDB persistence for players.
type Repository struct {
	col *mongo.Collection
}

// NewRepository creates a new player Repository.
func NewRepository(col *mongo.Collection) *Repository {
	return &Repository{col: col}
}

// Create inserts a new player document.
func (r *Repository) Create(ctx context.Context, p *models.Player) (*models.Player, error) {
	p.ID = primitive.NewObjectID()
	p.JoinedAt = time.Now().UTC()
	if p.Answers == nil {
		p.Answers = []models.PlayerAnswer{}
	}

	if _, err := r.col.InsertOne(ctx, p); err != nil {
		return nil, fmt.Errorf("player repo create: %w", err)
	}
	return p, nil
}

// FindBySessionID returns all players in a session ordered by score desc.
func (r *Repository) FindBySessionID(ctx context.Context, sessionID primitive.ObjectID) ([]models.Player, error) {
	opts := options.Find().SetSort(bson.D{{Key: "score", Value: -1}})
	cursor, err := r.col.Find(ctx, bson.M{"session_id": sessionID}, opts)
	if err != nil {
		return nil, fmt.Errorf("player repo find by session: %w", err)
	}
	defer cursor.Close(ctx)

	var players []models.Player
	if err := cursor.All(ctx, &players); err != nil {
		return nil, fmt.Errorf("player repo decode list: %w", err)
	}
	return players, nil
}

// FindByID retrieves a player by their ObjectID.
func (r *Repository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Player, error) {
	var p models.Player
	if err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&p); err != nil {
		return nil, fmt.Errorf("player repo find by id: %w", err)
	}
	return &p, nil
}

// AddAnswer appends a PlayerAnswer and increments the player's score atomically.
func (r *Repository) AddAnswer(ctx context.Context, playerID primitive.ObjectID, answer models.PlayerAnswer) error {
	update := bson.M{
		"$push": bson.M{"answers": answer},
		"$inc":  bson.M{"score": answer.Points},
	}
	fmt.Printf("[Repo] Adding answer for player %s: questionID=%s, isCorrect=%v, points=%d\n",
		playerID.Hex(), answer.QuestionID, answer.IsCorrect, answer.Points)

	res, err := r.col.UpdateOne(ctx, bson.M{"_id": playerID}, update)
	if err != nil {
		fmt.Printf("[Repo] ERROR: UpdateOne failed: %v\n", err)
		return fmt.Errorf("player repo add answer: %w", err)
	}

	fmt.Printf("[Repo] UpdateOne result: matchedCount=%d, modifiedCount=%d\n", res.MatchedCount, res.ModifiedCount)
	if res.MatchedCount == 0 {
		fmt.Printf("[Repo] ERROR: No documents matched for player %s\n", playerID.Hex())
		return mongo.ErrNoDocuments
	}
	return nil
}

// Count returns the total number of player documents.
func (r *Repository) Count(ctx context.Context) (int64, error) {
	return r.col.CountDocuments(ctx, bson.M{})
}

// FindByUserID returns all player documents for a given user ID, sorted by joined_at desc.
func (r *Repository) FindByUserID(ctx context.Context, userID primitive.ObjectID) ([]models.Player, error) {
	opts := options.Find().SetSort(bson.D{{Key: "joined_at", Value: -1}})
	cursor, err := r.col.Find(ctx, bson.M{"user_id": userID}, opts)
	if err != nil {
		return nil, fmt.Errorf("player repo find by user: %w", err)
	}
	defer cursor.Close(ctx)

	var players []models.Player
	if err := cursor.All(ctx, &players); err != nil {
		return nil, fmt.Errorf("player repo decode user list: %w", err)
	}
	return players, nil
}

// ─── Service interfaces ───────────────────────────────────────────────────────

// SessionFinder is the subset of game service the player service needs.
type SessionFinder interface {
	GetByPIN(ctx context.Context, pin string) (*models.QuizSession, error)
}

// QuizFinder lets the player service load quiz data for answer evaluation.
type QuizFinder interface {
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error)
}

// SessionByIDFinder lets the player service look up a session by its ObjectID.
type SessionByIDFinder interface {
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.QuizSession, error)
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

// PlayerAttemptSummary summarises a single quiz attempt for a student.
type PlayerAttemptSummary struct {
	PlayerID       string    `json:"player_id"`
	SessionID      string    `json:"session_id"`
	PIN            string    `json:"pin"`
	QuizTitle      string    `json:"quiz_title"`
	Score          int       `json:"score"`
	CorrectAnswers int       `json:"correct_answers"`
	TotalQuestions int       `json:"total_questions"`
	PlayedAt       time.Time `json:"played_at"`
}

// ─── Service ──────────────────────────────────────────────────────────────────

// Service provides player join and answer logic.
type Service struct {
	repo          *Repository
	sessionSvc    SessionFinder
	sessionByID   SessionByIDFinder
	quizFinder    QuizFinder
	publisher     events.Publisher
	redisClient   *database.RedisClient
}

// NewService creates a new player Service.
func NewService(
	repo *Repository,
	sessionSvc SessionFinder,
	quizFinder QuizFinder,
	publisher events.Publisher,
	redisClient *database.RedisClient,
) *Service {
	return &Service{
		repo:        repo,
		sessionSvc:  sessionSvc,
		quizFinder:  quizFinder,
		publisher:   publisher,
		redisClient: redisClient,
	}
}

// WithSessionByIDFinder attaches a SessionByIDFinder to the service (used for GetPlayerAttempts).
func (s *Service) WithSessionByIDFinder(f SessionByIDFinder) {
	s.sessionByID = f
}

// Join creates a player record in MongoDB, registers it in Redis and publishes
// player_join to the lobby MQTT topic so the host sees the join in real-time.
func (s *Service) Join(ctx context.Context, pin, nickname string, userID *primitive.ObjectID) (*models.Player, error) {
	session, err := s.sessionSvc.GetByPIN(ctx, pin)
	if err != nil {
		return nil, ErrSessionNotFound
	}

	if session.Status != models.StatusWaiting {
		return nil, ErrSessionNotJoinable
	}

	p := &models.Player{
		SessionID: session.ID,
		UserID:    userID,
		Nickname:  nickname,
		Score:     0,
	}

	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return nil, fmt.Errorf("player service join create: %w", err)
	}

	// Register player in Redis room.
	roomKey := fmt.Sprintf("room:%s:players", pin)
	playerInfo := map[string]interface{}{
		"id":       created.ID.Hex(),
		"nickname": nickname,
		"score":    0,
	}
	if err := s.redisClient.HSet(ctx, roomKey, created.ID.Hex(), playerInfo); err != nil {
		_ = err // non-fatal
	}
	_ = s.redisClient.Expire(ctx, roomKey, 4*time.Hour)

	// Publish player_join to the lobby MQTT topic.
	_ = s.publisher.Publish(ctx, events.LobbyTopic(pin), events.EventPlayerJoin,
		events.PlayerJoinPayload{
			ID:        created.ID.Hex(),
			Nickname:  created.Nickname,
			Score:     0,
			SessionID: created.SessionID.Hex(),
			JoinedAt:  created.JoinedAt.UTC().Format(time.RFC3339),
		})

	return created, nil
}

// FindBySessionID returns all players for a session.
func (s *Service) FindBySessionID(ctx context.Context, sessionID primitive.ObjectID) ([]models.Player, error) {
	return s.repo.FindBySessionID(ctx, sessionID)
}

// GetPlayerAttempts returns a summary of all quiz attempts for the authenticated user.
func (s *Service) GetPlayerAttempts(ctx context.Context, userIDHex string) ([]PlayerAttemptSummary, error) {
	userOID, err := primitive.ObjectIDFromHex(userIDHex)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}

	players, err := s.repo.FindByUserID(ctx, userOID)
	if err != nil {
		return nil, fmt.Errorf("get player attempts find: %w", err)
	}

	summaries := make([]PlayerAttemptSummary, 0, len(players))
	for _, p := range players {
		summary := PlayerAttemptSummary{
			PlayerID:  p.ID.Hex(),
			SessionID: p.SessionID.Hex(),
			Score:     p.Score,
			PlayedAt:  p.JoinedAt,
		}

		// Count correct answers.
		for _, a := range p.Answers {
			if a.IsCorrect {
				summary.CorrectAnswers++
			}
		}

		// Enrich with session and quiz data.
		if s.sessionByID != nil {
			sess, sessErr := s.sessionByID.FindByID(ctx, p.SessionID)
			if sessErr == nil {
				summary.PIN = sess.PIN

				quiz, quizErr := s.quizFinder.FindByID(ctx, sess.QuizID)
				if quizErr == nil {
					summary.QuizTitle = quiz.Title
					summary.TotalQuestions = len(quiz.Questions)
				}
			}
		}

		summaries = append(summaries, summary)
	}

	return summaries, nil
}

// SubmitAnswer evaluates the player's answer, persists it, then publishes
// answer_result (player topic) and leaderboard_update (broadcast topic).
// The result is also returned in the HTTP response for immediate feedback.
func (s *Service) SubmitAnswer(
	ctx context.Context,
	pin, playerIDHex, questionID, answer string,
	timeLeft, totalTime int,
) (*events.AnswerResultPayload, error) {
	// Load session.
	session, err := s.sessionSvc.GetByPIN(ctx, pin)
	if err != nil {
		return nil, ErrSessionNotFound
	}

	// Load quiz.
	quiz, err := s.quizFinder.FindByID(ctx, session.QuizID)
	if err != nil {
		return nil, fmt.Errorf("quiz not found: %w", err)
	}

	// Find the question.
	var question *models.Question
	for i := range quiz.Questions {
		if quiz.Questions[i].ID == questionID {
			question = &quiz.Questions[i]
			break
		}
	}
	if question == nil {
		return nil, ErrQuestionNotFound
	}

	// Validate player.
	playerOID, err := primitive.ObjectIDFromHex(playerIDHex)
	if err != nil {
		return nil, fmt.Errorf("invalid player_id")
	}

	// Check for duplicate answer.
	player, err := s.repo.FindByID(ctx, playerOID)
	if err != nil {
		return nil, fmt.Errorf("player not found: %w", err)
	}
	for _, a := range player.Answers {
		if a.QuestionID == questionID {
			return nil, ErrAlreadyAnswered
		}
	}

	// Evaluate and score.
	isCorrect := evaluateAnswer(question, answer)
	points := utils.CalculateScore(isCorrect, timeLeft, totalTime, question.Points)

	fmt.Printf("[Service] Answer evaluation: questionType=%s, question='%s', answer='%s', isCorrect=%v, points=%d\n",
		question.Type, question.Text, answer, isCorrect, points)

	ans := models.PlayerAnswer{
		QuestionID: questionID,
		Answer:     answer,
		IsCorrect:  isCorrect,
		Points:     points,
		AnsweredAt: time.Now().UTC(),
	}
	if err := s.repo.AddAnswer(ctx, playerOID, ans); err != nil {
		fmt.Printf("[Service] ERROR persisting answer: %v\n", err)
		return nil, fmt.Errorf("persist answer: %w", err)
	}
	fmt.Printf("[Service] Answer persisted successfully for player %s\n", playerOID.Hex())

	// Reload player for updated score.
	player, _ = s.repo.FindByID(ctx, playerOID)
	totalScore := 0
	if player != nil {
		totalScore = player.Score
	}

	// Update Redis scores sorted set.
	scoresKey := fmt.Sprintf("room:%s:scores", pin)
	if player != nil {
		_ = s.redisClient.ZAdd(ctx, scoresKey, float64(player.Score),
			fmt.Sprintf("%s:%s", player.ID.Hex(), player.Nickname))
		_ = s.redisClient.Expire(ctx, scoresKey, 4*time.Hour)
	}

	result := &events.AnswerResultPayload{
		IsCorrect:  isCorrect,
		Points:     points,
		TotalScore: totalScore,
	}

	// Publish answer_result to the player's personal MQTT topic.
	_ = s.publisher.Publish(ctx,
		events.PlayerTopic(pin, playerIDHex),
		events.EventAnswerResult,
		result)

	// Broadcast updated leaderboard to the whole room.
	s.broadcastLeaderboard(ctx, pin, session.ID)

	return result, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (s *Service) broadcastLeaderboard(ctx context.Context, pin string, sessionID primitive.ObjectID) {
	players, _ := s.repo.FindBySessionID(ctx, sessionID)
	sort.Slice(players, func(i, j int) bool { return players[i].Score > players[j].Score })

	entries := make([]events.LeaderboardEntry, len(players))
	for i, p := range players {
		entries[i] = events.LeaderboardEntry{
			PlayerID: p.ID.Hex(),
			Nickname: p.Nickname,
			Score:    p.Score,
			Rank:     i + 1,
		}
	}
	_ = s.publisher.Publish(ctx, events.BroadcastTopic(pin), events.EventLeaderboard,
		events.LeaderboardPayload{Entries: entries})
}

func evaluateAnswer(q *models.Question, answer string) bool {
	switch q.Type {
	case models.FillBlank:
		result := q.Answer != "" && q.Answer == answer
		fmt.Printf("[Eval] FillBlank: expected='%s', got='%s', match=%v\n", q.Answer, answer, result)
		return result
	case models.MultipleChoice, models.ImageBased, models.TrueFalse:
		fmt.Printf("[Eval] MultipleChoice/TrueFalse: received answer ID='%s', options count=%d\n", answer, len(q.Options))
		for i, opt := range q.Options {
			fmt.Printf("[Eval]   Option %d: id='%s', text='%s', isRight=%v\n", i, opt.ID, opt.Text, opt.IsRight)
			if opt.ID == answer && opt.IsRight {
				fmt.Printf("[Eval] Match found! Option %d is correct\n", i)
				return true
			}
		}
		fmt.Printf("[Eval] No matching correct option found\n")
		return false
	case models.MatchPair:
		result := q.Answer != "" && q.Answer == answer
		fmt.Printf("[Eval] MatchPair: expected='%s', got='%s', match=%v\n", q.Answer, answer, result)
		return result
	default:
		fmt.Printf("[Eval] Unknown question type: %s\n", q.Type)
		return false
	}
}
