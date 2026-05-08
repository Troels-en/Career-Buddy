# refinement-prompts.md — Career-Buddy

> **Use these when Lovable misfires on a specific part of the build.** Paste the matching prompt as a follow-up message; do not re-generate from scratch.

---

## 1. Sync Inbox stagger broken (rows update simultaneously instead of staggered)

```
Re-implement Sync Inbox stagger using a setTimeout chain at 250ms intervals in this exact company order: Pedlar, Avi, Picus Capital, Cherry Ventures, Project A, Earlybird, Rust, Speedinvest. Each row applies bg-purple-100 for 400ms then settles to its final badge state. The button shows a spinner with text "Scanning 8 cached emails…" for the full 2000ms loading window. Summary strip renders at t=2200ms below the table with text "8 emails scanned · 6 applications updated · 6 next actions created · 1 offer received". No typewriter, no scale animations, no per-row custom transitions.
```

---

## 2. Top-3 glow too weak or hardcoded by company name

```
Increase top-3 jobs glow to ring-2 ring-purple-500 ring-opacity-60 + animate-pulse (2s, slow). Critically: compute the top-3 cards by fit_score (descending sort) at render time. Do NOT hardcode company names like "Cherry Ventures", "Earlybird", "Project A" — derive them from the data so re-scoring stays consistent.
```

---

## 3. Mock pill missing from header

```
Add the "Mock AI mode · cached demo responses" status pill to the top-right of the sticky header. text-xs, bg-gray-100, rounded-full, px-3 py-1. To its right, keep the small "Reset demo" link (text-xs, text-gray-400, underline) that clears localStorage, reloads the page, and restarts onboarding from scratch.
```

---

## 4. Pre-seeded application rows missing or wrong

```
Pre-seed exactly the 8 rows specified in /docs/build.md F4 on first load. Reset state in localStorage if needed. The 8 rows in this exact order: Pedlar (Founders Associate, applied, fit 7.2), Avi (Investment Analyst, applied, last_event="2 days ago", fit 8.4), Rust (Operating Associate, applied, last_event="6 days ago", fit 6.8), Picus Capital (FA Program, applied, fit 8.1), Cherry Ventures (Investment Analyst, applied, fit 7.4), Project A (Strategy Associate, applied, fit 7.9), Earlybird (Investment Analyst, applied, fit 6.5), Speedinvest (Investment Associate, applied, fit 8.7). All status=applied, all next_action="Awaiting reply" except where last_event is set.
```

---

## 5. Profile card not collapsing after Sync

```
After Sync Inbox completes successfully, collapse the profile card to its one-line summary form: "Troels K. · Founders Associate · Berlin / Remote-DACH · CLSBE Master". Add an "edit profile" link (text-xs, accent-colored, underline) that re-expands the card to the full form (Name, Target Role, Target Geo, Background, Strong, Gap, plus the CV analysis block if Analyze CV was run).
```

---

## 6. Provider-name leak in UI or code

```
Search the codebase for any reference to OpenAI, Anthropic, GPT, Claude, or any LLM provider in UI strings, code comments, variable names, file names, or user-facing copy. Remove every reference except the single visible status pill "Mock AI mode · cached demo responses". Replace any leaked provider names with "Mock AI" or just delete the comment.
```

---

## 7. Sync timing off (summary strip lands too early or too late)

```
Fix Sync Inbox timing: button loading state is exactly 2000ms with spinner + text "Scanning 8 cached emails…". 8 row updates are staggered at 250ms each, starting at t=0 and ending at t=1750ms. The summary strip renders at t=2200ms (200ms after the last row settles). Do not shorten the loading window — the wow moment needs the full 2 seconds.
```

---

## 8. Mobile layout breaking

```
Below 768px viewport width: stack all sections single-column. Section 3 (Insights) should become inline below Section 2 (Applications) instead of staying as a sticky sidebar. Card grid in Section 4 collapses to 1 column. All text sizes and tap targets remain readable; no horizontal scroll.
```

---

## 9. Reset link not restarting onboarding

```
The "Reset demo" link in the sticky header must do three things on click: (1) clear localStorage entirely, (2) reload the page, (3) on the reloaded page, render the onboarding chat input in its initial empty state — do NOT auto-skip the Build-profile flow even if state was previously populated. The full demo arc must be re-runnable from a fresh state.
```

---

## 10. Add Application or Add-to-tracker default mismatch

```
Both the "+ Add Application" modal submission AND the VC Jobs Feed "Add to tracker" button must append a row with the SAME defaults: status=applied, next_action="Prep B2B-deal example". The fit score differs (Add Application = 8.4 default; Add to tracker = the card's fit_score). Do not introduce different next_action defaults across these two paths.
```
