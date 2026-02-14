# 단계 1-4 Step 5: 빌드 검증 + 학습 리뷰 상세 계획

> **상태**: ✅ 완료
> **작성일**: 2026-02-14
> **모델**: Opus 4.6
> **전제 조건**: Step 1~4 모두 완료 ✅
> **계획 방법**: Sequential Thinking MCP 3단계 분석

---

## 1. 목표

단계 1-4 학원 관리 CRUD의 모든 구현(Step 1~4)이 완료된 상태에서:
1. 전체 빌드 검증으로 품질 확인
2. 학습 리뷰로 핵심 개념 체화
3. 문서 업데이트로 진행 상황 기록

---

## 2. Phase A: 빌드 검증

### 실행 명령어

| # | 명령어 | 기대 결과 |
|---|--------|----------|
| 1 | `npm run test:run` | 235개+ 테스트 전체 통과 |
| 2 | `npm run build` | 프로덕션 빌드 성공 (exit code 0) |
| 3 | `npm run lint` | 린트 에러 0 (경고는 허용) |

### 발견된 이슈 및 수정 사항

1. **auth.test.ts 리다이렉트 경로 불일치**
   - `loginAction` 구현: `redirect('/')` (미들웨어가 역할별 라우팅 처리)
   - 테스트 기대값: `'NEXT_REDIRECT:/dashboard'`
   - **수정**: 테스트를 `'NEXT_REDIRECT:/'`로 변경

2. **lint `no-explicit-any` 에러 9개**
   - `academies.test.ts` (6개): mock 객체의 `as any` 캐스팅 → 파일 상단 `eslint-disable` 추가
   - `past-exams.ts` (1개): Supabase insert 객체 → `eslint-disable-next-line` 추가
   - `schools.ts` (2개): Supabase insert/update 객체 → `eslint-disable-next-line` 추가
   - **근본 원인**: Supabase 생성 타입 미사용 (MVP 범위 외)

3. **불필요 파일 정리**
   - `src/lib/actions/past-exams.ts.bak` 삭제

### 학습 포인트 (Phase A)
- **테스트와 구현의 동기화**: 구현이 변경되면 테스트도 반드시 업데이트
- **eslint-disable 사용 기준**: 테스트 mock은 파일 레벨, 소스 코드는 라인 레벨로 최소 범위 적용

---

## 3. Phase B: 학습 리뷰 (사용자와 대화) ✅

### 리뷰 토픽 6가지

| # | 토픽 | 관련 파일 | 난이도 |
|---|------|----------|--------|
| 1 | Defense in Depth (3중 방어) | academies.ts, RLS 정책 | 🔴 CRITICAL |
| 2 | Self-referencing ID 패턴 | academies.ts:checkAdminRole | 🔴 CRITICAL |
| 3 | Server Actions + FormData | academies.ts:updateMyAcademy | 🟡 RECOMMENDED |
| 4 | useTransition + React Hook Form | academy-form.tsx | 🟡 RECOMMENDED |
| 5 | Zod 스키마 설계 (strip, or) | academies.ts (validations) | 🟡 RECOMMENDED |
| 6 | Server Component 역할 분기 | page.tsx | 🟢 ROUTINE |

### 이해도 체크 질문 (예시)

1. "왜 academy_id를 URL 파라미터가 아닌 profile에서 가져올까?" (IDOR 방지)
2. "Zod strip 모드가 보안에 어떤 역할을 하는지 설명해보세요" (과도 필드 제거)
3. "useTransition과 useActionState의 차이는?" (낙관적 UI vs 상태 기반)
4. "Server Component에서 역할을 확인하면 어떤 보안 이점이 있을까?" (클라이언트 노출 최소화)

### 직접 구현 추천

| 난이도 | 범위 | 방식 |
|--------|------|------|
| 🔴 CRITICAL | `checkAdminRole` + `updateMyAcademy` 권한 로직 | 삭제 후 재구현 (reference 참고 OK) |
| 🟡 RECOMMENDED | `onSubmit` 핸들러, Zod 스키마 | 빈칸 채우기 방식 |
| 🟢 ROUTINE | 사이드바 메뉴, UI 카드 마크업 | AI 자동 구현 OK |

---

## 4. Phase C: 문서 업데이트

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `docs/plan/phase-1-step4-academy-crud.md` | Step 5 ✅ 완료로 변경 |
| 2 | `docs/plan/phase-1-step4-5-build-verification.md` | 본 문서 (이미 생성) |
| 3 | `ROADMAP.md` | 1-4 학원 관리 CRUD ✅ 완료 |
| 4 | `HANDOFF.md` | 다음 작업(1-5 사용자 관리 CRUD) 정보 |
| 5 | `src/lib/actions/past-exams.ts.bak` | 삭제 |

---

## 5. 검증 기준

- Phase A: 3개 명령어 모두 exit code 0
- Phase B: 사용자 응답 기반 이해도 확인
- Phase C: git diff로 문서 변경 확인
