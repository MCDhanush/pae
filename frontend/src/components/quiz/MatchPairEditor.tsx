import { useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MatchPairItem } from '../../types'

interface SortablePairProps {
  id: string; pair: MatchPairItem; index: number
  onUpdate: (i: number, f: 'left' | 'right', v: string) => void
  onRemove: (i: number) => void; canRemove: boolean
}

function SortablePair({ id, pair, index, onUpdate, onRemove, canRemove }: SortablePairProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 group">
      <button type="button" className="text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
        {...attributes} {...listeners} aria-label="Drag to reorder">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      <span className="text-[10px] font-bold text-white/30 w-4 shrink-0">{index + 1}</span>

      <div className="flex-1 flex items-center gap-2">
        <input type="text" value={pair.left} onChange={(e) => onUpdate(index, 'left', e.target.value)}
          placeholder="Left item"
          className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition-all" />
        <svg className="w-3.5 h-3.5 text-white/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <input type="text" value={pair.right} onChange={(e) => onUpdate(index, 'right', e.target.value)}
          placeholder="Right item"
          className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition-all" />
      </div>

      <button type="button" onClick={() => onRemove(index)} disabled={!canRemove}
        className="p-1 text-white/20 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

interface MatchPairEditorProps { pairs: MatchPairItem[]; onChange: (pairs: MatchPairItem[]) => void }

export default function MatchPairEditor({ pairs, onChange }: MatchPairEditorProps) {
  const [ids, setIds] = useState<string[]>(() => pairs.map((_, i) => `pair-${i}-${Date.now()}`))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = ids.indexOf(active.id as string)
      const newIdx = ids.indexOf(over.id as string)
      setIds(arrayMove(ids, oldIdx, newIdx))
      onChange(arrayMove(pairs, oldIdx, newIdx))
    }
  }

  const addPair = () => {
    setIds([...ids, `pair-${ids.length}-${Date.now()}`])
    onChange([...pairs, { left: '', right: '' }])
  }

  const removePair = (index: number) => {
    setIds(ids.filter((_, i) => i !== index))
    onChange(pairs.filter((_, i) => i !== index))
  }

  const updatePair = (index: number, field: 'left' | 'right', value: string) => {
    onChange(pairs.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Match Pairs</label>
        <span className="text-[10px] text-white/25">Drag to reorder</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {pairs.map((pair, index) => (
              <SortablePair key={ids[index]} id={ids[index]} pair={pair} index={index}
                onUpdate={updatePair} onRemove={removePair} canRemove={pairs.length > 2} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button type="button" onClick={addPair}
        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-dashed border-white/15 rounded-xl text-white/50 text-xs font-semibold hover:bg-white/10 hover:text-white/70 hover:border-white/25 transition-all">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add Pair
      </button>
    </div>
  )
}
