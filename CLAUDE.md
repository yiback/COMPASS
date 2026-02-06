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

## 기술 스택

> **현재 Phase: 0-1 (MVP)** | 전체 로드맵: [기술스택.md](docs/design/기술스택.md)

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | TailwindCSS v4, shadcn/ui |
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
│   └── ui/        # shadcn/ui 컴포넌트
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
- **Next.js 15**: `docs/guides/nextjs-15.md`

---

## 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 린트
npm run lint
```
