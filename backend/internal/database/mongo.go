package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	dbName                      = "pae_quiz"
	collUsers                   = "users"
	collQuizzes                 = "quizzes"
	collQuizSessions            = "quiz_sessions"
	collPlayers                 = "players"
	collStudentParticipation    = "student_participation"
	collPlatformStats           = "platform_stats"
)

// Database wraps a mongo.Client and exposes typed collection accessors.
type Database struct {
	client *mongo.Client
	db     *mongo.Database
}

// NewDatabase connects to MongoDB at the given URI and returns a Database.
// The function pings the server to verify the connection before returning.
func NewDatabase(ctx context.Context, mongoURI string) (*Database, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("mongo ping: %w", err)
	}

	return &Database{
		client: client,
		db:     client.Database(dbName),
	}, nil
}

// Close disconnects from MongoDB.
func (d *Database) Close(ctx context.Context) error {
	return d.client.Disconnect(ctx)
}

// EnsureIndexes creates all indexes required for the application. It is
// idempotent — MongoDB silently ignores indexes that already exist.
func (d *Database) EnsureIndexes(ctx context.Context) error {
	type indexSpec struct {
		collection string
		keys       bson.D
		unique     bool
	}

	specs := []indexSpec{
		// users — fast login / auth lookup
		{collUsers, bson.D{{Key: "email", Value: 1}}, true},

		// quizzes — teacher dashboard & marketplace queries
		{collQuizzes, bson.D{{Key: "teacher_id", Value: 1}}, false},
		{collQuizzes, bson.D{{Key: "is_public", Value: 1}, {Key: "category", Value: 1}}, false},

		// quiz_sessions — join by PIN, teacher history, quiz analytics
		{collQuizSessions, bson.D{{Key: "pin", Value: 1}}, true},
		{collQuizSessions, bson.D{{Key: "teacher_id", Value: 1}}, false},
		{collQuizSessions, bson.D{{Key: "quiz_id", Value: 1}}, false},

		// players — per-session leaderboard & answer lookup
		{collPlayers, bson.D{{Key: "session_id", Value: 1}}, false},
		{collPlayers, bson.D{{Key: "user_id", Value: 1}}, false},
	}

	for _, s := range specs {
		idxModel := mongo.IndexModel{
			Keys: s.keys,
			Options: options.Index().SetUnique(s.unique).SetBackground(true),
		}
		if _, err := d.db.Collection(s.collection).Indexes().CreateOne(ctx, idxModel); err != nil {
			return fmt.Errorf("ensure index on %s: %w", s.collection, err)
		}
	}
	return nil
}

// Client returns the underlying mongo.Client.
func (d *Database) Client() *mongo.Client {
	return d.client
}

// Users returns the users collection.
func (d *Database) Users() *mongo.Collection {
	return d.db.Collection(collUsers)
}

// Quizzes returns the quizzes collection.
func (d *Database) Quizzes() *mongo.Collection {
	return d.db.Collection(collQuizzes)
}

// QuizSessions returns the quiz_sessions collection.
func (d *Database) QuizSessions() *mongo.Collection {
	return d.db.Collection(collQuizSessions)
}

// Players returns the players collection.
func (d *Database) Players() *mongo.Collection {
	return d.db.Collection(collPlayers)
}

// StudentParticipation returns the student_participation collection.
func (d *Database) StudentParticipation() *mongo.Collection {
	return d.db.Collection(collStudentParticipation)
}

// PlatformStats returns the platform_stats collection.
func (d *Database) PlatformStats() *mongo.Collection {
	return d.db.Collection(collPlatformStats)
}
