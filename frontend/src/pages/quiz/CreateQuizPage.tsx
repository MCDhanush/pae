import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import gsap from 'gsap'
import { quizAPI } from '../../lib/api'
import type { QuestionType, MatchPairItem } from '../../types'
import MatchPairEditor from '../../components/quiz/MatchPairEditor'
import { QuestionTypePreview } from '../../components/quiz/QuestionCard'

interface OptionForm { id: string; text: string; is_right: boolean }
interface QuestionForm {
  type: QuestionType; text: string; image?: string
  options: OptionForm[]; match_pairs: MatchPairItem[]
  answer: string; time_limit: number; points: number
}
interface QuizForm { title: string; description: string; questions: QuestionForm[]; is_public: boolean; category: string }

const PRESET_CATEGORIES = ['Science', 'Math', 'History', 'Language', 'Geography', 'Technology', 'Arts', 'Other'] as const

function generateId() { return Math.random().toString(36).slice(2, 10) }

function defaultQuestion(type: QuestionType = 'multiple_choice'): QuestionForm {
  if (type === 'true_false') {
    const trueId = generateId()
    const falseId = generateId()
    return {
      type, text: '', image: '',
      options: [
        { id: trueId, text: 'True', is_right: true },
        { id: falseId, text: 'False', is_right: false },
      ],
      match_pairs: [],
      answer: '', time_limit: 20, points: 100,
    }
  }
  return {
    type, text: '', image: '',
    options: [
      { id: generateId(), text: '', is_right: true },
      { id: generateId(), text: '', is_right: false },
      { id: generateId(), text: '', is_right: false },
      { id: generateId(), text: '', is_right: false },
    ],
    match_pairs: [{ left: '', right: '' }, { left: '', right: '' }],
    answer: '', time_limit: 30, points: 100,
  }
}

