package analytics

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

// ─── DTOs ─────────────────────────────────────────────────────────────────────

// LeaderboardEntry is a ranked player result.
type LeaderboardEntry struct {
	PlayerID string `json:"player_id"`
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
	Rank     int    `json:"rank"`
}

// QuestionStat holds per-question analytics for a session.
type QuestionStat struct {
	QuestionID           string             `json:"question_id"`
	QuestionText         string             `json:"question_text"`
	CorrectCount         int                `json:"correct_count"`
	TotalAnswers         int                `json:"total_answers"`
	AccuracyPct          float64            `json:"accuracy_pct"`
	AvgTimeLeft          float64            `json:"avg_time_left"`
	AnswerDistribution   map[string]int     `json:"answer_distribution"`
}

// SessionAnalytics is the response for GET /api/analytics/sessions/{id}.
type SessionAnalytics struct {
	SessionID       string             `json:"session_id"`
	QuizTitle       string             `json:"quiz_title"`
	TotalPlayers    int                `json:"total_players"`
	TotalQuestions  int                `json:"total_questions"`
	AvgScore        float64            `json:"avg_score"`
	CompletionRate  float64            `json:"completion_rate"`
	Leaderboard     []LeaderboardEntry `json:"leaderboard"`
	QuestionStats   []QuestionStat     `json:"question_stats"`
}

// QuestionDifficulty aggregates accuracy across sessions for a question.
type QuestionDifficulty struct {
	QuestionID     string  `json:"question_id"`
	Text           string  `json:"text"`
	AvgAccuracyPct float64 `json:"avg_accuracy_pct"`
}

// QuizAnalytics is the response for GET /api/analytics/quizzes/{id}.
type QuizAnalytics struct {
	QuizID              string               `json:"quiz_id"`
	QuizTitle           string               `json:"quiz_title"`
	TotalSessions       int                  `json:"total_sessions"`
	TotalPlayers        int                  `json:"total_players"`
	AvgScorePerSession  float64              `json:"avg_score_per_session"`
	QuestionDifficulty  []QuestionDifficulty `json:"question_difficulty"`
}

// MonthlyCount is a (year-month label, count) pair.
type MonthlyCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

// OverviewAnalytics is the response for GET /api/analytics/overview.
type OverviewAnalytics struct {
	TotalQuizzes        int64          `json:"total_quizzes"`
	TotalSessions       int64          `json:"total_sessions"`
	TotalStudents       int64          `json:"total_students"`
	AvgScoreAllSessions float64        `json:"avg_score_all_sessions"`
	SessionsPerMonth    []MonthlyCount `json:"sessions_per_month"`
}

// ─── Service ──────────────────────────────────────────────────────────────────

// Service provides on-demand analytics by querying MongoDB.
type Service struct {
	players  *mongo.Collection
	sessions *mongo.Collection
	quizzes  *mongo.Collection
}

// NewService creates a new analytics Service.
func NewService(players, sessions, quizzes *mongo.Collection) *Service {
	return &Service{
		players:  players,
		sessions: sessions,
		quizzes:  quizzes,
	}
}

