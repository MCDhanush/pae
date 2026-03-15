package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	// ContextKeyUserID is the context key under which the authenticated user ID is stored.
	ContextKeyUserID contextKey = "user_id"
	// ContextKeyRole is the context key under which the authenticated user role is stored.
	ContextKeyRole contextKey = "role"
	// ContextKeyIsPro tracks whether the user has a pro plan.
	ContextKeyIsPro contextKey = "is_pro"
	// ContextKeyIsAdmin tracks whether the user is a platform admin.
	ContextKeyIsAdmin contextKey = "is_admin"
	// ContextKeyExtraSessions tracks purchased session cap increases.
	ContextKeyExtraSessions contextKey = "extra_sessions"
	// ContextKeyExtraAI tracks purchased AI generation credits.
	ContextKeyExtraAI contextKey = "extra_ai"
	// ContextKeyUnlimitedSessions tracks whether the user has unlimited sessions (₹299 plan).
	ContextKeyUnlimitedSessions contextKey = "unlimited_sessions"
)

// Claims defines the JWT payload shape.
type Claims struct {
	UserID             string `json:"user_id"`
	Role               string `json:"role"`
	IsPro              bool   `json:"is_pro,omitempty"`
	IsAdmin            bool   `json:"is_admin,omitempty"`
	UnlimitedSessions  bool   `json:"unlimited_sessions,omitempty"`
	ExtraSessions      int    `json:"extra_sessions,omitempty"`
	ExtraAI            int    `json:"extra_ai,omitempty"`
	jwt.RegisteredClaims
}

// RequireAuth is an HTTP middleware that validates the JWT in the Authorization
// header and injects the user ID and role into the request context.
func RequireAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, err := extractAndValidateToken(r, jwtSecret)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(*Claims)
			if !ok || !token.Valid {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyRole, claims.Role)
			ctx = context.WithValue(ctx, ContextKeyIsPro, claims.IsPro)
			ctx = context.WithValue(ctx, ContextKeyIsAdmin, claims.IsAdmin)
			ctx = context.WithValue(ctx, ContextKeyUnlimitedSessions, claims.UnlimitedSessions)
			ctx = context.WithValue(ctx, ContextKeyExtraSessions, claims.ExtraSessions)
			ctx = context.WithValue(ctx, ContextKeyExtraAI, claims.ExtraAI)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireTeacher builds on RequireAuth and additionally enforces that the
// authenticated user has the "teacher" or "admin" role.
func RequireTeacher(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, err := extractAndValidateToken(r, jwtSecret)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(*Claims)
			if !ok || !token.Valid {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			if claims.Role != "teacher" && claims.Role != "admin" {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyRole, claims.Role)
			ctx = context.WithValue(ctx, ContextKeyIsPro, claims.IsPro)
			ctx = context.WithValue(ctx, ContextKeyIsAdmin, claims.IsAdmin)
			ctx = context.WithValue(ctx, ContextKeyUnlimitedSessions, claims.UnlimitedSessions)
			ctx = context.WithValue(ctx, ContextKeyExtraSessions, claims.ExtraSessions)
			ctx = context.WithValue(ctx, ContextKeyExtraAI, claims.ExtraAI)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext extracts the authenticated user ID from the context.
func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(ContextKeyUserID).(string)
	return id, ok
}

// RoleFromContext extracts the authenticated user role from the context.
func RoleFromContext(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(ContextKeyRole).(string)
	return role, ok
}

// IsProFromContext returns whether the user has a pro plan.
func IsProFromContext(ctx context.Context) bool {
	v, _ := ctx.Value(ContextKeyIsPro).(bool)
	return v
}

// IsAdminFromContext returns whether the user is a platform admin.
func IsAdminFromContext(ctx context.Context) bool {
	v, _ := ctx.Value(ContextKeyIsAdmin).(bool)
	return v
}

// IsUnrestrictedFromContext returns true if the user is admin or pro —
// both bypass free-plan limits entirely (sessions + AI).
func IsUnrestrictedFromContext(ctx context.Context) bool {
	return IsAdminFromContext(ctx) || IsProFromContext(ctx)
}

// UnlimitedSessionsFromContext returns true if the user has unlimited game sessions
// (admin, pro, or the ₹299 sessions-only unlimited plan).
func UnlimitedSessionsFromContext(ctx context.Context) bool {
	v, _ := ctx.Value(ContextKeyUnlimitedSessions).(bool)
	return v || IsUnrestrictedFromContext(ctx)
}

// ExtraSessionsFromContext returns the number of purchased extra session credits.
func ExtraSessionsFromContext(ctx context.Context) int {
	v, _ := ctx.Value(ContextKeyExtraSessions).(int)
	return v
}

// ExtraAIFromContext returns the number of purchased extra AI generation credits.
func ExtraAIFromContext(ctx context.Context) int {
	v, _ := ctx.Value(ContextKeyExtraAI).(int)
	return v
}

// extractAndValidateToken parses the Bearer token from the Authorization header
// and validates it with the provided secret.
func extractAndValidateToken(r *http.Request, jwtSecret string) (*jwt.Token, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, jwt.ErrTokenMalformed
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return nil, jwt.ErrTokenMalformed
	}

	tokenStr := parts[1]
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return []byte(jwtSecret), nil
	})
	if err != nil {
		return nil, err
	}

	return token, nil
}
