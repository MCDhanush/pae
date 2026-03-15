package quiz

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/pae/backend/internal/ai"
	"github.com/pae/backend/internal/database"
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
	redis     *database.RedisClient
	geminiKey string
}

// NewHandler creates a new quiz Handler.
func NewHandler(service *Service, gcs *storage.GCSClient, rdb *database.RedisClient, geminiKey string) *Handler {
	return &Handler{
		service:   service,
		gcs:       gcs,
		validate:  validator.New(),
		redis:     rdb,
		geminiKey: geminiKey,
	}
}

// --- DTOs ---

type createQuizRequest struct {
	Title       string            `json:"title" validate:"required,min=1,max=200"`
	Description string            `json:"description" validate:"max=1000"`
	Images      []string          `json:"images"`
	Questions   []models.Question `json:"questions"`
	IsPublic    bool              `json:"is_public"`
	Category    string            `json:"category" validate:"max=100"`
}

type updateQuizRequest struct {
	Title       string            `json:"title" validate:"required,min=1,max=200"`
	Description string            `json:"description" validate:"max=1000"`
	Images      []string          `json:"images"`
	Questions   []models.Question `json:"questions"`
	IsPublic    bool              `json:"is_public"`
	Category    string            `json:"category" validate:"max=100"`
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
		IsPublic:    req.IsPublic,
		Category:    req.Category,
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

	// Strip correct-answer data unless the requester is the quiz owner.
	// teacherIDFromContext returns NilObjectID when the caller is not a teacher,
	// which will never equal a real TeacherID, so non-owners always get sanitized data.
	requesterID, _ := teacherIDFromContext(r)
	if requesterID != quiz.TeacherID {
		for i := range quiz.Questions {
			quiz.Questions[i] = quiz.Questions[i].Sanitize()
		}
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
		IsPublic:    req.IsPublic,
		Category:    req.Category,
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
	// Strip correct-answer data before sending to public consumers
	for i := range quizzes {
		for j := range quizzes[i].Questions {
			quizzes[i].Questions[j] = quizzes[i].Questions[j].Sanitize()
		}
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
		case errors.Is(err, ErrAlreadyImported):
			writeError(w, http.StatusConflict, "quiz already imported")
		default:
			writeError(w, http.StatusInternalServerError, "failed to import quiz")
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

// SoloCheckAnswer handles POST /api/marketplace/{id}/check-answer.
// Public endpoint — evaluates a student's answer server-side without exposing correct-answer data.
func (h *Handler) SoloCheckAnswer(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	quizID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	var req struct {
		QuestionID string `json:"question_id"`
		Answer     string `json:"answer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	quiz, err := h.service.GetByID(r.Context(), quizID)
	if err != nil {
		if errors.Is(err, ErrQuizNotFound) {
			writeError(w, http.StatusNotFound, "quiz not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get quiz")
		return
	}
	if !quiz.IsPublic {
		writeError(w, http.StatusForbidden, "quiz is not public")
		return
	}

	var target *models.Question
	for i := range quiz.Questions {
		if quiz.Questions[i].ID == req.QuestionID {
			target = &quiz.Questions[i]
			break
		}
	}
	if target == nil {
		writeError(w, http.StatusNotFound, "question not found")
		return
	}

	isCorrect, correctAnswer := evalAnswer(target, req.Answer)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"is_correct":     isCorrect,
		"correct_answer": correctAnswer,
		"points":         target.Points,
	})
}

func evalAnswer(q *models.Question, answer string) (bool, string) {
	switch q.Type {
	case models.MultipleChoice, models.ImageBased, models.TrueFalse:
		for _, opt := range q.Options {
			if opt.IsRight {
				return opt.ID == answer, opt.ID
			}
		}
	case models.FillBlank:
		correct := strings.TrimSpace(strings.ToLower(q.Answer))
		given := strings.TrimSpace(strings.ToLower(answer))
		return given == correct, q.Answer
	case models.MatchPair:
		rights := make([]string, len(q.MatchPairs))
		for i, pair := range q.MatchPairs {
			rights[i] = pair.Right
		}
		expected := strings.Join(rights, "|")
		return answer == expected, expected
	}
	return false, ""
}

// GenerateQuestions handles POST /api/quizzes/ai/generate.
// Teacher-only. Calls Gemini 1.5 Flash to generate quiz questions and returns
// them for review — questions are NOT saved until the teacher saves the quiz.
func (h *Handler) GenerateQuestions(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := teacherIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Topic      string `json:"topic"`
		Difficulty string `json:"difficulty"`
		Type       string `json:"type"`
		Count      int    `json:"count"`
		Context    string `json:"context"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate inputs
	req.Topic = strings.TrimSpace(req.Topic)
	if req.Topic == "" {
		writeError(w, http.StatusBadRequest, "topic is required")
		return
	}
	validDifficulties := map[string]bool{"easy": true, "medium": true, "hard": true}
	if !validDifficulties[req.Difficulty] {
		writeError(w, http.StatusBadRequest, "difficulty must be easy, medium, or hard")
		return
	}
	validTypes := map[string]bool{
		"multiple_choice": true,
		"true_false":      true,
		"fill_blank":      true,
		"reflection":      true,
	}
	if !validTypes[req.Type] {
		writeError(w, http.StatusBadRequest, "unsupported question type for AI generation")
		return
	}
	if req.Count < 1 {
		req.Count = 1
	}
	if req.Count > ai.MaxQuestionsPerRequest {
		req.Count = ai.MaxQuestionsPerRequest
	}

	// Rate limit: max DailyRequestLimit requests per teacher per day
	rateLimitKey := fmt.Sprintf("ai:ratelimit:%s", teacherID.Hex())
	dateField := time.Now().Format("2006-01-02")
	dayCount, err := h.redis.HIncrBy(r.Context(), rateLimitKey, dateField, 1)
	if err == nil {
		if dayCount == 1 {
			// First hit today — set TTL so the key expires automatically
			_ = h.redis.Client().Expire(r.Context(), rateLimitKey, 25*time.Hour)
		}
		if dayCount > int64(ai.DailyRequestLimit) {
			writeError(w, http.StatusTooManyRequests,
				fmt.Sprintf("daily AI generation limit reached (%d/day)", ai.DailyRequestLimit))
			return
		}
	}
	// Fail-open: if Redis is unavailable, allow the request through

	// Call Gemini
	client := ai.NewClient(h.geminiKey)
	generated, err := client.Generate(r.Context(), ai.GenerateRequest{
		Topic:      req.Topic,
		Difficulty: req.Difficulty,
		Type:       req.Type,
		Count:      req.Count,
		Context:    req.Context,
	})
	if err != nil {
		if errors.Is(err, ai.ErrNotConfigured) {
			writeError(w, http.StatusServiceUnavailable, "AI service not configured")
			return
		}
		writeError(w, http.StatusInternalServerError, "AI generation failed: "+err.Error())
		return
	}

	// Convert to models.Question and assign IDs
	questions := make([]models.Question, 0, len(generated))
	for _, g := range generated {
		q := models.Question{
			ID:            primitive.NewObjectID().Hex(),
			Type:          models.QuestionType(g.Type),
			Text:          g.Text,
			Answer:        g.Answer,
			TimeLimit:     g.TimeLimit,
			Points:        g.Points,
			Explanation:   g.Explanation,
			IsAIGenerated: true,
		}
		if len(g.Options) > 0 {
			q.Options = make([]models.Option, len(g.Options))
			for i, o := range g.Options {
				q.Options[i] = models.Option{
					ID:      primitive.NewObjectID().Hex(),
					Text:    o.Text,
					IsRight: o.IsRight,
				}
			}
		}
		questions = append(questions, q)
	}

	writeJSON(w, http.StatusOK, questions)
}
