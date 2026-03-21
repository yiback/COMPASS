# Step 6: 업로드 UI — 상세 구현 계획 ✅

> **상태**: ✅ 구현 완료 (2026-03-20, 3개 파일, DnD + 다중 이미지 + 클라이언트 검증)
> **소유 역할**: frontend-ui
> **의존성**: Step 4 (시험 생성 Action) + Step 2 (기존 코드 리팩토링)
> **Wave**: 3 (Step 2+4 완료 후)

---

## 파일 목록 (3개)

| # | 파일 | 유형 | 설명 |
|---|------|------|------|
| 1 | `src/app/(dashboard)/past-exams/upload/upload-form.tsx` | 수정 (대폭 변경) | 다중 이미지 + createPastExamAction + 리다이렉트 |
| 2 | `src/app/(dashboard)/past-exams/upload/image-sorter.tsx` | 신규 | DnD 이미지 순서 변경 + 미리보기 컴포넌트 |
| 3 | `src/app/(dashboard)/past-exams/upload/page.tsx` | 수정 (소폭) | import 경로 변경 |

---

## 새 의존성

- **`@dnd-kit/core`**, **`@dnd-kit/sortable`**, **`@dnd-kit/utilities`**
- Wave 3 시작 전 리드가 `package.json`에 추가 (v9 — `package.json`은 Shared Files, 리드 only)
- 구현자가 직접 `package.json` 수정 금지

**⚠️ `next.config.ts` bodySizeLimit 설정 필수 (리뷰 SHOULD FIX 반영)**:
- Vercel/Next.js 기본 body size limit = 4.5MB → 다중 이미지(최대 100MB) 업로드 불가
- Wave 3 시작 전 리드가 `next.config.ts`에 다음 설정 추가:
  ```typescript
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  ```
- `next.config.ts`는 Shared Files(리드 only)이므로 구현자가 직접 수정 금지

---

## 기존 패턴 분석 (`upload-form.tsx` 현재 상태)

현재 `upload-form.tsx`는 다음 패턴을 사용:

- **`useActionState`** + `formAction` — Server Action 제출 (`uploadPastExamAction`)
- **uncontrolled Select + `key` prop 리셋** — FormData에 값 전달 (Radix Select controlled 모드 회피)
- **`selectedSchoolId` 추적** → schoolType 파생 → 동적 학년 옵션 (`getGradeOptions`)
- **학교/학년/과목/연도/학기/시험유형** 메타데이터 입력
- **단일 파일 `<input type="file">`** — 1장만 업로드
- **성공 시 `router.push('/past-exams')`** — 목록으로 이동

### 변경 포인트

| 현재 | 변경 후 |
|------|---------|
| `uploadPastExamAction` (단일 이미지) | `createPastExamAction` (시험 생성 + 다중 이미지) |
| `<input type="file">` 단일 | `<input type="file" multiple>` 다중 |
| 성공 → `/past-exams` 이동 | 성공 → `/past-exams/${pastExamId}/edit` 이동 |
| 이미지 미리보기 없음 | 썸네일 그리드 + DnD 순서 변경 |
| 이미지 검증 없음 | 클라이언트 사전 검증 (20장/5MB/100MB) |

---

## Task 6.1: `upload-form.tsx` 리팩토링

### 변경 사항

1. **import 변경**:
   - `uploadPastExamAction` → `createPastExamAction` (Step 4에서 구현)
   - `ImageSorter` import 추가 (image-sorter.tsx)

2. **다중 이미지 상태 관리**:
   ```typescript
   // 선택된 파일 목록 (순서 포함)
   const [selectedFiles, setSelectedFiles] = useState<readonly File[]>([])
   ```

3. **`<input type="file" multiple>`로 변경**:
   ```typescript
   <Input
     id="files"
     name="files"
     type="file"
     accept=".jpg,.jpeg,.png,.webp"
     multiple
     required
     disabled={isPending}
     onChange={handleFilesChange}
   />
   ```
   > PDF 제거 — 이미지만 허용 (AI Vision API에 직접 전달)

4. **클라이언트 이미지 검증** (`handleFilesChange`):
   ```typescript
   function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
     const files = Array.from(e.target.files ?? [])

     // 검증 1: 최대 20장
     if (files.length > 20) {
       setValidationError('이미지는 최대 20장까지 업로드할 수 있습니다.')
       e.target.value = ''
       return
     }

     // 검증 2: 개별 5MB
     const oversized = files.find(f => f.size > 5 * 1024 * 1024)
     if (oversized) {
       setValidationError(`${oversized.name}의 크기가 5MB를 초과합니다.`)
       e.target.value = ''
       return
     }

     // 검증 3: 총 100MB
     const totalSize = files.reduce((sum, f) => sum + f.size, 0)
     if (totalSize > 100 * 1024 * 1024) {
       setValidationError('전체 이미지 크기가 100MB를 초과합니다.')
       e.target.value = ''
       return
     }

     setValidationError(null)
     setSelectedFiles(files)
   }
   ```

5. **ImageSorter 연동**:
   ```typescript
   {selectedFiles.length > 0 && (
     <ImageSorter
       files={selectedFiles}
       onReorder={setSelectedFiles}
     />
   )}
   ```

