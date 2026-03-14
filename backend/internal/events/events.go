package events

import (
	"context"
	"encoding/json"
	"fmt"
)

// ─── Topic builders ────────────────────────────────────────────────────────────

// BroadcastTopic returns the MQTT topic for room-wide events (all participants).
func BroadcastTopic(pin string) string {
	return fmt.Sprintf("pae/game/%s/broadcast", pin)
}

// LobbyTopic returns the MQTT topic for lobby events (player join / leave).
func LobbyTopic(pin string) string {
	return fmt.Sprintf("pae/game/%s/lobby", pin)
}

// PlayerTopic returns the MQTT topic for per-player messages (e.g. answer result).
func PlayerTopic(pin, playerID string) string {
	return fmt.Sprintf("pae/game/%s/player/%s/result", pin, playerID)
}

// ─── Publisher interface ───────────────────────────────────────────────────────

// Publisher sends game events to an MQTT broker.
type Publisher interface {
	// Publish wraps event + payload in a JSON envelope and publishes to topic.
	Publish(ctx context.Context, topic, event string, payload interface{}) error
	// Close cleanly disconnects.
	Close()
}

// ─── Event name constants ──────────────────────────────────────────────────────

const (
	EventPlayerJoin          = "player_join"
	EventPlayerLeave         = "player_leave"
	EventGameStart           = "game_start"
	EventQuestionStart       = "question_start"
	EventQuestionEnd         = "question_end"
	EventTimerUpdate         = "timer_update"
	EventAnswerResult        = "answer_result"
	EventLeaderboard         = "leaderboard_update"
	EventGameEnd             = "game_end"
	EventAnswerDistribution  = "answer_distribution"
)

// ─── Message envelope ─────────────────────────────────────────────────────────

// Message is the JSON object published to every MQTT topic.
type Message struct {
	Event   string      `json:"event"`
	Payload interface{} `json:"payload"`
}

// marshalMessage serialises event + payload into a Message JSON byte slice.
func marshalMessage(event string, payload interface{}) ([]byte, error) {
	return json.Marshal(Message{Event: event, Payload: payload})
}

// ─── Payload types ─────────────────────────────────────────────────────────────

// PlayerJoinPayload is published when a player joins the lobby.
type PlayerJoinPayload struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	Score     int    `json:"score"`
	SessionID string `json:"session_id"`
	JoinedAt  string `json:"joined_at"`
}

// GameStartPayload is published when the teacher starts the game.
type GameStartPayload struct {
	PIN string `json:"pin"`
}

// QuestionStartPayload is published when a new question begins.
type QuestionStartPayload struct {
	QuestionIndex  int         `json:"question_index"`
	TotalQuestions int         `json:"total_questions"`
	Question       interface{} `json:"question"`
	TimeLimit      int         `json:"time_limit"`
}

// QuestionEndPayload is published when a question timer expires.
type QuestionEndPayload struct {
	CorrectAnswer string `json:"correct_answer"`
}

// TimerUpdatePayload is published on each timer tick.
type TimerUpdatePayload struct {
	Remaining int `json:"remaining"`
}

// LeaderboardEntry is one row in the leaderboard.
type LeaderboardEntry struct {
	PlayerID string `json:"player_id"`
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
	Rank     int    `json:"rank"`
}

// LeaderboardPayload is published after each question.
type LeaderboardPayload struct {
	Entries []LeaderboardEntry `json:"entries"`
}

// GameEndPayload is published when the game finishes.
type GameEndPayload struct {
	PIN              string             `json:"pin"`
	FinalLeaderboard []LeaderboardEntry `json:"final_leaderboard"`
}

// AnswerResultPayload is sent back to the answering player.
type AnswerResultPayload struct {
	IsCorrect  bool `json:"is_correct"`
	Points     int  `json:"points"`
	TotalScore int  `json:"total_score"`
}

// AnswerDistributionPayload is broadcast to the teacher after each answer.
type AnswerDistributionPayload struct {
	QuestionID   string         `json:"question_id"`
	Distribution map[string]int `json:"distribution"`
	TotalAnswers int            `json:"total_answers"`
}
