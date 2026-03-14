package quiz

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/pae/backend/internal/middleware"
	"github.com/pae/backend/internal/models"
	"github.com/pae/backend/internal/storage"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const maxUploadSize = 2 << 20 // 2 MB

// Handler holds dependencies for quiz HTTP handlers.
type Handler struct {
	service   *Service
	gcs       *storage.GCSClient
	validate  *validator.Validate
}

// NewHandler creates a new quiz Handler.
func NewHandler(service *Service, gcs *storage.GCSClient) *Handler {
	return &Handler{
		service:  service,
		gcs:      gcs,
		validate: validator.New(),
	}
}

// --- DTOs ---

type createQuizRequest struct {
	Title       string           `json:"title" validate:"required,min=1,max=200"`
	Description string           `json:"description" validate:"max=1000"`
	Images      []string         `json:"images"`
	Questions   []models.Question `json:"questions"`
}

type updateQuizRequest struct {
	Title       string           `json:"title" validate:"required,min=1,max=200"`
	Description string           `json:"description" validate:"max=1000"`
	Images      []string         `json:"images"`
	Questions   []models.Question `json:"questions"`
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

// CreateQuiz handles POST /api/quizzes.
func (h *Handler) CreateQuiz(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req createQuizRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	quiz := &models.Quiz{
		TeacherID:   teacherID,
		Title:       req.Title,
		Description: req.Description,
		Images:      req.Images,
		Questions:   req.Questions,
	}

	if quiz.Images == nil {
		quiz.Images = []string{}
	}
	if quiz.Questions == nil {
		quiz.Questions = []models.Question{}
	}

	created, err := h.service.Create(r.Context(), quiz)
	if err != nil {
		if errors.Is(err, ErrTooManyImages) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create quiz")
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// ListQuizzes handles GET /api/quizzes (teacher's own quizzes).
func (h *Handler) ListQuizzes(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	quizzes, err := h.service.ListByTeacher(r.Context(), teacherID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list quizzes")
		return
	}

	writeJSON(w, http.StatusOK, quizzes)
}

// GetQuiz handles GET /api/quizzes/{id}.
func (h *Handler) GetQuiz(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	quiz, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrQuizNotFound) {
			writeError(w, http.StatusNotFound, "quiz not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get quiz")
		return
	}

	writeJSON(w, http.StatusOK, quiz)
}

// UpdateQuiz handles PUT /api/quizzes/{id}.
func (h *Handler) UpdateQuiz(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	var req updateQuizRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	quiz := &models.Quiz{
		ID:          id,
		TeacherID:   teacherID,
		Title:       req.Title,
		Description: req.Description,
		Images:      req.Images,
		Questions:   req.Questions,
	}

	updated, err := h.service.Update(r.Context(), quiz, teacherID)
	if err != nil {
		switch {
		case errors.Is(err, ErrQuizNotFound):
			writeError(w, http.StatusNotFound, "quiz not found")
		case errors.Is(err, ErrUnauthorized):
			writeError(w, http.StatusForbidden, "forbidden")
		case errors.Is(err, ErrTooManyImages):
			writeError(w, http.StatusBadRequest, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "failed to update quiz")
		}
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

// DeleteQuiz handles DELETE /api/quizzes/{id}.
func (h *Handler) DeleteQuiz(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	if err := h.service.Delete(r.Context(), id, teacherID); err != nil {
		switch {
		case errors.Is(err, ErrQuizNotFound):
			writeError(w, http.StatusNotFound, "quiz not found")
		case errors.Is(err, ErrUnauthorized):
			writeError(w, http.StatusForbidden, "forbidden")
		default:
			writeError(w, http.StatusInternalServerError, "failed to delete quiz")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "quiz deleted"})
}

// UploadImageGeneral handles POST /api/quizzes/images – uploads an image and
// returns the GCS URL without attaching it to any quiz. Used for the image
// library: teachers can upload once and reuse across quizzes.
func (h *Handler) UploadImageGeneral(w http.ResponseWriter, r *http.Request) {
	if _, ok := teacherIDFromContext(r); !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "image field is required")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if h.gcs == nil {
		writeError(w, http.StatusServiceUnavailable, "storage service not configured")
		return
	}

	url, err := h.gcs.Upload(r.Context(), file, header.Filename, contentType)
	if err != nil {
		if errors.Is(err, storage.ErrFileTooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "file exceeds 2 MB limit")
			return
		}
		writeError(w, http.StatusInternalServerError, "upload failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

// ListMarketplace handles GET /api/marketplace (public, no auth required).
func (h *Handler) ListMarketplace(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	search := r.URL.Query().Get("q")

	quizzes, err := h.service.ListPublic(r.Context(), category, search)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list marketplace")
		return
	}
	if quizzes == nil {
		quizzes = []models.Quiz{}
	}
	writeJSON(w, http.StatusOK, quizzes)
}

// PublishQuiz handles PUT /api/quizzes/{id}/publish (teacher auth required).
func (h *Handler) PublishQuiz(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	quizID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	var body struct {
		IsPublic bool `json:"is_public"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	if err := h.service.Publish(r.Context(), quizID, teacherID, body.IsPublic); err != nil {
		switch {
		case errors.Is(err, ErrQuizNotFound):
			writeError(w, http.StatusNotFound, "quiz not found")
		case errors.Is(err, ErrUnauthorized):
			writeError(w, http.StatusForbidden, "forbidden")
		default:
			writeError(w, http.StatusInternalServerError, "failed to update publish state")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"is_public": body.IsPublic})
}

// CopyMarketplaceQuiz handles POST /api/marketplace/{id}/copy (teacher auth required).
func (h *Handler) CopyMarketplaceQuiz(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	quizID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	created, err := h.service.CopyQuiz(r.Context(), quizID, teacherID, "")
	if err != nil {
		switch {
		case errors.Is(err, ErrQuizNotFound):
			writeError(w, http.StatusNotFound, "quiz not found")
		case errors.Is(err, ErrUnauthorized):
			writeError(w, http.StatusForbidden, "quiz is not public")
		default:
			writeError(w, http.StatusInternalServerError, "failed to copy quiz")
		}
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// UploadImage handles POST /api/quizzes/{id}/upload-image.
func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	quizID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "image field is required")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if h.gcs == nil {
		writeError(w, http.StatusServiceUnavailable, "storage service not configured")
		return
	}

	url, err := h.gcs.Upload(r.Context(), file, header.Filename, contentType)
	if err != nil {
		if errors.Is(err, storage.ErrFileTooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "file exceeds 2 MB limit")
			return
		}
		writeError(w, http.StatusInternalServerError, "upload failed")
		return
	}

	if err := h.service.AddImage(r.Context(), quizID, teacherID, url); err != nil {
		switch {
		case errors.Is(err, ErrQuizNotFound):
			writeError(w, http.StatusNotFound, "quiz not found")
		case errors.Is(err, ErrUnauthorized):
			writeError(w, http.StatusForbidden, "forbidden")
		case errors.Is(err, ErrTooManyImages):
			writeError(w, http.StatusBadRequest, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "failed to attach image")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}
