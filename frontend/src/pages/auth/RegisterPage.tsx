import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../../store/authStore'

interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: 'teacher' | 'student'
  institution: string
  institution_type: string
  location: string
  years_of_exp: number
  bio: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser, isLoading, error, token, clearError } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormData>({
    defaultValues: { role: 'teacher' },
  })

  const watchRole = watch('role')

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    return () => clearError()
  }, [clearError])

  const handleNextStep = async () => {
    const valid = await trigger(['name', 'email', 'password', 'confirmPassword', 'role'])
    if (valid) setStep(2)
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        institution: data.institution || undefined,
        institution_type: data.institution_type || undefined,
        location: data.location || undefined,
        years_of_exp: data.years_of_exp ? Number(data.years_of_exp) : undefined,
        bio: data.bio || undefined,
      })
      navigate('/dashboard')
    } catch {
      // error is set in store
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] left-[-5%] w-96 h-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="animate-blobFloat absolute top-[50%] left-[20%] w-64 h-64 rounded-full bg-purple-400/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Back button */}
      <button
        onClick={() => step === 2 ? setStep(1) : navigate('/')}
        className="animate-fadeInLeft fixed top-5 left-5 flex items-center gap-2 text-white/70 hover:text-white transition-all text-sm font-medium group z-10"
      >
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        <span className="hidden sm:block">{step === 2 ? 'Back' : 'Home'}</span>
      </button>

      <div className="w-full max-w-md relative z-10">
        {/* Logo + step indicator */}
        <div className="animate-fadeInDown text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-xl mb-4 animate-float">
            <span className="text-3xl font-black text-white">P</span>
          </div>
          <h1 className="text-2xl font-black text-white">Create your account</h1>
          <p className="text-white/50 mt-1.5 text-sm">Join PAE — it's free</p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {([1, 2] as const).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-8 bg-white' : s < step ? 'w-4 bg-white/60' : 'w-4 bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="animate-slideUpFade bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8">
          {error && (
            <div className="animate-fadeInDown mb-5 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl flex items-center gap-3 text-white text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* STEP 1: Account basics */}
            {step === 1 && (
              <div className="space-y-4">
                {/* Role selector */}
                <div className="animate-fadeInUp">
                  <label className="text-white/80 text-sm font-medium block mb-2">I am a...</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['teacher', 'student'] as const).map((role) => (
                      <label
                        key={role}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                          watchRole === role
                            ? 'border-white/60 bg-white/20'
                            : 'border-white/15 bg-white/5 hover:border-white/30'
                        }`}
                      >
                        <input type="radio" value={role} className="sr-only" {...register('role')} />
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          role === 'teacher' ? 'bg-violet-400/30' : 'bg-amber-400/30'
                        }`}>
                          {role === 'teacher' ? (
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-semibold capitalize text-white">{role}</span>
                        {watchRole === role && (
                          <svg className="w-4 h-4 text-white ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div className="animate-fadeInUp delay-100">
                  <label className="text-white/80 text-sm font-medium block mb-2">Full name</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
                      {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 chars' } })}
                    />
                  </div>
                  {errors.name && <p className="text-red-300 text-xs mt-1 ml-1">{errors.name.message}</p>}
                </div>

                {/* Email */}
                <div className="animate-fadeInUp delay-150">
                  <label className="text-white/80 text-sm font-medium block mb-2">Email address</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
                      {...register('email', {
                        required: 'Email is required',
                        pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' },
                      })}
                    />
                  </div>
                  {errors.email && <p className="text-red-300 text-xs mt-1 ml-1">{errors.email.message}</p>}
                </div>

                {/* Password */}
                <div className="animate-fadeInUp delay-200">
                  <label className="text-white/80 text-sm font-medium block mb-2">Password</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      className="w-full pl-11 pr-12 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
                      {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword
                          ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M3 3l18 18"
                          : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        } />
                      </svg>
                    </button>
                  </div>
                  {errors.password && <p className="text-red-300 text-xs mt-1 ml-1">{errors.password.message}</p>}
                </div>

                {/* Confirm password */}
                <div className="animate-fadeInUp delay-300">
                  <label className="text-white/80 text-sm font-medium block mb-2">Confirm password</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      placeholder="Repeat password"
                      className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (v) => v === watch('password') || 'Passwords do not match',
                      })}
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-red-300 text-xs mt-1 ml-1">{errors.confirmPassword.message}</p>}
                </div>

                {watchRole === 'teacher' ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full py-4 bg-white text-violet-700 font-bold rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xl shadow-black/20 text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    Continue
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-white text-violet-700 font-bold rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xl shadow-black/20 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {isLoading ? (
                      <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating account...</>
                    ) : (
                      <>Create Account <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* STEP 2: Teacher profile info */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="animate-fadeInDown text-center mb-2">
                  <h2 className="text-white font-bold text-lg">Tell us about yourself</h2>
                  <p className="text-white/50 text-sm mt-1">Help students and admins know you better <span className="text-white/30">(optional)</span></p>
                </div>

                {/* Institution name */}
                <div className="animate-fadeInUp delay-100">
                  <label className="text-white/80 text-sm font-medium block mb-2">Institution / School name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sunrise Public School"
                    className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
                    {...register('institution')}
                  />
                </div>

                {/* Institution type */}
                <div className="animate-fadeInUp delay-150">
                  <label className="text-white/80 text-sm font-medium block mb-2">Type of institution</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['school', 'college', 'university'] as const).map((type) => {
                      const watchType = watch('institution_type')
                      return (
                        <label
                          key={type}
                          className={`flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-medium capitalize ${
                            watchType === type
                              ? 'border-white/60 bg-white/20 text-white'
                              : 'border-white/15 bg-white/5 text-white/50 hover:border-white/30 hover:text-white/80'
                          }`}
                        >
                          <input type="radio" value={type} className="sr-only" {...register('institution_type')} />
                          {type}
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Location */}
                <div className="animate-fadeInUp delay-200">
                  <label className="text-white/80 text-sm font-medium block mb-2">Location (City, State)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Chennai, Tamil Nadu"
                      className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
                      {...register('location')}
                    />
                  </div>
                </div>

                {/* Years of experience */}
                <div className="animate-fadeInUp delay-250">
                  <label className="text-white/80 text-sm font-medium block mb-2">Years of teaching experience</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
                    {...register('years_of_exp', { valueAsNumber: true })}
                  />
                </div>

                {/* Bio */}
                <div className="animate-fadeInUp delay-300">
                  <label className="text-white/80 text-sm font-medium block mb-2">Short bio <span className="text-white/30">(optional)</span></label>
                  <textarea
                    rows={2}
                    placeholder="Tell students a little about yourself..."
                    className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm resize-none"
                    {...register('bio')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-white text-violet-700 font-bold rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xl shadow-black/20 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating account...</>
                  ) : (
                    <>Create Account <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={isLoading}
                  className="w-full py-2.5 text-white/50 hover:text-white/80 text-sm transition-colors"
                >
                  Skip and create account
                </button>
              </div>
            )}
          </form>

          <div className="mt-5 text-center">
            <p className="text-white/40 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-white font-semibold hover:text-violet-200 transition-colors">
                Sign in
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
