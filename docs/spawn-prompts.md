# Agent Team Spawn Prompt 샘플 — Compass 프로젝트용

워크플로우 순서에 맞춰 정리:
ROADMAP → 리서치 → Phase PLAN → PLAN 리뷰 → 상세 PLAN → 상세 리뷰 → 구현 → 코드 리뷰 → 회고

---

## 1. 리서치 팀 — Step 2에서 PLAN 작성 전 사용

**사용자가 할 일**: 리드가 정리한 추천안 1페이지만 읽고 방향 결정 (5~10분)

### 1-A. 기술 선택이 필요한 경우 (2명)

```
Phase 2에서 [기능명]을 구현해야 해.
PLAN 작성 전에 기술 리서치가 필요해. Agent team으로 조사하자.

2명을 스폰해줘:

- "tech-researcher": [기술 옵션들]을 비교 분석.
  각 방식의 장단점, TypeScript + Next.js + Supabase 호환성,
  주요 라이브러리 성숙도를 분석.
  산출물: docs/research/tech/[주제].md
  읽기 전용: src/ 전체
  절대 편집 금지: src/, supabase/, docs/plan/

- "feasibility-analyst": 기존 코드베이스에서 각 방식의 실현 가능성을 평가.
  src/lib/actions/, src/lib/ai/, supabase/migrations/를 분석해서
  기존 아키텍처와의 호환성, 변경 범위, 예상 작업량(S/M/L) 평가.
  산출물: docs/research/feasibility/[주제].md
  읽기 전용: src/ 전체, supabase/
  절대 편집 금지: src/, supabase/, docs/plan/

두 팀원은 서로 결과를 공유하고 결론이 충돌하면 토론할 것.
리드는 추천안 1개를 1페이지로 정리해줘.
```

### 1-B. 복잡한 결정 시 devil-advocate 포함 (3명)

```
PLAN 작성 전에 기술 리서치가 필요해. Agent team으로 조사하자.

3명을 스폰해줘:

- "tech-researcher": [기술 옵션들]을 비교 분석.
  각 방식의 장단점, TypeScript + Next.js + Supabase 호환성,
  주요 라이브러리 성숙도를 분석.
  산출물: docs/research/tech/[주제].md
  읽기 전용: src/ 전체
  절대 편집 금지: src/, supabase/, docs/plan/

- "feasibility-analyst": 기존 코드베이스에서 각 방식의 실현 가능성을 평가.
  src/lib/actions/, src/lib/ai/, supabase/migrations/를 분석해서
  기존 아키텍처와의 호환성, 변경 범위, 예상 작업량(S/M/L) 평가.
  산출물: docs/research/feasibility/[주제].md
  읽기 전용: src/ 전체, supabase/
  절대 편집 금지: src/, supabase/, docs/plan/

- "devil-advocate": 다른 두 팀원의 결론을 적극적으로 반박.
  "[기능]이 정말 필요한가? 더 단순한 방법은 없는가?"부터 시작.
  Supabase 내장 기능이나 shadcn/ui로 해결 가능한 부분이 있는지 확인.
  ❌ FORBIDDEN의 "Don't Reinvent the Wheel" 원칙 관점에서 평가.
  산출물: 리드에게 우려사항 리스트 메시지 전달.
  절대 편집 금지: src/, supabase/, docs/

리드는 최종 추천안 + 주요 리스크를 1페이지로 정리해줘.
나는 그 1페이지만 보고 결정할 거야.
```

---

## 2. PLAN 리뷰 팀 — Step 2, 3에서 PLAN 검토 시 사용

**사용자가 할 일**: 이슈 리스트만 확인하고 수용/거부 결정 (5~10분)

### 2-A. Phase PLAN 리뷰 (Step 2, 2명)

