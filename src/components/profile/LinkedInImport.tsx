import { useState } from "react";
import { Loader2, Linkedin } from "lucide-react";

import { type CvAnalysisResponse } from "@/lib/cv-storage";
import { setProfileFromAnalysis } from "@/lib/profile-store";
import { supabase } from "@/integrations/supabase/client";
import { VoiceMic } from "@/components/voice/VoiceMic";

/**
 * LinkedIn import — the fast-start onboarding path. The user pastes
 * their LinkedIn profile text and Buddy builds the structured profile
 * from it, reusing the same `analyze-cv` edge function + the
 * `setProfileFromAnalysis` persistence path as CvUploadInline.
 *
 * Why paste, not URL fetch: LinkedIn blocks server-side profile
 * fetches (login wall / 999 status), so a real URL fetch needs a paid
 * third-party API. The URL field here captures the profile URL for
 * later use and frames the flow; the working extraction path is the
 * paste box. See ~/Career-Buddy_Vault Feature_LinkedIn_URL_Onboarding.
 */

const LINKEDIN_URL_KEY = "career-buddy-linkedin-url";
const LINKEDIN_RE = /linkedin\.com\/in\/[^/\s]+/i;

type Props = { onAnalysed?: () => void };

export function LinkedInImport({ onAnalysed }: Props = {}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "analysing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const urlValid = LINKEDIN_RE.test(url);

  function persistUrl() {
    if (typeof window === "undefined" || !urlValid) return;
    try {
      window.localStorage.setItem(LINKEDIN_URL_KEY, url.trim());
    } catch {
      /* ignore quota / SecurityError */
    }
  }

  async function analyse() {
    const content = text.trim();
    if (content.length < 50) {
      setError(
        "Paste a bit more of your LinkedIn profile — open it in another tab, select all the text, and copy it here.",
      );
      return;
    }
    setPhase("analysing");
    setError(null);
    setSummary(null);
    persistUrl();
    try {
      // Reuses the analyze-cv edge function — LinkedIn profile text is
      // career text, the same extractor handles it. Contract verified
      // against supabase/functions/analyze-cv/index.ts:
      //   body  = { cvText: string, targetProfile?: string }
      //   reply = { analysis: CvAnalysisResponse } | { error: string }
      const { data, error: fnErr } = await supabase.functions.invoke("analyze-cv", {
        body: { cvText: content.slice(0, 40_000) },
      });
      if (fnErr) throw fnErr;
      const payload = (data ?? {}) as { analysis?: CvAnalysisResponse; error?: string };
      if (!payload.analysis) {
        throw new Error(payload.error ?? "analyze-cv returned no analysis");
      }
      await setProfileFromAnalysis(payload.analysis, "LinkedIn profile");
      setSummary(
        payload.analysis.summary ?? "Profile built from LinkedIn. Open Overview to review.",
      );
      setPhase("done");
      onAnalysed?.();
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Could not build profile from LinkedIn");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-cinema-eyebrow text-cinema-ink-mute">
          Your LinkedIn profile URL
        </label>
        <div className="flex items-center gap-2">
          <Linkedin className="w-5 h-5 text-cinema-pine shrink-0" />
          <input
            type="url"
            inputMode="url"
            className="w-full border border-cinema-mint rounded-glass px-3 py-2 text-base bg-white/80 text-cinema-ink focus:outline-none focus:ring-2 focus:ring-cinema-sage"
            placeholder="https://www.linkedin.com/in/your-handle"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={persistUrl}
          />
        </div>
        {url.trim() && !urlValid && (
          <p className="text-cinema-caption text-cinema-ink-mute">
            That doesn't look like a LinkedIn profile URL — it should contain
            <span className="font-mono"> linkedin.com/in/</span>.
          </p>
        )}
      </div>

      <div className="text-base text-cinema-ink-soft bg-cinema-mint/40 border border-cinema-mint rounded-glass px-4 py-3">
        LinkedIn blocks automated profile reading, so paste it yourself: open your profile in
        another tab, select all the text on the page (<span className="font-mono">⌘/Ctrl+A</span>),
        copy, and paste it below. Buddy extracts your work history, skills, and a structured profile
        from it.
      </div>

      <div className="relative">
        <textarea
          rows={6}
          className="w-full border border-cinema-mint rounded-glass p-3 pr-14 text-base bg-white/80 text-cinema-ink resize-y focus:outline-none focus:ring-2 focus:ring-cinema-sage"
          placeholder="Paste your LinkedIn profile text here, then click Build profile"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="absolute top-2 right-2">
          <VoiceMic
            size="sm"
            onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))}
            disabled={phase === "analysing"}
            label="Dictate LinkedIn profile text"
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => void analyse()}
          disabled={!text.trim() || phase === "analysing"}
          className="pill-cta disabled:opacity-50"
        >
          {phase === "analysing" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Linkedin className="w-4 h-4" />
          )}
          {phase === "analysing" ? "Building profile…" : "Build profile from LinkedIn"}
        </button>
      </div>

      {error && (
        <div className="text-base text-destructive bg-red-50 border border-red-200 rounded-glass px-3 py-2">
          {error}
        </div>
      )}

      {summary && (
        <div className="text-base text-cinema-ink-soft bg-cinema-mint/40 border border-cinema-mint rounded-glass px-4 py-3">
          {summary}{" "}
          <a href="/" className="underline text-cinema-pine font-medium">
            Open Overview to review →
          </a>
        </div>
      )}
    </div>
  );
}
