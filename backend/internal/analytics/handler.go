package analytics

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pae/backend/internal/middleware"
)

// Handler holds HTTP handler dependencies for analytics endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new analytics Handler.
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

// GetSessionAnalytics handles GET /api/analytics/sessions/{id}.
func (h *Handler) GetSessionAnalytics(w http.ResponseWriter, r *http.Request) {
	teacherIDStr, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, http.StatusBadRequest, "session id is required")
		return
	}

	result, err := h.service.GetSessionAnalytics(r.Context(), sessionID, teacherIDStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// GetQuizAnalytics handles GET /api/analytics/quizzes/{id}.
func (h *Handler) GetQuizAnalytics(w http.ResponseWriter, r *http.Request) {
	teacherIDStr, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	quizID := chi.URLParam(r, "id")
	if quizID == "" {
		writeError(w, http.StatusBadRequest, "quiz id is required")
		return
	}

	result, err := h.service.GetQuizAnalytics(r.Context(), quizID, teacherIDStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// GetOverview handles GET /api/analytics/overview.
func (h *Handler) GetOverview(w http.ResponseWriter, r *http.Request) {
	teacherIDStr, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	result, err := h.service.GetOverview(r.Context(), teacherIDStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}
