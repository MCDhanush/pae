// Package ai provides a lightweight client for generating quiz questions
// using the Gemini 1.5 Flash REST API. No additional Go module is required —
// all communication is done via the standard net/http package.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

	// MaxQuestionsPerRequest caps how many questions can be generated in one call.
	MaxQuestionsPerRequest = 20

	// DailyRequestLimit is the maximum number of generation requests per teacher per day.
	DailyRequestLimit = 10
)

// ErrNotConfigured is returned when no API key has been set.
var ErrNotConfigured = errors.New("AI service not configured: GEMINI_API_KEY is not set")

// Client calls the Gemini 1.5 Flash REST API.
type Client struct {
	apiKey string
	http   *http.Client
}

// NewClient returns a Client. If apiKey is empty, Generate will return ErrNotConfigured.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		http:   &http.Client{Timeout: 45 * time.Second},
	}
}

// GenerateRequest holds the parameters for a generation request.
type GenerateRequest struct {
	Topic      string // required
	Difficulty string // "easy" | "medium" | "hard"
	Type       string // question type constant
	Count      int    // 1-MaxQuestionsPerRequest
	Context    string // optional extra material
}

// GeneratedQuestion is a single AI-generated question before it is converted
// to a models.Question and assigned a persistent ID.
type GeneratedQuestion struct {
	Type        string     `json:"type"`
	Text        string     `json:"text"`
	Options     []OptionAI `json:"options,omitempty"`
	Answer      string     `json:"answer,omitempty"` // fill_blank correct answer
	Explanation string     `json:"explanation"`
	Points      int        `json:"points"`
	TimeLimit   int        `json:"time_limit"`
}

// OptionAI is an answer option inside a GeneratedQuestion.
type OptionAI struct {
	Text    string `json:"text"`
	IsRight bool   `json:"is_right"`
}

// --- Gemini REST types (internal) ---

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiRequest struct {
	Contents         []geminiContent  `json:"contents"`
	GenerationConfig geminiGenConfig  `json:"generationConfig"`
}

type geminiGenConfig struct {
	ResponseMIMEType string  `json:"responseMimeType"`
	Temperature      float64 `json:"temperature"`
}

type geminiResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
}

// Generate calls Gemini 1.5 Flash and returns parsed, validated questions.
func (c *Client) Generate(ctx context.Context, req GenerateRequest) ([]GeneratedQuestion, error) {
	if c.apiKey == "" {
		return nil, ErrNotConfigured
	}

	prompt := buildPrompt(req)

	body := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
		GenerationConfig: geminiGenConfig{
			ResponseMIMEType: "application/json",
			Temperature:      0.8,
		},
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s?key=%s", geminiEndpoint, c.apiKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call gemini: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errBody map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		return nil, fmt.Errorf("gemini returned %d: %v", resp.StatusCode, errBody)
	}

	var gemResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&gemResp); err != nil {
		return nil, fmt.Errorf("decode gemini response: %w", err)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return nil, errors.New("gemini returned no content")
	}

	rawJSON := gemResp.Candidates[0].Content.Parts[0].Text

	// Gemini sometimes wraps JSON in markdown fences — strip them
	rawJSON = strings.TrimSpace(rawJSON)
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var wrapper struct {
		Questions []GeneratedQuestion `json:"questions"`
	}
	if err := json.Unmarshal([]byte(rawJSON), &wrapper); err != nil {
		return nil, fmt.Errorf("parse questions JSON: %w", err)
	}

	valid := validateQuestions(wrapper.Questions, req.Type)
	if len(valid) == 0 {
		return nil, errors.New("AI returned no valid questions")
	}
	return valid, nil
}

