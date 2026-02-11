# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-11 (단계 1 라운드 2 진행 중)
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 라운드 2 (병렬 트랙 A/B 구현 중)
- **사용자 학습 목표**: 코드 구현뿐 아니라 개념 이해가 핵심. 자동 구현 후 반드시 리뷰 세션 진행

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### Phase 0 (100% 완료)

- **0-1~0-4**: Next.js + Supabase + 레이아웃 + 공통 UI 컴포넌트
- **0-5**: AI 추상화 레이어 (Factory + Strategy 패턴, GeminiProvider, 97개 테스트)

### 단계 1 라운드 1: 인증 시스템 (100% 완료)

| Step | 작업 | 상태 |
|------|------|------|
| 1 | DB 마이그레이션 (invite_code + 트리거) | ✅ |
| 2 | Zod 스키마 + Server Actions | ✅ |
| 3~5 | (auth) 레이아웃, 로그인, 회원가입, 비밀번호 재설정 | ✅ |
| 6~7 | 미들웨어 + 대시보드 인증 체크 + 로그아웃 | ✅ |
| 8 | 테스트 + 빌드 검증 (122개 테스트) | ✅ |

### 단계 1 라운드 2: 병렬 트랙 진행 중 ⚡

#### 트랙 A: 기출문제 + AI 문제 생성 (tmux pane 1)

| Step | 내용 | 상태 |
|------|------|------|
| A-1 | Storage 버킷 + 기출문제 업로드 | ✅ 완료 (Phase 1~4 모두 완료) |
| A-2 | 기출문제 목록/검색/상세 | ⏳ 승인 대기 중 |
| A-3 | AI 문제 생성 페이지 | 미시작 |
| A-4 | 생성된 문제 저장/목록/상세 | 미시작 |

- **context**: 79% (auto-compact까지 4%)
- **uncommitted files**: 27개
- A-1에서 생성된 핵심 파일:
  - `supabase/migrations/00005_storage_buckets.sql` — Storage 버킷 + 개선된 RLS
  - `src/lib/validations/past-exams.ts` — 업로드 Zod 스키마
  - `src/lib/actions/past-exams.ts` — 업로드/삭제 Server Actions
  - `src/app/(dashboard)/past-exams/upload/page.tsx` — 업로드 폼 UI

#### 트랙 B: CRUD UI (tmux pane 2)

| Step | 내용 | 상태 |
|------|------|------|
| B-1 | 학교 관리 CRUD | ✅ 완료 (Phase 1~5, RLS 수정 + Validation + Actions + UI) |
| B-2 | 사용자 관리 (역할 변경) | ⏳ 승인 대기 중 |
| B-3 | 학원 정보 관리 | 미시작 |

- **context**: 66%
- **uncommitted files**: 27개 (트랙 A와 공유)
- B-1에서 생성된 핵심 파일:
  - RLS 정책 수정 마이그레이션 (teacher 역할 추가)
  - `src/lib/validations/schools.ts` — 학교 Zod 스키마 (25개 테스트)
  - `src/lib/actions/schools.ts` — 5개 CRUD Server Actions
  - `src/app/(dashboard)/admin/schools/` — 목록/생성/수정 페이지

---

## 3. What Worked (성공한 접근)

### 라운드 2 병렬 실행
- **tmux split-window로 트랙 분리**: 왼쪽=리더(Opus), 오른쪽 상/하=트랙A/B(Sonnet)
- **`/everything-claude-code:plan` + zen thinkdeep MCP**: 계획 수립 시 Sequential thinking으로 깊이 분석 → 보안 이슈 사전 발견
- **트랙 A thinkdeep 발견**: 원안의 Storage RLS에서 역할 기반 접근 제어 누락, Client-side 직접 업로드 보안 취약점 발견 후 개선
- **트랙 B thinkdeep 발견**: RLS 정책에 teacher 역할 누락 (BLOCKING 이슈), DELETE 정책 미정의 발견 후 수정
- **accept edits on (shift+tab)**: 편집 자동 승인 모드로 전환하면 중간에 멈추지 않음

### 이전 라운드에서 이어온 것
- **`useActionState` + Server Actions**: React 19 표준 패턴
- **handle_new_user 트리거 수정**: metadata에서 `academy_id` 자동 저장
- **TDD RED→GREEN→REFACTOR** 철저 준수

### 학습 워크플로우 (CLAUDE.md에 추가됨)
- **병렬 구현 후 학습 플로우**: (1) 자동 구현 완료 → (2) Phase별 핵심 개념 리뷰 설명 → (3) 이해 부족 시 삭제 후 재구현 → (4) 학습 포인트 문서 정리

---

## 4. What Didn't Work (실패/주의사항)

### tmux send-keys로 Claude Code 조작 한계 (CRITICAL)
- **선택형 프롬프트(Yes/No)에 키 입력이 안 먹힘**: `tmux send-keys -t 1 Enter`, `'y'`, `'1'` 모두 실패. Claude Code의 interactive selection UI는 tmux send-keys로 조작 불가
- **해결**: 사용자가 직접 해당 pane 클릭 후 입력하거나, `shift+tab`으로 "accept all edits" 모드 활성화
- **의도치 않은 입력 전달**: tmux send-keys로 보낸 텍스트가 예기치 않게 다른 프롬프트에 입력될 수 있음. "승인. 구현해줘"가 사용자 모르게 입력된 사례 발생

