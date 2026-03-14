import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { playerAPI } from '../../lib/api'
import { useGameStore } from '../../store/gameStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

interface JoinFormData {
  pin: string
  nickname: string
}

export default function JoinGamePage() {
  const navigate = useNavigate()
  const { setMyPlayerID, setMyNickname } = useGameStore()
  const [joinError, setJoinError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormData>()

  const onSubmit = async (data: JoinFormData) => {
    setJoinError(null)
    try {
      // Validate PIN format before sending
      const trimmedPin = data.pin.trim().toUpperCase()
      if (!trimmedPin || trimmedPin.length !== 6) {
        setJoinError('PIN must be exactly 6 characters')
        return
      }

      const result = await playerAPI.join({
        pin: trimmedPin,
        nickname: data.nickname.trim(),
      })
      if (!result.player_id) {
        setJoinError('Invalid response from server - missing player_id')
        return
      }
      setMyPlayerID(result.player_id)
      setMyNickname(data.nickname.trim())
      
      // Ensure PIN is not empty before navigating
      const navigatePath = `/play/${trimmedPin}`
      navigate(navigatePath)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not join game. Check your PIN and try again.'
      setJoinError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      {/* Back to home */}
      <Link
        to="/"
        className="fixed top-4 left-4 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Home
      </Link>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white">Join Game</h1>
          <p className="text-white/70 mt-2">Enter the PIN to join the quiz</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {joinError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd" />
              </svg>
              {joinError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* PIN */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Game PIN</label>
              <input
                type="text"
                placeholder="e.g. 123456"
                maxLength={6}
                className="w-full text-center text-3xl font-black tracking-widest py-4 px-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-primary-500 uppercase transition-colors"
                {...register('pin', {
                  required: 'PIN is required',
                  validate: (value) => {
                    const trimmed = value.trim().toUpperCase()
                    if (trimmed.length !== 6) {
                      return 'PIN must be exactly 6 characters'
                    }
                    return true
                  },
                })}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                }}
              />
              {errors.pin && (
                <p className="text-sm text-red-600 mt-1">{errors.pin.message}</p>
              )}
            </div>

            {/* Nickname */}
            <Input
              id="nickname"
              label="Your Nickname"
              placeholder="e.g. QuizMaster99"
              required
              register={register('nickname', {
                required: 'Nickname is required',
                minLength: { value: 2, message: 'Nickname must be at least 2 characters' },
                maxLength: { value: 20, message: 'Nickname must be under 20 characters' },
              })}
              error={errors.nickname?.message}
              leftAddon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
            >
              Join Game
            </Button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-xs text-gray-400">
              Are you a teacher?{' '}
              <Link to="/login" className="text-primary-600 hover:underline font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
