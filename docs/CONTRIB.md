# 기여 가이드 (Contributing Guide)

> COMPASS 프로젝트 개발 워크플로우, 스크립트, 환경 설정 가이드

---

## 개발 환경 설정

### 필수 요구사항

- **Node.js**: 20.x 이상
- **npm**: 10.x 이상
- **Supabase 계정**: Cloud 프로젝트 생성 필요
- **Google AI Studio 계정**: Gemini API 키 발급 필요

### 초기 설정

1. **저장소 클론**

```bash
git clone <repository-url>
cd compass
```

2. **의존성 설치**

```bash
npm install
```

3. **환경 변수 설정**

`.env.local` 파일을 프로젝트 루트에 생성하고 아래 환경 변수를 설정합니다.

```bash
# Supabase 설정 (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI 설정 (필수)
GEMINI_API_KEY=your-gemini-api-key

# AI 설정 (선택 - 기본값 사용 가능)
# GEMINI_MODEL=gemini-2.0-flash
# AI_PROVIDER=gemini
# AI_MAX_RETRIES=3
# AI_TIMEOUT_MS=30000
```

환경 변수 상세 설명은 아래 [환경 변수](#환경-변수) 섹션 참조.

4. **Supabase 마이그레이션 실행**

Supabase 프로젝트의 SQL Editor에서 다음 파일을 순서대로 실행:

```
supabase/migrations/00001_initial_schema.sql
supabase/migrations/00002_rls_policies.sql
supabase/migrations/00003_indexes.sql
supabase/seed.sql
```

5. **개발 서버 실행**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 사용 가능한 스크립트

| 스크립트 | 명령어 | 설명 |
|----------|--------|------|
| **개발 서버** | `npm run dev` | Turbopack을 사용한 개발 서버 실행 (Hot Reload) |
| **프로덕션 빌드** | `npm run build` | 프로덕션용 최적화 빌드 생성 |
| **프로덕션 서버** | `npm run start` | 빌드된 앱을 프로덕션 모드로 실행 |
| **린트** | `npm run lint` | ESLint로 코드 품질 검사 |
| **테스트** | `npm run test` | Vitest 워치 모드로 테스트 실행 |
| **테스트 (단일 실행)** | `npm run test:run` | Vitest로 테스트 1회 실행 |
| **테스트 커버리지** | `npm run test:coverage` | 코드 커버리지 리포트 생성 |

### 스크립트 상세

#### `npm run dev`
- **목적**: 개발 중 실시간 미리보기
- **포트**: 기본 3000 (변경 시 `-p` 플래그 사용)
- **Turbopack**: Next.js 16의 기본 번들러로 빠른 번들링 지원
- **Hot Reload**: 파일 저장 시 자동 새로고침

#### `npm run build`
- **목적**: 배포 전 프로덕션 빌드 생성
- **검증**: 타입 체크, 린트, 빌드 오류 확인
- **출력**: `.next/` 디렉토리에 최적화된 파일 생성
- **CI/CD**: Vercel 배포 시 자동 실행됨

#### `npm run lint`
- **목적**: 코드 스타일 및 잠재적 오류 검사
- **설정**: `eslint.config.mjs` (Flat Config)
- **규칙**: `next/core-web-vitals` + TypeScript
- **자동 수정**: `npm run lint -- --fix`

#### `npm run test`
- **목적**: 개발 중 테스트 워치 모드 실행
- **프레임워크**: Vitest 4.x
- **환경**: Node.js (vitest.config.ts에서 설정)
- **경로 별칭**: `@/` → `./src` 자동 매핑

#### `npm run test:run`
- **목적**: CI/CD에서 테스트 1회 실행
- **종료**: 모든 테스트 완료 후 자동 종료

#### `npm run test:coverage`
- **목적**: 코드 커버리지 리포트 생성
- **목표**: 최소 80% 커버리지 달성
- **출력**: `coverage/` 디렉토리에 리포트 생성

---

## 환경 변수

### 전체 환경 변수 테이블

| 변수명 | 필수 | 공개 여부 | 기본값 | 설명 |
|--------|------|-----------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | 공개 가능 | - | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 | 공개 가능 | - | Supabase Anon Key (RLS 적용) |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | 비공개 | - | Supabase Service Role Key (RLS 우회) |
| `GEMINI_API_KEY` | 필수 | 비공개 | - | Google Gemini API 키 |
| `GEMINI_MODEL` | 선택 | 비공개 | `gemini-2.0-flash` | 사용할 Gemini 모델명 |
| `AI_PROVIDER` | 선택 | 비공개 | `gemini` | AI 프로바이더 식별자 |
| `AI_MAX_RETRIES` | 선택 | 비공개 | `3` | AI 요청 실패 시 최대 재시도 횟수 (1~10) |
| `AI_TIMEOUT_MS` | 선택 | 비공개 | `30000` | AI 요청 타임아웃 밀리초 (1000~120000) |

### Supabase 설정

Supabase 프로젝트 설정에서 값을 확인합니다:

1. **Project Settings** > **API**
2. **URL**: `NEXT_PUBLIC_SUPABASE_URL`에 복사
3. **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 복사
4. **service_role**: `SUPABASE_SERVICE_ROLE_KEY`에 복사 (주의!)

### AI (Gemini) 설정

Google AI Studio에서 API 키를 발급합니다:

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. API 키 생성
3. `GEMINI_API_KEY`에 복사

AI 설정은 `src/lib/ai/config.ts`에서 Zod 스키마로 검증됩니다. 유효하지 않은 값은 `AIConfigError`를 발생시킵니다.

### 보안 주의사항

- **`SUPABASE_SERVICE_ROLE_KEY`는 절대 커밋하지 마세요!**
- **`GEMINI_API_KEY`는 절대 커밋하지 마세요!**
- `.env.local`은 `.gitignore`에 포함되어 있음
- `NEXT_PUBLIC_` 접두사가 없는 변수는 서버 사이드에서만 접근 가능
- Service Role Key는 RLS(Row Level Security) 정책을 우회하므로 서버 코드에서만 사용

### 사용 위치

```
NEXT_PUBLIC_SUPABASE_URL     -> src/lib/supabase/client.ts (클라이언트)
                              -> src/lib/supabase/server.ts (서버)
                              -> src/lib/supabase/admin.ts  (관리자)
                              -> src/middleware.ts           (미들웨어)

NEXT_PUBLIC_SUPABASE_ANON_KEY -> src/lib/supabase/client.ts (클라이언트)
                               -> src/lib/supabase/server.ts (서버)
                               -> src/middleware.ts           (미들웨어)

SUPABASE_SERVICE_ROLE_KEY     -> src/lib/supabase/admin.ts  (관리자 전용)

GEMINI_API_KEY                -> src/lib/ai/config.ts       (AI 서비스)
GEMINI_MODEL                  -> src/lib/ai/config.ts       (AI 서비스)
AI_PROVIDER                   -> src/lib/ai/config.ts       (AI 서비스)
AI_MAX_RETRIES                -> src/lib/ai/config.ts       (AI 서비스)
AI_TIMEOUT_MS                 -> src/lib/ai/config.ts       (AI 서비스)
```

---

## 개발 워크플로우

### 1. 기능 개발

```bash
# 새 브랜치 생성
git checkout -b feature/기능명

# 개발 서버 실행
npm run dev

# 코드 작성 및 테스트
npm run test

# 린트 및 빌드 검증
npm run lint
npm run build
```

### 2. 코드 품질 체크리스트

커밋 전 확인:
- [ ] `npm run lint` 에러 0
- [ ] `npm run build` 성공
- [ ] `npm run test:run` 전체 통과
- [ ] 타입 에러 없음
- [ ] console.log 제거
- [ ] 하드코딩된 값 없음
- [ ] 환경 변수로 민감 정보 관리
- [ ] 불변성 패턴 사용 (mutation 없음)

### 3. 커밋 메시지 컨벤션

```
<type>: <description>

<optional body>
```

**타입**:
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `docs`: 문서 수정
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정 변경
- `perf`: 성능 개선
- `ci`: CI/CD 설정

**예시**:
```
feat: 로그인 페이지 구현

- Supabase Auth 연동
- 폼 검증 (Zod + React Hook Form)
- 에러 처리 추가
```

### 4. Pull Request

1. 브랜치 푸시
```bash
git push -u origin feature/기능명
```

2. PR 생성 시 포함할 내용:
   - 변경 사항 요약
   - 관련 이슈 번호
   - 테스트 방법
   - 스크린샷 (UI 변경 시)

---

## 테스팅 절차

### 테스트 프레임워크

- **Vitest 4.x**: 단위 테스트 및 통합 테스트
- **설정 파일**: `vitest.config.ts`
- **테스트 환경**: Node.js
- **경로 별칭**: `@/` -> `./src`

### 테스트 실행

```bash
# 워치 모드 (개발 중 실시간 실행)
npm run test

# 단일 실행 (CI/CD)
npm run test:run

# 커버리지 리포트 생성
npm run test:coverage

# 특정 파일만 테스트
npx vitest run src/lib/ai/__tests__/config.test.ts
```

### 테스트 작성 위치

```
src/lib/ai/__tests__/          # AI 모듈 테스트
  config.test.ts               # AI 설정 검증 테스트
  errors.test.ts               # AI 에러 클래스 테스트
  types.test.ts                # AI 타입 테스트
```

### TDD 워크플로우 (권장)

1. 테스트 작성 (RED) - 실패하는 테스트 먼저 작성
2. 테스트 실행 - 실패 확인
3. 최소 구현 (GREEN) - 테스트 통과하는 코드 작성
4. 리팩토링 (IMPROVE) - 코드 품질 개선
5. 커버리지 확인 - 80% 이상 달성

### Phase 1+ 추가 계획

- **E2E Tests**: Playwright (핵심 사용자 플로우)

### 수동 테스트 체크리스트

개발 중 확인:
- [ ] 페이지가 정상적으로 렌더링되는가?
- [ ] 폼 검증이 올바르게 작동하는가?
- [ ] 에러 처리가 사용자 친화적인가?
- [ ] 모바일 반응형이 잘 작동하는가?
- [ ] 브라우저 콘솔에 에러가 없는가?

---

## 트러블슈팅

### 일반적인 문제

#### 1. Turbopack 경고

**증상**:
```
Creating a new Turbopack project in a parent directory
```

**해결**:
- `next.config.ts`에 `turbopack.root` 설정 확인
- 절대경로로 `path.resolve(__dirname)` 사용

#### 2. Supabase 연결 실패

**증상**:
- "Invalid API key" 에러
- 데이터 조회 시 빈 배열

**해결**:
1. `.env.local` 파일 존재 확인
2. 환경 변수 값 재확인 (공백 없이)
3. 개발 서버 재시작 (`Ctrl+C` 후 `npm run dev`)
4. RLS 정책 확인 (로그인 필요한 경우)

#### 3. AI 설정 에러

**증상**:
```
AIConfigError: AI 설정 검증 실패: apiKey: GEMINI_API_KEY는 필수입니다
```

**해결**:
1. `.env.local`에 `GEMINI_API_KEY` 설정 확인
2. API 키가 유효한지 Google AI Studio에서 확인
3. `AI_MAX_RETRIES` 값이 1~10 범위인지 확인
4. `AI_TIMEOUT_MS` 값이 1000~120000 범위인지 확인
5. 개발 서버 재시작 (환경 변수 변경 후 필수)

#### 4. 빌드 에러

**증상**:
- TypeScript 타입 에러
- ESLint 에러

**해결**:
```bash
# TypeScript 타입 체크
npx tsc --noEmit

# ESLint 자동 수정
npm run lint -- --fix

# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

#### 5. Vitest 테스트 실패

**증상**:
- 모듈 import 에러
- `@/` 경로 해석 실패

**해결**:
1. `vitest.config.ts`에서 경로 별칭 확인
2. `tsconfig.json` paths 설정과 일치하는지 확인
3. `npm run test:run` 으로 전체 테스트 실행

---

## 프로젝트 구조

```
compass/
├── docs/                    # 프로젝트 문서
│   ├── CONTRIB.md          # 이 문서
│   ├── RUNBOOK.md          # 운영 가이드
│   ├── PRD.md              # 제품 요구사항
│   ├── design/             # 설계 문서
│   ├── guides/             # 개발 가이드
│   ├── plan/               # 구현 계획
│   └── prd/                # PRD 상세
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/         # 인증 관련 페이지
│   │   └── (dashboard)/    # 대시보드 페이지
│   ├── components/         # React 컴포넌트
│   │   ├── ui/             # shadcn/ui 컴포넌트 (19개)
│   │   ├── data-table/     # DataTable (TanStack Table)
│   │   ├── loading/        # Skeleton, Spinner
│   │   └── layout/         # 레이아웃 (사이드바, 헤더)
│   ├── lib/                # 유틸리티 및 서비스
│   │   ├── ai/             # AI 추상화 레이어
│   │   ├── supabase/       # Supabase 클라이언트
│   │   └── constants/      # 상수 정의
│   ├── hooks/              # 커스텀 훅
│   └── types/              # TypeScript 타입 정의
├── supabase/               # 데이터베이스 마이그레이션
├── CLAUDE.md               # 프로젝트 지침
├── package.json            # 의존성 및 스크립트
├── vitest.config.ts        # 테스트 설정
└── next.config.ts          # Next.js 설정
```

---

## 추가 리소스

- **프로젝트 구조**: [docs/guides/project-structure.md](./guides/project-structure.md)
- **컴포넌트 패턴**: [docs/guides/component-patterns.md](./guides/component-patterns.md)
- **폼 가이드**: [docs/guides/forms-react-hook-form.md](./guides/forms-react-hook-form.md)
- **스타일링 가이드**: [docs/guides/styling-guide.md](./guides/styling-guide.md)
- **시스템 아키텍처**: [docs/design/시스템아키텍처.md](./design/시스템아키텍처.md)

---

## 도움이 필요한가요?

- **버그 리포트**: GitHub Issues
- **기능 제안**: GitHub Discussions
- **질문**: 프로젝트 Slack 채널

---

**마지막 업데이트**: 2026-02-08
**소스 오브 트루스**: `package.json` (스크립트), `src/lib/ai/config.ts` (AI 환경변수), `src/lib/supabase/` (Supabase 환경변수)
