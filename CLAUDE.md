# COMPASS 프로젝트

## 프로젝트 개요

한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화

---

## 핵심 개발 원칙

### 1. Don't Reinvent the Wheel (바퀴를 다시 발명하지 마라)

- 기존에 검증된 라이브러리, 프레임워크, 솔루션을 **우선 활용**
- 직접 구현 전에 반드시 검토:
  - npm 패키지
  - shadcn/ui 컴포넌트
  - Supabase 내장 기능
- 커스텀 구현은 기존 솔루션이 요구사항을 충족하지 못할 때만

### 2. MVP 집중

- 필수 기능만 구현, 과도한 추상화 금지
- 단순하고 명확한 코드 우선
- "나중에 필요할 것 같은" 기능은 구현하지 않음

### 3. 점진적 개선

- 완벽한 코드보다 동작하는 코드 우선
- 리팩토링은 필요할 때 진행

---

## 학습 지향 개발 (필수)

이 프로젝트는 **학습 목적**을 겸하므로, 모든 작업에서 다음을 준수:

1. **작업 설명**: 코드 작성 전에 **무엇을, 왜 하는지** 설명
2. **기술 설명**: 새로운 기술/패턴/라이브러리 사용 시 **개념과 동작 원리** 설명
3. **핵심 로직 설명**: 복잡한 코드에 대해 **어떻게 동작하는지** 설명
4. **의사결정 근거**: 기술적 선택 시 **대안과 선택 이유** 명시
5. **에러 학습**: 에러 발생 시 **원인 분석과 해결 과정** 설명

---

## 기술 스택

> **현재 Phase: 0-4 완료** | 전체 로드맵: [기술스택.md](docs/design/기술스택.md)

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16.1.6, React 19, TypeScript |
| Styling | TailwindCSS v4, shadcn/ui (19개 컴포넌트) |
| 데이터 테이블 | TanStack Table |
| Toast | Sonner |
| Backend | Supabase (인증, PostgreSQL, Storage) |
| 폼/검증 | React Hook Form, Zod |
| AI | Google Gemini |
| 배포 | Vercel |

---

## 코딩 컨벤션

### 언어

- **주석**: 한국어
- **커밋 메시지**: 한국어
- **문서**: 한국어

### 네이밍

- **컴포넌트**: PascalCase (`UserProfile.tsx`)
- **함수/변수**: camelCase (`getUserData`)
- **상수**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **파일명**: kebab-case (`user-profile.tsx`) 또는 PascalCase (컴포넌트)

### 구조

```
src/
├── app/           # Next.js App Router 페이지
├── components/    # 재사용 컴포넌트
│   ├── ui/        # shadcn/ui 컴포넌트 (19개)
│   ├── data-table/ # DataTable (TanStack Table)
│   ├── loading/   # Skeleton, Spinner
│   └── layout/    # 레이아웃 (사이드바, 헤더)
├── lib/           # 유틸리티, 헬퍼 함수
├── hooks/         # 커스텀 훅
└── types/         # TypeScript 타입 정의
```

---

## 주요 참조 문서

### 기획
- **PRD**: `docs/PRD.md`
- **PRD 상세**: `docs/prd/PRD-v0.1-detailed.md`

### 설계
- **시스템 아키텍처**: `docs/design/시스템아키텍처.md`
- **기술스택**: `docs/design/기술스택.md`
- **개발요구사항**: `docs/design/개발요구사항.md`

### 데이터베이스
- **스키마**: `supabase/migrations/00001_initial_schema.sql`
- **RLS 정책**: `supabase/migrations/00002_rls_policies.sql`
- **인덱스**: `supabase/migrations/00003_indexes.sql`
- **시드 데이터**: `supabase/seed.sql`

### 개발 가이드
- **프로젝트 구조**: `docs/guides/project-structure.md`
- **컴포넌트 패턴**: `docs/guides/component-patterns.md`
- **스타일링 가이드**: `docs/guides/styling-guide.md`
- **폼 (React Hook Form)**: `docs/guides/forms-react-hook-form.md`
- **Next.js 16**: `docs/guides/nextjs-15.md`

---

## 개발 명령어

```bash
# 개발 서버 실행 (Turbopack)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# ESLint 코드 검사
npm run lint

# Vitest 워치 모드 테스트
npm run test

# Vitest 단일 실행
npm run test:run

# 테스트 커버리지 리포트
npm run test:coverage
```
