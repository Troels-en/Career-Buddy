# Copy-paste this into the new Claude Code chat

```
Career-Buddy continuation. We dropped Lovable, deploying to Cloudflare Pages.

Read first end-to-end:
1. /Users/troelsenigk/fa-track/docs/HANDOFF_NEW_CHAT_2026-05-09.md
2. /Users/troelsenigk/.claude/projects/-Users-troelsenigk-fa-track/memory/MEMORY.md
3. /Users/troelsenigk/fa-track/docs/decisions/0001..0004*.md

State: monorepo, frontend at root (TanStack Start + Vite + shadcn),
Python backend in /backend/. 3,849 jobs live in Supabase
gxnpfbzfqgbhnyqunuwf. 56 tests pass. Lovable abandoned.

Top priority queue (in order):

1. Run `bun install && bun run build` from repo root. Verify the build
   succeeds. Tell me the build-output directory (likely .output/public).
   Run `bun run dev` and screenshot the current frontend so we both see
   the starting state.

2. Set src/integrations/supabase/config.toml + supabase/config.toml
   project_id back to gxnpfbzfqgbhnyqunuwf (was flipped to
   xrfzgluntpbkseabirpt during the Path A detour).

3. Update src/components/CareerBuddy.tsx to fetch from the live `jobs`
   table instead of public/data/*.json fixtures.

4. Walk me (Troels) through the Cloudflare Pages connect:
   - sign-up at https://dash.cloudflare.com/sign-up (free)
   - Workers & Pages → Create → Connect to Git → enigkt1-prog/Career-Buddy
   - build cmd, output dir, env vars (VITE_SUPABASE_URL,
     VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID)
   - first deploy → career-buddy.pages.dev

5. Once deployed, set up GitHub Actions cron for the Python scraper.

Hard rules from the handoff doc:
- No Anthropic API auto-pay
- No Gemini paid auto-fallback
- Gemini fallback opt-in only (GEMINI_FALLBACK_ENABLED=1)
- No git push without my explicit authorization
- Caveman mode active by default — drop articles/filler/hedging.
  Code/commits/security: write normal.

User email: enigkt1@gmail.com (Lovable / GitHub) but Supabase main
account is troelsenigk@mail.de.

Repo: github.com/enigkt1-prog/Career-Buddy. Branch: main, ~4 commits
ahead origin from last session. NOT pushed yet.
```
