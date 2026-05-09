# Gemini Scraper — cost-zero job extraction

Three-tier fallback. Hard rule: never auto-spend on paid API.

```
Tier 1 → Google AI Studio Free API (15 RPM, 1500 RPD)
Tier 2 → ``gemini`` CLI (your Gemini Pro/Ultra subscription)
Tier 3 → STOP — raise QuotaExhausted
```

## Setup (3 Schritte)

1. **API Key holen** (kostenlos, kein Credit Card):
   https://aistudio.google.com/app/apikey
   → "Create API Key" → kopieren.

2. **In `.env` eintragen** (root von fa-track):
   ```bash
   echo 'GEMINI_API_KEY=<your-key>' >> .env
   ```

3. **Optional: Gemini CLI als Fallback**
   ```bash
   which gemini  # sollte /opt/homebrew/bin/gemini zeigen
   gemini /login  # OAuth via Gemini Pro/Ultra Account
   ```

Dependencies sind schon installiert (uv group `gemini`).

## Smoke-Test

```bash
cd scripts/scraper

# Test gegen lokales HTML (ohne HTTP-Fetch)
echo '<html><body><h1>Senior Backend Engineer at Acme</h1></body></html>' > /tmp/jobs.html
uv run python -m career_buddy_scraper.gemini_scraper \
  --url https://acme.example/jobs \
  --html-file /tmp/jobs.html \
  --pretty
```

Erwartete Ausgabe (mit gültigem API-Key):
```json
[
  {
    "company_name": "Acme",
    "role_title": "Senior Backend Engineer",
    "url": "https://acme.example/jobs",
    "is_remote": false
  }
]
```

## Live-Test gegen echte ATS-Site

```bash
uv run python -m career_buddy_scraper.gemini_scraper \
  --url https://jobs.lever.co/<company> \
  --pretty
```

## CLI-First Mode

Wenn du Free-Tier sparen willst und Gemini-Subscription nutzen:
```bash
uv run python -m career_buddy_scraper.gemini_scraper \
  --url <url> --prefer-cli --pretty
```

## Modell wählen

Default: `gemini-2.5-flash` (1500 RPD free).
Für bessere Reasoning auf schweren Pages: `gemini-2.5-pro` (100 RPD free).

```bash
uv run python -m career_buddy_scraper.gemini_scraper \
  --url <url> --model gemini-2.5-pro --pretty
```

## Free-Tier-Daily-Budget

```
gemini-2.5-flash: 1500 RPD
Pro 1 Job-Board-Scrape: ~1-3 Calls (HTML-Extract)
→ ~500-1500 Boards/Tag möglich

Real-World Career-Buddy:
5 Boards × 4 Runs/Tag = 20 Scrapes/Tag
Headroom: 75x
```

## Fehler-Modes

- **`QuotaExhausted: All Gemini tiers exhausted`** — alle Tiers tot. STOP. Nicht auto-fallback zu paid API. Warte bis Daily-Reset (UTC midnight) oder switch CLI/API order.
- **`google-genai not installed`** — `uv sync --group gemini`.
- **`GEMINI_API_KEY not set`** — `.env` editieren.
- **Gemini returned non-JSON** — Page-HTML zu fragmentiert. Manuelles Inspect der Page.

## Integration in Career-Buddy Pipeline

`extract_jobs(html, url)` returned dicts mit Schlüsseln nahe `CanonicalJob`. Mapping-Step im Caller:

```python
from career_buddy_scraper.gemini_scraper import GeminiScraper
from career_buddy_scraper.models import CanonicalJob, AtsSource

scraper = GeminiScraper()
raw = scraper.extract_jobs(html, source_url)

jobs: list[CanonicalJob] = []
for r in raw:
    jobs.append(CanonicalJob(
        company_name=r["company_name"],
        company_domain=extract_domain(r.get("url", source_url)),
        role_title=r["role_title"],
        url=r["url"],
        location=r.get("location"),
        is_remote=r.get("is_remote", False),
        description=r.get("description"),
        ats_source=AtsSource.CUSTOM,
        raw_payload=r,
    ))

# upsert via existing jobs_repo.py
```

## Privacy

- HTML + Prompts gehen zu Google.
- Keine Daten persistiert von Google laut Free-Tier-ToS (status: 2026-05-09 — verify).
- Wenn User-PII im Scrape-Target: separate Compliance-Decision treffen.
