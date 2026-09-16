import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { playerAPI } from '../../lib/api'
import { useGameStore } from '../../store/gameStore'
import PAELogo from '../../components/ui/PAELogo'

interface JoinFormData {
  pin: string
  nickname: string
}

export default function JoinGamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillPin = searchParams.get('pin')?.toUpperCase() ?? ''
  const { setMyPlayerID, setMyNickname, reset } = useGameStore()
  const [joinError, setJoinError] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormData>({ defaultValues: { pin: prefillPin } })

  const onSubmit = async (data: JoinFormData) => {
    setJoinError(null)
    try {
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
        setJoinError('Invalid response from server')
        return
      }
      reset()
      setMyPlayerID(result.player_id)
      setMyNickname(data.nickname.trim())
      navigate(`/play/${trimmedPin}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not join game. Check your PIN and try again.'
      setJoinError(msg)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#102f3b] via-[#174957] to-[#183a50] flex items-center justify-center p-4">
      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[#5db8b3]/[0.07] blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[450px] h-[450px] rounded-full bg-[#6fa8c2]/[0.07] blur-3xl" />
        <div className="absolute top-0 right-0 h-px w-2/5 bg-gradient-to-l from-[#e5a92f]/70 to-transparent" />
      </div>

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='15' cy='15' r='1.2'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Back to home */}
      <Link
        to="/"
        className="fixed top-5 left-5 flex items-center gap-2 text-white/70 hover:text-white transition-all text-sm font-medium group z-10"
      >
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        <span className="hidden sm:block">Home</span>
      </Link>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-5 rounded-[1.4rem] border border-[#d9b15c]/40 bg-[#0b3442]/80 p-3 shadow-[0_14px_35px_rgba(5,35,46,0.28)]">
            <PAELogo variant="dark" size="lg" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Join Game</h1>
          <p className="text-white/60 mt-2 text-sm">Enter the PIN from your teacher</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.13] backdrop-blur-xl rounded-3xl border border-[#d9b15c]/25 shadow-2xl p-7">
          {joinError && (
            <div className="mb-5 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl flex items-start gap-3 text-white text-sm">
              <svg className="w-5 h-5 shrink-0 text-red-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {joinError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* PIN */}
            <div>
              <label className="text-white/80 text-sm font-semibold block mb-3 text-center">Game PIN</label>
              <input
                type="text"
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                onFocus={() => setFocused('pin')}
                className={`w-full text-center text-4xl font-black tracking-[0.4em] py-5 px-4 bg-white/10 border-2 rounded-2xl text-white placeholder-white/20 focus:outline-none transition-all ${
                  focused === 'pin'
                    ? 'border-white/60 bg-white/15 shadow-lg shadow-white/10'
                    : 'border-white/20'
                }`}
                {...register('pin', {
                  required: 'PIN is required',
                  validate: (v) => v.trim().toUpperCase().length === 6 || 'PIN must be 6 characters',
                  onBlur: () => setFocused(null),
                })}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                }}
              />
              {errors.pin && (
                <p className="text-red-300 text-xs mt-2 text-center">{errors.pin.message}</p>
              )}
            </div>

            {/* Nickname */}
            <div>
              <label className="text-white/80 text-sm font-semibold block mb-2">Your Nickname</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="e.g. QuizMaster99"
                  onFocus={() => setFocused('nick')}
                  className={`w-full pl-12 pr-4 py-4 bg-white/10 border-2 rounded-2xl text-white placeholder-white/30 focus:outline-none transition-all text-sm font-medium ${
                    focused === 'nick'
                      ? 'border-white/60 bg-white/15 shadow-lg shadow-white/10'
                      : 'border-white/20'
                  }`}
                  {...register('nickname', {
                    required: 'Nickname is required',
                    minLength: { value: 2, message: 'Min 2 characters' },
                    maxLength: { value: 20, message: 'Max 20 characters' },
                    onBlur: () => setFocused(null),
                  })}
                />
              </div>
              {errors.nickname && (
                <p className="text-red-300 text-xs mt-1.5 ml-1">{errors.nickname.message}</p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-[#d9f1ef] text-[#0b5262] border border-[#8bcac8] font-black rounded-2xl hover:bg-[#c4e8e5] active:scale-[0.98] transition-all shadow-lg shadow-[#062f3c]/20 text-base disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Joining...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Join Game
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center">
            <p className="text-white/35 text-xs">
              Are you a teacher?{' '}
              <Link to="/login" className="text-white/60 hover:text-white transition-colors font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-white/25 text-xs mt-5">
          PAE — Real-time Quiz Platform
        </p>
      </div>
    </div>
  )
}
