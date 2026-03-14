import { useState } from 'react'
import clsx from 'clsx'
import type { Question } from '../../types'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Color palettes ─────────────────────────────────────────────────────────────

const ANSWER_COLORS = [
  {
    label: 'A',
    idle: 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/40',
    correct: 'bg-gradient-to-br from-emerald-500 to-green-600 ring-4 ring-emerald-300 shadow-emerald-500/40',
    wrong: 'bg-gradient-to-br from-rose-700 to-red-800 opacity-70 ring-4 ring-red-400',
    faded: 'bg-gradient-to-br from-rose-500/40 to-red-600/40',
  },
  {
    label: 'B',
    idle: 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/40',
    correct: 'bg-gradient-to-br from-emerald-500 to-green-600 ring-4 ring-emerald-300 shadow-emerald-500/40',
    wrong: 'bg-gradient-to-br from-blue-700 to-indigo-800 opacity-70 ring-4 ring-blue-400',
    faded: 'bg-gradient-to-br from-blue-500/40 to-indigo-600/40',
  },
  {
    label: 'C',
    idle: 'bg-gradient-to-br from-amber-500 to-yellow-600 shadow-amber-500/40',
    correct: 'bg-gradient-to-br from-emerald-500 to-green-600 ring-4 ring-emerald-300 shadow-emerald-500/40',
    wrong: 'bg-gradient-to-br from-amber-700 to-yellow-800 opacity-70 ring-4 ring-amber-400',
    faded: 'bg-gradient-to-br from-amber-500/40 to-yellow-600/40',
  },
  {
    label: 'D',
    idle: 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/40',
    correct: 'bg-gradient-to-br from-emerald-500 to-green-600 ring-4 ring-emerald-300 shadow-emerald-500/40',
    wrong: 'bg-gradient-to-br from-emerald-700 to-green-800 opacity-70 ring-4 ring-emerald-400',
    faded: 'bg-gradient-to-br from-emerald-500/40 to-green-600/40',
  },
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: Question
  mode: 'play' | 'preview'
  onAnswer?: (answer: string) => void
  disabled?: boolean
  selectedAnswer?: string
  correctAnswer?: string
  showResult?: boolean
}

// ── Sortable item for match pair ───────────────────────────────────────────────

