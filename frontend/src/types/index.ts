export interface User {
  id: string
  name: string
  email: string
  role: 'teacher' | 'student' | 'admin'
  institution?: string
  institution_type?: string
  location?: string
  years_of_exp?: number
  bio?: string
  is_pro?: boolean
  is_admin?: boolean
  extra_sessions?: number
  extra_ai?: number
  created_at: string
}

export interface Option {
  id: string
  text: string
  is_right: boolean
}

export interface MatchPairItem {
  left: string
  right: string
}

export type QuestionType = 'multiple_choice' | 'image_based' | 'match_pair' | 'fill_blank' | 'true_false' | 'reflection'

export interface Question {
  id: string
  type: QuestionType
  text: string
  image?: string
  options?: Option[]
  match_pairs?: MatchPairItem[]
  answer?: string
  time_limit: number
  points: number
  explanation?: string
  is_ai_generated?: boolean
}

export interface Quiz {
  id: string
  teacher_id: string
  teacher_name?: string
  title: string
  description: string
  category?: string
  images: string[]
  questions: Question[]
  is_public: boolean
  usage_count: number
  source_id?: string
  created_at: string
  updated_at: string
}

export interface QuizSession {
  id: string
  quiz_id: string
  teacher_id: string
  pin: string
  status: 'waiting' | 'active' | 'finished'
  current_question: number
  started_at?: string
  ended_at?: string
  created_at: string
}

export interface Player {
  id: string
  session_id: string
  nickname: string
  score: number
  joined_at: string
}

export interface PlatformStats {
  total_quizzes: number
  total_sessions: number
  total_participants: number
  total_teachers: number
}

export interface LeaderboardEntry {
  player_id: string
  nickname: string
  score: number
  rank: number
  correct_answers?: number
  avg_time?: number
}

export interface SessionWithQuiz extends QuizSession {
  quiz_title?: string
  player_count?: number
}

export interface CreateQuizPayload {
  title: string
  description: string
  questions: Omit<Question, 'id'>[]
  is_public?: boolean
  category?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  role: 'teacher' | 'student'
  institution?: string
  institution_type?: string
  location?: string
  years_of_exp?: number
  bio?: string
}

export interface UpdateProfilePayload {
  name?: string
  institution?: string
  institution_type?: string
  location?: string
  years_of_exp?: number
  bio?: string
  current_password?: string
  new_password?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface JoinGamePayload {
  pin: string
  nickname: string
}

export interface JoinGameResponse {
  player_id: string
  session_id: string
  nickname: string
}

export interface AnswerPayload {
  question_id: string
  answer: string
  time_taken: number
}

export interface AnswerResult {
  correct: boolean
  points_earned: number
  correct_answer: string
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface QuestionStat {
  question_id: string
  question_text: string
  correct_count: number
  total_answers: number
  accuracy_pct: number
  avg_time_left: number
  answer_distribution: Record<string, number>
}

export interface SessionAnalytics {
  session_id: string
  quiz_title: string
  total_players: number
  total_questions: number
  avg_score: number
  completion_rate: number
  leaderboard: LeaderboardEntry[]
  question_stats: QuestionStat[]
}

export interface QuizAnalyticsOverview {
  quiz_id: string
  quiz_title: string
  total_sessions: number
  total_players: number
  avg_score_per_session: number
  question_difficulty: { question_id: string; text: string; avg_accuracy_pct: number }[]
}

export interface TeacherAnalyticsOverview {
  total_quizzes: number
  total_sessions: number
  total_students: number
  avg_score_all_sessions: number
  sessions_per_month: { month: string; count: number }[]
}

// ── Student Attempts ──────────────────────────────────────────────────────────

export interface PlayerAttempt {
  player_id: string
  session_id: string
  pin: string
  quiz_title: string
  quiz_id: string
  teacher_name: string
  score: number
  correct_answers: number
  total_questions: number
  played_at: string
}