const QUESTION_TYPE_TABS: { type: QuestionType; label: string; icon: string }[] = [
  { type: 'multiple_choice', label: 'Multiple Choice', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { type: 'image_based', label: 'Image Based', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { type: 'match_pair', label: 'Match Pair', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { type: 'fill_blank', label: 'Fill Blank', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { type: 'true_false', label: 'True / False', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
]

const STEPS = [
  { label: 'Info', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Questions', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Review', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
]

const OPTION_COLORS = [
  { border: 'border-red-500/30 bg-red-500/10', badge: 'from-red-500 to-rose-600', label: 'A' },
  { border: 'border-blue-500/30 bg-blue-500/10', badge: 'from-blue-500 to-indigo-600', label: 'B' },
  { border: 'border-amber-500/30 bg-amber-500/10', badge: 'from-amber-500 to-yellow-600', label: 'C' },
  { border: 'border-emerald-500/30 bg-emerald-500/10', badge: 'from-emerald-500 to-green-600', label: 'D' },
]

const darkInput = 'w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all'

// ── QuestionEditor ──────────────────────────────────────────────────────────
interface QuestionEditorProps {
  index: number; watchQuestions: QuestionForm[]; errors: any
  register: any; setValue: any; update: (i: number, v: QuestionForm) => void
  uploadingImage: boolean; handleImageUpload: (f: File, idx?: number) => Promise<void>
}

function QuestionEditor({ index, watchQuestions, errors, register, setValue, update, uploadingImage, handleImageUpload }: QuestionEditorProps) {
  const q = watchQuestions[index]
  if (!q) return null

  const handleOptionChange = (optIdx: number, field: 'text' | 'is_right', value: string | boolean) => {
    if (field === 'text') setValue(`questions.${index}.options.${optIdx}.text`, value as string)
    if (field === 'is_right') q.options.forEach((_, i) => setValue(`questions.${index}.options.${i}.is_right`, i === optIdx))
  }

  return (
    <div className="space-y-5">
      {/* Type tabs */}
      <div>
        <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">Question Type</label>
        <div className="flex gap-2 flex-wrap">
          {QUESTION_TYPE_TABS.map(({ type, label, icon }) => (
            <button
              key={type} type="button"
              onClick={() => update(index, { ...defaultQuestion(type), text: q.text })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                q.type === type
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">
          Question Text <span className="text-red-400">*</span>
        </label>
        <textarea
          rows={2}
          placeholder={q.type === 'fill_blank' ? 'e.g. The capital of France is [blank]' : 'Enter your question...'}
          {...register(`questions.${index}.text`, { required: 'Question text is required' })}
          className={`${darkInput} resize-none`}
        />
        {q.type === 'fill_blank' && <p className="text-xs text-violet-400/70 mt-1">Use [blank] to mark the blank position.</p>}
        {errors.questions?.[index]?.text && <p className="text-red-400 text-xs mt-1">{errors.questions[index].text.message}</p>}
      </div>

      {/* Image upload */}
      {q.type === 'image_based' && (
        <div>
          <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">Question Image</label>
          {q.image && (
            <div className="relative inline-block mb-3">
              <img src={q.image} alt="Question" className="max-h-36 rounded-xl border border-white/10" />
              <button type="button" onClick={() => setValue(`questions.${index}.image`, '')}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer px-4 py-2.5 bg-white/5 border border-dashed border-white/20 rounded-xl hover:bg-white/10 hover:border-white/30 transition-all w-fit">
            {uploadingImage ? (
              <svg className="animate-spin w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            <span className="text-sm text-white/60">{uploadingImage ? 'Uploading…' : 'Upload Image (max 2MB)'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], index)} />
          </label>
        </div>
      )}

      {/* Options */}
      {(q.type === 'multiple_choice' || q.type === 'image_based') && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Answer Options</label>
          {q.options.map((opt, optIdx) => (
            <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${opt.is_right ? 'border-emerald-500/40 bg-emerald-500/10' : OPTION_COLORS[optIdx % 4].border}`}>
              <button type="button" onClick={() => handleOptionChange(optIdx, 'is_right', true)}
                className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${opt.is_right ? 'border-emerald-400 bg-emerald-500' : 'border-white/30 hover:border-emerald-400'}`}>
                {opt.is_right && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${OPTION_COLORS[optIdx % 4].badge} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {OPTION_COLORS[optIdx % 4].label}
              </div>
              <input
                type="text" autoComplete="off" value={opt.text}
                onChange={(e) => handleOptionChange(optIdx, 'text', e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={`Option ${OPTION_COLORS[optIdx % 4].label}`}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"
              />
            </div>
          ))}
          <p className="text-xs text-white/30">Click the circle to mark the correct answer.</p>
        </div>
      )}

      {/* True / False */}
      {q.type === 'true_false' && (
        <div>
          <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-3">Correct Answer</label>
          <div className="flex gap-3">
            {q.options.map((opt, optIdx) => (
              <button
                key={opt.id} type="button"
                onClick={() => q.options.forEach((_, i) => setValue(`questions.${index}.options.${i}.is_right`, i === optIdx))}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all border-2 ${
                  opt.is_right
                    ? opt.text === 'True'
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                      : 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                    : 'bg-white/5 border-white/15 text-white/50 hover:bg-white/10'
                }`}
              >
                {opt.text === 'True' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {opt.text}
                {opt.is_right && <span className="text-xs opacity-75">(correct)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Match pairs */}
      {q.type === 'match_pair' && (
        <MatchPairEditor pairs={q.match_pairs} onChange={(pairs) => update(index, { ...q, match_pairs: pairs })} />
      )}

      {/* Fill blank answer */}
      {q.type === 'fill_blank' && (
        <div>
          <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">
            Correct Answer <span className="text-red-400">*</span>
          </label>
          <input
            type="text" placeholder="e.g. Paris"
            {...register(`questions.${index}.answer`, { required: 'Answer is required' })}
            className={darkInput}
          />
          {errors.questions?.[index]?.answer && <p className="text-red-400 text-xs mt-1">{errors.questions[index].answer.message}</p>}
        </div>
      )}

      {/* Time + Points */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">
            Time Limit: <span className="text-violet-300">{q.time_limit}s</span>
          </label>
          <input
            type="range" min={10} max={60} step={5} value={q.time_limit}
            onChange={(e) => update(index, { ...q, time_limit: parseInt(e.target.value) })}
            className="w-full h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer accent-violet-500"
          />
          <div className="flex justify-between text-xs text-white/25 mt-1"><span>10s</span><span>60s</span></div>
        </div>
        <div>
          <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">Points</label>
          <select
            value={q.points}
            onChange={(e) => update(index, { ...q, points: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-white/40 transition-all"
          >
            {[50, 100, 150, 200, 500].map((p) => <option key={p} value={p} className="bg-gray-900">{p} points</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── CreateQuizPage ──────────────────────────────────────────────────────────
interface CreateQuizPageProps {
  initialData?: Partial<QuizForm>; quizId?: string; isEditing?: boolean
}

export default function CreateQuizPage({ initialData, quizId, isEditing = false }: CreateQuizPageProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { register, watch, control, setValue, getValues, formState: { errors }, trigger } = useForm<QuizForm>({
    defaultValues: { title: initialData?.title ?? '', description: initialData?.description ?? '', questions: initialData?.questions ?? [], is_public: false, category: '' },
  })
  const { fields: questionFields, append, remove, update } = useFieldArray({ control, name: 'questions' })
  const watchQuestions = watch('questions')
  const watchIsPublic = watch('is_public')

  // Track which dropdown option is selected separately from the saved category value.
  // When 'Other' is chosen the user types a custom subject; that text becomes the category.
  const initCategoryOption = (() => {
    const c = initialData?.category ?? ''
    if (!c) return ''
    return (PRESET_CATEGORIES as readonly string[]).includes(c) ? c : 'Other'
  })()
  const [categoryOption, setCategoryOption] = useState(initCategoryOption)

  // GSAP entry animation on step change
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gsap-step-content', { opacity: 0, y: 24, duration: 0.45, ease: 'power2.out' })
    }, containerRef)
    return () => ctx.revert()
  }, [step])

  const handleImageUpload = useCallback(async (file: File, questionIndex?: number) => {
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return }
    setUploadingImage(true)
    try {
      const { url } = await quizAPI.uploadImage(file)
      if (questionIndex !== undefined) setValue(`questions.${questionIndex}.image`, url)
    } catch { alert('Failed to upload image') }
    finally { setUploadingImage(false) }
  }, [setValue])

  const handleNextStep = async () => {
    if (step === 0) { const valid = await trigger(['title']); if (!valid) return }
    if (step === 1 && watchQuestions.length === 0) { alert('Please add at least one question'); return }
    setStep((s) => Math.min(s + 1, 2))
  }

  const handleSave = async () => {
    const data = getValues()
    if (!data.title.trim()) { setStep(0); return }
    if (data.questions.length === 0) { setStep(1); return }
    setIsSaving(true); setSaveError(null)
    try {
      const payload = {
        title: data.title, description: data.description,
        is_public: data.is_public,
        category: data.category || undefined,
        questions: data.questions.map((q) => ({
          type: q.type, text: q.text, image: q.image || undefined,
          options: q.type === 'multiple_choice' || q.type === 'image_based' || q.type === 'true_false' ? q.options : undefined,
          match_pairs: q.type === 'match_pair' ? q.match_pairs : undefined,
          answer: q.type === 'fill_blank' ? q.answer : undefined,
          time_limit: q.time_limit, points: q.points,
        })),
      }
      if (isEditing && quizId) await quizAPI.update(quizId, payload)
      else await quizAPI.create(payload)
      navigate('/dashboard')
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save quiz')
    } finally { setIsSaving(false) }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white" ref={containerRef}>
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E")` }} />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-white/50 hover:text-white/90 transition-colors text-sm font-medium group">
            <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <span className="hidden sm:block">Dashboard</span>
          </button>
          <h1 className="font-bold text-white text-sm">
            {isEditing ? 'Edit Quiz' : 'Create Quiz'}
          </h1>
          <div className="w-24" />
        </div>
      </header>

      {/* Step indicator */}
      <div className="relative z-10 bg-white/3 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  i < step ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : i === step ? 'bg-violet-600 shadow-lg shadow-violet-500/30' : 'bg-white/10'
                }`}>
                  {i < step ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className={`w-3.5 h-3.5 ${i === step ? 'text-white' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                    </svg>
                  )}
                </div>
                <span className={`text-xs font-semibold hidden sm:block ${i === step ? 'text-white' : 'text-white/30'}`}>{s.label}</span>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-px mx-1 transition-colors ${i < step ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* STEP 0: Basic Info */}
        {step === 0 && (
          <div className="gsap-step-content bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-5 max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white">Quiz Details</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">
                Quiz Title <span className="text-red-400">*</span>
              </label>
              <input
                id="title" type="text" placeholder="e.g. World Geography Quiz"
                {...register('title', { required: 'Title is required' })}
                className={darkInput}
              />
              {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">
                Description <span className="text-white/25 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                {...register('description')} autoComplete="off" spellCheck="false" rows={3}
                placeholder="Brief description of your quiz..."
                className={`${darkInput} resize-none`}
              />
            </div>

            {/* Marketplace toggle */}
            <div className="border-t border-white/10 pt-4">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-3">Marketplace</label>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <p className="text-sm font-semibold text-white/80">Publish to Marketplace</p>
                  <p className="text-xs text-white/35 mt-0.5">Let other teachers discover and copy this quiz</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue('is_public', !watchIsPublic)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${watchIsPublic ? 'bg-violet-500' : 'bg-white/15'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${watchIsPublic ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {watchIsPublic && (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Category</label>
                  <select
                    value={categoryOption}
                    onChange={e => {
                      const val = e.target.value
                      setCategoryOption(val)
                      if (val !== 'Other') setValue('category', val)
                      else setValue('category', '')
                    }}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-white/40 transition-all"
                  >
                    <option value="" className="bg-gray-900">Select a category...</option>
                    {PRESET_CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-gray-900">{c}</option>
                    ))}
                  </select>
                  {categoryOption === 'Other' && (
                    <input
                      {...register('category')}
                      type="text"
                      placeholder="e.g. Commerce, Accountancy, Law..."
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40 transition-all"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: Questions */}
        {step === 1 && (
          <div className="gsap-step-content grid md:grid-cols-5 gap-4">
            {/* Left: question list */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                  Questions <span className="text-violet-300">({questionFields.length})</span>
                </h3>
                <button type="button"
                  onClick={() => { append(defaultQuestion()); setEditingQuestionIndex(questionFields.length) }}
                  className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>

              {questionFields.length === 0 ? (
                <div className="py-10 text-center bg-white/3 border-2 border-dashed border-white/10 rounded-2xl">
                  <svg className="w-8 h-8 text-white/15 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-white/30 text-xs mb-2">No questions yet</p>
                  <button type="button"
                    onClick={() => { append(defaultQuestion()); setEditingQuestionIndex(0) }}
                    className="text-violet-400 text-xs font-semibold hover:text-violet-300 transition-colors">
                    Add your first question
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {questionFields.map((field, i) => {
                      const q = watchQuestions[i]
                      const isActive = editingQuestionIndex === i
                      return (
                        <div key={field.id} onClick={() => setEditingQuestionIndex(i)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all group ${isActive ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/10 hover:border-white/20 bg-white/3 hover:bg-white/5'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${isActive ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/50'}`}>
                                  {i + 1}
                                </span>
                                <span className="text-[10px] text-white/40 capitalize">{q?.type?.replace('_', ' ')}</span>
                              </div>
                              {q && <QuestionTypePreview question={{ ...q, id: field.id }} />}
                            </div>
                            <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); setEditingQuestionIndex(null) }}
                              className="p-1 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button type="button"
                    onClick={() => { append(defaultQuestion()); setEditingQuestionIndex(questionFields.length) }}
                    className="w-full py-2.5 text-xs text-violet-400 hover:text-violet-300 border-2 border-dashed border-violet-500/20 hover:border-violet-500/40 rounded-xl transition-all font-semibold flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Question
                  </button>
                </>
              )}
            </div>

            {/* Right: editor */}
            <div className="md:col-span-3">
              {editingQuestionIndex !== null && watchQuestions[editingQuestionIndex] ? (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                        {editingQuestionIndex + 1}
                      </div>
                      <h3 className="font-bold text-white text-sm">Question {editingQuestionIndex + 1}</h3>
                    </div>
                    <button type="button" onClick={() => setEditingQuestionIndex(null)} className="text-white/30 hover:text-white/60 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <QuestionEditor
                    index={editingQuestionIndex} watchQuestions={watchQuestions} errors={errors}
                    register={register} setValue={setValue} update={update}
                    uploadingImage={uploadingImage} handleImageUpload={handleImageUpload}
                  />
                </div>
              ) : (
                <div className="bg-white/3 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center min-h-[320px]">
                  <div className="text-center">
                    <svg className="w-10 h-10 text-white/10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <p className="text-white/25 text-sm">
                      {questionFields.length === 0 ? 'Add a question to start' : 'Select a question to edit'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 2 && (
          <div className="gsap-step-content space-y-5 max-w-2xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">{watch('title')}</h2>
                  {watch('description') && <p className="text-white/40 text-xs mt-0.5">{watch('description')}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <span className="px-2.5 py-1 bg-violet-500/20 border border-violet-500/30 rounded-full text-violet-300 text-xs font-semibold">
                  {watchQuestions.length} question{watchQuestions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {watchQuestions.map((q, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <QuestionTypePreview question={{ ...q, id: `q-${i}` }} />
                    </div>
                    <button type="button" onClick={() => { setStep(1); setEditingQuestionIndex(i) }}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-semibold shrink-0">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {saveError && (
              <div className="p-4 bg-red-500/15 border border-red-500/25 rounded-2xl text-red-300 text-sm">{saveError}</div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => step === 0 ? navigate('/dashboard') : setStep((s) => s - 1)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm font-semibold hover:bg-white/10 hover:text-white/80 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 2 ? (
            <button type="button" onClick={handleNextStep}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl text-white font-bold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all">
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button type="button" onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl text-white font-bold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100">
              {isSaving ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
