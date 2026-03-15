package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/pae/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Repository handles persistence operations for users.
type Repository struct {
	col *mongo.Collection
}

// NewRepository creates a new auth Repository backed by the given collection.
func NewRepository(col *mongo.Collection) *Repository {
	return &Repository{col: col}
}

// Create inserts a new user document and returns the created user with its ID
// populated.
func (r *Repository) Create(ctx context.Context, user *models.User) (*models.User, error) {
	user.ID = primitive.NewObjectID()
	user.CreatedAt = time.Now().UTC()

	if _, err := r.col.InsertOne(ctx, user); err != nil {
		return nil, fmt.Errorf("auth repo create: %w", err)
	}

	return user, nil
}

// FindByEmail looks up a user by email address. Returns mongo.ErrNoDocuments
// if the user does not exist.
func (r *Repository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	if err := r.col.FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByID looks up a user by its ObjectID. Returns mongo.ErrNoDocuments if
// the user does not exist.
func (r *Repository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	var user models.User
	if err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&user); err != nil {
		return nil, fmt.Errorf("auth repo find by id: %w", err)
	}
	return &user, nil
}

// SetPro marks the user as a pro subscriber (unlimited sessions + AI).
func (r *Repository) SetPro(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"is_pro": true}},
	)
	return err
}

// SetUnlimitedSessions marks the user as having unlimited game sessions (₹299 plan).
func (r *Repository) SetUnlimitedSessions(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"unlimited_sessions": true}},
	)
	return err
}

// AddSessionCredits increments the user's extra_sessions counter by credits.
func (r *Repository) AddSessionCredits(ctx context.Context, id primitive.ObjectID, credits int) error {
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{"$inc": bson.M{"extra_sessions": credits}},
	)
	return err
}

// AddAICredits increments the user's extra_ai counter by credits.
func (r *Repository) AddAICredits(ctx context.Context, id primitive.ObjectID, credits int) error {
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{"$inc": bson.M{"extra_ai": credits}},
	)
	return err
}

// Update saves all fields of the user document.
func (r *Repository) Update(ctx context.Context, user *models.User) error {
	filter := bson.M{"_id": user.ID}
	update := bson.M{"$set": bson.M{
		"name":             user.Name,
		"password":         user.Password,
		"institution":      user.Institution,
		"institution_type": user.InstitutionType,
		"location":         user.Location,
		"years_of_exp":     user.YearsOfExp,
		"bio":              user.Bio,
	}}
	if _, err := r.col.UpdateOne(ctx, filter, update); err != nil {
		return fmt.Errorf("auth repo update: %w", err)
	}
	return nil
}
