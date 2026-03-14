import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizAPI } from '../../lib/api'
import type { Quiz } from '../../types'
import CreateQuizPage from './CreateQuizPage'

export default function EditQuizPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      navigate('/dashboard')
      return
    }
    setIsLoading(true)
    quizAPI
      .getById(id)
      .then((data) => {
        setQuiz(data)
      })
      .catch((err) => {
        console.error('Failed to load quiz:', err)
        setError('Failed to load quiz. Please try again.')
      })
      .finally(() => setIsLoading(false))
  }, [id, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin w-10 h-10 text-primary-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium">{error ?? 'Quiz not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 text-primary-600 hover:underline text-sm font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Map quiz data to form-compatible format
  const initialData = {
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions.map((q) => ({
      type: q.type,
      text: q.text,
      image: q.image ?? '',
      options: q.options ?? [
        { id: '1', text: '', is_right: true },
        { id: '2', text: '', is_right: false },
        { id: '3', text: '', is_right: false },
        { id: '4', text: '', is_right: false },
      ],
      match_pairs: q.match_pairs ?? [{ left: '', right: '' }, { left: '', right: '' }],
      answer: q.answer ?? '',
      time_limit: q.time_limit,
      points: q.points,
    })),
  }

  return (
    <CreateQuizPage
      initialData={initialData}
      quizId={quiz.id}
      isEditing={true}
    />
  )
}
