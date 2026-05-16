/**
 * CV insights (F2) — three tabs (Strengths / Weaknesses / Gaps) over
 * the radar payload. Each card opens Buddy with a tab-aware prefill.
 */
import { useState } from "react";

import type { CvRadar } from "@/lib/cv-storage";
import { track } from "@/lib/telemetry";

type TabId = "strengths" | "weaknesses" | "gaps";

const TABS: { id: TabId; label: string }[] = [
  { id: "strengths", label: "Strengths" },
  { id: "weaknesses", label: "Weaknesses" },
  { id: "gaps", label: "Gaps" },
];

function prefillFor(tab: TabId, item: string): string {
  switch (tab) {
    case "strengths":
      return `My CV shows this strength: "${item}". How do I make it the lead in my applications?`;
    case "weaknesses":
      return `My CV has this weakness: "${item}". How much does it matter for the roles I'm targeting, and how do I offset it?`;
    case "gaps":
      return `Here's a gap on my CV: "${item}". What's the smallest concrete step to start closing it?`;
  }
}

export function CvInsights({ radar }: { radar: CvRadar }) {
  const [tab, setTab] = useState<TabId>("strengths");
  const items = radar[tab];

  function switchTab(next: TabId) {
    if (next === tab) return;
    setTab(next);
    void track("insights_tab_switch", { tab: next });
  }

  function openCard(item: string, index: number) {
    void track("insights_card_click", { tab, index });
    window.dispatchEvent(
      new CustomEvent("open-buddy", {
        detail: { prefill: prefillFor(tab, item) },
      }),
    );
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="CV insights" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t.id)}
              className={[
                "rounded-full border px-4 py-2 text-base transition-colors",
                active
                  ? "bg-cinema-moss text-cinema-cream border-cinema-moss"
                  : "bg-white border-cinema-mint text-cinema-ink hover:bg-cinema-mint/60",
              ].join(" ")}
            >
              {t.label}
              <span className={active ? "text-cinema-cream/75" : "text-cinema-ink-mute"}>
                {" "}
                · {radar[t.id].length}
              </span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="text-cinema-body text-cinema-ink-soft">
          Nothing here yet — re-run the CV analysis to refresh this tab.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={`${tab}-${i}`}>
              <button
                type="button"
                onClick={() => openCard(item, i)}
                title="Ask Buddy about this"
                className="h-full w-full rounded-glass border border-cinema-mint bg-white px-4 py-3 text-left text-cinema-body text-cinema-ink transition-colors hover:bg-cinema-mint/40"
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
