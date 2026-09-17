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
    <div className="route-light min-h-screen relative overflow-hidden bg-gradient-to-br from-[#fffdf8] via-[#f6faf9] to-[#eaf4f7] flex items-center justify-center p-4">
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
        className="fixed top-5 left-5 z-10 flex items-center gap-2 text-sm font-medium text-[#486375] transition-all hover:text-[#0f6b78] group"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c9dadd] bg-white/80 transition-colors group-hover:bg-[#d9f1ef]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        <span className="hidden sm:block">Home</span>
      </Link>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-5 rounded-[1.4rem] border border-[#e5a92f]/45 bg-white/90 p-3 shadow-[0_14px_35px_rgba(24,50,71,0.14)]">
            <PAELogo variant="light" size="lg" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-[#183247]">Join Game</h1>
          <p className="mt-2 text-sm text-[#60778a]">Enter the PIN from your teacher</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-[#c9dadd] bg-white/90 p-7 shadow-[0_18px_45px_rgba(24,50,71,0.12)] backdrop-blur-xl">
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
              <label className="mb-3 block text-center text-sm font-semibold text-[#183247]">Game PIN</label>
              <input
                type="text"
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                onFocus={() => setFocused('pin')}
                className={`w-full rounded-2xl border-2 bg-white py-5 px-4 text-center text-4xl font-black tracking-[0.4em] text-[#183247] placeholder-[#9aadb5] focus:outline-none transition-all ${
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
              <label className="mb-2 block text-sm font-semibold text-[#183247]">Your Nickname</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#78909c]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="e.g. QuizMaster99"
                  onFocus={() => setFocused('nick')}
                  className={`w-full rounded-2xl border-2 bg-white py-4 pl-12 pr-4 text-sm font-medium text-[#183247] placeholder-[#9aadb5] focus:outline-none transition-all ${
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
            <p className="text-xs text-[#78909c]">
              Are you a teacher?{' '}
              <Link to="/login" className="font-medium text-[#0f6b78] transition-colors hover:text-[#0b5262]">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[#78909c]">
          PAE — Real-time Quiz Platform
        </p>
      </div>
    </div>
  )
}
