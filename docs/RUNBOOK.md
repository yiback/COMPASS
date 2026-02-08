# 운영 가이드 (Runbook)

> COMPASS 프로젝트 배포, 모니터링, 트러블슈팅 가이드

---

## 배포 절차

### Vercel 배포 (자동)

**전제 조건**:
- Vercel 계정 연동
- GitHub 저장소 연결
- 환경 변수 설정 완료

**자동 배포 트리거**:
```bash
# main 브랜치에 푸시하면 자동 배포
git push origin main
```

**Preview 배포**:
- PR 생성 시 자동으로 Preview URL 생성
- 각 커밋마다 새로운 Preview 배포

---

### 환경 변수 설정 (Vercel)

1. **Vercel Dashboard** 접속
2. 프로젝트 선택 > **Settings** > **Environment Variables**
3. 다음 변수 추가:

#### Supabase 설정

| 변수명 | 타입 | 설명 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase Service Role Key (RLS 우회) |

#### AI 서비스 설정

| 변수명 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| `GEMINI_API_KEY` | Secret | - | Google Gemini API 키 (필수) |
| `GEMINI_MODEL` | Plain | `gemini-2.0-flash` | 사용할 Gemini 모델 |
| `AI_PROVIDER` | Plain | `gemini` | AI 프로바이더 식별자 |
| `AI_MAX_RETRIES` | Plain | `3` | 최대 재시도 횟수 (1~10) |
| `AI_TIMEOUT_MS` | Plain | `30000` | 요청 타임아웃 밀리초 (1000~120000) |

4. **환경 선택**:
   - Production
   - Preview
   - Development (필요 시)

5. **Redeploy**: 환경 변수 추가 후 재배포 필요

---

### 수동 배포 (로컬 빌드)

```bash
# 1. 프로덕션 빌드
npm run build

# 2. 빌드 확인
npm run start

# 3. 테스트 후 배포
# (Vercel CLI 사용)
vercel --prod
```

---

## 배포 전 체크리스트

- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] `npm run test:run` 전체 통과
- [ ] TypeScript 타입 에러 없음
- [ ] console.log 제거
- [ ] 환경 변수 Vercel에 설정 완료 (Supabase + AI)
- [ ] Supabase 마이그레이션 적용 확인
- [ ] RLS 정책 검증 완료
- [ ] 민감 정보 하드코딩 없음

---

## 모니터링 및 알림

### Vercel Analytics

**접근**:
- Vercel Dashboard > **Analytics** 탭

**확인 지표**:
- **페이지 뷰**: 총 방문 횟수
- **성능 점수**: Core Web Vitals (LCP, FID, CLS)
- **에러율**: 빌드 실패, 런타임 에러

### Supabase Logs

**접근**:
- Supabase Dashboard > **Logs** 탭

**로그 타입**:
- **API Logs**: REST API 요청/응답
- **Auth Logs**: 인증 이벤트
- **Postgres Logs**: 데이터베이스 쿼리
- **Edge Logs**: Edge Functions (Phase 2+)

### 핵심 모니터링 항목

| 지표 | 정상 범위 | 경고 기준 | 확인 위치 |
|------|-----------|-----------|-----------|
| **빌드 시간** | < 2분 | > 5분 | Vercel Deployments |
| **페이지 로드 시간** | < 2초 | > 5초 | Vercel Analytics |
| **API 응답 시간** | < 500ms | > 2초 | Supabase Logs |
| **AI 요청 시간** | < 30초 | > 60초 | 애플리케이션 로그 |
| **에러율** | < 1% | > 5% | Vercel Analytics |
| **DB 연결 풀** | < 70% | > 90% | Supabase Dashboard |

---

## 일반적인 문제 및 해결

### 1. 배포 실패

#### 증상
```
Error: Build failed
```

#### 원인 및 해결

**A. TypeScript 타입 에러**
```bash
# 로컬에서 확인
npx tsc --noEmit

# 타입 에러 수정 후 재배포
```

