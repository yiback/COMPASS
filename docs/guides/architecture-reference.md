# Architecture Reference

> 이 파일은 CLAUDE.md에서 분리된 상세 참조 문서입니다.

## 프로젝트 개요

한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 진행 중 (1-1~1-3 완료, 다음: 1-4 학원 관리)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16.1.6, React 19, TypeScript |
| Styling | TailwindCSS v4, shadcn/ui |
| 데이터 테이블 | TanStack Table |
| Backend | Supabase (인증, PostgreSQL, Storage) |
| 폼/검증 | React Hook Form, Zod |
| AI | Google Gemini (`@google/genai`) |
| 테스트 | Vitest |
| 배포 | Vercel |

---

## 아키텍처 (5개 레이어)

```
클라이언트 (Browser)
    │
프레젠테이션 레이어   ← App Router Pages, Server Components, RBAC Middleware
    │
비즈니스 로직 레이어   ← Server Actions + Service Layer + Zod Validation
    │          │
AI 서비스 레이어  │   ← Provider Pattern (Factory + Strategy) - Gemini 구현체
    │     데이터 레이어  ← Supabase (PostgreSQL + RLS + Auth + Storage)
```

### Route Groups 구조

- `(dashboard)/` — 로그인 필수. 사이드바+헤더 레이아웃. 역할별 하위 경로 (`teacher/`, `student/`, `admin/`)
- `(auth)/` — 미로그인 전용. 심플 레이아웃

### AI Provider Pattern

`src/lib/ai/` 에 Factory + Strategy 패턴으로 구현:
- `types.ts` — AIProvider 인터페이스, QuestionType↔DbQuestionType 매핑
- `errors.ts` — AIError 계층 (AIServiceError, AIValidationError, AIRateLimitError, AIConfigError)
- `config.ts` — 환경변수 검증 (Zod 스키마 + 캐싱)
- `retry.ts` — 재시도 유틸리티 (지수 백오프)
- `validation.ts` — 응답 파싱/검증 (Zod 스키마 이중 활용)
- `prompts/` — 프롬프트 템플릿 시스템 (빌더 패턴)
- `provider.ts` — Factory 함수 (`createAIProvider()`)
- `gemini.ts` — GeminiProvider 구현체 (Structured Output)

#### 미래 확장: 멀티 AI 협업

현재 Factory + Strategy 패턴은 "단일 AI 엔진 교체"에 초점. Phase 2+에서 멀티 AI 협업 아키텍처로 확장 예정. 현재 MVP에서는 단일 Provider로 충분.

### Supabase 클라이언트 3종 (`src/lib/supabase/`)

- `client.ts` — 브라우저용 (Client Component)
- `server.ts` — Server Component/Server Action용 (`await cookies()` 필수)
- `admin.ts` — Service Role용 (RLS 우회, 서버 전용)

---

## 알려진 제약 (MVP 의도적 제한)

- `questions.content = TEXT` — 수식은 LaTeX 마크업, 그래프/이미지 미지원
- 지문형 문제 미지원 (영어 지문+복수문제 구조 없음)
- 리치 텍스트 미지원 (표, 볼드, 박스 등)
- 후속 Phase에서 스키마 마이그레이션으로 확장 예정


