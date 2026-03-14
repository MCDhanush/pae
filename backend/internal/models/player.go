package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Player represents a participant in a quiz session.
type Player struct {
	ID        primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	SessionID primitive.ObjectID  `bson:"session_id" json:"session_id"`
	UserID    *primitive.ObjectID `bson:"user_id,omitempty" json:"user_id,omitempty"`
	Nickname  string              `bson:"nickname" json:"nickname"`
	Score     int                 `bson:"score" json:"score"`
	Answers   []PlayerAnswer      `bson:"answers" json:"answers"`
	JoinedAt  time.Time           `bson:"joined_at" json:"joined_at"`
}

// PlayerAnswer records the player's response to a single question.
type PlayerAnswer struct {
	QuestionID string    `bson:"question_id" json:"question_id"`
	Answer     string    `bson:"answer" json:"answer"`
	IsCorrect  bool      `bson:"is_correct" json:"is_correct"`
	Points     int       `bson:"points" json:"points"`
	AnsweredAt time.Time `bson:"answered_at" json:"answered_at"`
}
