# scraper-plan.md — Career-Buddy Layer 1+ Job Database

> **Goal.** Build a daily-refreshed database of operator / FA / BizOps / Strategy / BD / Chief-of-Staff jobs at VCs and their portfolio companies across Europe and the US, then expand to bootstrapped and pre-VC startups. This replaces the hardcoded `vc_jobs.json` fixture used in Layer 0.

---

## Scope (Layer 1, then Layer 1.5)

### Layer 1 — VC + portfolio jobs (4–6 weeks)

- **Geographies.** DACH, UK, France, Nordics, Iberia, Italy, Benelux, Eastern Europe, US (NY / SF / Boston / LA / Austin).
- **Source 1.** VC firms' own career pages (FA / Investment-Analyst / Operating-Associate roles).
- **Source 2.** VC portfolio companies' career pages (BizOps, Strategy, BD, Chief-of-Staff, Founders-Associate, Operations).
- **Target volume.** 2,000–5,000 active roles after dedup, refreshed daily.

### Layer 1.5 — bootstrapped / pre-VC startups (after Layer 1 stable)

- YC Work-at-a-Startup batches (W24, S24, W25, S25 cohorts).
- AngelList Talent / Wellfound startups with <$2M raised.
- EU-Startups job board.
- Hacker News "Who's hiring" monthly threads (parsed for non-engineering operator roles).
- Buttondown / Indie Hackers / Pioneer / EF talent network.

---

## VC list assembly (avoid hand-curating)

Do NOT build the VC list manually. Pull from aggregators, dedupe, classify.

### Primary aggregators

| Source                          | Coverage                | Access                               |
|---------------------------------|-------------------------|--------------------------------------|
| **OpenVC** (openvc.app)         | 5,000+ global VCs       | Free CSV export                      |
| **Signal NFX** (signal.nfx.com) | US-heavy partner-level  | Free, scrape profile pages           |
| **Dealroom**                    | EU-heavy firm + portfolio| Paid API; trial works for prototype  |
| **Crunchbase**                  | Global firms + funding  | Paid API; free tier for prototype    |
| **EU-Startups directory**       | EU-only firms           | Free, scrapeable                     |
| **Tracxn**                      | Global, deep portfolios | Paid; nice-to-have                   |

### Process

1. Pull VC list from OpenVC (free, broadest) + EU-Startups (EU coverage gap-fill) + Signal NFX (US partner directory).
2. Dedupe by domain.
3. Manual classification pass (one-time): Tier-1 / Tier-2 / Tier-3 by AUM and stage focus. Drop lifestyle funds, family offices, single-deal SPVs.
4. For each VC: capture `name`, `domain`, `careers_url` (or "no public careers"), `stage_focus` (pre-seed / seed / Series A / growth), `sector_tags` (B2B SaaS, fintech, deeptech, climate, etc.), `geography`, `portfolio_companies_url`.
5. Output: `/data/vc_master_list.json` (3,000–6,000 rows after dedup).

---

## Portfolio company list assembly

Each VC publishes its portfolio. Three sources of truth, in priority order:

1. **VC website portfolio page** (most accurate, but unstructured).
2. **Crunchbase / Dealroom investor profile** (structured, sometimes stale).
3. **Pitchbook** (most complete, paid).

### Process

1. For each VC in the master list, scrape its portfolio page → company name + domain.
2. Cross-reference with Crunchbase / Dealroom investor profile (free tier or one-time export).
3. Dedupe portfolio entries across investors (a company in 5 VCs' portfolios = 1 row, with `investors[]` array).
4. Output: `/data/portfolio_master_list.json` (~50,000–100,000 companies after dedup).
5. Filter to active (last funding round <3 years, employee count >5) → working set ~10,000–20,000.

---

## Scraper architecture

### Insight: 70%+ of startups use 4 ATS providers

Most VC and startup career pages embed one of these ATS providers. Each has a public, undocumented JSON API that returns all open roles. Build one adapter per ATS — cover most of the universe with 4 adapters.

| ATS         | Detect via                                      | Endpoint                                         | Auth   |
|-------------|-------------------------------------------------|--------------------------------------------------|--------|
| Greenhouse  | `boards.greenhouse.io/<slug>` or embedded iframe | `https://boards-api.greenhouse.io/v1/boards/<slug>/jobs` | None   |
| Lever       | `jobs.lever.co/<slug>` or iframe                 | `https://api.lever.co/v0/postings/<slug>?mode=json` | None   |
| Ashby       | `jobs.ashbyhq.com/<slug>`                        | `https://api.ashbyhq.com/posting-api/job-board/<slug>` | None   |
| Workable    | `apply.workable.com/<slug>`                      | `https://apply.workable.com/api/v3/accounts/<slug>/jobs` | None   |

**Coverage estimate.** Greenhouse + Lever + Ashby + Workable ≈ 70% of VC + portfolio career pages in Europe and US. Remaining 30% = Workday (enterprise, hard), BambooHR, Personio, Recruitee, Teamtailor, custom Webflow / Framer pages, Notion-hosted careers.

### Adapter responsibilities

```
detect(domain) → ats_type | "custom" | "no_jobs_page"
fetch(slug) → list[RawJob]
normalize(RawJob) → CanonicalJob
```

### CanonicalJob schema

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_domain text not null,
  role_title text not null,
  role_category text,         -- founders-associate | bizops | strategy | bd | chief-of-staff | investment-analyst | other
  location text,              -- raw
  location_normalized text,   -- "Berlin, DE" / "Remote-EU" / "NYC" / "Remote-US"
  is_remote boolean,
  employment_type text,       -- full-time | contract | intern
  url text not null,
  description text,
  requirements text,
  posted_date date,           -- from ATS if available, else first_seen_at
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  is_active boolean default true,
  ats_source text,            -- greenhouse | lever | ashby | workable | custom | manual
  raw_payload jsonb,          -- full original ATS response for debugging
  unique (company_domain, role_title, url)
);

