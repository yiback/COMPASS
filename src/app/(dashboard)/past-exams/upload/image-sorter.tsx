/**
 * 이미지 순서 변경 컴포넌트 (DnD)
 *
 * @dnd-kit SortableContext + rectSortingStrategy
 * 드래그로 이미지 순서 변경 → 페이지 번호 자동 할당
 * DnD 실패 시 fallback 교체 가능한 독립 컴포넌트 구조
 */

'use client'

import { useEffect, useState } from 'react'
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
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── 타입 ───────────────────────────────────────────────

interface ImageSorterProps {
  readonly files: readonly File[]
  readonly onReorder: (files: readonly File[]) => void
  readonly disabled?: boolean
}

interface SortableImageItemProps {
  readonly id: string
  readonly file: File
  readonly pageNumber: number
  readonly onRemove: () => void
  readonly disabled?: boolean
}

// ─── 유틸 ───────────────────────────────────────────────

/** 파일별 고유 ID 생성 (name+size+lastModified+index 조합) */
function createFileId(file: File, index: number): string {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`
}

// ─── SortableImageItem ─────────────────────────────────

function SortableImageItem({
  id,
  file,
  pageNumber,
  onRemove,
  disabled,
}: SortableImageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // URL.createObjectURL로 썸네일 생성 + 메모리 cleanup
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border bg-card p-2 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {/* 페이지 번호 뱃지 */}
      <span className="absolute top-1 left-1 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
        {pageNumber}
      </span>

      {/* 삭제 버튼 */}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 z-10 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        disabled={disabled}
        aria-label={`페이지 ${pageNumber} 삭제`}
      >
        <X className="h-3 w-3" />
      </Button>

      {/* 썸네일 미리보기 */}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`페이지 ${pageNumber}`}
          className="aspect-[3/4] w-full rounded object-cover"
        />
      )}

      {/* 파일명 */}
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {file.name}
      </p>
    </div>
  )
}

// ─── ImageSorter ────────────────────────────────────────

export function ImageSorter({ files, onReorder, disabled }: ImageSorterProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 파일별 고유 ID 매핑
  const items = files.map((file, index) => ({
    id: createFileId(file, index),
    file,
    index,
  }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    // 불변 배열 재정렬
    const reordered = arrayMove([...files], oldIndex, newIndex)
    onReorder(reordered)
  }

  function handleRemove(index: number) {
    // 불변 패턴: 새 배열 생성
    const updated = files.filter((_, i) => i !== index)
    onReorder(updated)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        드래그로 이미지 순서를 변경하세요. 순서대로 페이지 번호가 할당됩니다.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item) => (
              <SortableImageItem
                key={item.id}
                id={item.id}
                file={item.file}
                pageNumber={item.index + 1}
                onRemove={() => handleRemove(item.index)}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