```
docs/plan/[phase-plan 파일].md 초안을 작성했어.
Agent team으로 리뷰해줘.

2명을 스폰해줘:
- "technical-reviewer": PLAN의 기술적 실현 가능성을 검토.
  누락된 엣지 케이스, 기존 Supabase 스키마와의 충돌 가능성,
  현재 src/lib/actions/ 패턴과의 일관성을 확인.
  docs/research/ 리서치 결과와 PLAN이 일치하는지도 확인.
  산출물: docs/reviews/[phase]-tech-review.md
  읽기 전용: docs/plan/, src/ 전체, supabase/, docs/research/
  절대 편집 금지: src/, supabase/, docs/plan/

- "scope-reviewer": PLAN의 범위 적절성을 검토.
  이 Phase에서 꼭 해야 하는 것 vs 다음으로 미룰 수 있는 것 구분.
  YAGNI 위반, 과도 설계, shadcn/ui나 Supabase로 간단히 해결 가능한 부분 확인.
  산출물: docs/reviews/[phase]-scope-review.md
  읽기 전용: docs/plan/, docs/research/
  절대 편집 금지: src/, supabase/, docs/plan/

리드는 두 리뷰를 종합해서 이슈 리스트를 만들어줘:
- [MUST FIX] 구현 전 반드시 수정
- [SHOULD FIX] 수정하면 좋지만 없어도 진행 가능
- [CONSIDER] 참고할 만한 의견

나는 이 이슈 리스트만 보고 판단할 거야.
```

### 2-B. 상세 PLAN 리뷰 (Step 3, 3명) — Task 분해 검증

```
docs/plan/[phase-detail 파일].md 상세 PLAN을 작성했어.
Task 단위까지 분해되어 있어. Agent team으로 리뷰해줘.

3명을 스폰해줘:

- "technical-reviewer": 각 Task의 기술적 정확성 검토.
  Task 간 의존성 누락, 에러 처리 전략 부재,
  기존 Supabase RLS 정책과의 호환성 문제를 찾아줘.
  산출물: docs/reviews/[phase]-detail-tech-review.md
  읽기 전용: docs/plan/, src/ 전체, supabase/
  절대 편집 금지: src/, supabase/, docs/plan/

- "scope-reviewer": Task 분해의 적절성 검토.
  각 Task가 orchestrate 워커 하나로 처리 가능한 크기인가.
  Task별 파일 소유권이 명확해서 병렬 구현 시 충돌이 없는가.
  CLAUDE.md의 Implementation Phase 역할 경계와 일치하는가.
  산출물: docs/reviews/[phase]-detail-scope-review.md
  읽기 전용: docs/plan/
  절대 편집 금지: src/, supabase/, docs/plan/

- "consistency-reviewer": ROADMAP 및 이전 Phase와의 정합성 검토.
  ROADMAP.md의 목표와 상세 PLAN이 일치하는가.
  docs/retrospective/ 회고 교훈이 반영되었는가.
  이전 Phase의 Supabase 스키마, 타입 정의와 호환되는가.
  산출물: docs/reviews/[phase]-detail-consistency-review.md
  읽기 전용: docs/plan/, docs/retrospective/, ROADMAP.md, src/types/
  절대 편집 금지: src/, supabase/, docs/plan/

리드는 세 리뷰를 종합 + Plan Review Completion Checklist로 판정해줘:
- "[READY] 구현 진행 가능" 또는
- "[BLOCKED] 수정 필요: [미충족 항목들]"

나는 이 판정 결과만 보고 결정할 거야.
```

---

## 3. 구현 팀 — Step 4에서 사용

기존 orchestrate 커맨드와 병행 가능. CLAUDE.md의 파일 소유권 규칙을 따릅니다.

```
docs/plan/[상세 plan 파일].md에 따라 구현을 진행해줘.
Agent team을 만들어서 병렬로 작업하자.

[Task 내용에 따라 필요한 역할만 스폰. 아래는 예시]

- "backend-actions": [구체적 Task 내용].
  소유: src/lib/actions/[module]/, src/lib/validations/[module].ts
  절대 편집 금지: src/app/, src/components/, src/lib/ai/, supabase/
  상세 PLAN의 Task N, N+1 담당.

- "frontend-ui": [구체적 Task 내용].
  소유: src/app/(dashboard)/[page]/, src/components/[module]/
  절대 편집 금지: src/lib/actions/, src/lib/ai/, supabase/
  상세 PLAN의 Task N+2, N+3 담당.
  backend-actions가 Server Action 인터페이스를 완성하면 참조해서 작업 시작.

- "tester": [구체적 Task 내용].
  소유: src/lib/actions/__tests__/[module].test.ts
  절대 편집 금지: src/ 내 __tests__/ 외 모든 파일
  상세 PLAN의 Task N+4 담당.
  backend-actions 완료 후 테스트 작성 시작.

모든 팀원은 CLAUDE.md의 File Ownership Rules를 따를 것.
package.json, middleware.ts, src/lib/utils.ts 수정이 필요하면 리드에게 메시지.
각 팀원은 작업 완료 후 npm run typecheck && npm run lint 실행.
```