6. **FormData 구성 변경**:
   - 폼 제출 시 `selectedFiles` 배열 순서대로 FormData에 append
   - page_number는 배열 인덱스 + 1로 자동 할당

7. **리다이렉트 변경**:
   ```typescript
   useEffect(() => {
     if (state?.data?.id) {
       // 편집 페이지로 이동 (AI 자동 추출 트리거)
       router.push(`/past-exams/${state.data.id}/edit`)
     }
   }, [state, router])
   ```

8. **안내 문구 업데이트**:
   - "기출문제 파일 업로드" → "시험지 이미지 업로드"
   - 허용 형식 안내 업데이트
   - 다중 이미지 안내 추가

---

## Task 6.2: `image-sorter.tsx` 신규

파일: `src/app/(dashboard)/past-exams/upload/image-sorter.tsx`

### 컴포넌트 구조

```typescript
'use client'

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

interface ImageSorterProps {
  readonly files: readonly File[]
  readonly onReorder: (files: readonly File[]) => void
}

export function ImageSorter({ files, onReorder }: ImageSorterProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 파일별 고유 ID (인덱스 기반은 불안정 → name+size+lastModified 조합)
  const items = files.map((file, index) => ({
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
    file,
    index,
  }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(item => item.id === active.id)
    const newIndex = items.findIndex(item => item.id === over.id)

    // 불변 배열 재정렬
    const reordered = arrayMove([...files], oldIndex, newIndex)
    onReorder(reordered)
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
          <div className="grid grid-cols-4 gap-3">
            {items.map((item) => (
              <SortableImageItem
                key={item.id}
                id={item.id}
                file={item.file}
                pageNumber={item.index + 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
```

### SortableImageItem 컴포넌트

```typescript
interface SortableImageItemProps {
  readonly id: string
  readonly file: File
  readonly pageNumber: number
}

function SortableImageItem({ id, file, pageNumber }: SortableImageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // URL.createObjectURL로 썸네일 생성
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    // ⚠️ 메모리 cleanup 필수
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-lg border bg-card p-2 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {/* 페이지 번호 뱃지 */}
      <span className="absolute top-1 left-1 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
        {pageNumber}
      </span>

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
```

### 핵심 설계 결정

- **`<img>` 사용** (`next/image` 아님) — `URL.createObjectURL`은 로컬 blob URL이므로 `next/image`의 remote patterns 불필요
- **메모리 cleanup** — `useEffect` return에서 `URL.revokeObjectURL` 필수 (메모리 누수 방지)
- **불변 패턴** — `arrayMove([...files], ...)` 새 배열 생성
- **DnD fallback 구조** — `image-sorter.tsx`를 독립 컴포넌트로 분리하여 DnD 실패 시 "위/아래 버튼" 방식으로 교체 가능

---

## Task 6.3: `page.tsx` 수정 (소폭)

파일: `src/app/(dashboard)/past-exams/upload/page.tsx`

### 변경 사항

- 안내 문구 변경: "학교별 기출문제를 업로드하세요." → "시험지 이미지를 업로드하고 순서를 확인하세요."
- 기존 `UploadForm` import 및 props는 유지 (schools 목록)
- Step 2 리팩토링에서 변경된 타입이 있으면 반영

---

## 완료 기준

- [ ] `upload-form.tsx` — `createPastExamAction` 연동 + 다중 이미지 + 클라이언트 검증 (20장/5MB/100MB)
- [ ] `image-sorter.tsx` — DnD 순서 변경 + 썸네일 미리보기 + 메모리 cleanup
- [ ] `page.tsx` — 안내 문구 업데이트
- [ ] 파일 선택 → 미리보기 표시 → 드래그 순서 변경 → 업로드 → `/past-exams/${id}/edit` 리다이렉트
- [ ] 클라이언트 검증 실패 시 에러 메시지 표시 + 업로드 차단
- [ ] DnD 미동작 시 fallback 전환 가능한 구조 확인 (image-sorter.tsx 독립성)
- [ ] `npm run build` 성공

---

## 리스크

| 리스크 | 영향 | 확률 | 완화 방안 |
|--------|------|------|----------|
| @dnd-kit 새 패턴 학습 비용 | Medium | Medium | SortableContext + useSortable 공식 문서 참고 + 독립 컴포넌트 분리 |
| DnD 모바일 호환성 | Medium | Medium | PointerSensor + KeyboardSensor 조합. 터치 이슈 발견 시 fallback 전환 |
| URL.createObjectURL 메모리 누수 | High | Low | useEffect cleanup에서 revokeObjectURL 필수 |
| Step 2 리팩토링과의 충돌 | Medium | Medium | Step 2 완료 후 작업 (의존성 명시). upload-form.tsx는 Step 2에서 이미 3계층 구조로 변경됨 |
| 20장 이미지 한 번에 FormData 전송 용량 | Medium | Low | 개별 5MB + 총 100MB 사전 차단으로 대응. Vercel body size limit (4.5MB default) 확인 필요 — 필요 시 next.config.js에서 bodyParser 설정 |
| page_number 재할당 타이밍 | Low | Low | 폼 제출 시점에 selectedFiles 배열 인덱스+1로 할당 (드래그 중간 상태는 무관) |
