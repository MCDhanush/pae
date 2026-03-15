package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Quiz represents a quiz created by a teacher.
type Quiz struct {
	ID           primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	TeacherID    primitive.ObjectID  `bson:"teacher_id" json:"teacher_id"`
	TeacherName  string              `bson:"teacher_name,omitempty" json:"teacher_name,omitempty"`
	Title        string              `bson:"title" json:"title"`
	Description  string              `bson:"description" json:"description"`
	Category     string              `bson:"category,omitempty" json:"category,omitempty"`
	Images       []string            `bson:"images" json:"images"` // GCS URLs, max 3
	Questions    []Question          `bson:"questions" json:"questions"`
	IsPublic     bool                `bson:"is_public" json:"is_public"`
	UsageCount   int                 `bson:"usage_count" json:"usage_count"`
	// SourceID is set on imported quizzes to point to the original marketplace quiz.
	SourceID     *primitive.ObjectID `bson:"source_id,omitempty" json:"source_id,omitempty"`
	CreatedAt    time.Time           `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time           `bson:"updated_at" json:"updated_at"`
}
