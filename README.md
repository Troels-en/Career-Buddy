# Career-Buddy

> Land your first startup role. Track applications, learn what works, find roles that fit.

**ICP:** Business-background grads (Bucerius, CDTM, CLSBE, INSEAD, HEC, LBS, WHU) with 0–2y exp who want to break into early-stage startups via **Founders Associate / BizOps / Strategy / BD** roles. Not engineering. Not senior.

**The Pain:**
- 30+ FA-roles posted across VC career-pages, startup careers, LinkedIn-stealth, Antler/EF cohorts
- No central tracker — every application leaves traces in Gmail, LinkedIn-DMs, WhatsApp, Notion
- You forget who you applied to, when to follow up, what got responses
- No self-knowledge layer: which role-types respond, which don't, why
- Tools like Clera (Junior-Job-Board) have WhatsApp-chat that forgets you sent a CV — dumb

**Career-Buddy v0.1 (this hackathon ship):**
- Onboarding-Chat — LLM learns your target role, background, geo
- CV-Upload — Claude extracts skills/strengths/gaps
- Add-Application — paste URL → AI parses JD, scores fit vs. your profile
- Mock-Inbox-Sync — pre-loaded sample mails, AI auto-classifies + updates rows
- Insights-Panel — pattern-recognition ("B2B responds 3× than B2C", "Avi-Pipeline avg 18d, you're at day 5")
- VC-Jobs-Feed — 15 curated DACH FA-openings, AI-ranked vs. your profile

**Long-term Vision (Layer 1–3):** see [`docs/PRD.md`](docs/PRD.md). End-state = persistent **Career Buddy** with context-flywheel-moat: app remembers everything about your career, advises on switching, salary negotiation, headhunter-connect, growth-recommendations (courses/videos/events).

**Status:** Built at Lovable Future Founders Series Berlin, 2026-05-07. 2-hour ship.

## Quickstart (Lovable)

This repo holds product spec + sample data. The actual app is built via [Lovable.dev](https://lovable.dev) using `docs/LOVABLE_PROMPT.md`.

```bash
# Sample data live in /data
ls data/
# mock_emails.json — 8 sample inbox-mails for AI-classification demo
# vc_jobs.json     — 15 curated DACH FA-openings
# sample_cv.txt    — example CV for demo
```

## Roadmap

- [x] Layer 0 — Hackathon MVP (this build)
- [ ] Layer 1 — Real Gmail-OAuth + LinkedIn-sync + VC-scraper
- [ ] Layer 2 — CV-Coach + Cover-Letter-Generator + Interview-Prep + Growth-Recommender (courses/videos/events)
- [ ] Layer 3 — Career Buddy (full vision: switch-timing, salary-negotiation, headhunter-broker, life-stage-aware)

## Project documentation

| File | Purpose |
|---|---|
| [`docs/brief.md`](docs/brief.md) | Product brief: problem, primary user, core job, success criteria |
| [`docs/build.md`](docs/build.md) | Build scope, phased priority, screens, features, acceptance criteria |
| [`docs/design.md`](docs/design.md) | Visual direction, design tokens, motion |
| [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) | Stable project knowledge for Lovable's project memory |
| [`docs/LOVABLE_PROMPT.md`](docs/LOVABLE_PROMPT.md) | Canonical initial-generation prompt for Lovable |
| [`docs/refinement-prompts.md`](docs/refinement-prompts.md) | Iterative prompts to fix specific Lovable misfires |
| [`docs/project-knowledge.md`](docs/project-knowledge.md) | The Project Knowledge prompt to paste into Lovable settings |
| [`docs/scraper-plan.md`](docs/scraper-plan.md) | Layer-1 VC + portfolio scraper architecture |
| [`docs/PRD.md`](docs/PRD.md) | Long-form PRD covering Layers 0–3 |
| [`docs/DEMO.md`](docs/DEMO.md) | Demo script / talk track |
| [`docs/decisions/`](docs/decisions/) | Architecture Decision Records (ADRs) — see [the index](docs/decisions/README.md) |

## License

MIT — see [LICENSE](LICENSE).
