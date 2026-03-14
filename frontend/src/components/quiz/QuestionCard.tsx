import { useState } from 'react'
import clsx from 'clsx'
import type { Question } from '../../types'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const OPTION_COLORS = [
  { bg: 'bg-red-500 hover:bg-red-600', label: 'A', light: 'bg-red-100 border-red-300 text-red-800' },
  { bg: 'bg-blue-500 hover:bg-blue-600', label: 'B', light: 'bg-blue-100 border-blue-300 text-blue-800' },
  { bg: 'bg-yellow-500 hover:bg-yellow-600', label: 'C', light: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
  { bg: 'bg-green-500 hover:bg-green-600', label: 'D', light: 'bg-green-100 border-green-300 text-green-800' },
]

interface QuestionCardProps {
  question: Question
  mode: 'play' | 'preview'
  onAnswer?: (answer: string) => void
  disabled?: boolean
  selectedAnswer?: string
  correctAnswer?: string
  showResult?: boolean
}

// Sortable item for match pair mode
interface SortableRightItemProps {
  id: string
  text: string
}

function SortableRightItem({ id, text }: SortableRightItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'px-4 py-3 bg-primary-100 border border-primary-300 rounded-lg text-sm font-medium text-primary-800',
        'cursor-grab active:cursor-grabbing select-none',
        isDragging && 'shadow-lg opacity-80',
      )}
      {...attributes}
      {...listeners}
    >
      {text}
    </div>
  )
}

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

  const sensors = useSensors(useSensor(PointerSensor))

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

  // Multiple Choice / Image Based
  if (question.type === 'multiple_choice' || question.type === 'image_based') {
    return (
      <div className="space-y-4">
        {question.image && (
          <div className="rounded-xl overflow-hidden max-h-64">
            <img src={question.image} alt="Question" className="w-full object-contain" />
          </div>
        )}
        <h2 className="text-xl font-bold text-gray-900 text-center">{question.text}</h2>
        <div className="grid grid-cols-2 gap-3">
          {question.options?.map((option, i) => {
            const color = OPTION_COLORS[i % OPTION_COLORS.length]
            const isSelected = selectedAnswer === option.id
            const isCorrect = correctAnswer === option.id

            let buttonClass = clsx(
              'relative flex items-center gap-3 p-4 rounded-xl text-white font-semibold transition-all duration-200 text-left',
              mode === 'play' && !disabled ? 'cursor-pointer active:scale-95' : 'cursor-default',
              color.bg,
            )

            if (showResult) {
              if (isCorrect) {
                buttonClass = clsx(buttonClass, 'ring-4 ring-green-300 scale-105')
              } else if (isSelected && !isCorrect) {
                buttonClass = clsx(buttonClass, 'opacity-60 ring-4 ring-red-300')
              } else {
                buttonClass = clsx(buttonClass, 'opacity-40')
              }
            } else if (isSelected) {
              buttonClass = clsx(buttonClass, 'ring-4 ring-white/50 scale-105')
            }

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => !disabled && onAnswer && onAnswer(option.id)}
                disabled={disabled}
                className={buttonClass}
              >
                <span className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center font-bold text-sm shrink-0">
                  {color.label}
                </span>
                <span className="flex-1">{option.text}</span>
                {showResult && isCorrect && (
                  <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {showResult && isSelected && !isCorrect && (
                  <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

  // Fill in the Blank
  if (question.type === 'fill_blank') {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 text-center">
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
            <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
              Answer: {question.answer}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Match Pair
  if (question.type === 'match_pair') {
    const pairs = question.match_pairs ?? []
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 text-center">{question.text}</h2>
        <div className="flex gap-4">
          {/* Left column - fixed */}
          <div className="flex-1 space-y-2">
            {pairs.map((pair, i) => (
              <div
                key={i}
                className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium text-gray-700"
              >
                {pair.left}
              </div>
            ))}
          </div>

          {/* Right column - sortable */}
          <div className="flex-1 space-y-2">
            {mode === 'play' && !disabled ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleMatchDragEnd}
              >
                <SortableContext items={matchOrder} strategy={horizontalListSortingStrategy}>
                  <div className="space-y-2">
                    {matchOrder.map((id) => {
                      const idx = parseInt(id.replace('right-', ''))
                      return (
                        <SortableRightItem
                          key={id}
                          id={id}
                          text={pairs[idx]?.right ?? ''}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              pairs.map((pair, i) => (
                <div
                  key={i}
                  className="px-4 py-3 bg-primary-100 border border-primary-300 rounded-lg text-sm font-medium text-primary-800"
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
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
          >
            Submit Answer
          </button>
        )}
      </div>
    )
  }

  return null
}

// Fill blank input subcomponent
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
    return (
      <div className="space-y-2 text-center">
        <p className="text-gray-600">Your answer:</p>
        <span className={clsx(
          'inline-block px-4 py-2 rounded-lg font-semibold',
          correctAnswer
            ? selectedAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
            : 'bg-primary-100 text-primary-800',
        )}>
          {selectedAnswer}
        </span>
        {correctAnswer && selectedAnswer.toLowerCase().trim() !== correctAnswer.toLowerCase().trim() && (
          <p className="text-sm text-gray-600">Correct answer: <strong>{correctAnswer}</strong></p>
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
      className="flex gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer..."
        disabled={disabled}
        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary-500 text-lg"
        autoFocus
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </form>
  )
}

// Preview-only version that shows the question type label
export function QuestionTypePreview({ question }: { question: Question }) {
  const typeLabels: Record<string, string> = {
    multiple_choice: 'Multiple Choice',
    image_based: 'Image Based',
    match_pair: 'Match Pair',
    fill_blank: 'Fill in the Blank',
  }

  const typeBadgeColors: Record<string, string> = {
    multiple_choice: 'bg-blue-100 text-blue-800',
    image_based: 'bg-purple-100 text-purple-800',
    match_pair: 'bg-green-100 text-green-800',
    fill_blank: 'bg-orange-100 text-orange-800',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', typeBadgeColors[question.type])}>
          {typeLabels[question.type]}
        </span>
        <span className="text-xs text-gray-500">{question.time_limit}s • {question.points}pts</span>
      </div>
      <p className="text-sm font-medium text-gray-900 line-clamp-2">{question.text}</p>
      {question.type === 'multiple_choice' && question.options && (
        <div className="grid grid-cols-2 gap-1">
          {question.options.map((opt) => (
            <div
              key={opt.id}
              className={clsx(
                'text-xs px-2 py-1 rounded',
                opt.is_right ? 'bg-green-50 text-green-700 font-medium' : 'bg-gray-50 text-gray-600',
              )}
            >
              {opt.is_right && '✓ '}{opt.text}
            </div>
          ))}
        </div>
      )}
      {question.type === 'match_pair' && question.match_pairs && (
        <div className="space-y-1">
          {question.match_pairs.slice(0, 2).map((pair, i) => (
            <div key={i} className="text-xs text-gray-600">
              {pair.left} → {pair.right}
            </div>
          ))}
          {question.match_pairs.length > 2 && (
            <p className="text-xs text-gray-400">+{question.match_pairs.length - 2} more pairs</p>
          )}
        </div>
      )}
    </div>
  )
}
