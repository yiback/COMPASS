# COMPASS 프로젝트 핸드오프 문서

> **작성일**: 2026-02-05
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **타겟**: 소형~중형 보습학원, 중등 수학부터 시작
- **현재 Phase**: 0-1 (MVP), 코드 구현 미시작 상태

기술스택: Next.js 15 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### 완료된 작업

- **기획 문서 9개, 총 6,165줄** 작성 완료
- 기술스택 확정 및 Phase 0-1 / Phase 2+ 분리 구조화
- 문서 간 정합성 검증 및 수정 완료
- 개발 가이드 5종 작성 완료 (컴포넌트 패턴, 폼, 스타일링, Next.js 15, 프로젝트 구조)

### 미완료 작업

- **코드 초기화 미진행**: `src/`, `package.json`, `next.config.ts` 등 없음
- **docs/roadmaps/** 폴더가 비어있음 (로드맵 문서 미작성)

### 문서 목록 및 규모

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `CLAUDE.md` | 110 | 프로젝트 개발 지침 (메인) |
| `docs/PRD.md` | 291 | MVP PRD (요약) |
| `docs/prd/PRD-v0.1-detailed.md` | 827 | PRD 상세 버전 |
| `docs/design/기술스택.md` | 630 | 기술스택 정의 (Phase별) |
| `docs/design/개발요구사항.md` | 684 | 개발 요구사항 |
| `docs/guides/project-structure.md` | 329 | 프로젝트 구조 가이드 |
| `docs/guides/component-patterns.md` | 765 | 컴포넌트 패턴 가이드 |
| `docs/guides/forms-react-hook-form.md` | 1,545 | 폼 가이드 (React Hook Form) |
| `docs/guides/styling-guide.md` | 471 | 스타일링 가이드 (Tailwind v4) |
| `docs/guides/nextjs-15.md` | 513 | Next.js 15 가이드 |

---

## 3. What Worked (성공한 접근)

- **기술스택.md를 Phase별로 분리**: Phase 0-1 (MVP)과 Phase 2+ (스케일업)로 나누어 CLAUDE.md와의 정합성을 확보했다. CLAUDE.md에는 Phase 0-1 기술만 기재하고, 전체 로드맵은 기술스택.md로 링크한다.
- **구문 오류 수정**: `component-patterns.md`와 `forms-react-hook-form.md`에서 마크다운 구문 오류 3건을 발견하고 수정했다.
- **경로 불일치 해결**: `project-structure.md`의 경로가 실제 구조와 불일치하던 문제를 해결했다.
- **edu-system-architect + edu-critical-analyst 토론 방식**: 기술스택 결정 시 두 에이전트 간 토론으로 균형 잡힌 의사결정을 도출했다.

---

## 4. What Didn't Work (실패/주의사항)

- **PRD-v0.1-detailed.md의 상대경로 오류**: `기술스택.md`를 `./기술스택.md`로 참조하고 있으나, 실제 경로는 `../design/기술스택.md`이다. (3곳: 5행, 619행, 797행) 아직 미수정 상태이다.
- **docs/roadmaps/ 폴더 비어있음**: 폴더는 존재하지만 로드맵 문서가 작성되지 않았다.
- **Phase 0 AI 검증 미진행**: Phase 0의 핵심인 "AI 문제 추출 품질 검증"이 아직 시작되지 않았다.

---

## 5. Next Steps (다음 단계)

### 즉시 해야 할 일 (Phase 0: 프로젝트 초기화)

1. **Next.js 15 프로젝트 생성**: `create-next-app`으로 초기화
2. **핵심 의존성 설치**: Supabase, React Hook Form, Zod, shadcn/ui 등
3. **프로젝트 구조 셋업**: `project-structure.md` 기준으로 디렉토리 생성
4. **Supabase 프로젝트 연결**: 환경변수 설정, Auth/DB/Storage 초기화
5. **PRD-v0.1-detailed.md 경로 수정**: `./기술스택.md` → `../design/기술스택.md`

### 그 다음 (Phase 0: AI 검증)

6. **AI 문제 추출 검증**: Google Gemini로 중3 수학 예상 문제 생성 품질 확인
7. **교육부 학습목표(성취기준) 데이터 구조화**

### 핵심 참조 문서

시작 전 반드시 읽어야 할 문서 (우선순위 순):

1. `CLAUDE.md` - 프로젝트 개발 지침 및 기술스택 요약
2. `docs/PRD.md` - 사용자 여정과 기능 명세 요약
3. `docs/design/기술스택.md` - 상세 기술스택 및 구현 순서
4. `docs/guides/project-structure.md` - 디렉토리 구조 가이드
5. `docs/design/개발요구사항.md` - 전체 요구사항 정의

---

## 6. Architecture Decisions (주요 아키텍처 결정)

| 결정 | 이유 |
|------|------|
| Next.js 15 풀스택 (Phase 0-1) | MVP 속도, Server Actions로 API 레이어 최소화 |
| Supabase (인증/DB/Storage) | 올인원 BaaS로 초기 개발 비용 최소화 |
| Google Gemini (AI) | 무료 티어 활용, Phase 2+에서 OpenAI/Claude로 전환 계획 |
| Vercel 배포 | Next.js 최적화, 무료 티어로 MVP 운영 가능 |
| Phase 2+에서 NestJS 분리 | MVP 검증 후 백엔드 분리로 확장성 확보 |

---

## 7. 프로젝트 디렉토리 구조 (현재)

```
compass/
├── CLAUDE.md              # 개발 지침 (메인 진입점)
├── HANDOFF.md             # 이 문서
├── docs/
│   ├── PRD.md             # MVP PRD 요약
│   ├── prd/
│   │   └── PRD-v0.1-detailed.md  # PRD 상세
│   ├── design/
│   │   ├── 기술스택.md      # 기술스택 정의
│   │   └── 개발요구사항.md   # 개발 요구사항
│   ├── guides/
│   │   ├── project-structure.md     # 프로젝트 구조
│   │   ├── component-patterns.md    # 컴포넌트 패턴
│   │   ├── forms-react-hook-form.md # 폼 가이드
│   │   ├── styling-guide.md         # 스타일링 가이드
│   │   └── nextjs-15.md             # Next.js 15 가이드
│   └── roadmaps/          # (비어있음)
└── src/                   # (미생성 - 다음 단계에서 초기화)
```
