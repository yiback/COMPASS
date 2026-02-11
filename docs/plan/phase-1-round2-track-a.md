# 단계 1 — 라운드 2 트랙 A: 기출문제 + AI 문제 생성

> **상태**: 미시작
> **모델**: Sonnet (병렬 실행 — tmux 트랙 A)
> **전제 조건**: 라운드 1 인증 시스템 완료

---

## 목표

교사가 기출문제 이미지/PDF를 업로드하고, AI로 유사 문제를 생성하여 저장/관리할 수 있게 한다.

---

## 학습 포인트 (구현 전 설명)

### Supabase Storage
- 버킷(bucket): 파일 저장소 단위. RLS 정책으로 접근 제어
- 업로드 흐름: Client Component → `supabase.storage.from('bucket').upload(path, file)`
- URL 생성: `getPublicUrl()` 또는 `createSignedUrl()`

### 파일 업로드 패턴
- Client Component에서 파일 선택 → Storage 직접 업로드
- 메타데이터(학교, 학년, 과목 등)는 Server Action으로 DB 저장
- Storage URL을 `past_exam_questions.source_image_url`에 저장

### AI Provider 연동
- `createAIProvider().generateQuestions(params)` 호출
- 결과는 `GeneratedQuestion[]` 타입
- DB 저장 시 `toDbQuestionType()`으로 타입 변환

---

## A-1: Storage 버킷 + 기출문제 업로드 [F005]

### 파일

| 파일 | 신규/수정 | 설명 |
|------|-----------|------|
| `supabase/migrations/00005_storage_buckets.sql` | 신규 | past-exams 버킷 + RLS |
| `src/lib/validations/past-exams.ts` | 신규 | 업로드 폼 Zod 스키마 |
| `src/lib/actions/past-exams.ts` | 신규 | 업로드/삭제 Server Actions |
| `src/app/(dashboard)/past-exams/upload/page.tsx` | 신규 | 업로드 폼 UI |

### DB 마이그레이션

```sql
-- past-exams 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('past-exams', 'past-exams', false);

-- RLS: 같은 학원 소속만 업로드/조회
CREATE POLICY "학원 소속 사용자 업로드"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'past-exams'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "학원 소속 사용자 조회"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'past-exams'
  AND auth.role() = 'authenticated'
);
```

### Zod 스키마

```typescript
export const pastExamUploadSchema = z.object({
  schoolId: z.string().uuid('학교를 선택해주세요.'),
  year: z.number().int().min(2000).max(2100),
  semester: z.number().int().min(1).max(2),
  examType: z.enum(['midterm', 'final', 'mock', 'diagnostic']),
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1, '과목을 입력해주세요.'),
})
```

### Server Action 핵심 로직

1. 파일 유효성 검증 (타입, 크기)
2. Storage 업로드 → URL 획득
3. `past_exam_questions` 테이블에 메타데이터 + URL 저장

---

## A-2: 기출문제 목록/검색/상세 [F006]

### 파일

| 파일 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/app/(dashboard)/past-exams/page.tsx` | 수정 | DataTable + 필터 |
| `src/app/(dashboard)/past-exams/[id]/page.tsx` | 신규 | 상세 뷰 (이미지 + 메타데이터) |
| `src/lib/actions/past-exams.ts` | 수정 | 목록/상세 조회 Actions 추가 |

### 재사용 컴포넌트

- `src/components/data-table/` (DataTable, Pagination, Toolbar)
- `src/components/loading/table-skeleton.tsx`

### DataTable 컬럼

| 컬럼 | 필드 | 정렬 | 필터 |
|------|------|------|------|
| 학교 | school.name | ✅ | ✅ (select) |
| 학년 | grade | ✅ | ✅ |
| 과목 | subject | ✅ | ✅ |
| 시험유형 | exam_type | - | ✅ |
| 년도 | year | ✅ | ✅ |
| 학기 | semester | - | ✅ |
| 등록일 | created_at | ✅ | - |

---

## A-3: AI 문제 생성 페이지 [F011]

### 파일

| 파일 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/app/(dashboard)/generate/page.tsx` | 수정 | 문제 생성 폼 + 결과 표시 |
| `src/lib/validations/generate.ts` | 신규 | 생성 파라미터 Zod 스키마 |
| `src/lib/actions/generate.ts` | 신규 | AI 문제 생성 Server Action |

