export interface User {
  id: string
  name: string
  email: string
  role: 'teacher' | 'student'
  institution?: string
  institution_type?: string
  location?: string
  years_of_exp?: number
  bio?: string
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

export type QuestionType = 'multiple_choice' | 'image_based' | 'match_pair' | 'fill_blank' | 'true_false'

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
}

export interface Quiz {
  id: string
  teacher_id: string
  title: string
  description: string
  images: string[]
  questions: Question[]
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
