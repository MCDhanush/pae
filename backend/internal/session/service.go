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

// Player is a local alias so this package doesn't import the player package.
type Player = models.Player

// SessionDetail bundles a session with its players.
type SessionDetail struct {
	Session *models.QuizSession `json:"session"`
	Players []models.Player     `json:"players"`
}

// Service provides session history logic for the teacher dashboard.
type Service struct {
	sessionRepo SessionRepository
	playerRepo  PlayerRepository
}

// NewService creates a new session Service.
func NewService(sessionRepo SessionRepository, playerRepo PlayerRepository) *Service {
	return &Service{
		sessionRepo: sessionRepo,
		playerRepo:  playerRepo,
	}
}

// ListByTeacher returns all sessions for a teacher.
func (s *Service) ListByTeacher(ctx context.Context, teacherID primitive.ObjectID) ([]models.QuizSession, error) {
	sessions, err := s.sessionRepo.FindByTeacherID(ctx, teacherID)
	if err != nil {
		return nil, fmt.Errorf("session service list: %w", err)
	}
	return sessions, nil
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
