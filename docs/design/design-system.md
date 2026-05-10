# Career-Buddy "Cinema" Design System

> **Status:** v0.2 — drafted 2026-05-10. Inspired by 11x.ai's
> editorial composition (cinematic photography, glass-morphism overlays,
> sticky-scroll hero, mega-footer card cluster) but Career-Buddy makes
> it its own: a **soft, cool sage-green palette**, friendly "Buddy"
> voice, and operator-track focus instead of corporate AI marketing.
> Distance from the source is intentional — the grammar is shared, the
> vocabulary is ours.
>
> Lives **in parallel** with the existing shadcn-blue app theme;
> no semantic tokens (`background` / `foreground` / `card` / …) are
> overridden, so the working app pages keep their look.

## 1. North-star feeling

> "Quiet confidence over a warm, cinematic landscape. The interface is
> a layer of glass over a story."

Every marketing-surface decision answers to that sentence.

| Principle             | What it means in practice                           |
| --------------------- | --------------------------------------------------- |
| **Cinema first**      | Full-bleed photography or video drives every hero.  |
| **Glass over photo**  | Content sits in translucent panels; depth = blur, never drop-shadow. |
| **Editorial type**    | Massive, near-black display headlines; one underline accent. |
| **Restrained palette**| Soft cool sage greens only; one moss accent for CTAs. |
| **Air**               | Generous whitespace; sections breathe at 96–160 px vertical padding. |
| **No emojis in chrome**| SVG icons (lucide) only.                           |

## 2. Color tokens (oklch, parallel to existing palette)

Cinema palette adds new tokens **without touching** the existing
`--background` / `--foreground` / etc. shadcn defaults. Marketing
components opt in by name.

> **Naming note:** Tailwind v4's `@theme` block prefixes color tokens
> with `--color-` automatically, so the runtime variables are
> `--color-cinema-moss`, `--color-cinema-cream`, etc., and Tailwind
> exposes utilities as `bg-cinema-moss`, `text-cinema-cream`.
> The Claude-Design `tokens.json` file lists the prefix-stripped form
> (`moss`, `cream`) for portability.

| Token name (CSS var)         | Tailwind utility       | oklch                       | Hex (~) | Use                                              |
| ---------------------------- | ---------------------- | --------------------------- | ------- | ------------------------------------------------ |
| `--color-cinema-moss`        | `bg-cinema-moss`       | `oklch(0.22 0.025 160)`     | #1c2620 | Promo bar, primary CTA fill, dark glass base     |
| `--color-cinema-pine`        | `bg-cinema-pine`       | `oklch(0.42 0.06 155)`      | #4a6b58 | Deep accent (hover states, dark sections)        |
| `--color-cinema-sage`        | `bg-cinema-sage`       | `oklch(0.74 0.05 152)`      | #aac4af | Mid-tone glass fill, badge bg                    |
| `--color-cinema-mint`        | `bg-cinema-mint`       | `oklch(0.87 0.04 155)`      | #cee0d2 | Light glass fill, hover surface                  |
| `--color-cinema-mist`        | `bg-cinema-mist`       | `oklch(0.95 0.02 155)`      | #ebf2ec | Page bg between cinematic sections               |
| `--color-cinema-cream`       | `bg-cinema-cream`      | `oklch(0.975 0.012 150)`    | #f3f7f1 | Card fill on light bg, footer (cool off-white)   |
| `--color-cinema-meadow`      | `bg-cinema-meadow`     | `oklch(0.78 0.12 148)`      | #93cf83 | Tertiary accent — fresh green, used sparingly    |
| `--color-cinema-ink`         | `text-cinema-ink`      | `oklch(0.18 0.018 165)`     | #161e1a | Headline text on light bg                        |
| `--color-cinema-ink-soft`    | `text-cinema-ink-soft` | `oklch(0.36 0.015 165)`     | #4a544f | Body text on light bg                            |
| `--color-cinema-ink-mute`    | `text-cinema-ink-mute` | `oklch(0.55 0.012 165)`     | #7b827d | Captions, timestamps                             |

### Glass tints (rgba — `backdrop-filter` partners)

Glass cards layer **two tints**: an outer panel (warmer / less white)
and an optional inner card (whiter, more solid). Mixing the two creates
the depth you see on 11x's mega-footer.

