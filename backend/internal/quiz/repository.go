package quiz

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

// Repository handles persistence operations for quizzes.
type Repository struct {
	col *mongo.Collection
}

// NewRepository creates a new quiz Repository.
func NewRepository(col *mongo.Collection) *Repository {
	return &Repository{col: col}
}

// Create inserts a new quiz document.
func (r *Repository) Create(ctx context.Context, quiz *models.Quiz) (*models.Quiz, error) {
	quiz.ID = primitive.NewObjectID()
	now := time.Now().UTC()
	quiz.CreatedAt = now
	quiz.UpdatedAt = now

	// Generate IDs for questions that don't have them
	for i := range quiz.Questions {
		if quiz.Questions[i].ID == "" {
			quiz.Questions[i].ID = primitive.NewObjectID().Hex()
			fmt.Printf("[Quiz] Generated question ID for question %d: %s\n", i, quiz.Questions[i].ID)
		}
	}

	if _, err := r.col.InsertOne(ctx, quiz); err != nil {
		return nil, fmt.Errorf("quiz repo create: %w", err)
	}

	return quiz, nil
}

// FindByID retrieves a quiz by its ObjectID.
func (r *Repository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Quiz, error) {
	var quiz models.Quiz
	if err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&quiz); err != nil {
		return nil, fmt.Errorf("quiz repo find by id: %w", err)
	}
	return &quiz, nil
}

// FindByTeacherID returns all quizzes belonging to a teacher, sorted newest
// first.
func (r *Repository) FindByTeacherID(ctx context.Context, teacherID primitive.ObjectID) ([]models.Quiz, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.col.Find(ctx, bson.M{"teacher_id": teacherID}, opts)
	if err != nil {
		return nil, fmt.Errorf("quiz repo find by teacher: %w", err)
	}
	defer cursor.Close(ctx)

	var quizzes []models.Quiz
	if err := cursor.All(ctx, &quizzes); err != nil {
		return nil, fmt.Errorf("quiz repo decode list: %w", err)
	}

	return quizzes, nil
}

// Update replaces the mutable fields of an existing quiz.
func (r *Repository) Update(ctx context.Context, quiz *models.Quiz) (*models.Quiz, error) {
	quiz.UpdatedAt = time.Now().UTC()

	// Generate IDs for questions that don't have them
	for i := range quiz.Questions {
		if quiz.Questions[i].ID == "" {
			quiz.Questions[i].ID = primitive.NewObjectID().Hex()
		}
	}

	filter := bson.M{"_id": quiz.ID, "teacher_id": quiz.TeacherID}
	update := bson.M{
		"$set": bson.M{
			"title":       quiz.Title,
			"description": quiz.Description,
			"images":      quiz.Images,
			"questions":   quiz.Questions,
			"is_public":   quiz.IsPublic,
			"category":    quiz.Category,
			"updated_at":  quiz.UpdatedAt,
		},
	}

	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, fmt.Errorf("quiz repo update: %w", err)
	}
	if res.MatchedCount == 0 {
		return nil, mongo.ErrNoDocuments
	}

	return quiz, nil
}

// Delete removes a quiz by ID, scoped to the owning teacher.
func (r *Repository) Delete(ctx context.Context, id, teacherID primitive.ObjectID) error {
	res, err := r.col.DeleteOne(ctx, bson.M{"_id": id, "teacher_id": teacherID})
	if err != nil {
		return fmt.Errorf("quiz repo delete: %w", err)
	}
	if res.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// AddImage appends a GCS URL to the quiz's images array.
func (r *Repository) AddImage(ctx context.Context, quizID, teacherID primitive.ObjectID, url string) error {
	filter := bson.M{"_id": quizID, "teacher_id": teacherID}
	update := bson.M{
		"$push": bson.M{"images": url},
		"$set":  bson.M{"updated_at": time.Now().UTC()},
	}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("quiz repo add image: %w", err)
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// Count returns the total number of quizzes in the collection.
func (r *Repository) Count(ctx context.Context) (int64, error) {
	return r.col.CountDocuments(ctx, bson.M{})
}

// FindPublic returns public quizzes, optionally filtered by category and search term.
func (r *Repository) FindPublic(ctx context.Context, category, search string) ([]models.Quiz, error) {
	filter := bson.M{"is_public": true}
	if category != "" {
		filter["category"] = category
	}
	if search != "" {
		filter["title"] = bson.M{"$regex": search, "$options": "i"}
	}
	opts := options.Find().SetSort(bson.D{{Key: "usage_count", Value: -1}, {Key: "created_at", Value: -1}})
	cursor, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("quiz repo find public: %w", err)
	}
	defer cursor.Close(ctx)
	var quizzes []models.Quiz
	if err := cursor.All(ctx, &quizzes); err != nil {
		return nil, fmt.Errorf("quiz repo decode public: %w", err)
	}
	return quizzes, nil
}

// SetPublic toggles the is_public flag on a quiz (teacher-scoped).
func (r *Repository) SetPublic(ctx context.Context, quizID, teacherID primitive.ObjectID, isPublic bool) error {
	filter := bson.M{"_id": quizID, "teacher_id": teacherID}
	update := bson.M{"$set": bson.M{"is_public": isPublic, "updated_at": time.Now().UTC()}}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("quiz repo set public: %w", err)
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// IncrUsageCount atomically increments usage_count of a quiz.
func (r *Repository) IncrUsageCount(ctx context.Context, quizID primitive.ObjectID) {
	_, _ = r.col.UpdateOne(ctx, bson.M{"_id": quizID}, bson.M{"$inc": bson.M{"usage_count": 1}})
}
