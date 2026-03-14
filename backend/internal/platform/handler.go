package platform

import (
	"encoding/json"
	"net/http"
)

// Handler holds dependencies for platform HTTP handlers.
type Handler struct {
	service *Service
}

// NewHandler creates a new platform Handler.
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

// Stats handles GET /api/platform/stats.
func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.service.GetStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to retrieve platform stats")
		return
	}

	writeJSON(w, http.StatusOK, stats)
}
