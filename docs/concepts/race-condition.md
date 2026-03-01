# Race Condition (경쟁 상태)

## 한 줄 요약

두 개 이상의 비동기 작업이 **순서 보장 없이** 실행되어, 나중에 시작한 작업의 결과가 먼저 시작한 작업의 결과에 **덮어씌워지는** 버그.

---

## 비유

식당에서 주문을 바꾸는 상황:

1. "김치찌개 주세요" → 주방에서 조리 시작 (5분 소요)
2. 마음이 바뀌어 "된장찌개로 변경해주세요" → 조리 시작 (2분 소요)
3. 된장찌개가 먼저 도착 → 먹기 시작 ✅
4. 5분 후 김치찌개도 도착 → **된장찌개를 치우고 김치찌개를 놓음** ❌

원하는 건 된장찌개인데, 늦게 도착한 김치찌개가 덮어씌움.

---

## React에서의 구체적 시나리오

### 문제 상황: useEffect에서 비동기 데이터 로딩

```typescript
// ❌ 버그 있는 코드
useEffect(() => {
  async function load() {
    const result = await getQuestionDetail(id)
    setDetail(result) // 항상 실행됨 — 이미 다른 id를 보고 있어도!
  }
  load()
}, [id])
```

**버그 발생 순서:**

| 시간 | 사용자 행동 | 네트워크 | 화면 |
|------|-----------|---------|------|
| 0초 | 문제 A 클릭 | `getDetail("A")` 요청 (느림, 3초) | 로딩 중... |
| 1초 | 문제 B 클릭 | `getDetail("B")` 요청 (빠름, 1초) | 로딩 중... |
| 2초 | - | B 응답 도착 → `setDetail(B)` | **B 표시** ✅ |
| 3초 | - | A 응답 도착 → `setDetail(A)` | **A로 덮어씌워짐** ❌ |

사용자는 B를 선택했는데, 화면에 A가 표시됨.

---

## 해결: `cancelled` 플래그 패턴

```typescript
// ✅ 수정된 코드
useEffect(() => {
  let cancelled = false  // 플래그 생성

  async function load() {
    const result = await getQuestionDetail(id)
    if (!cancelled) {     // 아직 유효한 요청인지 확인
      setDetail(result)
    }
  }
  load()

  return () => {
    cancelled = true      // id가 바뀌면 이전 요청 무효화
  }
}, [id])
```

**수정 후 동작:**

| 시간 | 이벤트 | cancelled | 결과 |
|------|--------|-----------|------|
| 0초 | A 요청 시작 | `false` (A) | - |
| 1초 | B 클릭 → A의 cleanup 실행 | `true` (A), `false` (B) | A 무효화 |
| 2초 | B 응답 도착 | B의 `cancelled = false` | `setDetail(B)` ✅ |
| 3초 | A 응답 도착 | A의 `cancelled = true` | **무시됨** ✅ |

---

## 핵심 원리

- `useEffect`의 **cleanup 함수**는 의존성(`[id]`)이 바뀔 때 **이전 effect를 정리**하기 위해 실행됨
- `cancelled`는 클로저로 각 effect 호출마다 **별도 변수**가 생성됨
- A 요청의 `cancelled`와 B 요청의 `cancelled`는 **서로 다른 변수**

---

## 프로젝트 적용 사례

- `question-detail-sheet.tsx` — 문제 상세 조회 시 빠른 클릭으로 id가 바뀌어도 안전
- `generate-questions-dialog.tsx` — 이전 1-7에서도 동일 패턴 적용

---

## 참고

- 이 패턴은 React 18+의 `AbortController`로도 구현 가능하지만, `cancelled` 플래그가 더 간단함
- React 공식 문서: "Fetching data" 섹션에서 동일 패턴 권장
