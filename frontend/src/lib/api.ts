import axios from 'axios'
import type {
  User,
  Quiz,
  Question,
  QuizSession,
  Player,
  PlatformStats,
  LeaderboardEntry,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  AuthResponse,
  JoinGamePayload,
  JoinGameResponse,
  CreateQuizPayload,
  SessionWithQuiz,
  SessionAnalytics,
  QuizAnalyticsOverview,
  TeacherAnalyticsOverview,
  PlayerAttempt,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to attach Authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

// Auth API
export const authAPI = {
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', payload)
    return data
  },

  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', payload)
    return data
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me')
    return data
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<User> => {
    const { data } = await api.put<User>('/auth/profile', payload)
    return data
  },
}

// Quiz API
export const quizAPI = {
  create: async (payload: CreateQuizPayload): Promise<Quiz> => {
    const { data } = await api.post<Quiz>('/quizzes', payload)
    return data
  },

  list: async (): Promise<Quiz[]> => {
    const { data } = await api.get<Quiz[]>('/quizzes')
    return data
  },

  getById: async (id: string): Promise<Quiz> => {
    const { data } = await api.get<Quiz>(`/quizzes/${id}`)
    return data
  },

  update: async (id: string, payload: Partial<CreateQuizPayload>): Promise<Quiz> => {
    const { data } = await api.put<Quiz>(`/quizzes/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/quizzes/${id}`)
  },

  // General image upload – no quiz ID required, returns GCS URL
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData()
    formData.append('image', file)
    const { data } = await api.post<{ url: string }>('/quizzes/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  generateWithAI: async (payload: {
    topic: string
    difficulty: 'easy' | 'medium' | 'hard'
    type: string
    count: number
    context?: string
  }): Promise<Question[]> => {
    const { data } = await api.post<Question[]>('/quizzes/ai/generate', payload)
    return data
  },
}

// Game / Session API
export const gameAPI = {
  createSession: async (quizId: string): Promise<QuizSession> => {
    const { data } = await api.post<QuizSession>('/game/sessions', {
      quiz_id: quizId,
    })
    return data
  },

  getByPIN: async (pin: string): Promise<QuizSession> => {
    const { data } = await api.get<QuizSession>(`/game/sessions/${pin}`)
    return data
  },

  start: async (pin: string): Promise<void> => {
    await api.post(`/game/sessions/${pin}/start`)
  },

  next: async (pin: string): Promise<void> => {
    await api.post(`/game/sessions/${pin}/next`)
  },

  end: async (pin: string): Promise<void> => {
    await api.post(`/game/sessions/${pin}/end`)
  },

  getLeaderboard: async (sessionId: string): Promise<LeaderboardEntry[]> => {
    const { data } = await api.get<{ players: Player[] }>(
      `/game/sessions/${sessionId}/leaderboard`
    )
    const players = (data.players ?? []) as Player[]
    return players
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ player_id: p.id, nickname: p.nickname, score: p.score, rank: i + 1 }))
  },

  getCurrentQuestion: async (pin: string): Promise<{
    question_index: number
    total_questions: number
    question: Question
    time_limit: number
  } | null> => {
    try {
      const { data } = await api.get(`/game/sessions/${pin}/current-question`)
      return data
    } catch {
      return null
    }
  },

  getResults: async (pin: string): Promise<{
    session_id: string
    quiz_title: string
    total_players: number
    total_questions: number
    leaderboard: LeaderboardEntry[]
    question_stats: { question_id: string; text: string; correct_count: number; total_answers: number; avg_time_taken: number }[]
  }> => {
    const session = await api.get<QuizSession>(`/game/sessions/${pin}`).then((r) => r.data)
    const { data } = await api.get<{ players: Player[] }>(`/game/sessions/${pin}/leaderboard`)
    const players = (data.players ?? []) as Player[]
    const leaderboard: LeaderboardEntry[] = players
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ player_id: p.id, nickname: p.nickname, score: p.score, rank: i + 1 }))
    return {
      session_id: session.id,
      quiz_title: 'Quiz Results',
      total_players: players.length,
      total_questions: 0,
      leaderboard,
      question_stats: [],
    }
  },
}


// Player API
export const playerAPI = {
  join: async (payload: JoinGamePayload): Promise<JoinGameResponse> => {
    const { data } = await api.post<JoinGameResponse>('/players/join', payload)
    return data
  },

  submitAnswer: async (
    playerId: string,
    payload: { pin: string; question_id: string; answer: string; time_left: number; total_time: number },
  ): Promise<{ is_correct: boolean; points: number; total_score: number }> => {
    const { data } = await api.post(`/players/${playerId}/answer`, payload)
    return data
  },
}

// Platform stats API
export const platformAPI = {
  getStats: async (): Promise<PlatformStats> => {
    const { data } = await api.get<PlatformStats>('/platform/stats')
    return data
  },
}

// Session API
export const sessionAPI = {
  list: async (): Promise<SessionWithQuiz[]> => {
    const { data } = await api.get<SessionWithQuiz[]>('/sessions')
    return data
  },

  getById: async (id: string): Promise<QuizSession> => {
    const { data } = await api.get<QuizSession>(`/sessions/${id}`)
    return data
  },

  getPlayers: async (sessionId: string): Promise<Player[]> => {
    const { data } = await api.get<Player[]>(`/sessions/${sessionId}/players`)
    return data
  },
}

// Analytics API (teacher-only)
export const analyticsAPI = {
  getOverview: async (): Promise<TeacherAnalyticsOverview> => {
    const { data } = await api.get<TeacherAnalyticsOverview>('/analytics/overview')
    return data
  },

  getSession: async (sessionId: string): Promise<SessionAnalytics> => {
    const { data } = await api.get<SessionAnalytics>(`/analytics/sessions/${sessionId}`)
    return data
  },

  getQuiz: async (quizId: string): Promise<QuizAnalyticsOverview> => {
    const { data } = await api.get<QuizAnalyticsOverview>(`/analytics/quizzes/${quizId}`)
    return data
  },
}

// Student API
export const studentAPI = {
  getAttempts: async (): Promise<PlayerAttempt[]> => {
    const { data } = await api.get<PlayerAttempt[]>('/players/my-attempts')
    return data
  },
}

// Marketplace API
export const marketplaceAPI = {
  list: async (category?: string, search?: string): Promise<Quiz[]> => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (search) params.set('q', search)
    const { data } = await api.get<Quiz[]>(`/marketplace?${params.toString()}`)
    return data
  },

  import: async (quizId: string): Promise<Quiz> => {
    const { data } = await api.post<Quiz>(`/marketplace/${quizId}/copy`)
    return data
  },

  publish: async (quizId: string, isPublic: boolean): Promise<void> => {
    await api.put(`/quizzes/${quizId}/publish`, { is_public: isPublic })
  },

  checkAnswer: async (quizId: string, questionId: string, answer: string): Promise<{ is_correct: boolean; correct_answer: string; points: number }> => {
    const { data } = await api.post(`/marketplace/${quizId}/check-answer`, { question_id: questionId, answer })
    return data
  },
}

export default api