// GetSessionAnalytics computes analytics for a single quiz session.
// teacherID is used to verify ownership.
func (s *Service) GetSessionAnalytics(ctx context.Context, sessionIDHex, teacherIDHex string) (*SessionAnalytics, error) {
	sessionOID, err := primitive.ObjectIDFromHex(sessionIDHex)
	if err != nil {
		return nil, fmt.Errorf("invalid session_id: %w", err)
	}
	teacherOID, err := primitive.ObjectIDFromHex(teacherIDHex)
	if err != nil {
		return nil, fmt.Errorf("invalid teacher_id: %w", err)
	}

	// Load session.
	var sess models.QuizSession
	if err := s.sessions.FindOne(ctx, bson.M{"_id": sessionOID, "teacher_id": teacherOID}).Decode(&sess); err != nil {
		return nil, fmt.Errorf("session not found or not owned by teacher: %w", err)
	}

	// Load quiz.
	var quiz models.Quiz
	if err := s.quizzes.FindOne(ctx, bson.M{"_id": sess.QuizID}).Decode(&quiz); err != nil {
		return nil, fmt.Errorf("quiz not found: %w", err)
	}

	// Load all players for session.
	cursor, err := s.players.Find(ctx, bson.M{"session_id": sessionOID},
		options.Find().SetSort(bson.D{{Key: "score", Value: -1}}))
	if err != nil {
		return nil, fmt.Errorf("players query: %w", err)
	}
	defer cursor.Close(ctx)

	var players []models.Player
	if err := cursor.All(ctx, &players); err != nil {
		return nil, fmt.Errorf("decode players: %w", err)
	}

	totalPlayers := len(players)
	totalQuestions := len(quiz.Questions)

	// Leaderboard.
	leaderboard := make([]LeaderboardEntry, totalPlayers)
	var scoreSum float64
	for i, p := range players {
		leaderboard[i] = LeaderboardEntry{
			PlayerID: p.ID.Hex(),
			Nickname: p.Nickname,
			Score:    p.Score,
			Rank:     i + 1,
		}
		scoreSum += float64(p.Score)
	}

	avgScore := 0.0
	if totalPlayers > 0 {
		avgScore = scoreSum / float64(totalPlayers)
	}

	// Completion rate: players who answered all questions.
	completedCount := 0
	for _, p := range players {
		if len(p.Answers) == totalQuestions {
			completedCount++
		}
	}
	completionRate := 0.0
	if totalPlayers > 0 {
		completionRate = float64(completedCount) / float64(totalPlayers)
	}

	// Per-question stats.
	questionStats := make([]QuestionStat, 0, totalQuestions)
	for _, q := range quiz.Questions {
		stat := QuestionStat{
			QuestionID:         q.ID,
			QuestionText:       q.Text,
			AnswerDistribution: make(map[string]int),
		}

		var timeLeftSum float64
		for _, p := range players {
			for _, a := range p.Answers {
				if a.QuestionID != q.ID {
					continue
				}
				stat.TotalAnswers++
				if a.IsCorrect {
					stat.CorrectCount++
				}
				stat.AnswerDistribution[a.Answer]++
				timeLeftSum += float64(a.Points) // We don't store time_left on answer, use a proxy
			}
		}

		if stat.TotalAnswers > 0 {
			stat.AccuracyPct = float64(stat.CorrectCount) / float64(stat.TotalAnswers) * 100
			stat.AvgTimeLeft = timeLeftSum / float64(stat.TotalAnswers)
		}

		questionStats = append(questionStats, stat)
	}

	return &SessionAnalytics{
		SessionID:      sessionIDHex,
		QuizTitle:      quiz.Title,
		TotalPlayers:   totalPlayers,
		TotalQuestions: totalQuestions,
		AvgScore:       avgScore,
		CompletionRate: completionRate,
		Leaderboard:    leaderboard,
		QuestionStats:  questionStats,
	}, nil
}

// GetQuizAnalytics computes aggregate analytics across all sessions of a quiz.
func (s *Service) GetQuizAnalytics(ctx context.Context, quizIDHex, teacherIDHex string) (*QuizAnalytics, error) {
	quizOID, err := primitive.ObjectIDFromHex(quizIDHex)
	if err != nil {
		return nil, fmt.Errorf("invalid quiz_id: %w", err)
	}
	teacherOID, err := primitive.ObjectIDFromHex(teacherIDHex)
	if err != nil {
		return nil, fmt.Errorf("invalid teacher_id: %w", err)
	}

	// Load quiz (verify ownership).
	var quiz models.Quiz
	if err := s.quizzes.FindOne(ctx, bson.M{"_id": quizOID, "teacher_id": teacherOID}).Decode(&quiz); err != nil {
		return nil, fmt.Errorf("quiz not found or not owned by teacher: %w", err)
	}

	// Find all sessions for this quiz.
	sessionsCursor, err := s.sessions.Find(ctx, bson.M{"quiz_id": quizOID})
	if err != nil {
		return nil, fmt.Errorf("sessions query: %w", err)
	}
	defer sessionsCursor.Close(ctx)

	var allSessions []models.QuizSession
	if err := sessionsCursor.All(ctx, &allSessions); err != nil {
		return nil, fmt.Errorf("decode sessions: %w", err)
	}

	totalSessions := len(allSessions)
	totalPlayers := 0
	var totalScoreSum float64

	// Per-question accuracy accumulators: map[questionID] -> {correct, total}
	type qAccum struct{ correct, total int }
	qAccumMap := make(map[string]*qAccum)
	for _, q := range quiz.Questions {
		qAccumMap[q.ID] = &qAccum{}
	}

	// Collect all session IDs and bulk-fetch all players in one query.
	sessionIDs := make([]primitive.ObjectID, len(allSessions))
	for i, sess := range allSessions {
		sessionIDs[i] = sess.ID
	}

	var allPlayers []models.Player
	if len(sessionIDs) > 0 {
		pCursor, pErr := s.players.Find(ctx, bson.M{"session_id": bson.M{"$in": sessionIDs}})
		if pErr == nil {
			_ = pCursor.All(ctx, &allPlayers)
			pCursor.Close(ctx)
		}
	}

	for _, p := range allPlayers {
		totalPlayers++
		totalScoreSum += float64(p.Score)
		for _, a := range p.Answers {
			if acc, ok := qAccumMap[a.QuestionID]; ok {
				acc.total++
				if a.IsCorrect {
					acc.correct++
				}
			}
		}
	}

	avgScorePerSession := 0.0
	if totalSessions > 0 && totalPlayers > 0 {
		avgScorePerSession = totalScoreSum / float64(totalSessions)
	}

	// Build question difficulty slice preserving quiz order.
	difficulty := make([]QuestionDifficulty, 0, len(quiz.Questions))
	for _, q := range quiz.Questions {
		acc := qAccumMap[q.ID]
		avgAccuracy := 0.0
		if acc.total > 0 {
			avgAccuracy = float64(acc.correct) / float64(acc.total) * 100
		}
		difficulty = append(difficulty, QuestionDifficulty{
			QuestionID:     q.ID,
			Text:           q.Text,
			AvgAccuracyPct: avgAccuracy,
		})
	}

	return &QuizAnalytics{
		QuizID:             quizIDHex,
		QuizTitle:          quiz.Title,
		TotalSessions:      totalSessions,
		TotalPlayers:       totalPlayers,
		AvgScorePerSession: avgScorePerSession,
		QuestionDifficulty: difficulty,
	}, nil
}

