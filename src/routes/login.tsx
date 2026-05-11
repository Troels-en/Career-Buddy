import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, LogIn } from "lucide-react";

import { GlassPanel } from "@/components/cinema";
import {
  getCurrentUserId,
  signInWithEmail,
  signInWithGoogle,
  onAuthChange,
} from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Career-Buddy — Sign in" },
      {
        name: "description",
        content:
          "Sign in to Career-Buddy with a magic link or Google to sync your profile across devices.",
      },
    ],
  }),
});

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<SendState>({ kind: "idle" });
  const [googleState, setGoogleState] = useState<SendState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    void getCurrentUserId().then((id) => {
      if (!cancelled && id) {
        void navigate({ to: "/" });
      }
    });
    const unsubscribe = onAuthChange((id) => {
      if (id) void navigate({ to: "/" });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate]);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailState({ kind: "error", message: "Email required." });
      return;
    }
    setEmailState({ kind: "sending" });
    try {
      await signInWithEmail(trimmed);
      setEmailState({ kind: "sent" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't send magic link.";
      setEmailState({ kind: "error", message });
    }
  }

  async function onGoogleClick() {
    setGoogleState({ kind: "sending" });
    try {
      await signInWithGoogle();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";
      setGoogleState({ kind: "error", message });
    }
  }

  return (
    <div className="bg-cinema-mist">
      <section className="max-w-2xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-24">
        <div className="text-cinema-eyebrow text-cinema-ink-mute mb-4">
          Sign in
        </div>
        <h1 className="text-cinema-h1 mb-4">
          <span className="cinema-headline-underline">Pick up</span> where you
          left off.
        </h1>
        <p className="text-cinema-body mb-8 max-w-xl">
          Your profile, applications, and inbox connections sync across every
          device once you're signed in. No password — pick a magic link or
          Google.
        </p>

        <GlassPanel>
          <form onSubmit={onEmailSubmit} className="space-y-4">
            <label
              htmlFor="login-email"
              className="block text-base font-medium text-cinema-ink"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={
                emailState.kind === "sending" || emailState.kind === "sent"
              }
              placeholder="you@example.com"
              className="w-full border border-cinema-mint rounded-glass px-4 py-3 text-base bg-white/80 focus:outline-none focus:ring-2 focus:ring-cinema-sage text-cinema-ink"
            />
            <button
              type="submit"
              disabled={
                emailState.kind === "sending" || emailState.kind === "sent"
              }
              className="pill-cta disabled:opacity-40"
            >
              {emailState.kind === "sending" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Send magic link
            </button>
            {emailState.kind === "sent" && (
              <div className="text-base text-cinema-pine bg-cinema-mint/60 border border-cinema-sage/40 rounded-glass px-4 py-3">
                Check your inbox — the link will sign you in. You can close
                this tab.
              </div>
            )}
            {emailState.kind === "error" && (
              <div className="text-base text-destructive bg-red-50 border border-red-200 rounded-glass px-4 py-3">
                {emailState.message}
              </div>
            )}
          </form>

          <div className="my-6 flex items-center gap-3 text-cinema-caption text-cinema-ink-mute">
            <div className="flex-1 h-px bg-cinema-mint" />
            or
            <div className="flex-1 h-px bg-cinema-mint" />
          </div>

          <button
            type="button"
            onClick={onGoogleClick}
            disabled={googleState.kind === "sending"}
            className="pill-cta-soft w-full justify-center disabled:opacity-40"
          >
            {googleState.kind === "sending" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            Sign in with Google
          </button>
          {googleState.kind === "error" && (
            <div className="mt-3 text-base text-destructive bg-red-50 border border-red-200 rounded-glass px-4 py-3">
              {googleState.message}
            </div>
          )}
        </GlassPanel>

        <p className="text-cinema-caption text-cinema-ink-mute mt-6">
          Browsing /jobs without signing in still works — your saved data stays
          on this device until you connect an account.
        </p>
      </section>
    </div>
  );
}