// buildPrompt constructs the generation prompt sent to Gemini.
func buildPrompt(req GenerateRequest) string {
	points, timeLimit := difficultyDefaults(req.Difficulty)

	typeDesc := questionTypeDescription(req.Type)

	var sb strings.Builder
	sb.WriteString("You are an expert quiz creator. Generate exactly ")
	sb.WriteString(fmt.Sprintf("%d quiz question(s) about the topic: \"%s\".\n\n", req.Count, req.Topic))
	sb.WriteString(fmt.Sprintf("Difficulty: %s\n", req.Difficulty))
	sb.WriteString(fmt.Sprintf("Question type: %s\n", typeDesc))
	if req.Context != "" {
		sb.WriteString(fmt.Sprintf("Additional context / learning material:\n%s\n\n", req.Context))
	}
	sb.WriteString(fmt.Sprintf("Use %d points and %d seconds time limit per question.\n\n", points, timeLimit))

	sb.WriteString("Return ONLY a JSON object with this exact structure (no markdown, no extra text):\n")
	sb.WriteString(jsonSchemaForType(req.Type, points, timeLimit))
	return sb.String()
}

func difficultyDefaults(difficulty string) (points, timeLimit int) {
	switch strings.ToLower(difficulty) {
	case "easy":
		return 50, 30
	case "hard":
		return 200, 15
	default: // medium
		return 100, 20
	}
}

func questionTypeDescription(qType string) string {
	switch qType {
	case "multiple_choice":
		return "Multiple Choice (4 options, exactly 1 correct)"
	case "true_false":
		return "True or False (2 options: True / False)"
	case "fill_blank":
		return "Fill in the Blank (one correct short answer)"
	case "reflection":
		return "Reflection / Open-ended (no graded answer, prompt for thought)"
	default:
		return "Multiple Choice"
	}
}

func jsonSchemaForType(qType string, points, timeLimit int) string {
	switch qType {
	case "multiple_choice":
		return fmt.Sprintf(`{
  "questions": [
    {
      "type": "multiple_choice",
      "text": "Question text here?",
      "options": [
        {"text": "Option A", "is_right": false},
        {"text": "Option B", "is_right": true},
        {"text": "Option C", "is_right": false},
        {"text": "Option D", "is_right": false}
      ],
      "explanation": "Brief explanation of the correct answer.",
      "points": %d,
      "time_limit": %d
    }
  ]
}`, points, timeLimit)

	case "true_false":
		return fmt.Sprintf(`{
  "questions": [
    {
      "type": "true_false",
      "text": "Statement to evaluate as true or false.",
      "options": [
        {"text": "True", "is_right": true},
        {"text": "False", "is_right": false}
      ],
      "explanation": "Brief explanation.",
      "points": %d,
      "time_limit": %d
    }
  ]
}`, points, timeLimit)

	case "fill_blank":
		return fmt.Sprintf(`{
  "questions": [
    {
      "type": "fill_blank",
      "text": "The ___ is the powerhouse of the cell.",
      "answer": "mitochondria",
      "explanation": "Brief explanation.",
      "points": %d,
      "time_limit": %d
    }
  ]
}`, points, timeLimit)

	case "reflection":
		return fmt.Sprintf(`{
  "questions": [
    {
      "type": "reflection",
      "text": "Open-ended question or reflective prompt here.",
      "explanation": "Key ideas or points to consider.",
      "points": 0,
      "time_limit": %d
    }
  ]
}`, timeLimit)

	default:
		return jsonSchemaForType("multiple_choice", points, timeLimit)
	}
}

// validateQuestions filters out structurally invalid questions and enforces
// the expected type. Silently drops bad items; returns nil if none pass.
func validateQuestions(qs []GeneratedQuestion, expectedType string) []GeneratedQuestion {
	out := make([]GeneratedQuestion, 0, len(qs))
	for _, q := range qs {
		if strings.TrimSpace(q.Text) == "" {
			continue
		}
		// Normalise type to the expected one (Gemini occasionally returns wrong type)
		q.Type = expectedType

		switch expectedType {
		case "multiple_choice", "true_false":
			if len(q.Options) < 2 {
				continue
			}
			rightCount := 0
			for _, o := range q.Options {
				if o.IsRight {
					rightCount++
				}
			}
			if rightCount != 1 {
				continue
			}

		case "fill_blank":
			if strings.TrimSpace(q.Answer) == "" {
				continue
			}

		case "reflection":
			// No answer required; always valid if text is present.
			q.Points = 0 // reflection questions are always ungraded
		}

		if q.Points <= 0 && expectedType != "reflection" {
			q.Points = 100 // safe default
		}
		if q.TimeLimit <= 0 {
			q.TimeLimit = 20 // safe default
		}

		out = append(out, q)
	}
	return out
}