---

## 4. 코드 리뷰 팀 — Step 5에서 사용

```
Phase [N] 구현이 완료됐어. Agent team으로 코드 리뷰를 진행하자.
테스트는 Vercel Agent Browser CLI를 --headed 모드로 실행하여 시각적으로 검증해야 합니다.
.claude/agents/dev/code-reviewer.md 의 리뷰 프로세스를 따를 것.

3명을 스폰해줘:

- "security-reviewer": 보안 취약점 집중 리뷰.
  src/lib/actions/auth.ts, src/middleware.ts,
  supabase/migrations/*rls* 변경사항 중점.

- "perf-reviewer": 성능 영향 분석.
  src/lib/actions/의 Supabase 쿼리 패턴, src/lib/ai/의 API 호출.
  N+1 쿼리, 불필요한 재렌더링, 번들 사이즈 영향.

- "test-reviewer": 테스트 커버리지 검증.
  __tests__/ 와 src/ 변경사항 대조.
  엣지 케이스, 에러 경로 테스트 존재 여부.

읽기 전용 — 코드를 수정하지 말 것.
각 리뷰어는 severity (critical/high/medium/low)로 분류.
리뷰 완료 후 서로 도전(challenge)할 것.
리드가 최종 리포트를 docs/reviews/[phase]-code-review.md에 작성.
```

---

## 5. 디버깅 팀 — 필요 시 사용

```
[증상 설명].
Agent team으로 서로 다른 가설을 병렬 조사하자.

- "hypothesis-[가설1 이름]": [구체적 조사 방향].
  [관련 파일 경로] 분석.

- "hypothesis-[가설2 이름]": [구체적 조사 방향].
  [관련 파일 경로] 분석.

모든 팀원은 코드를 수정하지 말고 분석만 할 것.
서로의 가설을 적극적으로 반박(disprove)하려고 시도할 것.
리드가 합의된 결과를 정리.
```

---
## ercel Agent Browser CLI 예시(E2E)
Chargebee 시스템의 종단 간 테스트를 수행하십시오. 
사용자가 회원가입, 로그인, 토큰 구매 페이지 이동, 100 토큰 구매, 그리고 채팅 페이지에서 토큰 소모를 확인하는 전체 과정을 Vercel Agent Browser CLI를 --headed 모드로 실행하여 시각적으로 검증해야 합니다. 
모든 사용자 여정이 완벽하게 작동하고 애플리케이션에 오류가 없음을 확인할 때까지 테스트를 중단하지 마십시오. 
실패한 테스트는 절대 무시하지 말고, 문제를 해결하고 다시 테스트하십시오.
---

## 사용자 역할 변화 요약

### Before: 사용자가 직접 검토
```
PLAN 초안 → [Yi가 직접 읽고 검토] → 피드백 → 수정 확인 → [다시 검토] → 반복...
```

### After: 사용자는 의사결정만
```
리서치 팀 조사 → 리드가 추천안 1페이지 정리 → [Yi가 방향 결정] (5분)
PLAN 초안 → 리뷰 팀 검토 → 리드가 이슈 리스트 정리 → [Yi가 수용/거부] (5분)
상세 PLAN → 리뷰 팀 검토 → READY/BLOCKED 판정 → [Yi가 확인] (5분)
```

---

## 기존 에이전트와의 관계

| 기존 에이전트 (`.claude/agents/`) | Agent Team에서의 활용 |
|---|---|
| `dev/code-reviewer.md` | 코드 리뷰 팀의 기본 리뷰 프로세스로 참조 |
| `dev/development-planner.md` | ROADMAP 작성 시 단독 사용 (팀 불필요) |
| `docs/prd-validator.md` | 리서치 팀의 feasibility-analyst가 참고 |
| `docs/edu-critical-analyst.md` | 리서치 팀의 devil-advocate가 참고 |
| `orchestrate.md` 커맨드 | 구현 팀 대신 사용 가능 (tmux 기반 병렬 실행) |
