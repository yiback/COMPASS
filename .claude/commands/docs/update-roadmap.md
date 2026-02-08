---
description: 'ROADMAP.md에서 완료된 작업을 체크하고, docs/plan/ 문서의 진행 상황을 업데이트합니다'
allowed-tools: ['Read(docs/ROADMAP.md:*)', 'Edit(docs/ROADMAP.md:*)', 'Read(docs/plan/*)', 'Edit(docs/plan/*)', 'Glob(docs/plan/**)']
---

# Claude 명령어: Update Roadmap

완료된 작업을 ROADMAP.md에 체크하고, 해당 Phase의 `docs/plan/` 문서도 함께 업데이트합니다.

## 사용법

```
/update-roadmap
```

## 프로세스

1. ROADMAP.md 파일 읽기
2. 사용자에게 완료한 Task 번호 확인
3. 해당 Task와 하위 체크리스트에 체크 표시 추가
4. Phase 진행 상황 업데이트
5. 문서 버전 및 최종 업데이트 날짜 갱신
6. 진행 상황(X/12 Tasks 완료) 업데이트
7. **`docs/plan/` 해당 Phase 문서 업데이트** (Step 상태, 진행률, 완료 요약)

## 업데이트 규칙

### Task 체크 패턴

**Task 제목 업데이트:**

- Before: `- **Task XXX: 작업명** - 우선순위`
- After: `- **Task XXX: 작업명** ✅ - 완료`

**하위 항목 업데이트:**

- Before: `  - 항목명`
- After: `  - ✅ 항목명`

### Phase 상태

- 모든 Task 완료 시: `### Phase N: 제목` → `### Phase N: 제목 ✅`

### 진행 상황 업데이트

- 완료된 Task 수 / 전체 Task 수 계산
- 진행 상황 라인 업데이트

### 날짜 업데이트

- 최종 업데이트 날짜를 오늘 날짜로 자동 설정

## 대화형 프로세스

1. 현재 ROADMAP.md 읽기
2. 미완료 Task 목록 표시
3. "어떤 Task를 완료했나요? (예: 004 또는 004,005)" 질문
4. 사용자 입력 받기
5. 해당 Task와 모든 하위 항목에 체크 추가
6. Phase 상태 자동 확인 및 업데이트
7. 진행 상황 통계 업데이트
8. **`docs/plan/` 해당 Phase 문서 업데이트**
9. 변경 사항 확인 메시지 출력

## 구현 상세

### Task 완료 체크 로직

1. **Task 제목 찾기**: `- **Task XXX:` 패턴으로 검색
2. **이미 완료 확인**: 제목에 ✅가 있으면 건너뜀
3. **제목 업데이트**: 우선순위를 완료로 교체
4. **하위 항목 업데이트**: Task 다음 줄부터 ✅ 추가

### Phase 완료 체크 로직

1. Phase 내 모든 Task 확인
2. 모든 Task에 ✅가 있으면 Phase 제목에도 ✅ 추가
3. 단, 이미 ✅가 있는 Phase는 건너뜀

### 진행 상황 계산

```
전체 Task: 001~012 (12개)
완료 Task: ✅ 표시가 있는 Task 개수
진행률: (완료 Task / 전체 Task) * 100
```

### Phase Plan 문서 업데이트 로직 (`docs/plan/`)

완료한 Task가 속한 Phase의 plan 문서도 함께 업데이트한다.

1. **파일 찾기**: `docs/plan/` 폴더에서 해당 Phase 문서 탐색 (예: `phase-0-5.md`)
2. **진행 상태 요약 테이블 업데이트**: 완료한 Step의 상태를 `⏸️` → `✅`로 변경
3. **Step 섹션 상태 업데이트**: `**상태**: ⏸️ pending` → `**상태**: ✅ completed`
4. **검증 기준 체크**: 해당 Step의 `- [ ]` 항목을 `- [x]`로 변경
5. **완료 요약 추가**: Step 섹션에 `**완료 요약**:` 블록 추가 (작업 내용 간략 기술)
6. **헤더 진행률 업데이트**: 문서 상단의 `> **진행률**: X/N Steps 완료 (XX%)` 갱신
7. **마지막 업데이트 날짜 갱신**: `> **마지막 업데이트**: YYYY-MM-DD`
8. **파일 구조 섹션**: 완료된 파일에 `[완료]` 표시 추가
9. **전체 Phase 완료 시**: 상단 `> **상태**: 🚧 진행 중` → `> **상태**: ✅ 완료`

