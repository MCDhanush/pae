import { create } from 'zustand'
import { authAPI } from '../lib/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role?: 'teacher' | 'student') => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const { token, user } = await authAPI.login({ email, password })
      localStorage.setItem('auth_token', token)
      set({ token, user, isLoading: false })
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Login failed'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  register: async (name: string, email: string, password: string, role: 'teacher' | 'student' = 'teacher') => {
    set({ isLoading: true, error: null })
    try {
      const { token, user } = await authAPI.register({ name, email, password, role })
      localStorage.setItem('auth_token', token)
      set({ token, user, isLoading: false })
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Registration failed'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    set({ user: null, token: null, error: null })
  },

  loadUser: async () => {
    const { token } = get()
    if (!token) return
    set({ isLoading: true })
    try {
      const user = await authAPI.getMe()
      set({ user, isLoading: false })
    } catch {
      localStorage.removeItem('auth_token')
      set({ user: null, token: null, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
