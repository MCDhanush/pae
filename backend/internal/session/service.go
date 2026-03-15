package session

import (
	"context"
	"fmt"

	"github.com/pae/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SessionRepository is the interface for quiz session persistence.
type SessionRepository interface {
	FindByTeacherID(ctx context.Context, teacherID primitive.ObjectID) ([]models.QuizSession, error)
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.QuizSession, error)
}

// PlayerRepository is the interface for retrieving players.
type PlayerRepository interface {
	FindBySessionID(ctx context.Context, sessionID primitive.ObjectID) ([]models.Player, error)
}

// QuizFinder looks up a quiz by its ID.
type QuizFinder interface {
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error)
}

// Player is a local alias so this package doesn't import the player package.
type Player = models.Player

// SessionDetail bundles a session with its players.
type SessionDetail struct {
	Session *models.QuizSession `json:"session"`
	Players []models.Player     `json:"players"`
}

// SessionSummary is a session enriched with quiz title and player count.
type SessionSummary struct {
	models.QuizSession
	QuizTitle   string `json:"quiz_title"`
	PlayerCount int    `json:"player_count"`
}

// Service provides session history logic for the teacher dashboard.
type Service struct {
	sessionRepo SessionRepository
	playerRepo  PlayerRepository
	quizFinder  QuizFinder
}

// NewService creates a new session Service.
func NewService(sessionRepo SessionRepository, playerRepo PlayerRepository, quizFinder QuizFinder) *Service {
	return &Service{
		sessionRepo: sessionRepo,
		playerRepo:  playerRepo,
		quizFinder:  quizFinder,
	}
}

// ListByTeacher returns all sessions for a teacher enriched with quiz title and player count.
func (s *Service) ListByTeacher(ctx context.Context, teacherID primitive.ObjectID) ([]SessionSummary, error) {
	sessions, err := s.sessionRepo.FindByTeacherID(ctx, teacherID)
	if err != nil {
		return nil, fmt.Errorf("session service list: %w", err)
	}

	summaries := make([]SessionSummary, 0, len(sessions))
	for _, sess := range sessions {
		sum := SessionSummary{QuizSession: sess}

		// Enrich with quiz title.
		if s.quizFinder != nil {
			if quiz, qErr := s.quizFinder.FindByID(ctx, sess.QuizID); qErr == nil {
				sum.QuizTitle = quiz.Title
			}
		}

		// Enrich with player count.
		if players, pErr := s.playerRepo.FindBySessionID(ctx, sess.ID); pErr == nil {
			sum.PlayerCount = len(players)
		}

		summaries = append(summaries, sum)
	}
	return summaries, nil
}

// GetDetail returns a session with its player list.
func (s *Service) GetDetail(ctx context.Context, sessionID primitive.ObjectID) (*SessionDetail, error) {
	sess, err := s.sessionRepo.FindByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session service get detail session: %w", err)
	}

	players, err := s.playerRepo.FindBySessionID(ctx, sess.ID)
	if err != nil {
		return nil, fmt.Errorf("session service get detail players: %w", err)
	}

	return &SessionDetail{
		Session: sess,
		Players: players,
	}, nil
}

func (s *Service) GetPlayers(ctx context.Context, sessionID string) ([]models.Player, error) {
	id, err := primitive.ObjectIDFromHex(sessionID)
	if err != nil {
		return nil, err
	}

	return s.playerRepo.FindBySessionID(ctx, id)
}