**Phase Plan 문서 패턴 예시:**

진행 상태 요약 테이블:
```markdown
| 6 | validation.ts (응답 검증) | ⏸️ | `src/lib/ai/validation.ts` |
→
| 6 | validation.ts (응답 검증) | ✅ | `src/lib/ai/validation.ts` |
```

Step 섹션:
```markdown
**상태**: ⏸️ pending
→
**상태**: ✅ completed
```

검증 기준:
```markdown
- [ ] 유효한 데이터 → `GeneratedQuestion[]` 반환
→
- [x] 유효한 데이터 → `GeneratedQuestion[]` 반환
```

파일 구조:
```markdown
├── validation.ts           (~80줄)  - 응답 검증
→
├── validation.ts           (~80줄)  - 응답 검증 [완료]
```

## 예시

**Before:**

```markdown
- **Task 004: 공통 컴포넌트 라이브러리 구축** - 우선순위
  - shadcn/ui 설치 및 설정
  - 기본 UI 컴포넌트 추가
  - 더미 견적서 데이터 생성 유틸리티

**📅 최종 업데이트**: 2025-10-07
**📊 진행 상황**: Phase 1 완료 (3/12 Tasks 완료)
```

**After:**

```markdown
- **Task 004: 공통 컴포넌트 라이브러리 구축** ✅ - 완료
  - ✅ shadcn/ui 설치 및 설정
  - ✅ 기본 UI 컴포넌트 추가
  - ✅ 더미 견적서 데이터 생성 유틸리티

**📅 최종 업데이트**: 2025-10-08
**📊 진행 상황**: Phase 2 진행 중 (4/12 Tasks 완료)
```

## 주의사항

- Task 번호는 3자리 숫자 형식 (001, 002, 003...)
- 이미 완료된(✅ 표시가 있는) Task는 건너뜀
- Phase 전체 완료 시 Phase 제목에도 ✅ 추가
- 날짜는 YYYY-MM-DD 형식 사용
- 여러 Task 동시 완료 지원 (004,005,006)
- `docs/plan/` 문서가 없는 Phase는 plan 업데이트를 건너뜀
- plan 문서의 Step 번호와 ROADMAP의 Task 번호가 다를 수 있음 — Task가 어떤 Phase/Step에 해당하는지 문맥으로 판단

## 스마트 기능

1. **자동 Phase 진행 추적**
   - Phase 1 완료
   - Phase 2 진행 중
   - Phase 4 대기 중

2. **완료율 계산**
   - 전체 12개 Task 중 완료 개수 자동 카운트
   - Phase별 완료 Task 수 추적

3. **날짜 자동 갱신**
   - 오늘 날짜로 자동 업데이트 (YYYY-MM-DD)

## 사용 예시

```bash
# 커맨드 실행
/update-roadmap

# 출력 예시:
현재 미완료 Task 목록:
- Task 004: 공통 컴포넌트 라이브러리 구축
- Task 005: 견적서 조회 페이지 UI 구현
- Task 006: 에러 및 로딩 상태 UI 구현
...

어떤 Task를 완료했나요? (예: 004 또는 004,005): 004

✅ Task 004 완료 체크 완료!
📊 진행 상황: 4/12 Tasks 완료 (33%)

📄 docs/plan/phase-0-2.md 업데이트 완료:
  - Step 4 상태: ⏸️ → ✅
  - 진행률: 3/8 → 4/8 Steps 완료 (50%)
  - 검증 기준 체크 완료
```