**B. 환경 변수 누락**
- Vercel Dashboard에서 환경 변수 확인
- `NEXT_PUBLIC_*` 접두사 확인
- AI 관련 변수 (`GEMINI_API_KEY`) 설정 확인

**C. 의존성 문제**
```bash
# package-lock.json 재생성
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "chore: package-lock.json 재생성"
```

---

### 2. 런타임 에러

#### 증상
- 프로덕션에서 500 에러
- "Unexpected token" 에러

#### 해결

**A. 서버 로그 확인**
```bash
# Vercel CLI로 로그 확인
vercel logs

# 또는 Vercel Dashboard > Functions > Logs
```

**B. 환경 변수 검증**
- Vercel 설정에서 모든 필수 환경 변수 확인
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- AI: `GEMINI_API_KEY`

**C. Rollback**
```bash
# 이전 배포로 롤백
vercel rollback
```

---

### 3. Supabase 연결 문제

#### 증상
- "Invalid API key"
- "Failed to fetch"
- 데이터 조회 시 빈 배열

#### 해결

**A. API Key 검증**
- Vercel 환경 변수에서 Supabase 키 확인
- Supabase Dashboard에서 키 재발급 필요 시 갱신

**B. RLS 정책 확인**
- Supabase Dashboard > **Authentication** > **Policies**
- 로그인 없이 접근 가능한지 확인
- `auth.uid()` 검증 로직 확인

**C. CORS 설정**
- Supabase Dashboard > **Settings** > **API**
- **Allowed origins**에 Vercel 도메인 추가

---

### 4. AI 서비스 문제

#### 증상
- `AIConfigError: AI 설정 검증 실패`
- AI 요청 타임아웃
- Gemini API 응답 에러

#### 해결

