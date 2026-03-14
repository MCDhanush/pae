import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MatchPairItem } from '../../types'
import Button from '../ui/Button'

interface SortablePairProps {
  id: string
  pair: MatchPairItem
  index: number
  onUpdate: (index: number, field: 'left' | 'right', value: string) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

function SortablePair({ id, pair, index, onUpdate, onRemove, canRemove }: SortablePairProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing shrink-0"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      <span className="text-sm font-medium text-gray-500 w-5 shrink-0">{index + 1}.</span>

      <div className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={pair.left}
          onChange={(e) => onUpdate(index, 'left', e.target.value)}
          placeholder="Left item"
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        />
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <input
          type="text"
          value={pair.right}
          onChange={(e) => onUpdate(index, 'right', e.target.value)}
          placeholder="Right item"
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        aria-label="Remove pair"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

interface MatchPairEditorProps {
  pairs: MatchPairItem[]
  onChange: (pairs: MatchPairItem[]) => void
}

export default function MatchPairEditor({ pairs, onChange }: MatchPairEditorProps) {
  const [ids, setIds] = useState<string[]>(() => pairs.map((_, i) => `pair-${i}-${Date.now()}`))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(active.id as string)
      const newIndex = ids.indexOf(over.id as string)
      const newIds = arrayMove(ids, oldIndex, newIndex)
      const newPairs = arrayMove(pairs, oldIndex, newIndex)
      setIds(newIds)
      onChange(newPairs)
    }
  }

  const addPair = () => {
    const newId = `pair-${ids.length}-${Date.now()}`
    setIds([...ids, newId])
    onChange([...pairs, { left: '', right: '' }])
  }

  const removePair = (index: number) => {
    const newIds = ids.filter((_, i) => i !== index)
    const newPairs = pairs.filter((_, i) => i !== index)
    setIds(newIds)
    onChange(newPairs)
  }

  const updatePair = (index: number, field: 'left' | 'right', value: string) => {
    const newPairs = pairs.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    onChange(newPairs)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Match Pairs</p>
        <p className="text-xs text-gray-500">Drag rows to reorder</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {pairs.map((pair, index) => (
              <SortablePair
                key={ids[index]}
                id={ids[index]}
                pair={pair}
                index={index}
                onUpdate={updatePair}
                onRemove={removePair}
                canRemove={pairs.length > 2}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addPair}
        leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }
      >
        Add Pair
      </Button>
    </div>
  )
}
