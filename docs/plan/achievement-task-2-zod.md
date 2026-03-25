# Task 2: Zod 스키마 — 상세 계획

> 소유: backend-actions (`src/lib/validations/`)
> 의존: 없음 (Task 1과 병렬 가능)
> 산출물: `src/lib/validations/achievement-standards.ts`

---

## 기존 패턴: src/lib/validations/schools.ts

- schoolSchema (생성), updateSchoolSchema (수정), schoolFilterSchema (필터)
- 타입 export: `type SchoolInput = z.infer<typeof schoolSchema>`
- `.or(z.literal(''))` 패턴: optional 문자열에서 빈 문자열 허용

---

## Step 분해

### Step 1: 생성 스키마 (achievementStandardCreateSchema)

| 필드 | Zod | 필수 | DB 제약 대응 |
|------|-----|------|------------|
| code | `z.string().min(1).max(20)` | 필수 | NOT NULL UNIQUE |
| content | `z.string().min(1).max(1000)` | 필수 | NOT NULL |
| subject | `z.string().min(1)` | 필수 | NOT NULL |
| grade | `z.coerce.number().int().min(1).max(12)` | 필수 | CHECK 1-12 |
| semester | `z.coerce.number().int().min(1).max(2).optional()` | 선택 | CHECK 1,2 |
| unit | `z.string().max(100).optional().or(z.literal(''))` | 선택 | |
| sub_unit | `z.string().max(100).optional().or(z.literal(''))` | 선택 | |
| keywords | `z.array(z.string()).default([])` | 선택 | TEXT[] |
| source_name | `z.string().max(100).optional().or(z.literal(''))` | 선택 | |
| source_url | `z.string().url().optional().or(z.literal(''))` | 선택 | |
| order_in_semester | `z.coerce.number().int().min(1).optional()` | 선택 | |
| effective_year | `z.coerce.number().int().min(2000).max(2100).optional()` | 선택 | |
| curriculum_version | `z.string().default('2022')` | 선택 | |

### Step 2: 수정 스키마 (achievementStandardUpdateSchema)

편집 가능 필드만 (의사결정 #3):
- content, keywords, unit, sub_unit, source_name, source_url
- code/subject/grade/semester **제외** (읽기전용)

### Step 3: 필터 스키마 (achievementStandardFilterSchema)

- subject, grade, semester, unit, search: 모두 optional
- isActive: `z.enum(['true', 'false', 'all']).optional().default('true')`
- `z.coerce.number()` 필수 (URL searchParams는 문자열)

### Step 4: 타입 export

```typescript
export type AchievementStandardCreateInput = z.infer<typeof achievementStandardCreateSchema>
export type AchievementStandardUpdateInput = z.infer<typeof achievementStandardUpdateSchema>
export type AchievementStandardFilterInput = z.infer<typeof achievementStandardFilterSchema>
```

---

## 파일 구조 (~70줄)

```
src/lib/validations/achievement-standards.ts
├── achievementStandardCreateSchema
├── achievementStandardUpdateSchema
├── achievementStandardFilterSchema
├── type AchievementStandardCreateInput
├── type AchievementStandardUpdateInput
└── type AchievementStandardFilterInput
```

---

## 검증 기준

- [ ] npx tsc --noEmit 타입 에러 없음
- [ ] schools.ts 패턴과 일관성 유지
- [ ] DB 제약조건과 Zod 범위 일치
- [ ] 기존 테스트 전체 PASS (1390+)
