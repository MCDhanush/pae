package session

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pae/backend/internal/middleware"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Handler holds dependencies for session HTTP handlers.
type Handler struct {
	service *Service
}

// NewHandler creates a new session Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
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

// ListSessions handles GET /api/sessions — returns the teacher's sessions.
func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	idStr, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	teacherID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	sessions, err := h.service.ListByTeacher(r.Context(), teacherID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list sessions")
		return
	}

	writeJSON(w, http.StatusOK, sessions)
}

// GetSession handles GET /api/sessions/{id} — returns session detail with players.
func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	sessionID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid session id")
		return
	}

	detail, err := h.service.GetDetail(r.Context(), sessionID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get session")
		return
	}

	writeJSON(w, http.StatusOK, detail)
}

func (h *Handler) GetPlayers(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	players, err := h.service.GetPlayers(r.Context(), sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}
