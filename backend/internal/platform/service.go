package platform

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

// CountableRepository can count documents in its collection.
type CountableRepository interface {
	Count(ctx context.Context) (int64, error)
}

// Service provides platform-level statistics.
type Service struct {
	statsCol     *mongo.Collection
	quizRepo     CountableRepository
	sessionRepo  CountableRepository
	playerRepo   CountableRepository
	userCol      *mongo.Collection
}

// NewService creates a new platform stats Service.
func NewService(
	statsCol *mongo.Collection,
	userCol *mongo.Collection,
	quizRepo CountableRepository,
	sessionRepo CountableRepository,
	playerRepo CountableRepository,
) *Service {
	return &Service{
		statsCol:    statsCol,
		quizRepo:    quizRepo,
		sessionRepo: sessionRepo,
		playerRepo:  playerRepo,
		userCol:     userCol,
	}
}

const statsTTL = 5 * time.Minute

// GetStats returns the latest platform statistics. If no stats document
// exists, or the cached one is older than statsTTL, it recomputes and upserts.
func (s *Service) GetStats(ctx context.Context) (*models.PlatformStats, error) {
	// Try cached document first.
	var stats models.PlatformStats
	err := s.statsCol.FindOne(ctx, bson.M{}).Decode(&stats)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, fmt.Errorf("platform stats find: %w", err)
	}

	// Return cached value if it is still fresh.
	if err == nil && time.Since(stats.UpdatedAt) < statsTTL {
		return &stats, nil
	}

	// Recompute from source collections.
	totalQuizzes, err := s.quizRepo.Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("platform stats count quizzes: %w", err)
	}

	totalSessions, err := s.sessionRepo.Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("platform stats count sessions: %w", err)
	}

	totalParticipants, err := s.playerRepo.Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("platform stats count players: %w", err)
	}

	totalTeachers, err := s.userCol.CountDocuments(ctx, bson.M{"role": "teacher"})
	if err != nil {
		return nil, fmt.Errorf("platform stats count teachers: %w", err)
	}

	stats = models.PlatformStats{
		TotalQuizzes:      totalQuizzes,
		TotalSessions:     totalSessions,
		TotalParticipants: totalParticipants,
		TotalTeachers:     totalTeachers,
		UpdatedAt:         time.Now().UTC(),
	}

	// Upsert the stats document.
	filter := bson.M{}
	update := bson.M{
		"$set": bson.M{
			"total_quizzes":      stats.TotalQuizzes,
			"total_sessions":     stats.TotalSessions,
			"total_participants": stats.TotalParticipants,
			"total_teachers":     stats.TotalTeachers,
			"updated_at":         stats.UpdatedAt,
		},
		"$setOnInsert": bson.M{
			"_id": primitive.NewObjectID(),
		},
	}
	opts := options.Update().SetUpsert(true)

	res, err := s.statsCol.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return nil, fmt.Errorf("platform stats upsert: %w", err)
	}

	if res.UpsertedID != nil {
		if oid, ok := res.UpsertedID.(primitive.ObjectID); ok {
			stats.ID = oid
		}
	}

	return &stats, nil
}
