# Defense in Depth (심층 방어)

> **분류**: 보안 아키텍처 원칙 (Security Architecture Principle)
> **기원**: 군사 전략 → 정보보안 → 웹 애플리케이션 보안
> **적용 기술스택**: 특정 기술에 종속되지 않는 **범용 보안 원칙**. 웹, 모바일, 클라우드, 네트워크 등 모든 소프트웨어 아키텍처에 적용

---

## 1. 개념

Defense in Depth는 **단일 방어선에 의존하지 않고, 여러 계층의 독립적인 보안 장벽을 중첩 배치**하는 전략이다.

핵심 가정: **어떤 방어선이든 뚫릴 수 있다.**

따라서 한 계층이 실패해도 다음 계층이 공격을 차단한다. 중세 성의 방어 구조와 같다:

```
공격자
  │
  ├── 해자 (moat)         ← 1차: 접근 자체를 어렵게
  ├── 외벽 (outer wall)   ← 2차: 물리적 장벽
  ├── 내벽 (inner wall)   ← 3차: 2차 물리적 장벽
  ├── 경비병 (guards)     ← 4차: 능동적 탐지/대응
  └── 금고 (vault)        ← 5차: 최종 보호 대상 격리
```

소프트웨어에서도 동일한 원칙이 적용된다:

```
악의적 요청
  │
  ├── 입력 검증 (Validation)      ← "이 값이 형식상 올바른가?"
  ├── 비즈니스 로직 (Authorization) ← "이 사용자가 이 작업을 할 권한이 있는가?"
  ├── 데이터베이스 정책 (RLS)       ← "이 행(row)에 접근할 자격이 있는가?"
  └── 감사 로그 (Audit Log)        ← "무슨 일이 일어났는지 추적 가능한가?"
```

---

## 2. 왜 단일 방어선으로는 부족한가

### 시나리오: 역할 변경 API

`changeUserRole(userId, newRole)` — 사용자의 역할을 변경하는 기능

**방어선이 Server Action 하나뿐이라면:**

```typescript
// Server Action만으로 방어
async function changeUserRole(userId: string, newRole: string) {
  // 여기서 모든 검증을 해야 함
  if (newRole === 'system_admin') throw new Error('불가')
  // ... 나머지 로직
}
```

문제점:

| 상황 | 결과 |
|------|------|
| 개발자가 `system_admin` 체크를 빠뜨림 | **권한 상승 공격 성공** |
| 새 개발자가 다른 엔드포인트를 추가하면서 같은 검증을 누락 | **우회 경로 발생** |
| 리팩토링 중 검증 로직이 실수로 삭제됨 | **방어선 소멸** |
| Server Action 자체에 버그가 있음 | **유일한 방어선 무력화** |

**핵심: 사람은 실수한다. 코드도 버그가 있다. 단일 지점에 의존하면 그 지점이 실패할 때 방어가 0이 된다.**

---

## 3. COMPASS 프로젝트 적용 (3중 방어)

### 방어 계층 구조

```
클라이언트 요청: { userId: "...", newRole: "system_admin", academy_id: "hacked" }
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  1차 방어: Zod 스키마 검증                              │
│                                                     │
│  - newRole이 enum에 없는 "system_admin" → 즉시 거부    │
│  - 스키마에 없는 "academy_id" 필드 → 자동 제거 (strip)   │
│  - 결과: { userId: "...", newRole: ❌ REJECTED }      │
│                                                     │
│  역할: "형식상 허용되는 값인가?"                         │
│  기술: Zod (TypeScript 검증 라이브러리)                  │
└─────────────────────────────────────────────────────┘
       │ (1차 통과 시)
       ▼
┌─────────────────────────────────────────────────────┐
│  2차 방어: Server Action 비즈니스 로직                   │
│                                                     │
│  - 호출자가 admin/system_admin인지 확인                 │
│  - 자기 자신 역할 변경 시도 → 차단                      │
│  - admin이 admin 역할 부여 시도 → 차단                  │
│  - admin이 다른 admin 변경 시도 → 차단                  │
│  - 대상이 system_admin이면 → 차단                      │
│                                                     │
│  역할: "이 사용자가 이 작업을 할 권한이 있는가?"            │
│  기술: Next.js Server Actions + Supabase Auth          │
└─────────────────────────────────────────────────────┘
       │ (2차 통과 시)
       ▼
┌─────────────────────────────────────────────────────┐
│  3차 방어: Supabase RLS (Row Level Security)           │
│                                                     │
│  - profiles_update_admin 정책:                        │
│    "같은 academy_id + 호출자가 admin/system_admin"      │
│  - 다른 학원의 사용자 데이터 → 접근 자체 불가             │
│                                                     │
│  역할: "이 데이터 행(row)에 접근할 자격이 있는가?"         │
│  기술: PostgreSQL RLS (Supabase)                       │
└─────────────────────────────────────────────────────┘
```

### 각 방어선의 책임 분리

| 계층 | 질문 | 차단 대상 | 기술 |
|------|------|----------|------|
| **1차: Zod** | "형식이 올바른가?" | 잘못된 타입, 허용 안 된 값, 악의적 필드 | Zod 스키마 |
| **2차: Server Action** | "권한이 있는가?" | 권한 없는 사용자, 비즈니스 규칙 위반 | Next.js + Supabase Auth |
| **3차: RLS** | "이 행에 접근 가능한가?" | 다른 학원 데이터, 미인증 접근 | PostgreSQL RLS |

