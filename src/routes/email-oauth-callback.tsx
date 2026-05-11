import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

import { GlassPanel } from "@/components/cinema";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/email-oauth-callback")({
  component: EmailOauthCallback,
  head: () => ({
    meta: [
      { title: "Career-Buddy — Connecting your inbox" },
      {
        name: "description",
        content:
          "Finishing your Gmail / Outlook connection so Buddy can read application replies.",
      },
    ],
  }),
});

type State =
  | { kind: "exchanging" }
  | { kind: "success" }
  | { kind: "error"; message: string };

function readParams() {
  if (typeof window === "undefined") {
    return { code: null, state: null, provider: "gmail" as "gmail" | "outlook" };
  }
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerParam = url.searchParams.get("provider");
  const provider: "gmail" | "outlook" =
    providerParam === "outlook" ? "outlook" : "gmail";
  return { code, state, provider };
}

function EmailOauthCallback() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<State>({ kind: "exchanging" });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const { code, state, provider } = readParams();
      if (!code || !state) {
        if (!cancelled) {
          setPhase({
            kind: "error",
            message: "Missing OAuth code or state in the redirect URL.",
          });
        }
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke(
          "email-oauth-callback",
          { body: { provider, code, state } },
        );
        if (cancelled) return;
        if (error) {
          setPhase({ kind: "error", message: error.message });
          return;
        }
        if (data && typeof data === "object" && "error" in data && data.error) {
          setPhase({ kind: "error", message: String(data.error) });
          return;
        }
        setPhase({ kind: "success" });
        window.setTimeout(() => {
          void navigate({ to: "/profile", hash: "email" });
        }, 1500);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "OAuth exchange failed.";
        setPhase({ kind: "error", message });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="bg-cinema-mist">
      <section className="max-w-2xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-24">
        <div className="text-cinema-eyebrow text-cinema-ink-mute mb-4">
          Connecting your inbox
        </div>
        <h1 className="text-cinema-h1 mb-8">
          <span className="cinema-headline-underline">One moment</span> —
          finishing the handshake.
        </h1>

        <GlassPanel>
          {phase.kind === "exchanging" && (
            <div className="flex items-center gap-3 text-cinema-body text-cinema-ink-soft">
              <Loader2 className="w-5 h-5 animate-spin text-cinema-pine" />
              Exchanging the OAuth code with the provider…
            </div>
          )}
          {phase.kind === "success" && (
            <div className="flex items-center gap-3 text-cinema-body text-cinema-pine">
              <CheckCircle2 className="w-5 h-5" />
              Connected. Redirecting to your profile…
            </div>
          )}
          {phase.kind === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-cinema-body text-destructive">
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Couldn't connect your inbox.</div>
                  <div className="text-cinema-ink-soft mt-1">
                    {phase.message}
                  </div>
                </div>
              </div>
              <a href="/profile#email" className="pill-cta-soft">
                Back to profile
              </a>
            </div>
          )}
        </GlassPanel>
      </section>
    </div>
  );
}