### Zod 스키마

```typescript
export const generateQuestionsSchema = z.object({
  subject: z.string().min(1, '과목을 입력해주세요.'),
  grade: z.number().int().min(1).max(12),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  count: z.number().int().min(1).max(10),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  unit: z.string().optional(),
  topics: z.array(z.string()).optional(),
  schoolName: z.string().optional(),
})
```

### Server Action 핵심 로직

```typescript
'use server'
import { createAIProvider } from '@/lib/ai'

export async function generateQuestionsAction(formData: FormData) {
  // 1. Zod 검증
  // 2. 인증 확인
  // 3. AI 문제 생성
  const provider = createAIProvider()
  const questions = await provider.generateQuestions(params)
  // 4. 결과 반환 (아직 저장하지 않음)
  return { data: questions }
}
```

### UI 구조

```
┌─────────────────────────────────┐
│ 문제 생성                        │
│                                  │
│ [과목] [학년] [문제유형]          │
│ [난이도] [개수] [단원(선택)]      │
│ [학교명(선택)]                   │
│                                  │
│ [생성하기 버튼]                   │
│                                  │
│ ─── 생성 결과 ───                │
│ 문제 1: ...                      │
│ 문제 2: ...                      │
│                                  │
│ [전체 저장] [선택 저장]           │
└─────────────────────────────────┘
```

---

## A-4: 생성된 문제 저장/목록/상세 [F003]

### 파일

| 파일 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/lib/validations/questions.ts` | 신규 | 문제 Zod 스키마 |
| `src/lib/actions/questions.ts` | 신규 | 저장/수정/삭제/목록 Server Actions |
| `src/app/(dashboard)/questions/page.tsx` | 신규 | 문제 목록 DataTable |
| `src/app/(dashboard)/questions/[id]/page.tsx` | 신규 | 문제 상세 |

### 타입 매핑

```typescript
// GeneratedQuestion → questions 테이블 INSERT
const dbQuestion = {
  content: question.content,
  type: toDbQuestionType(question.type),
  difficulty: difficultyToNumber(question.difficulty), // easy=1, medium=3, hard=5
  answer: question.answer,
  explanation: question.explanation,
  options: question.options ? JSON.stringify(question.options) : null,
  is_ai_generated: true,
  ai_review_status: 'pending',
  source_type: 'ai_generated',
}
```

### 문제 목록 DataTable 컬럼

| 컬럼 | 필드 | 필터 |
|------|------|------|
| 과목 | subject | ✅ |
| 학년 | grade | ✅ |
| 유형 | type | ✅ |
| 난이도 | difficulty | ✅ |
| AI 검토 | ai_review_status | ✅ |
| 출처 | source_type | ✅ |
| 생성일 | created_at | - |

---

## 테스트

| 파일 | 내용 |
|------|------|
| `src/lib/actions/__tests__/past-exams.test.ts` | 업로드/목록/삭제 Server Actions |
| `src/lib/actions/__tests__/generate.test.ts` | AI 생성 Server Action (AI 모킹) |
| `src/lib/actions/__tests__/questions.test.ts` | 문제 CRUD Server Actions |

---

## 메뉴 수정

`src/lib/constants/menu.ts`에 문제 관리 메뉴 추가:

```typescript
{
  title: '문제 관리',
  href: '/questions',
  icon: ClipboardList,
  description: '생성된 문제 관리',
}
```

---

## 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Supabase Storage RLS 복잡 | 중 | 공식 문서 참조, 테스트 검증 |
| AI API 호출 비용 | 저 | 개발 중 count=1, 테스트는 mock |
| 파일 크기 제한 | 저 | 5MB 제한 + 클라이언트 검증 |
