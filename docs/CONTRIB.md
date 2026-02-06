# 기여 가이드 (Contributing Guide)

> COMPASS 프로젝트 개발 워크플로우, 스크립트, 환경 설정 가이드

---

## 개발 환경 설정

### 필수 요구사항

- **Node.js**: 20.x 이상
- **npm**: 10.x 이상
- **Supabase 계정**: Cloud 프로젝트 생성 필요

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

`.env.local.example` 파일을 복사하여 `.env.local` 생성:

```bash
cp .env.local.example .env.local
```

환경 변수 설정 방법은 아래 [환경 변수](#환경-변수) 섹션 참조.

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

### 스크립트 상세

#### `npm run dev`
- **목적**: 개발 중 실시간 미리보기
- **포트**: 기본 3000 (변경 시 `-p` 플래그 사용)
- **Turbopack**: Next.js 16의 기본 번들러 (Webpack 대비 ~700배 빠름)
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

---

## 환경 변수

### Supabase 설정

프로젝트는 다음 환경 변수가 필요합니다:

```bash
# Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key (공개 가능)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Role Key (절대 노출 금지!)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 환경 변수 가져오기

Supabase 프로젝트 설정에서:
1. **Project Settings** → **API**
2. **URL**: `NEXT_PUBLIC_SUPABASE_URL`에 복사
3. **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 복사
4. **service_role**: `SUPABASE_SERVICE_ROLE_KEY`에 복사 (주의!)

### 보안 주의사항

- ⚠️ **SUPABASE_SERVICE_ROLE_KEY는 절대 커밋하지 마세요!**
- `.env.local`은 `.gitignore`에 포함되어 있음
- RLS(Row Level Security) 정책을 우회하므로 서버 코드에서만 사용

---

## 개발 워크플로우

### 1. 기능 개발

```bash
# 새 브랜치 생성
git checkout -b feature/기능명

# 개발 서버 실행
npm run dev

# 코드 작성 및 테스트
# ...

# 린트 및 빌드 검증
npm run lint
npm run build
```

### 2. 코드 품질 체크리스트

커밋 전 확인:
- [ ] `npm run lint` 에러 0
- [ ] `npm run build` 성공
- [ ] 타입 에러 없음
- [ ] console.log 제거
- [ ] 하드코딩된 값 없음
- [ ] 환경 변수로 민감 정보 관리

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

### 현재 상태
- ⚠️ **테스트 프레임워크 미설치** (Phase 1에서 추가 예정)

### Phase 1+ 계획
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: API Routes 테스트
- **E2E Tests**: Playwright

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

#### 3. 빌드 에러

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

---

## 추가 리소스

- **프로젝트 구조**: [docs/guides/project-structure.md](./guides/project-structure.md)
- **컴포넌트 패턴**: [docs/guides/component-patterns.md](./guides/component-patterns.md)
- **폼 가이드**: [docs/guides/forms-react-hook-form.md](./guides/forms-react-hook-form.md)
- **Next.js 15 가이드**: [docs/guides/nextjs-15.md](./guides/nextjs-15.md)
- **시스템 아키텍처**: [docs/design/시스템아키텍처.md](./design/시스템아키텍처.md)

---

## 도움이 필요한가요?

- **버그 리포트**: GitHub Issues
- **기능 제안**: GitHub Discussions
- **질문**: 프로젝트 Slack 채널

---

**마지막 업데이트**: 2026-02-06
