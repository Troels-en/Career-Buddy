# Demo Script — fa-track

> 3-minute Lightning Demo, Lovable Founder Series Berlin, 2026-05-07.

## Talk Track (memorize)

**[0:00–0:20] Hook (live-pain)**
> "I'm Troels. I'm a CLSBE Master grad applying to Founders Associate roles. I have 8 open applications. Got rejected by Pedlar today. I lose track. So I built fa-track in 2 hours."

**[0:20–0:40] Problem (sharp)**
> "FA-roles aren't on standard job-boards. They're on Picus career-page, Cherry, Earlybird, in stealth-LinkedIn-DMs. I was tracking them in Excel. My friend Marleen uses WhatsApp + Notion. Both of us forget who we sent CVs to. Tools like Clera have a chat that forgets your CV. Dumb."

**[0:40–1:10] Demo Step 1 — Onboarding + CV-Upload**
> "Let me onboard." → Type live: `"FA roles at AI-startups, Berlin/Remote, business-background"` → AI clarifies → profile-card emerges
> Drag CV PDF → Claude extracts → "Strong: B2B-sales, deal-sourcing. Gap: SaaS-metrics, ML-fundamentals." → Profile enriched

**[1:10–1:40] Demo Step 2 — Add Application**
> "I just applied to Picus FA. Let me add it." → Paste URL → AI parses JD → `fit_score: 8.4/10, "matches your B2B background, lacks SaaS-metrics — recommend reading SaaStr basics before interview"` → Row appears in tracker

**[1:40–2:10] Demo Step 3 — Sync Inbox (THE WOW MOMENT)**
> "Now click Sync." → Mock-inbox loads 8 emails → Watch:
> - Pedlar rejection → Pedlar-row updates to `status: rejected`, side-panel pops "Want feedback? Here's draft email"
> - Avi interview-invite → Avi-row → `status: interview-2, next: Thu 3pm`
> - Rust silence-7-days → Rust-row flagged → "Send follow-up?"
> All happen in 3 seconds.

**[2:10–2:30] Demo Step 4 — Insights Panel**
> "And here — patterns I didn't see myself: 'B2B-roles respond 3× more than B2C. Picus-pipeline avg is 21 days, you're at day 5 — be patient.' Bro just saved me 30 min of self-analysis."

**[2:30–2:50] Demo Step 5 — Jobs Feed**
> "And 15 FA-roles ranked by fit. Top match: Cherry Ventures Investment Analyst, 8.7/10, 'matches your CLSBE background and B2B-sales experience'."

**[2:50–3:00] Vision + CTA**
> "Today: tracker. Next month: real Gmail. Year-1 vision: full Career Buddy that knows you for 3 years and tells you when to switch jobs and how to negotiate salary. Public repo at github.com/troelsenigk/fa-track. If you're applying to startup-roles, ping me — I want you on it tonight."

## Backup Q&A

| Q | A |
|---|---|
| Why not engineers? | Engineers have GitHub + Stack-Overflow + tech-job-boards. Business-grads have nothing comparable for FA-roles. |
| Why monolithic vs. just-tracker? | Context-flywheel. Tracker is wedge. Real moat = 3-year-Career-Buddy that no transactional competitor catches. |
| What if Clera adds memory? | Possible but they have to rebuild. We start from memory-first design. |
| Privacy on Gmail-access? | Layer 1+: read-only scope, classification on-device option, no email-storage by default — only structured-events extracted. |
| TAM? | DACH alone: ~50k business-background-grads/year. Global: 500k+. €9–79/mo pricing × 5% conversion = real ARR. |
| Why you? | Live-pain + Bucerius/CLSBE-network as direct funnel + already shipped MVP today. |

## Visual Flow Cheat-Sheet (during build)

```
┌────────────────────────────────────────────────────────┐
│  [Onboarding Chat]                                      │
│  "Tell me about your career goal..."                   │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│  [CV Upload]    [Profile Card]                          │
│  drag PDF       Target: FA / AI startups               │
│                 Strong: B2B-sales, deals               │
│                 Gap: SaaS-metrics                      │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────┬─────────────────────────────────────┐
│  [Applications] │  [Insights Panel]                  │
│  Pedlar  ❌    │  → B2B responds 3× than B2C         │
│  Avi     📅 Thu│  → Picus-pipeline avg 21d           │
│  Rust    ⏳ 7d │  → Strong-fit: Series-A + Berlin    │
│  Picus   ✅ 8.4│                                     │
├────────────────┤  [Jobs Feed — top 3]                │
│  [+ Add app]   │  Cherry IA   8.7/10                 │
│  [Sync inbox]  │  Earlybird   7.9/10                 │
│                │  Project A   7.6/10                 │
└────────────────┴─────────────────────────────────────┘
```
