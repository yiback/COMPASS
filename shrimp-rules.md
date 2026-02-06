# COMPASS Project Development Rules

> **For AI Agents Only** - Project-specific rules for autonomous task execution

---

## 1. Project Overview

- **Project Name**: COMPASS (학원 관리 플랫폼)
- **Tech Stack**: Next.js 16.1.6 + React 19 + Supabase Cloud + TypeScript
- **Architecture**: 5-layer (Presentation → Business → AI → Data → Cross-cutting)
- **Pattern**: Server Actions + Service Layer (NestJS 전환 대비)
- **Multi-tenancy**: academy_id-based data isolation with RLS
- **Current Phase**: Phase 0-2 completed (Supabase integration), Phase 0-3 next (Route Groups)

---

## 2. Architecture Rules

### 5-Layer Structure

**MUST follow this layer hierarchy:**

1. **Presentation Layer** (`src/app/`, `src/components/`)
2. **Business Logic Layer** (Server Actions, Services)
3. **AI Service Layer** (Provider Pattern - Gemini)
4. **Data Layer** (`src/lib/supabase/`)
5. **Cross-cutting Concerns** (Logging, Auth, Validation)

**DO:**
```typescript
// Server Action → Service Layer → Supabase
'use server'
export async function createStudent(data: StudentData) {
  const service = new StudentService()
  return await service.create(data) // Service Layer handles Supabase
}
```

**DON'T:**
```typescript
// Direct Supabase call from Server Action
'use server'
export async function createStudent(data: StudentData) {
  const supabase = await createClient()
  return await supabase.from('students').insert(data) // ❌ Skip Service Layer
}
```

### Server Actions + Service Layer Pattern

**CRITICAL**: Prepare for Phase 2+ NestJS migration by keeping Service Layer reusable

**DO:**
- Create Service classes in `src/services/`
- Server Actions call Service methods
- Services contain business logic + Supabase calls

---

## 3. Directory Structure Rules

### File Organization

**MUST maintain:**
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Dashboard routes
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components
│   └── providers/         # Context providers
├── lib/
│   ├── supabase/          # **CRITICAL** Supabase clients
│   │   ├── client.ts      # Browser client
│   │   ├── server.ts      # Server client
│   │   ├── admin.ts       # Admin client (RLS bypass)
│   │   └── types.ts       # TypeScript types
│   └── utils.ts
├── hooks/                 # Custom React hooks
├── services/              # Business logic services
└── types/                 # Shared TypeScript types
```

### Component Naming

**DO:**
- PascalCase for components: `UserProfile.tsx`
- kebab-case or PascalCase for files
- camelCase for functions/variables
- UPPER_SNAKE_CASE for constants

---

## 4. Supabase Client Rules

### **CRITICAL**: Client Selection

| Client | Usage | File | RLS |
|--------|-------|------|-----|
| `createClient()` from `client.ts` | Client Components | Browser | ✅ Applied |
| `createClient()` from `server.ts` | Server Components, Actions | Server | ✅ Applied |
| `createAdminClient()` from `admin.ts` | Admin tasks **ONLY** | Server | ❌ Bypassed |

### Browser Client (`src/lib/supabase/client.ts`)

**DO:**
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export function ClientComponent() {
  const supabase = createClient()
  // Client-side queries with RLS
}
```

**DON'T:**
```typescript
'use client'
import { createAdminClient } from '@/lib/supabase/admin'

export function ClientComponent() {
  const supabase = createAdminClient() // ❌ NEVER use admin in browser!
}
```

### Server Client (`src/lib/supabase/server.ts`)

**DO:**
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function ServerComponent() {
  const supabase = await createClient() // ✅ Async required
  const { data } = await supabase.from('profiles').select()
}
```

**DON'T:**
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function ServerComponent() {
  const supabase = createClient() // ❌ Missing await
}
```

### Admin Client (`src/lib/supabase/admin.ts`)

**⚠️ WARNING**: Use ONLY when RLS bypass is absolutely necessary

**DO (Limited use cases):**
- User signup (create profile)
- System admin operations
- Academy creation

**DON'T:**
- ❌ Use in Client Components
- ❌ Expose Service Role Key to browser
- ❌ Use for regular data access (prefer RLS-based clients)

---

## 5. Next.js 16 Specific Rules

### Async `cookies()` Function

**CRITICAL**: Next.js 16 requires `await cookies()`

**DO:**
```typescript
import { cookies } from 'next/headers'

export async function myAction() {
  const cookieStore = await cookies() // ✅ Await required
  const value = cookieStore.get('name')
}
```

**DON'T:**
```typescript
import { cookies } from 'next/headers'

export async function myAction() {
  const cookieStore = cookies() // ❌ Missing await
}
```

### Server Component Cookie Limitations

**Server Components**: READ-ONLY cookies
**Server Actions/Route Handlers**: Can write cookies

**DO:**
```typescript
// Server Action
'use server'
export async function login() {
  const cookieStore = await cookies()
  cookieStore.set('token', 'value') // ✅ OK in Server Action
}
```

**DON'T:**
```typescript
// Server Component
export default async function Page() {
  const cookieStore = await cookies()
  cookieStore.set('token', 'value') // ❌ Cannot write in Server Component
}
```

### Middleware File Convention

**⚠️ WARNING**: `middleware.ts` → `proxy.ts` (Next.js 16 deprecation)

**Current**: `src/middleware.ts` still works but deprecated
**Future**: Migrate to `src/proxy.ts` when stable

