// Package payment provides Razorpay payment integration for tiered plan upgrades.
package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/pae/backend/internal/middleware"
	"github.com/pae/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const razorpayOrdersURL = "https://api.razorpay.com/v1/orders"

// Plan types for the tiered pricing model.
const (
	PlanSessions50        = "sessions_50"        // +50 session cap
	PlanSessions100       = "sessions_100"        // +100 session cap
	PlanSessionsUnlimited = "sessions_unlimited"  // unlimited sessions only
	PlanAI10              = "ai_10"               // +10 AI generation credits
	PlanAI20              = "ai_20"               // +20 AI generation credits
	PlanAI50              = "ai_50"               // +50 AI generation credits
)

// planDetails holds the amount (paise) and human description for each plan.
type planDetail struct {
	Amount      int64  // in paise (1 INR = 100 paise)
	Description string
}

// plans maps plan_type → price + description. All prices in INR paise.
// ₹45 = 4500   ₹80 = 8000   ₹399 = 39900   ₹10 = 1000   ₹20 = 2000   ₹45 = 4500
var plans = map[string]planDetail{
	PlanSessions50:        {4500, "50 extra game sessions"},
	PlanSessions100:       {8000, "100 extra game sessions"},
	PlanSessionsUnlimited: {39900, "Unlimited game sessions"},
	PlanAI10:              {1000, "10 extra AI question generations"},
	PlanAI20:              {2000, "20 extra AI question generations"},
	PlanAI50:              {4500, "50 extra AI question generations"},
}

// AuthService is the subset of auth.Service methods the payment handler needs.
type AuthService interface {
	SetPro(ctx context.Context, userID primitive.ObjectID) error
	SetUnlimitedSessions(ctx context.Context, userID primitive.ObjectID) error
	AddSessionCredits(ctx context.Context, userID primitive.ObjectID, credits int) error
	AddAICredits(ctx context.Context, userID primitive.ObjectID, credits int) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*models.User, error)
	GenerateToken(user *models.User) (string, error)
}

// Handler handles Razorpay payment endpoints.
type Handler struct {
	authService AuthService
	keyID       string
	keySecret   string
}

// NewHandler creates a new payment Handler.
func NewHandler(authService AuthService, keyID, keySecret string) *Handler {
	return &Handler{authService: authService, keyID: keyID, keySecret: keySecret}
}

// IsConfigured returns true when Razorpay credentials are set.
func (h *Handler) IsConfigured() bool {
	return h.keyID != "" && h.keySecret != ""
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// CreateOrder handles POST /api/payments/create-order.
// Body: { "plan_type": "sessions_50" | "sessions_100" | "sessions_unlimited" | "ai_10" | "ai_20" }
// Returns: { order_id, amount, currency, key_id, plan_type, description }
func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	if !h.IsConfigured() {
		writeError(w, http.StatusServiceUnavailable, "payments not configured")
		return
	}

	userIDStr, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body struct {
		PlanType string `json:"plan_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PlanType == "" {
		writeError(w, http.StatusBadRequest, "plan_type is required")
		return
	}

	plan, ok := plans[body.PlanType]
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid plan_type")
		return
	}

	orderBody := map[string]interface{}{
		"amount":   plan.Amount,
		"currency": "INR",
		"receipt":  fmt.Sprintf("pae_%s_%s", body.PlanType, userIDStr),
		"notes": map[string]string{
			"plan_type": body.PlanType,
			"user_id":   userIDStr,
		},
	}
	bodyBytes, _ := json.Marshal(orderBody)

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, razorpayOrdersURL, bytes.NewReader(bodyBytes))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build order request")
		return
	}
	req.SetBasicAuth(h.keyID, h.keySecret)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create Razorpay order")
		return
	}
	defer resp.Body.Close()

	var rzpOrder map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rzpOrder); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to parse Razorpay response")
		return
	}
	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusInternalServerError, "Razorpay order creation failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"order_id":    rzpOrder["id"],
		"amount":      plan.Amount,
		"currency":    "INR",
		"key_id":      h.keyID,
		"plan_type":   body.PlanType,
		"description": plan.Description,
	})
}

// VerifyPayment handles POST /api/payments/verify.
// Validates the Razorpay signature, applies the purchased plan, and returns a
// fresh JWT so the frontend can update its token immediately.
func (h *Handler) VerifyPayment(w http.ResponseWriter, r *http.Request) {
	if !h.IsConfigured() {
		writeError(w, http.StatusServiceUnavailable, "payments not configured")
		return
	}

	userIDStr, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		PaymentID string `json:"razorpay_payment_id"`
		OrderID   string `json:"razorpay_order_id"`
		Signature string `json:"razorpay_signature"`
		PlanType  string `json:"plan_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if _, ok := plans[req.PlanType]; !ok {
		writeError(w, http.StatusBadRequest, "invalid plan_type")
		return
	}

	// Verify HMAC-SHA256: sign(order_id + "|" + payment_id)
	mac := hmac.New(sha256.New, []byte(h.keySecret))
	mac.Write([]byte(req.OrderID + "|" + req.PaymentID))
	expected := hex.EncodeToString(mac.Sum(nil))
	if expected != req.Signature {
		writeError(w, http.StatusBadRequest, "invalid payment signature")
		return
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	// Apply the purchased plan
	switch req.PlanType {
	case PlanSessions50:
		err = h.authService.AddSessionCredits(r.Context(), userID, 50)
	case PlanSessions100:
		err = h.authService.AddSessionCredits(r.Context(), userID, 100)
	case PlanSessionsUnlimited:
		err = h.authService.SetUnlimitedSessions(r.Context(), userID)
	case PlanAI10:
		err = h.authService.AddAICredits(r.Context(), userID, 10)
	case PlanAI20:
		err = h.authService.AddAICredits(r.Context(), userID, 20)
	case PlanAI50:
		err = h.authService.AddAICredits(r.Context(), userID, 50)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to apply plan")
		return
	}

	// Fetch updated user and issue a new JWT with updated credits/flags
	user, err := h.authService.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch user")
		return
	}
	// Ensure in-memory values reflect the DB update for the new token
	switch req.PlanType {
	case PlanSessions50:
		user.ExtraSessions += 50
	case PlanSessions100:
		user.ExtraSessions += 100
	case PlanSessionsUnlimited:
		user.UnlimitedSessions = true
	case PlanAI10:
		user.ExtraAI += 10
	case PlanAI20:
		user.ExtraAI += 20
	case PlanAI50:
		user.ExtraAI += 50
	}

	token, err := h.authService.GenerateToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token generation failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"token":     token,
		"plan_type": req.PlanType,
		"message":   fmt.Sprintf("Plan activated: %s", plans[req.PlanType].Description),
	})
}
