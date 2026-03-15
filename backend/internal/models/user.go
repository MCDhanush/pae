package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a registered teacher or student on the platform.
type User struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Email     string             `bson:"email" json:"email"`
	Password  string             `bson:"password" json:"-"`
	Role      string             `bson:"role" json:"role"` // "teacher" | "student" | "admin"
	// Plan / access flags
	IsPro              bool `bson:"is_pro,omitempty" json:"is_pro,omitempty"`                           // true = unlimited sessions + AI (paid once)
	IsAdmin            bool `bson:"is_admin,omitempty" json:"is_admin,omitempty"`                       // true = no restrictions at all
	UnlimitedSessions  bool `bson:"unlimited_sessions,omitempty" json:"unlimited_sessions,omitempty"`  // true = unlimited game sessions only (₹299 plan)
	ExtraSessions      int  `bson:"extra_sessions,omitempty" json:"extra_sessions,omitempty"`          // additive session cap increase
	ExtraAI            int  `bson:"extra_ai,omitempty" json:"extra_ai,omitempty"`                      // additive AI generation credits
	// Teacher profile fields (optional)
	Institution     string `bson:"institution,omitempty" json:"institution,omitempty"`
	InstitutionType string `bson:"institution_type,omitempty" json:"institution_type,omitempty"` // "school" | "college" | "university"
	Location        string `bson:"location,omitempty" json:"location,omitempty"`
	YearsOfExp      int    `bson:"years_of_exp,omitempty" json:"years_of_exp,omitempty"`
	Bio             string `bson:"bio,omitempty" json:"bio,omitempty"`
	CreatedAt       time.Time `bson:"created_at" json:"created_at"`
}
