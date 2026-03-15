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
	IsPro   bool `bson:"is_pro,omitempty" json:"is_pro,omitempty"`
	IsAdmin bool `bson:"is_admin,omitempty" json:"is_admin,omitempty"`
	// Teacher profile fields (optional)
	Institution     string `bson:"institution,omitempty" json:"institution,omitempty"`
	InstitutionType string `bson:"institution_type,omitempty" json:"institution_type,omitempty"` // "school" | "college" | "university"
	Location        string `bson:"location,omitempty" json:"location,omitempty"`
	YearsOfExp      int    `bson:"years_of_exp,omitempty" json:"years_of_exp,omitempty"`
	Bio             string `bson:"bio,omitempty" json:"bio,omitempty"`
	CreatedAt       time.Time `bson:"created_at" json:"created_at"`
}
