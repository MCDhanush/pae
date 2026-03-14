package socket

// Event type constants used in WebSocket messages.
// Frontend SOCKET_EVENTS values MUST match these strings.
const (
	EventPlayerJoin    = "player_join"
	EventPlayerLeave   = "player_leave"
	EventGameStart     = "game_start"
	EventQuestionStart = "question_start"
	EventQuestionEnd   = "question_end"
	EventTimerUpdate   = "timer_update"
	EventAnswerSubmit  = "answer_submit"
	EventAnswerResult  = "answer_result"
	EventLeaderboard   = "leaderboard_update"
	EventGameEnd       = "game_end"
	EventError         = "error"
)

// Message is the envelope for all WebSocket communication.
type Message struct {
	Event   string      `json:"event"`
	Payload interface{} `json:"payload"`
}

// PlayerPayload is broadcast when a player joins the lobby.
// Matches the frontend Player type so the host lobby list works directly.
type PlayerPayload struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	Score     int    `json:"score"`
	SessionID string `json:"session_id"`
	JoinedAt  string `json:"joined_at"`
}

// PlayerLeavePayload is sent when a player disconnects.
type PlayerLeavePayload struct {
	PlayerID string `json:"player_id"`
	Nickname string `json:"nickname"`
}

// GameStartPayload is broadcast when the teacher starts the game.
type GameStartPayload struct {
	PIN string `json:"pin"`
}

// QuestionStartPayload is broadcast when a new question begins.
type QuestionStartPayload struct {
	QuestionIndex  int         `json:"question_index"`
	TotalQuestions int         `json:"total_questions"`
	Question       interface{} `json:"question"`
	TimeLimit      int         `json:"time_limit"`
}

// QuestionEndPayload is broadcast when a question's timer expires.
type QuestionEndPayload struct {
	CorrectAnswer string `json:"correct_answer"`
}

// TimerUpdatePayload is sent on each tick of the countdown.
type TimerUpdatePayload struct {
	Remaining int `json:"remaining"`
}

// AnswerSubmitPayload is sent by a player to submit their answer.
type AnswerSubmitPayload struct {
	PlayerID   string `json:"player_id"`
	QuestionID string `json:"question_id"`
	Answer     string `json:"answer"`
	TimeLeft   int    `json:"time_left"`
	TotalTime  int    `json:"total_time"`
}

// AnswerResultPayload is sent back to the answering player.
type AnswerResultPayload struct {
	IsCorrect bool   `json:"is_correct"`
	Points    int    `json:"points"`
	TotalScore int   `json:"total_score"`
}

// LeaderboardEntry is a single row in the leaderboard.
type LeaderboardEntry struct {
	PlayerID string `json:"player_id"`
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
	Rank     int    `json:"rank"`
}

// LeaderboardPayload is broadcast after each question.
type LeaderboardPayload struct {
	Entries []LeaderboardEntry `json:"entries"`
}

// GameEndPayload is broadcast when the teacher ends the game.
type GameEndPayload struct {
	PIN              string             `json:"pin"`
	FinalLeaderboard []LeaderboardEntry `json:"final_leaderboard"`
}

// ErrorPayload wraps an error message for the client.
type ErrorPayload struct {
	Message string `json:"message"`
}
