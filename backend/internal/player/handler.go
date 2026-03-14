package player

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
)

// Handler holds dependencies for player HTTP handlers.
type Handler struct {
	service  *Service
	validate *validator.Validate
}

// NewHandler creates a new player Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{
		service:  service,
		validate: validator.New(),
	}
}

// --- DTOs ---

type joinRequest struct {
	PIN      string `json:"pin" validate:"required,len=6"`
	Nickname string `json:"nickname" validate:"required,min=1,max=50"`
}

type joinResponse struct {
	PlayerID  string `json:"player_id"`
	Nickname  string `json:"nickname"`
	SessionID string `json:"session_id"`
}

type submitAnswerRequest struct {
	PIN        string `json:"pin" validate:"required"`
	QuestionID string `json:"question_id" validate:"required"`
	Answer     string `json:"answer" validate:"required"`
	TimeLeft   int    `json:"time_left"`
	TotalTime  int    `json:"total_time"`
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// --- Handlers ---

// Join handles POST /api/players/join.
func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	var req joinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	p, err := h.service.Join(r.Context(), req.PIN, req.Nickname, nil)
	if err != nil {
		switch {
		case errors.Is(err, ErrSessionNotFound):
			writeError(w, http.StatusNotFound, "session not found")
		case errors.Is(err, ErrSessionNotJoinable):
			writeError(w, http.StatusConflict, "session is not accepting players")
		default:
			writeError(w, http.StatusInternalServerError, "failed to join session")
		}
		return
	}

	writeJSON(w, http.StatusCreated, joinResponse{
		PlayerID:  p.ID.Hex(),
		Nickname:  p.Nickname,
		SessionID: p.SessionID.Hex(),
	})
}

// SubmitAnswer handles POST /api/players/{player_id}/answer.
func (h *Handler) SubmitAnswer(w http.ResponseWriter, r *http.Request) {
	playerID := chi.URLParam(r, "player_id")
	if playerID == "" {
		writeError(w, http.StatusBadRequest, "player_id is required")
		return
	}

	var req submitAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fmt.Printf("[Backend] Raw request after JSON decode: PIN=%s, QuestionID=%s, Answer=%s, TimeLeft=%d, TotalTime=%d\n",
		req.PIN, req.QuestionID, req.Answer, req.TimeLeft, req.TotalTime)

	// Manual validation instead of struct tags
	if req.PIN == "" {
		writeError(w, http.StatusUnprocessableEntity, "pin is required")
		return
	}
	if req.QuestionID == "" {
		writeError(w, http.StatusUnprocessableEntity, "question_id is required")
		return
	}
	if req.Answer == "" {
		writeError(w, http.StatusUnprocessableEntity, "answer is required")
		return
	}

	fmt.Printf("[Backend] Answer received: playerID=%s, pin=%s, questionID=%s, answer=%s, timeLeft=%d, totalTime=%d\n",
		playerID, req.PIN, req.QuestionID, req.Answer, req.TimeLeft, req.TotalTime)

	result, err := h.service.SubmitAnswer(
		r.Context(),
		req.PIN, playerID, req.QuestionID, req.Answer,
		req.TimeLeft, req.TotalTime,
	)
	if err != nil {
		fmt.Printf("[Backend] Error submitting answer: %v\n", err)
		switch {
		case errors.Is(err, ErrSessionNotFound):
			writeError(w, http.StatusNotFound, "session not found")
		case errors.Is(err, ErrQuestionNotFound):
			writeError(w, http.StatusNotFound, "question not found")
		case errors.Is(err, ErrAlreadyAnswered):
			writeError(w, http.StatusConflict, "already answered this question")
		default:
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	fmt.Printf("[Backend] Answer stored successfully: isCorrect=%v, points=%d, totalScore=%d\n",
		result.IsCorrect, result.Points, result.TotalScore)

	writeJSON(w, http.StatusOK, result)
}
