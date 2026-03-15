package game

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/pae/backend/internal/middleware"
	"github.com/pae/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)


// PlayerFinder is the interface used to retrieve players for a leaderboard.
type PlayerFinder interface {
	FindBySessionID(ctx context.Context, sessionID primitive.ObjectID) ([]models.Player, error)
}

// Handler holds dependencies for game HTTP handlers.
type Handler struct {
	service      *Service
	playerFinder PlayerFinder
	validate     *validator.Validate
}

// NewHandler creates a new game Handler.
func NewHandler(service *Service, playerFinder PlayerFinder) *Handler {
	return &Handler{
		service:      service,
		playerFinder: playerFinder,
		validate:     validator.New(),
	}
}

// --- DTOs ---

type createSessionRequest struct {
	QuizID string `json:"quiz_id" validate:"required"`
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

func teacherIDFromContext(r *http.Request) (primitive.ObjectID, bool) {
	idStr, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		return primitive.NilObjectID, false
	}
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return primitive.NilObjectID, false
	}
	return id, true
}

// --- Handlers ---

// CreateSession handles POST /api/game/sessions.
func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req createSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	quizID, err := primitive.ObjectIDFromHex(req.QuizID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz_id")
		return
	}

	isUnrestricted := middleware.IsUnrestrictedFromContext(r.Context())
	extraSessions := middleware.ExtraSessionsFromContext(r.Context())
	session, err := h.service.CreateSession(r.Context(), quizID, teacherID, isUnrestricted, extraSessions)
	if err != nil {
		if strings.Contains(err.Error(), "session limit reached") {
			writeError(w, http.StatusPaymentRequired, err.Error())
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	writeJSON(w, http.StatusCreated, session)
}

// GetSessionByPIN handles GET /api/game/sessions/{pin}.
func (h *Handler) GetSessionByPIN(w http.ResponseWriter, r *http.Request) {
	pin := chi.URLParam(r, "pin")

	session, err := h.service.GetByPIN(r.Context(), pin)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			writeError(w, http.StatusNotFound, "session not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get session")
		return
	}

	writeJSON(w, http.StatusOK, session)
}

// StartSession handles POST /api/game/sessions/{pin}/start.
func (h *Handler) StartSession(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	pin := chi.URLParam(r, "pin")

	session, err := h.service.StartSession(r.Context(), pin, teacherID)
	if err != nil {
		switch {
		case errors.Is(err, ErrSessionNotFound):
			writeError(w, http.StatusNotFound, "session not found")
		case errors.Is(err, ErrSessionNotWaiting):
			writeError(w, http.StatusConflict, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	writeJSON(w, http.StatusOK, session)
}

// NextQuestion handles POST /api/game/sessions/{pin}/next.
func (h *Handler) NextQuestion(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	pin := chi.URLParam(r, "pin")

	session, err := h.service.NextQuestion(r.Context(), pin, teacherID)
	if err != nil {
		switch {
		case errors.Is(err, ErrSessionNotFound):
			writeError(w, http.StatusNotFound, "session not found")
		case errors.Is(err, ErrSessionNotActive):
			writeError(w, http.StatusConflict, err.Error())
		case errors.Is(err, ErrNoMoreQuestions):
			writeError(w, http.StatusBadRequest, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	writeJSON(w, http.StatusOK, session)
}

// EndSession handles POST /api/game/sessions/{pin}/end.
func (h *Handler) EndSession(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	pin := chi.URLParam(r, "pin")

	session, err := h.service.EndSession(r.Context(), pin, teacherID)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			writeError(w, http.StatusNotFound, "session not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, session)
}

// GetCurrentQuestion handles GET /api/game/sessions/{pin}/current-question.
// Public endpoint — returns the question currently being displayed in an active session.
func (h *Handler) GetCurrentQuestion(w http.ResponseWriter, r *http.Request) {
	pin := chi.URLParam(r, "pin")

	resp, err := h.service.GetCurrentQuestion(r.Context(), pin)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			writeError(w, http.StatusNotFound, "session not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get current question")
		return
	}
	if resp == nil {
		writeError(w, http.StatusNotFound, "no active question")
		return
	}

	// Strip correct-answer data before sending to students/players
	resp.Question = resp.Question.Sanitize()
	writeJSON(w, http.StatusOK, resp)
}

// Leaderboard handles GET /api/game/sessions/{pin}/leaderboard.
func (h *Handler) Leaderboard(w http.ResponseWriter, r *http.Request) {
	pin := chi.URLParam(r, "pin")

	session, err := h.service.GetByPIN(r.Context(), pin)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			writeError(w, http.StatusNotFound, "session not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get session")
		return
	}

	players, err := h.playerFinder.FindBySessionID(r.Context(), session.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get leaderboard")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"session": session,
		"players": players,
	})
}
