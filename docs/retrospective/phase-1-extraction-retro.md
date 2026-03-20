# Phase 1 기출문제 추출 — 회고

> 일자: 2026-03-20
> 범위: 세션 19~25 (PLAN v1→v9 + Wave 1~5 구현 + 코드 리뷰)
> 결과: 34개 파일, 548→1238 테스트, 빌드 성공

---

## 1. 무엇을 했는가

### 계획 단계 (세션 19~24)
- PLAN v1→v9까지 9번 반복 정제
- Agent Team 리뷰 6회 (tech + scope + consistency)
- 리서치 2건 (이미지 관리 기술 + 실현가능성)
- Step별 상세 계획 8개 작성

### 구현 단계 (세션 25)
- Wave 1~5 병렬 구현 (5-Wave 패턴)
- 코드 리뷰 2회 (3팀 병렬) → MUST FIX 4건 수정
- 최종: 1238 테스트 PASS + 빌드 성공

---

## 2. 잘된 점 (Keep)

### 계획 프로세스
| 패턴 | 효과 |
|------|------|
| **PLAN 반복 정제 (v1→v9)** | 구현 시 거의 막힘 없이 진행. "한 번에 완벽한 계획"보다 "빠르게 초안 → 리뷰 → 수정" 반복이 효과적 |
| **Agent Team 리뷰 3팀** | tech/scope/consistency 3관점이 서로 다른 이슈를 발견. 단독 리뷰보다 커버리지 높음 |
| **사용자 NOTE 패턴** | `<!-- NOTE: -->` 태그로 리뷰 문서에 직접 결정 기록 → planner가 바로 반영. 의사결정 지연 최소화 |
| **Sequential Thinking MCP + planner** | 복잡한 변경사항을 구조화하여 분석 → planner가 정형화. 누락 방지 |

### 구현 프로세스
| 패턴 | 효과 |
|------|------|
| **5-Wave 병렬 구현** | 독립 Step을 병렬로 실행하여 구현 속도 극대화. 파일 충돌 0건 |
| **Step별 상세 계획** | 각 에이전트가 상세 계획을 읽고 독립적으로 구현. 리드 개입 최소화 |
| **코드 리뷰 3팀 병렬** | 보안/성능/테스트 전문 관점에서 MUST FIX 4건 발견. 구현 직후 바로 수정 |
| **IDOR 방어 academy_id 필터** | 리뷰에서 발견 → 9곳 일괄 수정. 리뷰 없었으면 배포 후 발견될 뻔 |

### 기술 패턴
| 패턴 | 교훈 |
|------|------|
| **imageBufferMap 캐싱** | 같은 리소스를 여러 단계에서 사용할 때 첫 fetch에서 Buffer 보관 → 중복 네트워크 호출 제거 |
| **Optimistic Lock** | `.update().in().select('id')` + 빈 배열 체크로 동시 실행 방지. DB 잠금 없이 가벼움 |
| **isCompleted + try/finally** | catch만으로는 `return { error }` 조기 반환을 잡지 못함. finally 필수 |
| **타입 경계 설계** | Action에서 URL→base64 변환 완료 → Provider는 imageParts만 수신. 테스트 용이성 + SRP |

---

## 3. 문제가 된 점 (Problem)

### 계획 과도 반복
| 문제 | 영향 | 원인 |
|------|------|------|
| PLAN v1→v9 (9회 반복) | 계획에 세션 6회 소비. 구현은 세션 1회 | 리뷰 루프 종료 조건이 불명확. "MUST FIX 0이면 READY"가 아닌 "SHOULD FIX도 반영해야 함"으로 해석 |
| 상세 계획 8개 작성 후 다시 리뷰 | 추가 세션 소비 | 마스터 PLAN 리뷰 완료 후에도 상세 계획 리뷰를 별도로 요청 |

**교훈**: PLAN 리뷰는 **최대 3회**로 제한. MUST FIX 0이면 즉시 구현 시작. SHOULD FIX는 구현 중 처리.

### 빌드 에러 3건
| 에러 | 원인 | 교훈 |
|------|------|------|
| `'use server'`에서 `export const runtime` | Next.js route segment config는 page.tsx에서만 유효 | 에이전트가 Server Action 파일에 잘못 배치 |
| Zod v4 `errorMap` → `error` | Zod 메이저 버전 변경 | 기존 코드에서 `errorMap` 사용 여부를 먼저 확인해야 함 |
| `supabase gen types` stderr 오염 | npm warn이 stdout으로 리다이렉트 | 타입 파일 생성 후 첫 줄 확인 필수 |

**교훈**: 에이전트 구현 후 **즉시 빌드 확인**. Wave 단위가 아닌 Step 단위로 빌드 체크.

### IDOR 누락
| 문제 | 원인 |
|------|------|
| extract-questions.ts 9곳에 academy_id 필터 누락 | 상세 계획의 의사코드에서 academy_id 필터를 일부만 명시 |

**교훈**: 상세 계획의 의사코드에 **모든 쿼리에 academy_id 필터 포함** 여부를 체크리스트에 추가.

---

## 4. 시도할 점 (Try)

### 계획 프로세스 개선
1. **PLAN 리뷰 최대 3회 제한**: v1→리뷰→v2→리뷰→v3(최종). MUST FIX 0이면 구현 시작
2. **상세 계획은 리뷰 없이 구현**: 마스터 PLAN 리뷰 완료 = 상세 계획도 승인. 별도 리뷰 불필요
3. **SHOULD FIX는 구현 중 처리**: 코드 리뷰에서 잡으면 됨

### 구현 프로세스 개선
4. **Step 단위 빌드 체크**: Wave 완료 후가 아닌 각 에이전트 완료 직후 `npm run build` 실행
5. **academy_id 체크리스트**: Server Action 작성 시 모든 UPDATE/DELETE 쿼리에 academy_id 필터 포함 확인
6. **Zod 버전 확인**: 에이전트 프롬프트에 "기존 코드의 Zod 패턴을 먼저 확인하고 일관성 유지" 명시

### 코드 품질
7. **exam-management.ts IDOR 보완**: 잔여 SHOULD FIX — 3개 Action에도 academy_id 필터 추가
8. **프롬프트 인젝션 방어**: feedback 입력 sanitize (Phase 2)
9. **try/finally 테스트 개선**: mock 설계 결함 수정 (Phase 2)

---

## 5. 수치 요약

| 지표 | 값 |
|------|------|
| 계획 세션 수 | 6 (세션 19~24) |
| 구현 세션 수 | 1 (세션 25) |
| PLAN 버전 수 | 9 (v1→v9) |
| Agent Team 리뷰 횟수 | 8 (PLAN 6 + 코드 2) |
| 신규/수정 파일 수 | 34 |
| 테스트 증가 | 548 → 1238 (+690) |
| MUST FIX 발견/수정 | 총 ~15건 발견 → 전부 수정 |
| 빌드 에러 수정 | 3건 |
| 코드 리뷰 MUST FIX | 4건 발견 → 전부 수정 |

---

## 6. 다음 Phase 적용 사항

- [ ] PLAN 리뷰 최대 3회로 제한
- [ ] 상세 계획 별도 리뷰 생략
- [ ] Step 단위 빌드 체크
- [ ] academy_id 필터 체크리스트 도입
- [ ] Zod 버전 호환성 확인 프롬프트 추가
- [ ] exam-management.ts 잔여 SHOULD FIX 처리
