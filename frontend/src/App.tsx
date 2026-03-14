import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import CreateQuizPage from './pages/quiz/CreateQuizPage'
import EditQuizPage from './pages/quiz/EditQuizPage'
import HostGamePage from './pages/game/HostGamePage'
import JoinGamePage from './pages/game/JoinGamePage'
import PlayGamePage from './pages/game/PlayGamePage'
import ResultsPage from './pages/game/ResultsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) {
    return <Navigate to="/login" replace />
  }
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
        path="/quiz/create"
        element={
          <ProtectedRoute>
            <CreateQuizPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz/:id/edit"
        element={
          <ProtectedRoute>
            <EditQuizPage />
          </ProtectedRoute>
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
      <Route path="/join" element={<JoinGamePage />} />
      <Route path="/play/:pin" element={<PlayGamePage />} />
      <Route path="/results/:pin" element={<ResultsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
