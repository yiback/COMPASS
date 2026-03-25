# 성취기준 자동 수집 + 다중 소스 관리 — 기술 리서치

> 작성일: 2026-03-24
> 역할: tech-researcher
> 상태: 완료

---

## 1. 자동 수집 방식 비교

| 방식 | 호환성 | 장기 실행 | 비용 | 추천도 |
|------|--------|---------|------|--------|
| **Supabase Edge Function + pg_cron** | ✅ 스택 내부 | ⚠️ 2초 제한 | 낮음 | ⭐ 추천 |
| **Vercel Cron Jobs** | ✅ Next.js 통합 | ✅ Route Handler 가능 | 중간 | ⭐ 추천 (대안) |
| **GitHub Actions 스케줄** | ⚠️ 외부 CI | ✅ 6시간 | 무료 | 🟡 프로토타입용 |
| **별도 Node.js 서버** | ❌ 스택 분리 | ✅ 무제한 | 높음 | ❌ 비추천 |

### 추천: Supabase Edge Functions + pg_cron (1순위), Vercel Cron (2순위)

---

## 2. 웹 크롤링 기술 비교

| 기술 | 속도 | 한글 지원 | Vercel/Supabase | 추천 대상 |
|------|------|---------|-----------------|----------|
| **Cheerio + Axios** | 매우 빠름 | ✅ | ✅ | 정적 HTML (교육청) |
| **Playwright** | 보통 | ✅ | ⚠️ 용량 큼 | JS 렌더링 필요 시 |
| **Puppeteer** | 느림 | ✅ | ⚠️ 무거움 | 로그인 필요 시 |
| **pdf-parse** | 빠름 | ✅ | ✅ | 교육부 고시 PDF |

### 추천: Cheerio (정적 사이트) + pdf-parse (PDF 문서)

---

## 3. 한국 교육청 데이터 소스

| 소스 | 형식 | API | 비고 |
|------|------|-----|------|
| **NCIC (ncic.re.kr)** | 웹 (동적) | ❌ 미확인 | 크롤링 필요 |
| **교육부 고시 (moe.go.kr)** | PDF | ❌ | pdf-parse 필요 |
| **data.go.kr** | 파일/API | 일부 | 성취기준 데이터셋 미확인 |
| **시도교육청 (17곳)** | 각각 다름 | ❌ | 표준화 부재 |

### 현실: 공식 API 부재 → 크롤링 의존 → 유지보수 비용 높음

---

## 4. 다중 소스 관리 패턴

### 추천: Strategy + Adapter 패턴

```typescript
interface AchievementStandardsSource {
  readonly sourceId: string    // 'ncic', 'moe'
  readonly name: string
  fetchStandards(subject: string, grade: number): Promise<RawStandard[]>
  normalizeStandard(raw: RawStandard): NormalizedStandard
}
```

- 소스별 Adapter 구현체 분리
- `Promise.allSettled`로 부분 실패 허용
- `source_metadata` JSONB로 소스 이력 보존

---

## 5. 스키마 확장 제안

```sql
ALTER TABLE achievement_standards
ADD COLUMN collected_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN collection_method TEXT CHECK (collection_method IN ('manual', 'auto_ncic', 'auto_moe', 'csv_upload', 'migration')),
ADD COLUMN source_url TEXT;
```

선택사항 (이후):
- `confidence_score NUMERIC` — 자동 수집 신뢰도
- `is_verified BOOLEAN` — 교사/관리자 확인 여부
- `source_metadata JSONB` — 소스별 메타데이터

---

## 6. 최종 추천

| 항목 | 선택 | 근거 |
|------|------|------|
| 자동 수집 | Supabase Edge Function + pg_cron | 스택 내부, 비용 효율 |
| 크롤링 | Cheerio + pdf-parse | 빠름, 가벼움, 한글 지원 |
| 다중 소스 | Adapter 패턴 | 확장성, 부분 실패 처리 |
| 에러 처리 | Promise.allSettled | 1개 소스 실패 시 서비스 지속 |
