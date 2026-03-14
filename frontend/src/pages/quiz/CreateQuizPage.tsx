import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import clsx from 'clsx'
import { quizAPI } from '../../lib/api'
import type { QuestionType, MatchPairItem } from '../../types'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import MatchPairEditor from '../../components/quiz/MatchPairEditor'
import { QuestionTypePreview } from '../../components/quiz/QuestionCard'

// ---- Types for form ----
interface OptionForm {
  id: string
  text: string
  is_right: boolean
}

interface QuestionForm {
  type: QuestionType
  text: string
  image?: string
  options: OptionForm[]
  match_pairs: MatchPairItem[]
  answer: string
  time_limit: number
  points: number
}

interface QuizForm {
  title: string
  description: string
  questions: QuestionForm[]
}

// ---- Helpers ----
function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function defaultQuestion(type: QuestionType = 'multiple_choice'): QuestionForm {
  return {
    type,
    text: '',
    image: '',
    options: [
      { id: generateId(), text: '', is_right: true },
      { id: generateId(), text: '', is_right: false },
      { id: generateId(), text: '', is_right: false },
      { id: generateId(), text: '', is_right: false },
    ],
    match_pairs: [
      { left: '', right: '' },
      { left: '', right: '' },
    ],
    answer: '',
    time_limit: 30,
    points: 100,
  }
}

const QUESTION_TYPE_TABS: { type: QuestionType; label: string }[] = [
  { type: 'multiple_choice', label: 'Multiple Choice' },
  { type: 'image_based', label: 'Image Based' },
  { type: 'match_pair', label: 'Match Pair' },
  { type: 'fill_blank', label: 'Fill in Blank' },
]

const STEPS = ['Basic Info', 'Questions', 'Review']

// ---- QuestionEditor Props ----
interface QuestionEditorProps {
  index: number
  watchQuestions: QuestionForm[]
  errors: any
  register: any
  setValue: any
  update: (index: number, value: QuestionForm) => void
  uploadingImage: boolean
  handleImageUpload: (file: File, questionIndex?: number) => Promise<void>
}

