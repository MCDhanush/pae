package models

// QuestionType identifies the kind of interaction required to answer a question.
type QuestionType string

const (
	MultipleChoice QuestionType = "multiple_choice"
	ImageBased     QuestionType = "image_based"
	MatchPair      QuestionType = "match_pair"
	FillBlank      QuestionType = "fill_blank"
)

// Option is a single answer choice for a multiple-choice or image-based question.
type Option struct {
	ID      string `bson:"id" json:"id"`
	Text    string `bson:"text" json:"text"`
	IsRight bool   `bson:"is_right" json:"is_right"`
}

// MatchPairItem is a left/right pair used in match_pair questions.
type MatchPairItem struct {
	Left  string `bson:"left" json:"left"`
	Right string `bson:"right" json:"right"`
}

// Question is a single question within a Quiz.
type Question struct {
	ID         string          `bson:"id" json:"id"`
	Type       QuestionType    `bson:"type" json:"type"`
	Text       string          `bson:"text" json:"text"`
	Image      string          `bson:"image,omitempty" json:"image,omitempty"`
	Options    []Option        `bson:"options,omitempty" json:"options,omitempty"`
	MatchPairs []MatchPairItem `bson:"match_pairs,omitempty" json:"match_pairs,omitempty"`
	Answer     string          `bson:"answer,omitempty" json:"answer,omitempty"` // for fill_blank
	TimeLimit  int             `bson:"time_limit" json:"time_limit"`              // seconds
	Points     int             `bson:"points" json:"points"`
}
