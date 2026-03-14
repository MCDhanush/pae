package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SessionStatus represents the lifecycle state of a quiz session.
type SessionStatus string

const (
	StatusWaiting  SessionStatus = "waiting"
	StatusActive   SessionStatus = "active"
	StatusFinished SessionStatus = "finished"
)

// QuizSession is a live or completed game instance of a quiz.
type QuizSession struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	QuizID          primitive.ObjectID `bson:"quiz_id" json:"quiz_id"`
	TeacherID       primitive.ObjectID `bson:"teacher_id" json:"teacher_id"`
	PIN             string             `bson:"pin" json:"pin"`
	Status          SessionStatus      `bson:"status" json:"status"`
	CurrentQuestion int                `bson:"current_question" json:"current_question"`
	StartedAt       *time.Time         `bson:"started_at,omitempty" json:"started_at,omitempty"`
	EndedAt         *time.Time         `bson:"ended_at,omitempty" json:"ended_at,omitempty"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
}
