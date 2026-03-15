import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import AnalyticsPage from './pages/dashboard/AnalyticsPage'
import MarketplacePage from './pages/marketplace/MarketplacePage'
import QuizPreviewPage from './pages/marketplace/QuizPreviewPage'
import SoloPlayPage from './pages/marketplace/SoloPlayPage'
import CreateQuizPage from './pages/quiz/CreateQuizPage'
import EditQuizPage from './pages/quiz/EditQuizPage'
import HostGamePage from './pages/game/HostGamePage'
import JoinGamePage from './pages/game/JoinGamePage'
import PlayGamePage from './pages/game/PlayGamePage'
import ResultsPage from './pages/game/ResultsPage'
import DocsPage from './pages/DocsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function TeacherOnlyRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (user && user.role !== 'teacher') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function App() {
  const { loadUser, token } = useAuthStore()

  useEffect(() => {
    if (token) {
      loadUser()
    }
  }, [token, loadUser])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <TeacherOnlyRoute>
            <AnalyticsPage />
          </TeacherOnlyRoute>
        }
      />
      <Route
        path="/quiz/create"
        element={
          <TeacherOnlyRoute>
            <CreateQuizPage />
          </TeacherOnlyRoute>
        }
      />
      <Route
        path="/quiz/:id/edit"
        element={
          <TeacherOnlyRoute>
            <EditQuizPage />
          </TeacherOnlyRoute>
        }
      />
      <Route
        path="/game/host/:pin"
        element={
          <ProtectedRoute>
            <HostGamePage />
          </ProtectedRoute>
        }
      />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/marketplace/:id" element={<QuizPreviewPage />} />
      <Route path="/marketplace/:id/play" element={<SoloPlayPage />} />
      <Route path="/join" element={<JoinGamePage />} />
      <Route path="/play/:pin" element={<PlayGamePage />} />
      <Route path="/results/:pin" element={<ResultsPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
