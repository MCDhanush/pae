package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PlatformStats holds aggregated statistics about the entire platform.
// There is typically one document in the collection that is upserted on changes.
type PlatformStats struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TotalQuizzes      int64              `bson:"total_quizzes" json:"total_quizzes"`
	TotalSessions     int64              `bson:"total_sessions" json:"total_sessions"`
	TotalParticipants int64              `bson:"total_participants" json:"total_participants"`
	TotalTeachers     int64              `bson:"total_teachers" json:"total_teachers"`
	UpdatedAt         time.Time          `bson:"updated_at" json:"updated_at"`
}