### Supabase placeholder 타입 문제
- **`.insert()`, `.update()` 메서드에서 타입 불일치**: DB 타입이 placeholder여서 TypeScript 에러 발생
- **임시 해결**: `as any` 캐스팅, `supabase: any` 타입 단언
- **근본 해결**: `npx supabase gen types typescript --project-id <ID> > src/types/supabase.ts` 실행 필요

### TypeScript 튜플 타입 이슈
- `as const`로 선언한 배열이 Zod `.enum()`과 호환 안 됨
- `Index signature for type 'string' is missing` 에러
- `.refine()` + `.includes()` 패턴으로 우회

### 이전 Phase 교훈 (여전히 유효)
- `next.config.ts`에서 `import.meta.url` 사용 불가 → `__dirname` 사용
- handle_new_user 트리거에서 role 항상 `'student'` 고정
- seed.sql UUID `s0000000-...` 유효하지 않음 → `b0000000-...` 사용

---

## 5. Next Steps (다음 단계)

### 🚨 즉시 해야 할 일

#### 1. 진행 중인 트랙 완료시키기

**트랙 A** (pane 1):
- A-2 "진행해줘" 입력 → 기출문제 목록/검색/상세 구현
- A-3 → AI 문제 생성 페이지
- A-4 → 생성된 문제 저장/목록/상세
- ⚠️ context 79% — auto-compact 될 수 있음

**트랙 B** (pane 2):
- B-2 "진행해줘" 입력 → 사용자 관리 CRUD
- B-3 → 학원 정보 관리
- context 66% — 여유 있음

#### 2. 학습 리뷰 세션 (트랙 완료 후)

완료된 코드를 기반으로:
1. Phase별 핵심 개념 설명 (RLS, Server Actions, Storage, Zod 패턴 등)
2. 이해 부족 시 삭제 후 재구현
3. 학습 포인트 문서 정리

#### 3. 통합 작업 (양쪽 트랙 완료 후)

- `menu.ts` 통합 (트랙 B에서만 수정, 트랙 A 메뉴 나중에 추가)
- `supabase gen types` 실행 → placeholder 타입 해소
- 전체 빌드 + 린트 + 테스트 검증
- 커밋 (트랙별 또는 통합)

### 그 이후
- 단계 2: 시험지 조합 + 배포 (ROADMAP.md 참조)

---

## 6. Architecture Decisions (주요 아키텍처 결정)

| 결정 | 이유 |
|------|------|
| 5개 레이어 아키텍처 | 프레젠테이션/비즈니스/AI/데이터/횡단 관심사 분리 |
| Server Actions + Service Layer | MVP 속도 + Phase 2 NestJS 전환 시 재사용 |
| AI Provider Pattern (Factory + Strategy) | Gemini → OpenAI/Claude 교체를 Factory에 case 추가로 해결 |
| Supabase RLS 멀티테넌시 | academy_id 기반 데이터 격리, 3중 보안 |
| Route Groups: (auth)/(dashboard) | URL 영향 없이 레이아웃 분리 |
| Storage RLS: 역할 기반 | 교사/관리자만 업로드, 소유자/관리자만 삭제 (라운드 2에서 개선) |
| Server-side 파일 업로드 | Client 직접 업로드 보안 취약점 방지 (라운드 2에서 결정) |
| Defense in Depth | RLS(DB 계층) + Server Action(앱 계층) 이중 권한 체크 |

---

## 7. tmux 환경 상태

```
왼쪽 (pane 0): 리더 (Opus) — 조율/모니터링/학습 설명
    │  오른쪽 위 (pane 1): track-A (Sonnet) — 기출문제 + AI
    │────────────────────────────────────────────────────
    │  오른쪽 아래 (pane 2): track-B (Sonnet) — CRUD UI
```

- 두 트랙 모두 `--model sonnet`으로 실행됨
- `accept edits on` 모드 활성화 상태 (shift+tab)
- 양쪽 모두 다음 작업 승인 대기 중

---

## 8. 개발 명령어

```bash
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run test:run       # Vitest 단일 실행

# 단일 테스트 파일 실행
npx vitest run src/lib/actions/__tests__/auth.test.ts
```

---

## 9. 핵심 참조 문서 (우선순위 순)

1. `CLAUDE.md` — 프로젝트 개발 지침 (학습 워크플로우 포함)
2. `docs/plan/phase-1-round2-track-a.md` — 트랙 A 상세 계획
3. `docs/plan/phase-1-round2-track-b.md` — 트랙 B 상세 계획
4. `docs/plan/phase-1-round1.md` — 라운드 1 상세 계획 (완료)
5. `docs/design/시스템아키텍처.md` — 아키텍처, DB 스키마, 데이터 흐름
6. `ROADMAP.md` — 단계별 개발 로드맵
7. `docs/prd/PRD-v0.1-detailed.md` — 기능 명세 및 페이지별 상세

---

## 10. 알려진 제약 (의도적 MVP 제한)

- DB 타입: placeholder (`supabase gen types` 미실행 → `as any` 우회 중)
- `questions.content = TEXT`: 수식은 LaTeX 마크업, 그래프/이미지 미지원
- 지문형 문제 미지원 (영어 지문+복수문제 구조 없음)
- 소셜 로그인 미지원 (이메일/비밀번호만)
- 마이그레이션 00004, 00005는 Supabase Cloud에 **아직 미적용** (로컬 파일만 생성)
