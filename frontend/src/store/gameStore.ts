import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QuizSession, Quiz, Player, LeaderboardEntry, Question } from '../types'

// TIP: Use selectors to prevent unnecessary re-renders:
// Instead of: const store = useGameStore()
// Use: const myPlayerID = useGameStore(s => s.myPlayerID)
// This only subscribes to changes in myPlayerID, not the entire store

interface GameState {
  session: QuizSession | null
  quiz: Quiz | null
  players: Player[]
  leaderboard: LeaderboardEntry[]
  currentQuestion: Question | null
  timeRemaining: number
  hasAnswered: boolean
  myScore: number
  myPlayerID: string | null
  myNickname: string | null
  lastAnswerCorrect: boolean | null
  pointsEarned: number
  questionIndex: number
  /** Persisted: last known game PIN so we can detect re-entry to same game */
  activePin: string | null
  /** Persisted: last known player phase so UI can restore on re-mount */
  savedPhase: string | null
  /** Persisted: last question ID answered — prevents duplicate submit after page reload */
  lastAnsweredQuestionId: string | null

  setSession: (s: QuizSession) => void
  setQuiz: (q: Quiz) => void
  setPlayers: (p: Player[]) => void
  addPlayer: (p: Player) => void
  updateLeaderboard: (l: LeaderboardEntry[]) => void
  setCurrentQuestion: (q: Question | null) => void
  setTimeRemaining: (t: number | ((prev: number) => number)) => void
  setHasAnswered: (v: boolean) => void
  setMyScore: (score: number) => void
  setMyPlayerID: (id: string) => void
  setMyNickname: (name: string) => void
  setLastAnswerResult: (correct: boolean, points: number) => void
  incrementQuestionIndex: () => void
  setActivePin: (pin: string | null) => void
  setSavedPhase: (phase: string | null) => void
  setLastAnsweredQuestionId: (id: string | null) => void
  reset: () => void
}

const initialState = {
  session: null,
  quiz: null,
  players: [],
  leaderboard: [],
  currentQuestion: null,
  timeRemaining: 0,
  hasAnswered: false,
  myScore: 0,
  myPlayerID: null,
  myNickname: null,
  lastAnswerCorrect: null,
  pointsEarned: 0,
  questionIndex: 0,
  activePin: null,
  savedPhase: null,
  lastAnsweredQuestionId: null,
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (session) => set({ session }),

      setQuiz: (quiz) => set({ quiz }),

      setPlayers: (players) => set({ players: players ?? [] }),

      addPlayer: (player) =>
        set((state) => ({
          players: state.players.some((p) => p.id === player.id)
            ? state.players.map((p) => (p.id === player.id ? player : p))
            : [...state.players, player],
        })),

      updateLeaderboard: (leaderboard) => set({ leaderboard }),

      setCurrentQuestion: (currentQuestion) =>
        set({ currentQuestion, hasAnswered: false }),

      setTimeRemaining: (t) =>
        set((state) => ({ timeRemaining: typeof t === 'function' ? t(state.timeRemaining) : t })),

      setHasAnswered: (hasAnswered) => set({ hasAnswered }),

      setMyScore: (myScore) => set({ myScore }),

      setMyPlayerID: (myPlayerID) => set({ myPlayerID }),

      setMyNickname: (myNickname) => set({ myNickname }),

      setLastAnswerResult: (correct, points) =>
        set((state) => ({
          lastAnswerCorrect: correct,
          pointsEarned: points,
          myScore: state.myScore + points,
        })),

      incrementQuestionIndex: () =>
        set((state) => ({ questionIndex: state.questionIndex + 1 })),

      setActivePin: (activePin) => set({ activePin }),
      setSavedPhase: (savedPhase) => set({ savedPhase }),
      setLastAnsweredQuestionId: (lastAnsweredQuestionId) => set({ lastAnsweredQuestionId }),

      reset: () => set({
        session: null,
        quiz: null,
        players: [],
        leaderboard: [],
        currentQuestion: null,
        timeRemaining: 0,
        hasAnswered: false,
        lastAnswerCorrect: null,
        pointsEarned: 0,
        questionIndex: 0,
        myScore: 0,
        activePin: null,
        savedPhase: null,
        lastAnsweredQuestionId: null,
      }),
    }),
    {
      name: 'game-store',
      partialize: (state) => ({
        myPlayerID: state.myPlayerID,
        myNickname: state.myNickname,
        myScore: state.myScore,
        activePin: state.activePin,
        savedPhase: state.savedPhase,
        currentQuestion: state.currentQuestion,
        questionIndex: state.questionIndex,
        leaderboard: state.leaderboard,
        lastAnsweredQuestionId: state.lastAnsweredQuestionId,
      }),
    }
  )
)
