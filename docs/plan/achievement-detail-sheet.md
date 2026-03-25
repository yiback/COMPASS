# 성취기준 상세 Sheet — 계획

> 작성일: 2026-03-25
> 상태: **리뷰 대기**
> 예상 작업량: XS (2~3시간)
> 선행: 단계 2-2 Task 4 (UI) 완료

---

## 1. 문제

DataTable에서 성취기준 "내용" 컬럼이 잘려서 전체 텍스트가 보이지 않음.
성취기준 내용은 30~80자로 다양하며, 테이블 행에서 truncate 처리됨.

## 2. 해결 방식

**행 클릭 → Sheet (사이드 패널)에서 전체 정보 표시**

기존 패턴 참조:
- `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx`
- `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx`
- `src/app/(dashboard)/admin/users/_components/user-detail-sheet.tsx`

## 3. 구현 사항

### 신규 파일 (1개)

| 파일 | 설명 |
|------|------|
| `src/components/achievement-standards/detail-sheet.tsx` | 성취기준 상세 Sheet |

### 수정 파일 (1개)

| 파일 | 변경 |
|------|------|
| `src/components/achievement-standards/achievement-standards-table.tsx` | 행 클릭 → Sheet open 상태 관리 |

### detail-sheet.tsx 구조

```
'use client'

Props:
  - open: boolean
  - onOpenChange: (open: boolean) => void
  - standard: AchievementStandard | null

Sheet > SheetContent (side="right")
  SheetHeader
    SheetTitle: "[코드] 성취기준 상세"

  본문:
    - 내용 (content) — 전체 텍스트, 줄바꿈 허용
    - 과목 / 학년 / 학기
    - 단원 / 소단원
    - 키워드 (Badge 목록 — 전체 표시)
    - 출처 (source_name + source_url 링크)
    - 진도 순서 (order_in_semester)
    - 교육과정 버전 (curriculum_version)
    - 적용 연도 (effective_year)
    - 상태 (is_active)
```

### achievement-standards-table.tsx 수정

```
기존:
  - DataTable + 수정/비활성화 Dialog 상태

추가:
  - selectedStandard 상태 (useState<AchievementStandard | null>)
  - DataTable 행 클릭 핸들러 → setSelectedStandard(row)
  - DetailSheet 컴포넌트 렌더링
```

### 행 클릭 방식

기존 question-detail-sheet 패턴 참조:
- DataTable의 `onRowClick` prop 또는
- columns의 content 셀에 클릭 핸들러 추가
- 또는 테이블 래퍼에서 `table.getRowModel().rows` 순회 시 onClick

**추천**: achievement-standards-table.tsx에서 `onRowClick` 콜백 → DetailSheet open

### 학년 표시 변환

```
{ 7: '중1', 8: '중2', 9: '중3' }
```

columns.tsx의 GRADE_DISPLAY 맵 재사용.

## 4. 의존성

- 기존 `Sheet`, `SheetContent` 등 shadcn/ui 컴포넌트 — 이미 설치됨
- `AchievementStandard` 타입 — columns.tsx에서 export 됨
- Server Action 호출 불필요 — DataTable에 이미 로드된 데이터 사용 (추가 DB 쿼리 없음)

## 5. RBAC

- 모든 역할(admin, teacher, student)이 상세 Sheet 조회 가능
- system_admin 전용 기능 없음 (읽기 전용 Sheet)

## 6. 검증 기준

- [ ] 행 클릭 시 Sheet 열림
- [ ] 전체 content 텍스트 표시 (truncate 없음)
- [ ] 키워드 전체 Badge 표시
- [ ] 학년 "중1/중2/중3" 변환 표시
- [ ] Sheet 닫기 (X 버튼 / 바깥 클릭)
- [ ] 콘솔 에러 0건
- [ ] npm run build 성공
- [ ] 기존 테스트 전체 PASS