| Token (CSS var)              | Tailwind utility           | Value                              | Where                                       |
| ---------------------------- | -------------------------- | ---------------------------------- | ------------------------------------------- |
| `--color-glass-mist`         | `bg-glass-mist`            | `rgba(238, 244, 234, 0.72)`        | Default light glass over photo              |
| `--color-glass-sage`         | `bg-glass-sage`            | `rgba(190, 213, 195, 0.58)`        | Sagier outer panel                          |
| `--color-glass-dark`         | `bg-glass-dark`            | `rgba(28, 38, 30, 0.62)`           | Dark glass for promo / stats over photo     |
| `--color-glass-stroke-light` | `border-glass-stroke-light`| `rgba(255, 255, 255, 0.55)`        | 1 px inner highlight for top edge           |
| `--color-glass-stroke-dark`  | `border-glass-stroke-dark` | `rgba(0, 0, 0, 0.18)`              | 1 px outer ring on dark glass               |

### Blur scale

| Token                  | Value     | Use                                       |
| ---------------------- | --------- | ----------------------------------------- |
| `--blur-glass-soft`    | `12px`    | Small chips and pills                     |
| `--blur-glass`         | `20px`    | Default glass cards                       |
| `--blur-glass-heavy`   | `36px`    | Large hero panels (mega-footer cluster)   |

## 3. Typography

Single font stack, two roles. No web-font loading dependency
(system stack keeps first-paint instant).

```css
--font-cinema-display: "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
--font-cinema-body:    "Inter", "SF Pro Text",    system-ui, -apple-system, sans-serif;
```

### Display scale (`clamp` for fluid responsive)

| Class                 | Size                                    | Tracking | Use                          |
| --------------------- | --------------------------------------- | -------- | ---------------------------- |
| `text-cinema-display` | `clamp(3rem, 6.5vw + 1rem, 7rem)`       | -0.03em  | Hero headline ("Be more …")  |
| `text-cinema-h1`      | `clamp(2.25rem, 3.5vw + 1rem, 4rem)`    | -0.02em  | Section opener               |
| `text-cinema-h2`      | `clamp(1.75rem, 1.6vw + 1rem, 2.5rem)`  | -0.015em | Card titles                  |
| `text-cinema-eyebrow` | `1rem` (16px)                           | 0.18em   | UPPERCASE eyebrow labels     |
| `text-cinema-body`    | `1.0625rem` (17px) / 1.55 lh            | normal   | Long-form prose              |
| `text-cinema-caption` | `1rem` (16px)                           | 0.005em  | Captions, footnotes          |

**Headline rule:** every display headline gets a single 1px underline
accent at 40 % opacity, ending one or two characters short of the line.
On a light surface the headline is `--color-cinema-ink` (near-black)
and the underline carries the same ink. On a dark surface — including
the cinematic-photo hero, where the headline sits over a 0.45-onyx
gradient — the headline switches to `--color-cinema-cream` and the
underline inherits the cream colour. This is the visual signature of
the cinema theme.

## 4. Spacing + radii

Tailwind defaults stay; cinema adds three radii used for the glass
language only.

| Token              | Value      | Use                              |
| ------------------ | ---------- | -------------------------------- |
| `--radius-glass`   | `1.25rem`  | Default glass card               |
| `--radius-glass-lg`| `1.75rem`  | Large hero glass panel           |
| `--radius-pill`    | `9999px`   | Pill buttons & badges            |

Section vertical rhythm:

- Hero block: **min-h 88vh**, padding-top `clamp(96px, 12vh, 160px)`.
- Standard section: padding `clamp(96px, 14vw, 160px) clamp(24px, 5vw, 96px)`.
- Tight section (dense card grid): padding `64px` top/bottom.

## 5. Glass-card anatomy

Every glass card is **three layers stacked**:

```
┌────────────────────────────────────────────┐
│ ① 1 px inner top highlight                 │
│ ┌────────────────────────────────────────┐ │
│ │ ② glass tint + backdrop-blur            │ │
│ │ ┌────────────────────────────────────┐ │ │
│ │ │ ③ optional inner card (whiter)     │ │ │
│ │ │   contents (heading, body, etc.)    │ │ │
│ │ └────────────────────────────────────┘ │ │
│ └────────────────────────────────────────┘ │
│ ④ 1 px outer ring (for dark glass)         │
└────────────────────────────────────────────┘
```

**Never** add a drop-shadow. Depth = blur + tint contrast only.

```html
<div class="glass-card">
  <h3 class="text-cinema-h2">Workers</h3>
  <div class="glass-card-inner">
    <p>Alice</p>
    <p>Julian</p>
  </div>
</div>
```

The component primitive is `<GlassCard variant="cream|warm|dark" tone="…">`.

## 6. Scroll-effect language

The 11x landing has **no parallax** in the JS sense — it uses three
plain CSS techniques. We adopt the same:

