package game

import (
	"context"
	"fmt"
	"time"

	"github.com/pae/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Repository handles persistence for quiz sessions.
type Repository struct {
	col *mongo.Collection
}

// NewRepository creates a new game Repository.
func NewRepository(col *mongo.Collection) *Repository {
	return &Repository{col: col}
}

// Create inserts a new quiz session document.
func (r *Repository) Create(ctx context.Context, session *models.QuizSession) (*models.QuizSession, error) {
	session.ID = primitive.NewObjectID()
	session.CreatedAt = time.Now().UTC()

	if _, err := r.col.InsertOne(ctx, session); err != nil {
		return nil, fmt.Errorf("game repo create: %w", err)
	}

	return session, nil
}

// FindByPIN retrieves a session by its PIN code.
func (r *Repository) FindByPIN(ctx context.Context, pin string) (*models.QuizSession, error) {
	var session models.QuizSession
	if err := r.col.FindOne(ctx, bson.M{"pin": pin}).Decode(&session); err != nil {
		return nil, fmt.Errorf("game repo find by pin: %w", err)
	}
	return &session, nil
}

// FindByID retrieves a session by its ObjectID.
func (r *Repository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.QuizSession, error) {
	var session models.QuizSession
	if err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&session); err != nil {
		return nil, fmt.Errorf("game repo find by id: %w", err)
	}
	return &session, nil
}

// FindByTeacherID returns sessions for a teacher, sorted newest first.
func (r *Repository) FindByTeacherID(ctx context.Context, teacherID primitive.ObjectID) ([]models.QuizSession, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.col.Find(ctx, bson.M{"teacher_id": teacherID}, opts)
	if err != nil {
		return nil, fmt.Errorf("game repo find by teacher: %w", err)
	}
	defer cursor.Close(ctx)

	var sessions []models.QuizSession
	if err := cursor.All(ctx, &sessions); err != nil {
		return nil, fmt.Errorf("game repo decode list: %w", err)
	}

	return sessions, nil
}

// UpdateStatus changes the status field of a session.
func (r *Repository) UpdateStatus(ctx context.Context, id primitive.ObjectID, status models.SessionStatus) error {
	update := bson.M{"$set": bson.M{"status": status}}
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return fmt.Errorf("game repo update status: %w", err)
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// UpdateCurrentQuestion increments the current_question counter.
func (r *Repository) UpdateCurrentQuestion(ctx context.Context, id primitive.ObjectID, questionIndex int) error {
	update := bson.M{"$set": bson.M{"current_question": questionIndex}}
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return fmt.Errorf("game repo update question: %w", err)
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// End marks a session as finished and records the end timestamp.
func (r *Repository) End(ctx context.Context, id primitive.ObjectID) error {
	now := time.Now().UTC()
	update := bson.M{
		"$set": bson.M{
			"status":   models.StatusFinished,
			"ended_at": now,
		},
	}
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return fmt.Errorf("game repo end: %w", err)
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// Start marks a session as active and records the start timestamp.
func (r *Repository) Start(ctx context.Context, id primitive.ObjectID) error {
	now := time.Now().UTC()
	update := bson.M{
		"$set": bson.M{
			"status":     models.StatusActive,
			"started_at": now,
		},
	}
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return fmt.Errorf("game repo start: %w", err)
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// Count returns the total number of sessions.
func (r *Repository) Count(ctx context.Context) (int64, error) {
	return r.col.CountDocuments(ctx, bson.M{})
}

// CountByTeacherID returns how many sessions a teacher has created in total.
func (r *Repository) CountByTeacherID(ctx context.Context, teacherID primitive.ObjectID) (int64, error) {
	return r.col.CountDocuments(ctx, bson.M{"teacher_id": teacherID})
}
