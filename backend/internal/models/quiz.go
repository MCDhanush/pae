package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Quiz represents a quiz created by a teacher.
type Quiz struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TeacherID   primitive.ObjectID `bson:"teacher_id" json:"teacher_id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Images      []string           `bson:"images" json:"images"` // GCS URLs, max 3
	Questions   []Question         `bson:"questions" json:"questions"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}
