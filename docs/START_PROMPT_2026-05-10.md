# START PROMPT — Career-Buddy new chat 2026-05-10

Career-Buddy continuation. Read first end-to-end:

1. `docs/HANDOFF_NEW_CHAT_2026-05-10.md` (full hand-off — start here)
2. `/Users/troelsenigk/.claude/projects/-Users-troelsenigk-fa-track/memory/MEMORY.md`
3. `docs/decisions/0001..0004*.md`
4. `feedback_scraper_systematic_fixes.md` (new pattern library)

## Background processes at session start

None. Previous Tier-2 run completed cleanly (481 updated, 7518 other,
quota-hit at batch 8500 / 16). Final coverage: **883 / 9,980 (8%)**
specifically classified. ~1,579 still `tier2_pending` — wait until the
next quota window (~07:00 CEST tomorrow) to finish.

## Then proceed with HANDOFF priority list (sections "What's NOT done")

1. Re-run `cli.report` — see post-Tier-2 distribution.
2. Rewrite the report's "Findings" block (currently stale from 17-job era).
3. Defer Zoho Recruit adapter (only 1 VC needs it now).
4. Frontend `CareerBuddy.tsx` WIP — leave alone unless instructed.
5. GitHub Actions: add daily classify_tier2 job after the scrape cron.

## Caveman mode default

Drop articles/filler/hedging. Code/commits/security: write normal.
Auto mode: execute autonomously.

## Hard rules

- No Anthropic API auto-pay
- No Gemini paid auto-fallback
- Gemini fallback opt-in only (`GEMINI_FALLBACK_ENABLED=1`)
- No git push without explicit authorization

## Repo + Supabase

- Repo: github.com/enigkt1-prog/Career-Buddy
- Supabase: gxnpfbzfqgbhnyqunuwf
- Branch: main, sync'd with remote at commit `d565f9b` (plus whatever
  parallel session pushes between hand-off and start).

## Status snapshot at hand-off

| Was | State |
|-----|-------|
| Active jobs | 9,980 (was 3,849 yesterday) |
| Tests | 94/94 passing (+2 regression added) |
| Edge funcs | analyze-cv ✓ match-job ✓ draft-message ✓ |
| Tier-2 done | 481 updated, 7518 other, 1579 still pending (next reset 07:00 CEST) |
| Role coverage | 883 / 9,980 (8%) specifically classified |
| Last commit | d565f9b (skip_probe systematic blacklist) |
| Push status | up to date with origin/main |
| Uncommitted | src/components/CareerBuddy.tsx (~24 lines, parallel session) |
