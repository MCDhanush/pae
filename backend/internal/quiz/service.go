package quiz

import (
	"context"
	"errors"
	"fmt"
	"time"

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

// ErrAlreadyImported is returned when a teacher tries to import the same quiz twice.
var ErrAlreadyImported = errors.New("quiz already imported")

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

// ListPublic returns marketplace quizzes, optionally filtered by category/search.
func (s *Service) ListPublic(ctx context.Context, category, search string) ([]models.Quiz, error) {
	quizzes, err := s.repo.FindPublic(ctx, category, search)
	if err != nil {
		return nil, fmt.Errorf("quiz service list public: %w", err)
	}
	return quizzes, nil
}

// Publish toggles the is_public flag on a quiz (teacher-owned only).
func (s *Service) Publish(ctx context.Context, quizID, teacherID primitive.ObjectID, isPublic bool) error {
	existing, err := s.GetByID(ctx, quizID)
	if err != nil {
		return err
	}
	if existing.TeacherID != teacherID {
		return ErrUnauthorized
	}
	if err := s.repo.SetPublic(ctx, quizID, teacherID, isPublic); err != nil {
		if err == mongo.ErrNoDocuments {
			return ErrQuizNotFound
		}
		return fmt.Errorf("quiz service publish: %w", err)
	}
	return nil
}

// CopyQuiz duplicates a public quiz into the requesting teacher's library.
func (s *Service) CopyQuiz(ctx context.Context, quizID, teacherID primitive.ObjectID, teacherName string) (*models.Quiz, error) {
	original, err := s.GetByID(ctx, quizID)
	if err != nil {
		return nil, err
	}
	if !original.IsPublic {
		return nil, ErrUnauthorized
	}

	// Prevent duplicate imports by the same teacher.
	exists, err := s.repo.ExistsImport(ctx, teacherID, quizID)
	if err != nil {
		return nil, fmt.Errorf("quiz service copy check: %w", err)
	}
	if exists {
		return nil, ErrAlreadyImported
	}

	// Deep-copy questions with new IDs.
	questions := make([]models.Question, len(original.Questions))
	for i, q := range original.Questions {
		q.ID = primitive.NewObjectID().Hex()
		questions[i] = q
	}

	now := time.Now().UTC()
	copy := &models.Quiz{
		ID:          primitive.NewObjectID(),
		TeacherID:   teacherID,
		TeacherName: teacherName,
		Title:       original.Title,
		Description: original.Description,
		Category:    original.Category,
		Images:      original.Images,
		Questions:   questions,
		IsPublic:    false,
		UsageCount:  0,
		SourceID:    &quizID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	created, err := s.repo.Create(ctx, copy)
	if err != nil {
		return nil, fmt.Errorf("quiz service copy create: %w", err)
	}

	// Increment source usage count asynchronously.
	s.repo.IncrUsageCount(ctx, quizID)

	return created, nil
}

// FindByID is an alias exposed for the analytics interface.
func (s *Service) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error) {
	return s.GetByID(ctx, id)
}