// ---- QuestionEditor is defined OUTSIDE CreateQuizPage ----
// This is the critical fix: when defined inside, React treats it as a new
// component type on every parent render, causing unmount/remount and focus loss.
function QuestionEditor({
  index,
  watchQuestions,
  errors,
  register,
  setValue,
  update,
  uploadingImage,
  handleImageUpload,
}: QuestionEditorProps) {
  const q = watchQuestions[index]
  if (!q) return null

  const handleOptionChange = (
    optIdx: number,
    field: 'text' | 'is_right',
    value: string | boolean
  ) => {
    if (field === 'text') {
      setValue(`questions.${index}.options.${optIdx}.text`, value as string)
    }
    if (field === 'is_right') {
      q.options.forEach((_, i) => {
        setValue(`questions.${index}.options.${i}.is_right`, i === optIdx)
      })
    }
  }

  return (
    <div className="space-y-5">
      {/* Type selector */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Question Type</label>
        <div className="flex gap-2 flex-wrap">
          {QUESTION_TYPE_TABS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => update(index, { ...defaultQuestion(type), text: q.text })}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                q.type === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Question text */}
      <Input
        id={`q-text-${index}`}
        label="Question Text"
        placeholder={q.type === 'fill_blank' ? 'e.g. The capital of France is [blank]' : 'Enter your question...'}
        register={register(`questions.${index}.text`, { required: 'Question text is required' })}
        error={errors.questions?.[index]?.text?.message}
        required
      />
      {q.type === 'fill_blank' && (
        <p className="text-xs text-gray-400 -mt-3">Use [blank] to mark where the blank should appear.</p>
      )}

      {/* Image upload for image_based */}
      {q.type === 'image_based' && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Question Image</label>
          {q.image && (
            <div className="mb-2 relative inline-block">
              <img src={q.image} alt="Question" className="max-h-40 rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => setValue(`questions.${index}.image`, '')}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:bg-gray-100 transition-colors w-fit">
            {uploadingImage ? (
              <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            <span className="text-sm text-gray-600">Upload Image (max 2MB)</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], index)}
            />
          </label>
        </div>
      )}

      {/* Options for MC / image_based */}
      {(q.type === 'multiple_choice' || q.type === 'image_based') && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 block">Answer Options</label>
          {q.options.map((opt, optIdx) => (
            <div key={opt.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleOptionChange(optIdx, 'is_right', true)}
                className={clsx(
                  'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                  opt.is_right
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 hover:border-green-400',
                )}
                title="Mark as correct"
              >
                {opt.is_right && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <input
                type="text"
                autoComplete="off"
                value={opt.text}
                onChange={(e) => handleOptionChange(optIdx, 'text', e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          ))}
          <p className="text-xs text-gray-400">Click the circle to mark the correct answer.</p>
        </div>
      )}

      {/* Match pairs */}
      {q.type === 'match_pair' && (
        <MatchPairEditor
          pairs={q.match_pairs}
          onChange={(pairs) => update(index, { ...q, match_pairs: pairs })}
        />
      )}

      {/* Fill blank answer */}
      {q.type === 'fill_blank' && (
        <Input
          id={`q-answer-${index}`}
          label="Correct Answer"
          placeholder="e.g. Paris"
          register={register(`questions.${index}.answer`, { required: 'Answer is required for fill-in-the-blank' })}
          error={errors.questions?.[index]?.answer?.message}
          required
        />
      )}

      {/* Time limit + Points */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Time Limit: {q.time_limit}s
          </label>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={q.time_limit}
            onChange={(e) => update(index, { ...q, time_limit: parseInt(e.target.value) })}
            className="w-full accent-primary-600 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>10s</span><span>60s</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Points</label>
          <select
            value={q.points}
            onChange={(e) => update(index, { ...q, points: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {[50, 100, 150, 200, 500].map((p) => (
              <option key={p} value={p}>{p} points</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// ---- CreateQuizPage Props ----
interface CreateQuizPageProps {
  initialData?: Partial<QuizForm>
  quizId?: string
  isEditing?: boolean
}

export default function CreateQuizPage({ initialData, quizId, isEditing = false }: CreateQuizPageProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const {
    register,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors },
    trigger,
  } = useForm<QuizForm>({
    defaultValues: {
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      questions: initialData?.questions ?? [],
    },
  })

  const { fields: questionFields, append, remove, update } = useFieldArray({
    control,
    name: 'questions',
  })

  const watchQuestions = watch('questions')

  // ---- Image upload ----
  const handleImageUpload = useCallback(
    async (file: File, questionIndex?: number) => {
      if (file.size > 2 * 1024 * 1024) {
        alert('Image must be under 2MB')
        return
      }
      setUploadingImage(true)
      try {
        const { url } = await quizAPI.uploadImage(file)
        if (questionIndex !== undefined) {
          setValue(`questions.${questionIndex}.image`, url)
        }
      } catch {
        alert('Failed to upload image')
      } finally {
        setUploadingImage(false)
      }
    },
    [setValue],
  )

  // ---- Step navigation ----
  const handleNextStep = async () => {
    if (step === 0) {
      const valid = await trigger(['title'])
      if (!valid) return
    }
    if (step === 1 && watchQuestions.length === 0) {
      alert('Please add at least one question')
      return
    }
    setStep((s) => Math.min(s + 1, 2))
  }

  // ---- Save ----
  const handleSave = async () => {
    const data = getValues()
    if (!data.title.trim()) {
      setStep(0)
      return
    }
    if (data.questions.length === 0) {
      setStep(1)
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const payload = {
        title: data.title,
        description: data.description,
        questions: data.questions.map((q) => ({
          type: q.type,
          text: q.text,
          image: q.image || undefined,
          options: q.type === 'multiple_choice' || q.type === 'image_based' ? q.options : undefined,
          match_pairs: q.type === 'match_pair' ? q.match_pairs : undefined,
          answer: q.type === 'fill_blank' ? q.answer : undefined,
          time_limit: q.time_limit,
          points: q.points,
        })),
      }
      if (isEditing && quizId) {
        await quizAPI.update(quizId, payload)
      } else {
        await quizAPI.create(payload)
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save quiz'
      setSaveError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
          <h1 className="font-bold text-gray-900">{isEditing ? 'Edit Quiz' : 'Create Quiz'}</h1>
          <div className="w-24" />
        </div>
      </header>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                    i < step
                      ? 'bg-green-500 text-white'
                      : i === step
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-400',
                  )}
                >
                  {i < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={clsx(
                    'text-sm font-medium hidden sm:block',
                    i === step ? 'text-primary-600' : 'text-gray-400',
                  )}
                >
                  {s}
                </span>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* STEP 0: Basic Info */}
        {step === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">Quiz Details</h2>
            <Input
              id="title"
              label="Quiz Title"
              placeholder="e.g. World Geography Quiz"
              required
              register={register('title', { required: 'Title is required' })}
              error={errors.title?.message}
            />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                {...register('description')}
                autoComplete="off"
                spellCheck="false"
                rows={3}
                placeholder="Brief description of your quiz..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 1: Questions */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Left: question list */}
              <div className="md:col-span-1 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Questions ({questionFields.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      append(defaultQuestion())
                      setEditingQuestionIndex(questionFields.length)
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + Add
                  </button>
                </div>

                {questionFields.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm mb-2">No questions yet</p>
                    <button
                      type="button"
                      onClick={() => {
                        append(defaultQuestion())
                        setEditingQuestionIndex(0)
                      }}
                      className="text-primary-600 text-sm font-medium hover:underline"
                    >
                      Add your first question
                    </button>
                  </div>
                ) : (
                  questionFields.map((field, i) => {
                    const q = watchQuestions[i]
                    return (
                      <div
                        key={field.id}
                        onClick={() => setEditingQuestionIndex(i)}
                        className={clsx(
                          'p-3 rounded-xl border cursor-pointer transition-all',
                          editingQuestionIndex === i
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-xs text-gray-400 capitalize">{q?.type?.replace('_', ' ')}</span>
                            </div>
                            {q && <QuestionTypePreview question={{ ...q, id: field.id }} />}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              remove(i)
                              setEditingQuestionIndex(null)
                            }}
                            className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}

                {questionFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      append(defaultQuestion())
                      setEditingQuestionIndex(questionFields.length)
                    }}
                    className="w-full py-2.5 text-sm text-primary-600 hover:text-primary-700 border-2 border-dashed border-primary-200 hover:border-primary-300 rounded-xl transition-colors font-medium"
                  >
                    + Add Question
                  </button>
                )}
              </div>

              {/* Right: question editor */}
              <div className="md:col-span-2">
                {editingQuestionIndex !== null && watchQuestions[editingQuestionIndex] ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-semibold text-gray-900">
                        Question {editingQuestionIndex + 1}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingQuestionIndex(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {/* QuestionEditor is now a stable top-level component — no focus loss on re-render */}
                    <QuestionEditor
                      index={editingQuestionIndex}
                      watchQuestions={watchQuestions}
                      errors={errors}
                      register={register}
                      setValue={setValue}
                      update={update}
                      uploadingImage={uploadingImage}
                      handleImageUpload={handleImageUpload}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center min-h-[300px]">
                    <div className="text-center">
                      <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-400 text-sm">
                        {questionFields.length === 0
                          ? 'Add a question to start editing'
                          : 'Select a question to edit it'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-1">{watch('title')}</h2>
              {watch('description') && (
                <p className="text-gray-500 text-sm">{watch('description')}</p>
              )}
              <div className="flex gap-3 mt-3">
                <span className="badge badge-purple">{watchQuestions.length} question{watchQuestions.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="space-y-3">
              {watchQuestions.map((q, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <QuestionTypePreview question={{ ...q, id: `q-${i}` }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStep(1); setEditingQuestionIndex(i) }}
                      className="text-xs text-primary-600 hover:underline shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {saveError}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="secondary"
            onClick={() => step === 0 ? navigate('/dashboard') : setStep((s) => s - 1)}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          {step < 2 ? (
            <Button variant="primary" onClick={handleNextStep}>
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
            >
              {isEditing ? 'Save Changes' : 'Create Quiz'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}