### 왜 이렇게 나누는가?

**1차(Zod)가 없다면:**
- `system_admin`이라는 값이 Server Action까지 도달함
- 개발자가 `if (newRole === 'system_admin')` 체크를 빠뜨리면 → 통과
- TypeScript 타입이 `string`이므로 컴파일러도 잡지 못함

**2차(Server Action)가 없다면:**
- Zod는 "형식"만 검증하므로 `admin`이 `admin` 역할을 부여하는 것은 통과
- RLS는 "같은 학원인지"만 확인하므로 역할 변경 규칙은 검증 불가
- 비즈니스 규칙을 지킬 곳이 없음

**3차(RLS)가 없다면:**
- Server Action에 버그가 있으면 → 다른 학원 데이터까지 수정 가능
- SQL 인젝션이 성공하면 → 데이터베이스 레벨 방어가 0

---

## 4. 범용 적용 사례

Defense in Depth는 COMPASS 프로젝트만의 패턴이 아니다. 모든 웹 애플리케이션에 적용되는 범용 원칙이다.

### 4-1. 웹 애플리케이션 일반

```
[WAF] → [HTTPS/TLS] → [인증] → [인가] → [입력 검증] → [ORM/파라미터화 쿼리] → [DB 권한]
```

| 계층 | 기술 예시 | 방어 대상 |
|------|----------|----------|
| 네트워크 | WAF (Cloudflare, AWS WAF) | DDoS, 알려진 공격 패턴 |
| 전송 | HTTPS/TLS | 도청, 중간자 공격 |
| 인증 | JWT, Session, OAuth | 미인증 접근 |
| 인가 | RBAC, ABAC | 권한 없는 작업 |
| 입력 검증 | Zod, Joi, class-validator | 잘못된 입력, 인젝션 |
| 데이터 접근 | ORM, 파라미터화 쿼리 | SQL 인젝션 |
| 데이터베이스 | RLS, DB 권한, 뷰 | 무단 데이터 접근 |

### 4-2. 기술스택별 적용

#### Next.js + Supabase (현재 프로젝트)

```
Middleware → Zod → Server Action → Supabase RLS
```

#### Express + PostgreSQL

```
helmet → express-validator → 비즈니스 로직 → Prisma/TypeORM → DB 권한
```

#### Spring Boot + JPA

```
Spring Security Filter → @Valid (Bean Validation) → @PreAuthorize → JPA → DB 권한
```

#### Django + PostgreSQL

```
Django Middleware → Django Forms/Serializer → @permission_required → ORM → DB 권한
```

#### NestJS + TypeORM

```
Guard → ValidationPipe (class-validator) → Service Layer → TypeORM → DB 권한
```

---

## 5. 핵심 원칙 정리

### 원칙 1: 가능한 한 가장 이른 시점에서 차단

```
❌ 나쁜 예: DB 쿼리 후에 "이 값이 허용되는지" 확인
✅ 좋은 예: 스키마 검증 단계에서 "절대 허용 안 되는 값" 즉시 거부
```

### 원칙 2: 각 계층은 독립적으로 방어

한 계층이 다른 계층의 존재를 가정하지 않는다.

```
❌ 나쁜 예: "Zod에서 이미 검증했으니 Server Action에서는 안 해도 돼"
✅ 좋은 예: Server Action은 Zod 존재 여부와 무관하게 자체 검증 수행
```

### 원칙 3: 계층마다 다른 종류의 위협을 담당

```
❌ 나쁜 예: 모든 계층에서 동일한 검증을 중복 수행
✅ 좋은 예: Zod는 "형식", Server Action은 "권한", RLS는 "데이터 접근 범위"
```

### 원칙 4: 실패를 가정하고 설계

```
"이 계층이 뚫리면 다음 계층이 잡는가?"
→ Yes: 심층 방어 달성
→ No: 단일 실패 지점(Single Point of Failure) 존재
```

---

## 6. 안티패턴 (하지 말아야 할 것)

### 안티패턴 1: 클라이언트만 검증

```typescript
// ❌ 클라이언트에서만 검증 — 개발자 도구로 우회 가능
if (newRole === 'system_admin') {
  alert('불가능합니다')
  return
}
// 서버에는 검증 없이 전송
```

### 안티패턴 2: 방어선 1개에 모든 책임

```typescript
// ❌ Server Action 하나에 모든 검증을 몰아넣기
async function changeRole(data: any) {
  // 형식 검증 + 권한 검증 + 데이터 접근 범위 검증 = 200줄짜리 함수
  // 한 줄 빠뜨리면 전체 방어 실패
}
```

### 안티패턴 3: "나중에 추가하지 뭐"

```
초기: 검증 없이 빠르게 구현
나중에: "보안 강화 스프린트"에서 추가 예정
현실: 그 스프린트는 오지 않는다
```

---

## 7. 참고 자료

- [OWASP Defense in Depth](https://owasp.org/www-community/Defense_in_depth) — 웹 보안 표준 기관의 정의
- [NIST SP 800-53](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final) — 미국 국립표준기술연구소 보안 프레임워크
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — 데이터베이스 계층 방어
- [Zod Documentation](https://zod.dev/) — 입력 검증 계층