create index idx_jobs_active on jobs(is_active, posted_date desc);
create index idx_jobs_category on jobs(role_category, location_normalized);
```

### Role categorization

Most ATS feeds dump every role (engineering, marketing, ops, etc.). We only want operator/FA-track roles. Filter on title regex first, then LLM classification for ambiguous cases.

**Tier-1 regex (high precision):**

```
(?i)\b(founders? associate|founder('?s)? associate|founders associate|chief of staff|cos|operating associate|biz ?ops|business operations|strategy associate|strategy & operations|special projects|investment analyst|investment associate|venture associate|portfolio operator)\b
```

**Tier-2 LLM classification (for ambiguous titles like "Operations Manager", "Strategic Initiatives Lead", "Growth Associate").** Run a cheap LLM (gpt-4.1-mini or claude-haiku-4.5) over `title + first 500 chars of description` once per new role. Cache the classification.

### Daily refresh job

```
00:00 UTC — pipeline starts
  ├─ for each company in portfolio_master_list
  │     adapter = detect(company.domain)
  │     raw_jobs = adapter.fetch(company.slug)
  │     for each raw_job:
  │         canonical = adapter.normalize(raw_job)
  │         upsert into jobs (key: company_domain + role_title + url)
  │         update last_seen_at = now()
  │
  ├─ mark stale: jobs.last_seen_at < now() - 48h → is_active = false
  ├─ classify new roles (Tier-2 LLM only on rows where role_category IS NULL)
  ├─ compute "new_today" view: first_seen_at >= today
  └─ rebuild fit-score per user (deferred to user request, not batch)
```

### Concurrency + politeness

- Max 5 concurrent requests per ATS provider (Greenhouse rate-limits aggressively).
- 200ms delay between requests to the same domain.
- Respect `robots.txt` for non-API custom scrapes.
- User-Agent: `Career-Buddy-Bot/1.0 (+https://career-buddy.app/bot)`.
- Cache ATS responses for 4h locally to avoid re-hitting on retries.

---

## Tech stack

| Layer            | Choice                                  | Why                                      |
|------------------|-----------------------------------------|------------------------------------------|
| Language         | TypeScript (Bun) or Python 3.11 (uv)    | TS aligns with Lovable frontend; Python is simpler for scraping |
| Scheduler        | GitHub Actions cron (daily 00:00 UTC)   | Free, version-controlled                 |
| HTTP client      | undici (TS) / httpx (Python)            | Fast, async                              |
| HTML parsing     | linkedom (TS) / selectolax (Python)     | Fast, no JS execution needed for ATS APIs |
| JS-rendered fallback | Playwright (only for custom Webflow/Framer pages) | Last resort, slow                       |
| Storage          | Supabase Postgres                       | Already in repo schema                   |
| Job queue        | None for v1 — just sequential cron      | YAGNI. Add BullMQ if >30min run time     |
| Observability    | GitHub Actions logs + Slack webhook on failure | Free                              |

---

## Build phases

### Phase A — VC master list (week 1)

- [ ] Pull OpenVC CSV export.
- [ ] Pull EU-Startups directory.
- [ ] Pull Signal NFX partner pages.
- [ ] Dedupe by domain → `vc_master_list.json`.
- [ ] One-time manual tier classification (T1/T2/T3, drop family offices).
- [ ] Capture `careers_url` per VC.
- **Acceptance.** ≥ 1,500 deduplicated VCs with `careers_url` filled where available.

### Phase B — VC career-page scraper (week 2)

- [ ] Build Greenhouse adapter (covers Index, Sequoia EU, Atomico, Cherry, Earlybird, Speedinvest, etc.).
- [ ] Build Lever adapter.
- [ ] Build Ashby adapter.
- [ ] Build Workable adapter.
- [ ] Detector: given a careers_url, return ATS type or "custom".
- [ ] Daily cron writes to `jobs` table.
- **Acceptance.** ≥ 200 active VC roles in DB after first full run.

### Phase C — Portfolio scraper (weeks 3–4)

- [ ] For each VC, scrape its portfolio page → portfolio_master_list.
- [ ] Dedupe portfolio companies across VCs.
- [ ] Detect ATS per portfolio company.
- [ ] Add to daily cron.
- **Acceptance.** ≥ 5,000 portfolio companies tracked, ≥ 1,500 active operator roles after Tier-1 filter.

### Phase D — Categorization + dedup (week 5)

- [ ] Tier-1 regex filter.
- [ ] Tier-2 LLM classifier on ambiguous titles.
- [ ] Cross-company dedup (same role posted to multiple boards).
- **Acceptance.** Role-category populated for ≥ 95% of rows.

### Phase E — Frontend integration (week 6)

- [ ] Replace `vc_jobs.json` fixture with Supabase query.
- [ ] Add filters: stage, geography, sector, role-category.
- [ ] Per-user fit-score: re-run on profile change, not nightly.
- [ ] "New today" badge on jobs first seen in last 24h.
- **Acceptance.** Career-Buddy live demo runs against the real DB instead of the mock JSON.

### Phase F — Layer 1.5 expansion (post-MVP)

- [ ] YC Work-at-a-Startup scraper (`workatastartup.com`).
- [ ] Wellfound / AngelList Talent ingest (paid API or scrape).
- [ ] EU-Startups job board scraper.
- [ ] HN "Who's hiring" monthly thread parser.
- **Acceptance.** ≥ 500 additional bootstrapped / pre-VC roles per week.

---

## Risks + mitigations

| Risk                                            | Mitigation                                                   |
|-------------------------------------------------|--------------------------------------------------------------|
| ATS providers add auth or rate-limit aggressively | Cache 4h. Backoff exponentially. Stay under public RPS budgets. |
| Custom career pages change HTML weekly          | Don't try to scrape them. Skip company. Add to `manual_review` queue. |
| LinkedIn / Wellfound legal grey area            | Use their official APIs where possible. Scraping LinkedIn is a ToS violation — don't. |
| Posted-date often missing from ATS              | Fall back to `first_seen_at`. Note "added X days ago" in UI rather than "posted X days ago". |
| Role categorization drift (LLM hallucination)   | Tier-1 regex is deterministic. LLM only fills category on titles not matched by regex. Manual override allowed. |
| GDPR / CCPA on candidate data                   | We store job postings, not candidates. Low risk. Document anyway. |
| Job duplication (cross-posted to 3 ATS)         | Dedup key: `company_domain + role_title + normalized location`. Track sources in `aliases[]`. |
| Compute / storage cost                          | Postgres + GitHub Actions cron. Estimate: <$10/mo at 20k rows + daily refresh. |

---

## Layer 1.5+ ideas (parking lot)

- Slack workspace integrations: VCs that announce hires in Slack/Discord communities.
- Twitter/X firehose for "we're hiring" posts (filter by VC partner / portfolio founder accounts).
- LinkedIn Recruiter ad scraping (legal risk, defer).
- University career-portal scrapers (Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS career services).
- Operator-role newsletter ingest (Lenny's Newsletter, First Round Review hiring tabs).
- Reverse-engineering of accelerator demo-day slides (EF, Antler, YC) — list of companies before they're publicly funded.

---

## Open decisions

1. **Language: TS vs Python?** Lean Python — better scraping ecosystem, simpler async, mature on selectolax/httpx. Ship with `uv`.
2. **Hosted vs self-hosted DB?** Supabase Postgres — already in repo schema. No reason to switch.
3. **Where does the cron live?** GitHub Actions for v1 (free, version-controlled). Migrate to Modal / Railway / Fly.io if run time exceeds Actions limits.
4. **Do we need a vector index for JD-to-CV matching?** Not for v1. Pure structured filtering (geo, stage, role-category) plus the existing fit-score formula. Add embeddings in Layer 2 (CV-Coach).
5. **Bootstrapped/pre-VC sources first or after VC backlog stable?** After. Layer 1 must ship clean before chasing the long tail.
