# Career-Buddy — frontend (`web/`)

TanStack Start (React + Vite) frontend. Originally built in the
[`founder-trackr` repo](https://github.com/enigkt1-prog/founder-trackr) via
Lovable, merged into the Career-Buddy monorepo on 2026-05-09 to consolidate
backend + frontend in one place.

## Setup

```bash
cd web
bun install               # or npm install
cp .env.example .env      # fill in Supabase keys
bun run dev               # vite dev server
```

## Stack

- **Framework.** TanStack Start (Vite + React + file-based routing).
- **Hosting.** Cloudflare Workers (`wrangler.jsonc`).
- **Backend API.** Supabase Postgres (same project the scraper writes to;
  see repo-root `.env` for credentials and `data/migrations/` for schema).
- **Edge Functions.** `supabase/functions/analyze-cv` — CV-parsing endpoint.

## Layout

```
web/
├── package.json
├── vite.config.ts
├── wrangler.jsonc
├── public/                       static assets
├── src/
│   ├── routes/                   TanStack file-based routes
│   │   ├── __root.tsx
│   │   └── index.tsx
│   ├── components/
│   │   ├── CareerBuddy.tsx       main app component
│   │   └── ui/                   shadcn-ui primitives
│   ├── hooks/                    React hooks
│   ├── integrations/supabase/    Supabase client (server + browser)
│   └── lib/
│       ├── cv-parser.ts          PDF → text utility
│       ├── error-page.ts
│       └── error-capture.ts
├── supabase/
│   ├── config.toml
│   └── functions/analyze-cv/     Edge Function for CV analysis
└── .env.example
```

## How frontend talks to scraper

Both write to the same Supabase project:

- Scraper (`scripts/scraper/`) writes to `vcs` and `jobs`.
- Frontend reads from `vcs` and `jobs` (and writes to `users`,
  `applications`, `events` for user actions).
- See [`data/migrations/`](../data/migrations) for the full schema.

## Deployment

```bash
bun run build
wrangler deploy            # pushes to Cloudflare Workers
```

Lovable can iterate on this codebase by being pointed at this repo's
`web/` subdirectory (see repo-root README for the connect-prompt).
