// Package payment provides Razorpay payment integration for pro plan upgrades.
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

const (
	razorpayOrdersURL = "https://api.razorpay.com/v1/orders"
	// ProUpgradeAmount is ₹499 in paise (smallest Razorpay unit).
	ProUpgradeAmount = 49900
)

// AuthService is the subset of auth.Service methods the payment handler needs.
type AuthService interface {
	SetPro(ctx context.Context, userID primitive.ObjectID) error
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

// helper: JSON response
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// CreateOrder handles POST /api/payments/create-order.
// Creates a Razorpay order for the pro plan upgrade and returns the order
// details the frontend needs to open the Razorpay checkout dialog.
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

	orderBody := map[string]interface{}{
		"amount":   ProUpgradeAmount,
		"currency": "INR",
		"receipt":  fmt.Sprintf("pae_pro_%s", userIDStr),
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
		"order_id": rzpOrder["id"],
		"amount":   ProUpgradeAmount,
		"currency": "INR",
		"key_id":   h.keyID,
	})
}

// VerifyPayment handles POST /api/payments/verify.
// Validates the Razorpay payment signature, upgrades the teacher to pro, and
// returns a fresh JWT with is_pro: true so the frontend can update its token.
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
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Verify HMAC-SHA256 signature: sign(order_id + "|" + payment_id)
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

	if err := h.authService.SetPro(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to upgrade account")
		return
	}

	// Fetch the updated user and issue a new JWT with is_pro: true
	user, err := h.authService.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch user")
		return
	}
	user.IsPro = true // ensure flag is set even if DB propagation lags

	token, err := h.authService.GenerateToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token generation failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"token":   token,
		"message": "Account upgraded to Pro — session limit removed",
	})
}