1. **Sticky-with-fade**: the cinematic hero image is `position: sticky`
   on its own 200vh-tall container. The headline fades and shrinks via
   `animation-timeline: scroll()` (fallback: opacity transition on a
   throttled scroll listener for browsers that don't support it yet).
2. **Reveal cards**: cards animate `opacity 0 → 1` and `translateY 24px → 0`
   when they enter viewport (`IntersectionObserver`, single-shot).
3. **Floating cluster**: the mega-footer card cluster sits over the
   hero image at the bottom of the page using `position: absolute;
   bottom: 0` inside a relatively-positioned wrapper.

All of the above degrade gracefully — without JS or with reduced-motion
preference, the page is fully readable as a static document.

```css
@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll { opacity: 1 !important; transform: none !important; }
}
```

## 7. Component primitives (folder map)

```
src/components/cinema/
├── index.ts                     // barrel export
├── PromoBar.tsx                 // top moss ribbon, single CTA link
├── PillButton.tsx               // primary CTA — moss fill, cream text (PillButton + PillLink)
├── GlassCard.tsx                // 3 variants: cream | warm | dark
├── GlassPanel.tsx               // large hero-overlay container
├── CinematicHero.tsx            // sticky photo + headline + underline
├── LogoStrip.tsx                // partner logos row on cream bg
├── SiteFooter.tsx               // sitewide cinema footer (used by __root)
├── StatBlock.tsx                // big number + descriptor
├── SectionDivider.tsx           // cream → white → cream bridge
├── FloatingCardCluster.tsx      // mega-footer stack over photo
└── RevealOnScroll.tsx           // IntersectionObserver wrapper
```

## 8. Page composition rules

A "cinema" page is composed top-to-bottom from this menu — never
deviate without a doc update:

1. `<PromoBar/>` — single line, dismissible, optional.
2. `<Nav/>` (existing component, transparent over hero, opaque on scroll).
3. `<CinematicHero/>` — full-bleed photo + headline + sub + CTA.
4. `<LogoStrip/>` — social-proof.
5. **Story sections** alternating: text-only, text + dark glass-card stat,
   text + photo card. 1.5–3 of these.
6. `<FloatingCardCluster/>` — the iconic over-photo footer.

## 9. Hard rules (do not violate)

- **No drop-shadows on glass.** Depth via blur + tint only.
- **No more than one accent color per page** outside the warm palette.
- **No gradient backgrounds** except inside hero photography.
- **No emoji in product chrome.** lucide-react SVG only.
- **Body text never goes below 16px.** Headlines never thinner than 600.
- **All glass surfaces require a fallback solid bg** for browsers that
  don't support `backdrop-filter` — `@supports not (backdrop-filter: blur(1px))`.
- **`prefers-reduced-motion: reduce`** disables every scroll animation.

## 10. Photography direction

Career-Buddy's hero photography eventually lives in `public/cinema/`.
The current routes use Unsplash CDN URLs as a stop-gap (deferred until
we license a small library of cool sage-leaning landscape photography).
Sourcing guidelines:

- Cinematic landscape orientation, `ratio ≥ 16:9`.
- **Cool, sage-leaning tones** — pine forests, alpine meadows, soft
  morning mist, evergreen coastline. Avoid warm gold / desert / sunset
  photography (that was the prior 11x-mimicry palette and is out).
- Subject is **environment**, not face. Avoid people-portraits in heroes.
- Focal point in the lower-third or right-third so the headline can
  occupy the upper-left.
- Always include a low-resolution LQIP variant (16 × 9 px JPEG) for
  blur-up loading.
- Verified-rendering Unsplash IDs (Chromium ORB safe as of 2026-05-10):
  `1441974231531-c6227db76b6e` (pine forest),
  `1448375240586-882707db888b` (forest sun rays),
  `1500530855697-b586d89ba3ee` (misty mountains).

## 11. Accessibility

- Headline text on photo: minimum WCAG AA contrast ratio 4.5:1.
  Enforce by overlaying a 0–40 % `--color-cinema-moss` gradient when the
  photo is too bright in the headline region.
- Glass cards on photo: text always sits on a white-tinted inner card
  if the outer panel's effective contrast is < 4.5.
- All pill-buttons reach 44 × 44 px tap target on mobile.
- Reveal animations are decorative; no information lives in motion.

## 12. Pointers

- Tokens live in `src/styles/cinema.css`.
- Components live in `src/components/cinema/`.
- A live preview of every component is at `/design-preview` (route
  added in iter 1).
- The Claude Design counterpart of this doc is in
  `docs/design/cinema-tokens.json` — paste into Claude Design's
  "Custom theme" panel to get parity.