---

## 6. Code Style Rules

### Immutability

**CRITICAL**: NEVER mutate objects

**DO:**
```typescript
function updateUser(user: User, name: string): User {
  return { ...user, name } // ✅ New object
}
```

**DON'T:**
```typescript
function updateUser(user: User, name: string): User {
  user.name = name // ❌ MUTATION!
  return user
}
```

### Error Handling

**ALWAYS handle errors comprehensively**

**DO:**
```typescript
try {
  const result = await riskyOperation()
  return { data: result, error: null }
} catch (error) {
  console.error('Operation failed:', error)
  return { data: null, error: error.message }
}
```

### Input Validation

**MUST validate all user input with Zod**

**DO:**
```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

const validated = schema.parse(input) // ✅ Validated
```

---

## 7. Security Rules

### Service Role Key Management

**⚠️ CRITICAL SECURITY RULE**:

- ✅ **DO**: Use environment variable `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix)
- ✅ **DO**: Use ONLY in server-side code (Server Actions, Route Handlers)
- ❌ **DON'T**: NEVER expose to browser
- ❌ **DON'T**: NEVER use `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`

### RLS (Row Level Security) Priority

**ALWAYS prefer RLS-based access control**

**DO:**
```typescript
// Use server client with RLS
const supabase = await createClient() // ✅ RLS applied
const { data } = await supabase.from('students')
  .select()
  .eq('academy_id', academyId) // Explicit filter + RLS
```

**DON'T:**
```typescript
// Bypass RLS unnecessarily
const supabase = createAdminClient() // ❌ RLS bypassed
const { data } = await supabase.from('students').select()
```

### Multi-tenancy Data Isolation

**CRITICAL**: Enforce `academy_id` filtering

**DO:**
```typescript
'use server'
export async function getStudents() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('academy_id')
    .eq('id', user.id)
    .single()

  // Explicit academy_id filter + RLS
  const { data } = await supabase
    .from('students')
    .select()
    .eq('academy_id', profile.academy_id) // ✅ Double protection

  return data
}
```

---

## 8. File Interaction Rules

### When modifying Supabase clients, check:

**IF you modify `src/lib/supabase/client.ts`:**
- ✅ Check `src/lib/supabase/types.ts` for type compatibility
- ✅ Update Server Components using this client

**IF you modify `src/lib/supabase/server.ts`:**
- ✅ Check `src/middleware.ts` (uses same pattern)
- ✅ Update Server Actions using this client

**IF you modify `src/lib/supabase/admin.ts`:**
- ⚠️ **WARNING**: Review all usage for security
- ✅ Ensure Service Role Key is NOT exposed

### When adding new routes:

**IF you create `app/(dashboard)/foo/page.tsx`:**
- ✅ Add navigation link in `app/(dashboard)/layout.tsx` (when implemented)
- ✅ Check RBAC middleware for route permissions

---

## 9. Prohibited Actions

### Absolute Prohibitions

**❌ NEVER**:
1. Mutate objects directly (use immutability)
2. Expose `SUPABASE_SERVICE_ROLE_KEY` to browser
3. Use admin client in Client Components
4. Skip input validation with Zod
5. Hardcode secrets (use environment variables)
6. Create files >800 lines (split into smaller modules)
7. Use `console.log` in production code
8. Commit `.env.local` to git

### Discouraged Practices

**⚠️ Avoid**:
1. Using admin client when RLS-based client works
2. Skipping error handling
3. Creating overly complex abstractions for MVP
4. Adding features not explicitly requested
5. Writing tests after code (TDD required - write tests first)

---

## 10. AI Decision-Making Guide

### When to use which Supabase client?

```
START
  ↓
Is this Client Component?
  YES → Use client.ts (browser)
  NO → Continue
  ↓
Do you need to bypass RLS?
  YES → Is it absolutely necessary?
    YES → Use admin.ts (server only)
    NO → Use server.ts
  NO → Use server.ts (server)
```

### When to create a new Service?

```
START
  ↓
Does business logic exist?
  YES → Is it in Server Action?
    YES → Extract to Service Layer
    NO → Continue
  NO → Create new Service
  ↓
Create service in src/services/[domain].service.ts
```

### File modification priority:

1. **Highest**: Security-related files (`admin.ts`, RLS policies)
2. **High**: Core infrastructure (`server.ts`, `middleware.ts`)
3. **Medium**: Business logic (Services, Server Actions)
4. **Low**: UI components, styling

---

## 11. Testing Requirements

### TDD Workflow (MANDATORY)

1. ✅ Write test FIRST (RED)
2. ✅ Run test - should FAIL
3. ✅ Write minimal implementation (GREEN)
4. ✅ Run test - should PASS
5. ✅ Refactor (IMPROVE)
6. ✅ Verify 80%+ coverage

### Test Types (ALL required)

- **Unit Tests**: Functions, utilities, components
- **Integration Tests**: API endpoints, DB operations
- **E2E Tests**: Critical user flows (Playwright)

---

## 12. Documentation Rules

### Language

- **Code comments**: 한국어
- **Commit messages**: 한국어
- **Documentation**: 한국어
- **Variable/function names**: English

### Commit Message Format

```
<type>: <description>

<optional body>
```

**Types**: feat, fix, refactor, docs, test, chore, perf, ci

---

## End of Rules

**Last Updated**: Phase 0-2 completed (2026-02-06)
**Next Update**: After Phase 0-3 (Route Groups implementation)
