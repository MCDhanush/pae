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

// RegisterParams holds all fields needed to register a new user.
type RegisterParams struct {
	Name            string
	Email           string
	Password        string
	Role            string
	Institution     string
	InstitutionType string
	Location        string
	YearsOfExp      int
	Bio             string
}

// UpdateProfileParams holds fields for updating a user profile.
type UpdateProfileParams struct {
	Name            string
	Institution     string
	InstitutionType string
	Location        string
	YearsOfExp      int
	Bio             string
	CurrentPassword string
	NewPassword     string
}

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
func (s *Service) Register(ctx context.Context, p RegisterParams) (*models.User, error) {
	existing, err := s.repo.FindByEmail(ctx, p.Email)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, fmt.Errorf("auth service register lookup: %w", err)
	}
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("auth service bcrypt: %w", err)
	}

	user := &models.User{
		Name:            p.Name,
		Email:           p.Email,
		Password:        string(hash),
		Role:            p.Role,
		Institution:     p.Institution,
		InstitutionType: p.InstitutionType,
		Location:        p.Location,
		YearsOfExp:      p.YearsOfExp,
		Bio:             p.Bio,
	}

	return s.repo.Create(ctx, user)
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

	token, err := s.GenerateToken(user)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// SetPro upgrades the user to the unlimited plan.
func (s *Service) SetPro(ctx context.Context, userID primitive.ObjectID) error {
	return s.repo.SetPro(ctx, userID)
}

// SetUnlimitedSessions grants unlimited game sessions (₹299 plan — sessions only, not AI).
func (s *Service) SetUnlimitedSessions(ctx context.Context, userID primitive.ObjectID) error {
	return s.repo.SetUnlimitedSessions(ctx, userID)
}

// AddSessionCredits adds extra session cap credits for a user.
func (s *Service) AddSessionCredits(ctx context.Context, userID primitive.ObjectID, credits int) error {
	return s.repo.AddSessionCredits(ctx, userID, credits)
}

// AddAICredits adds extra AI generation credits for a user.
func (s *Service) AddAICredits(ctx context.Context, userID primitive.ObjectID, credits int) error {
	return s.repo.AddAICredits(ctx, userID, credits)
}

// UpdateProfile updates a user's profile data and optionally changes password.
func (s *Service) UpdateProfile(ctx context.Context, userID primitive.ObjectID, p UpdateProfileParams) (*models.User, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("auth service update profile find: %w", err)
	}

	if p.NewPassword != "" {
		if p.CurrentPassword == "" {
			return nil, ErrInvalidCredentials
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(p.CurrentPassword)); err != nil {
			return nil, ErrInvalidCredentials
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(p.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("auth service bcrypt: %w", err)
		}
		user.Password = string(hash)
	}

	if p.Name != "" {
		user.Name = p.Name
	}
	user.Institution = p.Institution
	user.InstitutionType = p.InstitutionType
	user.Location = p.Location
	user.YearsOfExp = p.YearsOfExp
	user.Bio = p.Bio

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("auth service update profile save: %w", err)
	}

	return user, nil
}

// GenerateToken creates and signs a JWT token for the given user, embedding
// IsPro and IsAdmin flags so handlers can bypass free-plan limits without
// extra DB lookups.
func (s *Service) GenerateToken(user *models.User) (string, error) {
	claims := middleware.Claims{
		UserID:            user.ID.Hex(),
		Role:              user.Role,
		IsPro:             user.IsPro,
		IsAdmin:           user.IsAdmin,
		UnlimitedSessions: user.UnlimitedSessions,
		ExtraSessions:     user.ExtraSessions,
		ExtraAI:           user.ExtraAI,
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