**A. API 키 검증**
- Vercel에서 `GEMINI_API_KEY` 설정 확인
- [Google AI Studio](https://aistudio.google.com/apikey)에서 키 유효성 확인
- 키 할당량(Quota) 초과 여부 확인

**B. 타임아웃 조정**
- `AI_TIMEOUT_MS` 값을 늘려봄 (기본 30000, 최대 120000)
- 네트워크 환경에 따라 조정 필요

**C. 재시도 설정 확인**
- `AI_MAX_RETRIES` 값 확인 (기본 3, 최대 10)
- 일시적 에러는 재시도로 해결되는 경우가 많음

**D. 모델 가용성 확인**
- `GEMINI_MODEL` 값이 유효한 모델인지 확인
- 기본값: `gemini-2.0-flash`
- [Google AI 모델 목록](https://ai.google.dev/models)에서 사용 가능 모델 확인

---

### 5. 성능 저하

#### 증상
- 페이지 로드 > 5초
- API 응답 느림

#### 해결

**A. 이미지 최적화**
```tsx
// Next.js Image 컴포넌트 사용
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={100}
  height={100}
  priority // LCP 개선
/>
```

**B. DB 쿼리 최적화**
```sql
-- 인덱스 확인
SELECT * FROM pg_indexes WHERE tablename = 'your_table';

-- Slow Query 확인 (Supabase Logs)
```

**C. 코드 스플리팅**
```tsx
// 동적 import로 번들 사이즈 감소
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
})
```

---

### 6. 인증 문제

#### 증상
- 로그인 후 리다이렉트 실패
- 세션 즉시 만료

#### 해결

**A. Middleware 확인**
```typescript
// src/middleware.ts
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: Request) {
  return await updateSession(request)
}
```

**B. Cookie 설정**
- Supabase Dashboard > **Settings** > **Auth** > **URL Configuration**
- **Site URL**: Vercel 프로덕션 URL
- **Redirect URLs**: 허용할 리다이렉트 URL 추가

**C. 세션 갱신**
```typescript
// 클라이언트에서 세션 갱신
const { data, error } = await supabase.auth.refreshSession()
```

---

## 롤백 절차

### Vercel 롤백

**방법 1: Vercel Dashboard**
1. **Deployments** 탭
2. 이전 배포 선택
3. **Promote to Production** 클릭

**방법 2: Vercel CLI**
```bash
# 최근 배포 목록 확인
vercel ls

# 특정 배포로 롤백
vercel rollback [deployment-url]
```

---

### Supabase 마이그레이션 롤백

**주의**: Supabase는 자동 롤백 미지원. 수동으로 역방향 SQL 작성 필요.

**예시**:
```sql
-- 00004_add_column.sql (Forward)
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- 00004_rollback.sql (Backward)
ALTER TABLE users DROP COLUMN phone;
```

**실행**:
1. Supabase Dashboard > **SQL Editor**
2. 역방향 SQL 실행
3. 데이터 백업 권장

---

## 긴급 대응 절차

### 1. 서비스 장애 발생 시

**우선순위**:
1. **즉시 롤백**: `vercel rollback`
2. **장애 원인 파악**: Vercel Logs + Supabase Logs
3. **임시 조치**: 에러 페이지 표시
4. **근본 원인 수정**: 로컬에서 재현 > 수정 > 배포

---

### 2. 데이터 손실 위험 시

**절차**:
1. **서비스 중단**: Vercel 배포 일시 중지
2. **DB 백업**: Supabase Dashboard > **Database** > **Backups**
3. **원인 조사**: RLS 정책, 트리거, 애플리케이션 로직
4. **복구**: 백업에서 복원 또는 수동 복구
5. **재배포**: 검증 후 서비스 재개

---

### 3. 보안 이슈 발견 시

**절차**:
1. **즉시 롤백**: 취약점 포함된 배포 롤백
2. **API Key 회전**:
   - Supabase Dashboard > **Settings** > **API** > **Reset Key**
   - Google AI Studio에서 Gemini API 키 재생성
   - Vercel 환경 변수 업데이트
3. **취약점 수정**: 로컬에서 수정 후 재배포
4. **보안 감사**: 전체 코드베이스 스캔

---

### 4. AI 서비스 장애 시

**절차**:
1. **Google AI 상태 확인**: [Google AI Status](https://status.cloud.google.com/)
2. **에러 로그 확인**: Vercel Functions Logs에서 AI 관련 에러 확인
3. **할당량 확인**: Google AI Studio에서 API 사용량/할당량 확인
4. **임시 조치**: AI 기능을 일시적으로 비활성화하고 사용자에게 안내
5. **재시도 설정 조정**: `AI_MAX_RETRIES`, `AI_TIMEOUT_MS` 값 상향

---

## 백업 및 복구

### Supabase 자동 백업

- **백업 주기**: 매일 (Free Plan은 7일 보관)
- **접근**: Supabase Dashboard > **Database** > **Backups**

### 수동 백업

```bash
# PostgreSQL dump
pg_dump -h <supabase-host> -U postgres -d postgres > backup.sql

# 복원
psql -h <supabase-host> -U postgres -d postgres < backup.sql
```

---

## 유지보수 체크리스트

### 일일
- [ ] Vercel 배포 상태 확인
- [ ] Supabase API 로그 확인
- [ ] 에러 알림 확인

### 주간
- [ ] 성능 지표 검토 (Core Web Vitals)
- [ ] DB 쿼리 성능 확인
- [ ] 의존성 보안 업데이트 (`npm audit`)
- [ ] AI API 사용량 확인

### 월간
- [ ] Supabase 백업 검증
- [ ] 데이터베이스 디스크 사용량 확인
- [ ] 미사용 API Key 정리
- [ ] Gemini API 할당량 검토

---

## 연락처 및 에스컬레이션

### 긴급 연락망

| 역할 | 담당자 | 연락처 |
|------|--------|--------|
| **백엔드** | - | - |
| **프론트엔드** | - | - |
| **인프라** | - | - |

### 외부 지원

- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Supabase Support**: [supabase.com/support](https://supabase.com/support)
- **Google AI Support**: [ai.google.dev/support](https://ai.google.dev/support)

---

**마지막 업데이트**: 2026-02-08
**소스 오브 트루스**: `package.json` (스크립트), `src/lib/ai/config.ts` (AI 설정), `src/lib/supabase/` (Supabase 설정)
