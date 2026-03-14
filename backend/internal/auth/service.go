package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pae/backend/internal/middleware"
	"github.com/pae/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

// ErrInvalidCredentials is returned when email/password do not match.
var ErrInvalidCredentials = errors.New("invalid email or password")

// ErrEmailTaken is returned when a registration email is already in use.
var ErrEmailTaken = errors.New("email already registered")

// Service provides authentication business logic.
type Service struct {
	repo      *Repository
	jwtSecret string
}

// NewService creates a new auth Service.
func NewService(repo *Repository, jwtSecret string) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret}
}

// Register hashes the password with bcrypt and creates a new user record.
// Returns ErrEmailTaken if the email is already registered.
func (s *Service) Register(ctx context.Context, name, email, password, role string) (*models.User, error) {
	// Check uniqueness.
	existing, err := s.repo.FindByEmail(ctx, email)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, fmt.Errorf("auth service register lookup: %w", err)
	}
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("auth service bcrypt: %w", err)
	}

	user := &models.User{
		Name:     name,
		Email:    email,
		Password: string(hash),
		Role:     role,
	}

	created, err := s.repo.Create(ctx, user)
	if err != nil {
		return nil, err
	}

	return created, nil
}

// Login verifies the password against the stored bcrypt hash and returns a
// signed JWT token on success.
func (s *Service) Login(ctx context.Context, email, password string) (string, *models.User, error) {
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return "", nil, ErrInvalidCredentials
		}
		return "", nil, fmt.Errorf("auth service login lookup: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", nil, ErrInvalidCredentials
	}

	token, err := s.GenerateToken(user.ID, user.Role)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// GenerateToken creates and signs a JWT token for the given user ID and role
// with a 24-hour expiry.
func (s *Service) GenerateToken(userID primitive.ObjectID, role string) (string, error) {
	claims := middleware.Claims{
		UserID: userID.Hex(),
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("auth service sign token: %w", err)
	}

	return signed, nil
}

// GetByID returns the user with the given ObjectID.
func (s *Service) GetByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	return s.repo.FindByID(ctx, id)
}