function SortableRightItem({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold',
        'cursor-grab active:cursor-grabbing select-none touch-manipulation',
        'bg-white/10 border-white/20 text-white',
        isDragging ? 'shadow-2xl opacity-90 scale-105 z-50' : 'hover:bg-white/15 hover:border-white/30',
        'transition-colors',
      )}
      {...attributes}
      {...listeners}
    >
      <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
      </svg>
      {text}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function QuestionCard({
  question,
  mode,
  onAnswer,
  disabled = false,
  selectedAnswer,
  correctAnswer,
  showResult = false,
}: QuestionCardProps) {
  const [matchOrder, setMatchOrder] = useState<string[]>(
    () => question.match_pairs?.map((_, i) => `right-${i}`) ?? [],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const handleMatchDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = matchOrder.indexOf(active.id as string)
      const newIndex = matchOrder.indexOf(over.id as string)
      setMatchOrder(arrayMove(matchOrder, oldIndex, newIndex))
    }
  }

  const submitMatchAnswer = () => {
    if (!question.match_pairs || !onAnswer) return
    const answer = matchOrder
      .map((id) => {
        const idx = parseInt(id.replace('right-', ''))
        return question.match_pairs![idx].right
      })
      .join('|')
    onAnswer(answer)
  }

  const questionText = (
    <h2 className="text-lg sm:text-xl font-bold text-white text-center leading-snug px-1">
      {question.text}
    </h2>
  )

  // ── Multiple Choice / Image Based ──────────────────────────────────────────
  if (question.type === 'multiple_choice' || question.type === 'image_based') {
    return (
      <div className="space-y-4">
        {question.image && (
          <div className="rounded-2xl overflow-hidden max-h-52 sm:max-h-64">
            <img src={question.image} alt="Question" className="w-full object-contain" />
          </div>
        )}
        {questionText}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options?.map((option, i) => {
            const c = ANSWER_COLORS[i % ANSWER_COLORS.length]
            const isSelected = selectedAnswer === option.id
            const isCorrect = correctAnswer === option.id

            let cls = clsx(
              'relative flex items-center gap-3 p-4 rounded-2xl text-white font-semibold',
              'transition-all duration-200 text-left shadow-lg',
              mode === 'play' && !disabled ? 'cursor-pointer active:scale-[0.97] hover:scale-[1.02] hover:shadow-xl' : 'cursor-default',
            )

            if (showResult) {
              if (isCorrect) cls = clsx(cls, c.correct, 'scale-[1.02]')
              else if (isSelected) cls = clsx(cls, c.wrong)
              else cls = clsx(cls, c.faded)
            } else if (isSelected) {
              cls = clsx(cls, c.idle, 'ring-4 ring-white/60 scale-[1.02]')
            } else {
              cls = clsx(cls, c.idle, disabled ? 'opacity-70' : '')
            }

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => !disabled && onAnswer && onAnswer(option.id)}
                disabled={disabled}
                className={cls}
              >
                <span className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center font-black text-sm shrink-0">
                  {c.label}
                </span>
                <span className="flex-1 text-sm sm:text-base leading-snug">{option.text}</span>
                {showResult && isCorrect && (
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {showResult && isSelected && !isCorrect && (
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── True / False ───────────────────────────────────────────────────────────
  if (question.type === 'true_false') {
    const trueId = question.options?.find(o => o.text.toLowerCase() === 'true')?.id ?? 'true'
    const falseId = question.options?.find(o => o.text.toLowerCase() === 'false')?.id ?? 'false'
    const isTrueCorrect = correctAnswer === trueId
    const isFalseCorrect = correctAnswer === falseId

    const tfBtn = (isTrue: boolean) => {
      const id = isTrue ? trueId : falseId
      const isSelected = selectedAnswer === id
      const isCorrectOpt = isTrue ? isTrueCorrect : isFalseCorrect
      const baseGrad = isTrue
        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/40'
        : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/40'
      const correctCls = 'ring-4 ring-white/70 scale-[1.03] shadow-2xl'
      const wrongCls = 'opacity-50 ring-4 ring-white/20'

      let cls = clsx(
        'flex-1 flex flex-col items-center justify-center gap-3 py-8 px-6 rounded-2xl',
        'text-white font-black text-2xl shadow-xl transition-all duration-200',
        mode === 'play' && !disabled ? 'cursor-pointer active:scale-[0.97] hover:scale-[1.02] hover:shadow-2xl' : 'cursor-default',
        baseGrad,
      )
      if (showResult) {
        if (isCorrectOpt) cls = clsx(cls, correctCls)
        else if (isSelected) cls = clsx(cls, wrongCls)
        else cls += ' opacity-60'
      } else if (isSelected) {
        cls = clsx(cls, 'ring-4 ring-white/60 scale-[1.02]')
      }

      return (
        <button
          key={id}
          type="button"
          onClick={() => !disabled && onAnswer && onAnswer(id)}
          disabled={disabled}
          className={cls}
        >
          {isTrue ? (
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {isTrue ? 'True' : 'False'}
        </button>
      )
    }

    return (
      <div className="space-y-5">
        {questionText}
        <div className="flex gap-4 min-h-[10rem]">
          {tfBtn(true)}
          {tfBtn(false)}
        </div>
      </div>
    )
  }

  // ── Fill in the Blank ──────────────────────────────────────────────────────
  if (question.type === 'fill_blank') {
    return (
      <div className="space-y-6">
        <h2 className="text-lg sm:text-xl font-bold text-white text-center leading-snug">
          {question.text.replace('[blank]', '______')}
        </h2>
        {mode === 'play' && (
          <FillBlankInput
            onSubmit={(value) => onAnswer && onAnswer(value)}
            disabled={disabled}
            correctAnswer={showResult ? correctAnswer : undefined}
            selectedAnswer={selectedAnswer}
          />
        )}
        {mode === 'preview' && question.answer && (
          <div className="text-center">
            <span className="inline-block px-4 py-2 bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 rounded-xl font-medium text-sm">
              Answer: {question.answer}
            </span>
          </div>
        )}
      </div>
    )
  }

  // ── Match Pair ─────────────────────────────────────────────────────────────
  if (question.type === 'match_pair') {
    const pairs = question.match_pairs ?? []
    return (
      <div className="space-y-5">
        {questionText}
        {/* Mobile: vertical stack of each pair row. Desktop: two columns */}
        <div className="block sm:flex gap-4">
          {/* Left column – fixed terms */}
          <div className="flex-1 space-y-2 mb-2 sm:mb-0">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Match these</p>
            {pairs.map((pair, i) => (
              <div
                key={i}
                className="px-4 py-3 rounded-xl border border-violet-400/30 bg-violet-500/15 text-sm font-semibold text-white"
              >
                {pair.left}
              </div>
            ))}
          </div>

          {/* Right column – draggable */}
          <div className="flex-1 space-y-2">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Drag to order</p>
            {mode === 'play' && !disabled ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMatchDragEnd}>
                <SortableContext items={matchOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {matchOrder.map((id) => {
                      const idx = parseInt(id.replace('right-', ''))
                      return (
                        <SortableRightItem key={id} id={id} text={pairs[idx]?.right ?? ''} />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              pairs.map((pair, i) => (
                <div
                  key={i}
                  className="px-4 py-3 rounded-xl border border-white/20 bg-white/8 text-sm font-semibold text-white/80"
                >
                  {pair.right}
                </div>
              ))
            )}
          </div>
        </div>

        {mode === 'play' && !disabled && (
          <button
            type="button"
            onClick={submitMatchAnswer}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-violet-500/30 active:scale-[0.98] text-base"
          >
            Submit Answer
          </button>
        )}
      </div>
    )
  }

  return null
}

// ── FillBlankInput ─────────────────────────────────────────────────────────────

function FillBlankInput({
  onSubmit,
  disabled,
  correctAnswer,
  selectedAnswer,
}: {
  onSubmit: (value: string) => void
  disabled: boolean
  correctAnswer?: string
  selectedAnswer?: string
}) {
  const [value, setValue] = useState(selectedAnswer ?? '')

  if (selectedAnswer) {
    const isRight = correctAnswer
      ? selectedAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
      : null
    return (
      <div className="space-y-3 text-center">
        <p className="text-white/50 text-sm">Your answer:</p>
        <span className={clsx(
          'inline-block px-5 py-2.5 rounded-xl font-bold text-base',
          isRight === null ? 'bg-white/15 text-white' :
          isRight ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200' :
          'bg-red-500/20 border border-red-400/40 text-red-200',
        )}>
          {selectedAnswer}
        </span>
        {isRight === false && correctAnswer && (
          <p className="text-sm text-white/50">
            Correct answer: <strong className="text-emerald-300">{correctAnswer}</strong>
          </p>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSubmit(value.trim())
      }}
      className="flex gap-3"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer..."
        disabled={disabled}
        autoFocus
        className="flex-1 px-4 py-4 bg-white/10 border-2 border-white/20 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/15 text-base transition-all"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-2xl transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:from-violet-500 hover:to-purple-500 active:scale-[0.97]"
      >
        Submit
      </button>
    </form>
  )
}

// ── QuestionTypePreview ────────────────────────────────────────────────────────

export function QuestionTypePreview({ question }: { question: Question }) {
  const typeLabels: Record<string, string> = {
    multiple_choice: 'Multiple Choice',
    image_based: 'Image Based',
    match_pair: 'Match Pair',
    fill_blank: 'Fill Blank',
    true_false: 'True / False',
  }

  const typeBadgeColors: Record<string, string> = {
    multiple_choice: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    image_based: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    match_pair: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    fill_blank: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    true_false: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx('text-xs font-semibold px-2.5 py-0.5 rounded-full', typeBadgeColors[question.type])}>
          {typeLabels[question.type] ?? question.type}
        </span>
        <span className="text-xs text-white/40">{question.time_limit}s · {question.points}pts</span>
      </div>
      <p className="text-sm font-medium text-white line-clamp-2">{question.text}</p>
      {(question.type === 'multiple_choice' || question.type === 'image_based') && question.options && (
        <div className="grid grid-cols-2 gap-1">
          {question.options.map((opt) => (
            <div
              key={opt.id}
              className={clsx(
                'text-xs px-2 py-1 rounded-lg',
                opt.is_right ? 'bg-emerald-500/15 text-emerald-300 font-semibold' : 'bg-white/5 text-white/50',
              )}
            >
              {opt.is_right && '✓ '}{opt.text}
            </div>
          ))}
        </div>
      )}
      {question.type === 'true_false' && (
        <div className="flex gap-2 text-xs">
          <span className="px-3 py-1 bg-emerald-500/15 text-emerald-300 rounded-lg font-semibold">True</span>
          <span className="px-3 py-1 bg-rose-500/15 text-rose-300 rounded-lg font-semibold">False</span>
        </div>
      )}
      {question.type === 'match_pair' && question.match_pairs && (
        <div className="space-y-0.5">
          {question.match_pairs.slice(0, 2).map((pair, i) => (
            <div key={i} className="text-xs text-white/50">
              {pair.left} → {pair.right}
            </div>
          ))}
          {question.match_pairs.length > 2 && (
            <p className="text-xs text-white/30">+{question.match_pairs.length - 2} more pairs</p>
          )}
        </div>
      )}
    </div>
  )
}