// GetOverview returns the teacher's overall analytics overview.
func (s *Service) GetOverview(ctx context.Context, teacherIDHex string) (*OverviewAnalytics, error) {
	teacherOID, err := primitive.ObjectIDFromHex(teacherIDHex)
	if err != nil {
		return nil, fmt.Errorf("invalid teacher_id: %w", err)
	}

	// Count teacher's quizzes.
	totalQuizzes, err := s.quizzes.CountDocuments(ctx, bson.M{"teacher_id": teacherOID})
	if err != nil {
		return nil, fmt.Errorf("count quizzes: %w", err)
	}

	// Find all sessions — derive the count from the slice to avoid a redundant CountDocuments.
	sessionsCursor, err := s.sessions.Find(ctx, bson.M{"teacher_id": teacherOID})
	if err != nil {
		return nil, fmt.Errorf("sessions query: %w", err)
	}
	defer sessionsCursor.Close(ctx)

	var allSessions []models.QuizSession
	if err := sessionsCursor.All(ctx, &allSessions); err != nil {
		return nil, fmt.Errorf("decode sessions: %w", err)
	}
	totalSessions := int64(len(allSessions))

	var totalStudents int64
	var totalScoreSum float64

	// Accumulate sessions per month for last 6 months.
	monthlyMap := make(map[string]int)
	now := time.Now().UTC()
	for i := 0; i < 6; i++ {
		m := now.AddDate(0, -i, 0)
		label := m.Format("2006-01")
		monthlyMap[label] = 0
	}

	// Bucket sessions into monthly map in a single pass.
	for _, sess := range allSessions {
		label := sess.CreatedAt.UTC().Format("2006-01")
		if _, ok := monthlyMap[label]; ok {
			monthlyMap[label]++
		}
	}

	// Bulk-fetch all players for all sessions in one query instead of 2N queries.
	overviewSessionIDs := make([]primitive.ObjectID, len(allSessions))
	for i, sess := range allSessions {
		overviewSessionIDs[i] = sess.ID
	}
	if len(overviewSessionIDs) > 0 {
		pCursor, pErr := s.players.Find(ctx, bson.M{"session_id": bson.M{"$in": overviewSessionIDs}})
		if pErr == nil {
			var allPlayers []models.Player
			_ = pCursor.All(ctx, &allPlayers)
			pCursor.Close(ctx)
			totalStudents = int64(len(allPlayers))
			for _, p := range allPlayers {
				totalScoreSum += float64(p.Score)
			}
		}
	}

	avgScore := 0.0
	if totalStudents > 0 {
		avgScore = totalScoreSum / float64(totalStudents)
	}

	// Build sorted months (last 6, oldest first).
	sessionsPerMonth := make([]MonthlyCount, 0, 6)
	for i := 5; i >= 0; i-- {
		m := now.AddDate(0, -i, 0)
		label := m.Format("2006-01")
		sessionsPerMonth = append(sessionsPerMonth, MonthlyCount{
			Month: label,
			Count: monthlyMap[label],
		})
	}

	return &OverviewAnalytics{
		TotalQuizzes:        totalQuizzes,
		TotalSessions:       totalSessions,
		TotalStudents:       totalStudents,
		AvgScoreAllSessions: avgScore,
		SessionsPerMonth:    sessionsPerMonth,
	}, nil
}
