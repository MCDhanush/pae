package quiz

import (
	"context"
	"errors"
	"fmt"

	"github.com/pae/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const maxImages = 3

// ErrQuizNotFound is returned when a quiz cannot be located.
var ErrQuizNotFound = errors.New("quiz not found")

// ErrUnauthorized is returned when a teacher attempts to modify another
// teacher's quiz.
var ErrUnauthorized = errors.New("unauthorized")

// ErrTooManyImages is returned when the image limit would be exceeded.
var ErrTooManyImages = errors.New("quiz already has maximum number of images (3)")

// Service provides quiz business logic.
type Service struct {
	repo *Repository
}

// NewService creates a new quiz Service.
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Create validates and persists a new quiz.
func (s *Service) Create(ctx context.Context, quiz *models.Quiz) (*models.Quiz, error) {
	if len(quiz.Images) > maxImages {
		return nil, ErrTooManyImages
	}

	created, err := s.repo.Create(ctx, quiz)
	if err != nil {
		return nil, fmt.Errorf("quiz service create: %w", err)
	}

	return created, nil
}

// GetByID returns a quiz by ID. Returns ErrQuizNotFound if it does not exist.
func (s *Service) GetByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error) {
	quiz, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrQuizNotFound
		}
		return nil, fmt.Errorf("quiz service get: %w", err)
	}
	return quiz, nil
}

// ListByTeacher returns all quizzes for the given teacher.
func (s *Service) ListByTeacher(ctx context.Context, teacherID primitive.ObjectID) ([]models.Quiz, error) {
	quizzes, err := s.repo.FindByTeacherID(ctx, teacherID)
	if err != nil {
		return nil, fmt.Errorf("quiz service list: %w", err)
	}
	return quizzes, nil
}

// Update applies changes to an existing quiz, enforcing ownership.
func (s *Service) Update(ctx context.Context, quiz *models.Quiz, teacherID primitive.ObjectID) (*models.Quiz, error) {
	existing, err := s.GetByID(ctx, quiz.ID)
	if err != nil {
		return nil, err
	}

	if existing.TeacherID != teacherID {
		return nil, ErrUnauthorized
	}

	if len(quiz.Images) > maxImages {
		return nil, ErrTooManyImages
	}

	quiz.TeacherID = teacherID
	updated, err := s.repo.Update(ctx, quiz)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrQuizNotFound
		}
		return nil, fmt.Errorf("quiz service update: %w", err)
	}

	return updated, nil
}

// Delete removes a quiz, enforcing ownership.
func (s *Service) Delete(ctx context.Context, quizID, teacherID primitive.ObjectID) error {
	existing, err := s.GetByID(ctx, quizID)
	if err != nil {
		return err
	}

	if existing.TeacherID != teacherID {
		return ErrUnauthorized
	}

	if err := s.repo.Delete(ctx, quizID, teacherID); err != nil {
		if err == mongo.ErrNoDocuments {
			return ErrQuizNotFound
		}
		return fmt.Errorf("quiz service delete: %w", err)
	}

	return nil
}

// AddImage appends a GCS URL to the quiz image list, respecting the max limit.
func (s *Service) AddImage(ctx context.Context, quizID, teacherID primitive.ObjectID, url string) error {
	existing, err := s.GetByID(ctx, quizID)
	if err != nil {
		return err
	}

	if existing.TeacherID != teacherID {
		return ErrUnauthorized
	}

	if len(existing.Images) >= maxImages {
		return ErrTooManyImages
	}

	return s.repo.AddImage(ctx, quizID, teacherID, url)
}
