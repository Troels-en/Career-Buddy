# design.md — Career-Buddy

> **Lovable convention:** this is the durable visual & UX direction. Every styling decision must check this file. If a request conflicts, flag it before building.

## Mood

Linear / Notion. Restrained. Operator-grade. No slideware aesthetics. Coach-tone for hero copy and vision strip; clinical-tone for tracker rows and badges.

## Brand

- **Name.** Career-Buddy.
- **Voice.** Friendly companion, not corporate HR software.
- **Logo.** Text logo "Career-Buddy" in `font-semibold text-lg`, accent purple `#7c3aed`.
- **Favicon.** Purple "C" on white circle.

## Color palette

| Role        | Hex       | Use |
|-------------|-----------|-----|
| Background  | `#FFFFFF` | Page background, cards |
| Text        | `#111827` | Charcoal — body text, headings |
| Accent      | `#7c3aed` | Purple — primary buttons, focus rings, top-3 glow, animation flash |
| Subtle      | `bg-gray-50` / `bg-gray-100` | Pills, footer strips, summary strips, insights cards |
| Muted text  | `text-gray-500` / `text-gray-400` / `text-gray-700` | Subheads, captions, vision body |

**No gradient backgrounds. No colored left borders on cards. No emoji decoration in UI.**

## Status badge palette (Tailwind, pill-shaped, `text-xs font-medium px-2 py-1 rounded-full`)

| Status              | Classes                          |
|---------------------|----------------------------------|
| `applied`           | `bg-gray-100 text-gray-700`      |
| `interview-1`       | `bg-blue-100 text-blue-800`      |
| `interview-2`       | `bg-blue-200 text-blue-900`      |
| `rejected`          | `bg-red-100 text-red-700`        |
| `offer`             | `bg-green-100 text-green-700`    |
| `follow-up-needed`  | `bg-yellow-100 text-yellow-800`  |
| `confirmation`      | `bg-gray-50 text-gray-600`       |

## Fit-score color (text only, `font-semibold`)

| Score range  | Class            |
|--------------|------------------|
| ≥ 8.0        | `text-green-600` |
| 5.0 – 7.9    | `text-yellow-600`|
| < 5.0        | `text-red-600`   |

## Typography

- **Family.** Inter, fallback `system-ui, sans-serif`.
- **Hero tagline.** `text-3xl font-semibold tracking-tight` (Section 1).
- **Section title.** `text-2xl font-semibold` (Section 4).
- **Card title.** `text-base font-semibold` (Section 3 Patterns).
- **Body.** `text-base text-gray-700` (vision strip body).
- **Subhead.** `text-base text-gray-500` (Section 1 subtagline).
- **Caption / status / refresh.** `text-xs`, often `text-gray-400` or accent.
- **Uppercase track header.** `text-sm uppercase tracking-wider text-gray-500` (vision strip heading).

## Spacing & layout

- **Outer grid.** `max-w-6xl mx-auto px-6`.
- **Section spacing.** `py-8` between sections.
- **Card spacing.** `gap-4` inside cards.
- **Card padding.** `p-4` (insights), `p-5` (job cards).

## Radii

- **Cards.** `12px` (`rounded-lg` for 8px or `rounded-xl` if 12px is mapped).
- **Inputs.** `8px` (`rounded-lg`).
- **Pills.** `9999px` (`rounded-full`).

## Shadows

- **Default.** `shadow-sm` on cards.
- **Hover.** `shadow-md` on cards; `hover:shadow-lg` on the primary Sync button.

## Motion

- **One animation primitive.** `bg-purple-100` flash, 400ms, `transition-colors duration-[400ms] ease-out`. Used across all Sync row updates. No typewriter, no scale tweens, no per-row custom animations.
- **Spinners.** Inside the triggering button only. Short text alongside ("Building your profile…", "Scanning 8 cached emails…").
- **Pulse.** `animate-pulse` for top-3 job glow (slow 2s) and Insights refresh shimmer (300ms).
- **Stagger.** 250ms between rows during Sync. 8 rows × 250ms = 2000ms total window. Summary strip lands at t=2200ms.

## UX principles

1. **Optimistic UI.** Update state first. Spinners only on the triggering button.
2. **Perceived latency < 2s.** Simulated 400–800ms delays only where "AI" needs to feel real (600ms onboarding, 800ms CV analysis, 700ms Add Application). Sync is the deliberate exception (2000ms loading window for the wow moment).
3. **One wow moment per demo.** Sync Inbox is the single most important interaction. Everything else is supporting cast.
4. **Deterministic content.** Every visible string is hardcoded or read literally from JSON fixtures. No inference, no generation, no surprises during a live demo.
5. **No emoji decoration.** Use proper SVG icons or plain text. Mail icon left of Sync button is allowed; nothing else.
6. **Mobile responsive.** Below `768px`, stack single-column, sticky sidebar becomes inline.
7. **Reset is a first-class action.** "Reset demo" link in header clears `localStorage`, reloads, and restarts onboarding from scratch.
8. **Profile collapse.** Profile card shows expanded by default and after first onboarding submit. After a successful Sync, it collapses to a one-line summary with an "edit profile" link to re-expand. On reload, it stays collapsed if Sync was already run.

## Layout grid

```
┌─────────────────────────────────────────────────────────┐
│ Section 0 — Sticky header (logo · mock pill · reset)   │
├─────────────────────────────────────────────────────────┤
│ Section 1 — Onboarding & Profile (full-width)          │
├─────────────────────────────────┬───────────────────────┤
│ Section 2 — Applications (2/3) │ Section 3 — Insights  │
│                                 │   (1/3, sticky)       │
├─────────────────────────────────┴───────────────────────┤
│ Section 4 — VC Jobs Feed (full-width, 3-col grid)      │
├─────────────────────────────────────────────────────────┤
│ Section 5 — Vision Strip (compact footer)              │
└─────────────────────────────────────────────────────────┘
```
