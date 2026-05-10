import { useState } from "react";
import { Mail, Plus, Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Email accounts UI — Phase 1.5 stub.
 *
 * The Supabase table `user_email_accounts` (migration 0010) is live,
 * but the OAuth client + token encryption layer (KMS / pgcrypto)
 * aren't wired yet. Until then this component is a UI mock that:
 *   - shows the empty state and the planned multi-account chip-set
 *   - exposes Connect-Gmail / Connect-Outlook / Connect-IMAP buttons
 *     that open an info modal explaining when OAuth ships
 *   - persists nothing
 *
 * When backend lands the OAuth handshake (Phase 1.6), the
 * `accounts` state below will be hydrated from a `select * from
 * user_email_accounts` query and the buttons will trigger the real
 * OAuth redirect.
 */

type Provider = "gmail" | "outlook" | "imap";

type EmailAccount = {
  id: string;
  email: string;
  provider: Provider;
  isPrimary: boolean;
};

const PROVIDER_LABEL: Record<Provider, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  imap: "IMAP",
};

const PROVIDER_COLOR: Record<Provider, string> = {
  gmail: "bg-cinema-mint/60 text-cinema-ink",
  outlook: "bg-cinema-sage/40 text-cinema-ink",
  imap: "bg-cinema-mist text-cinema-ink-mute",
};

export function EmailAccounts() {
  const [accounts] = useState<EmailAccount[]>([]); // empty until OAuth ships
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);

  function explain(provider: Provider) {
    setPendingProvider(provider);
  }

  function close() {
    setPendingProvider(null);
  }

  return (
    <div className="space-y-5">
      {accounts.length === 0 ? (
        <div className="rounded-glass border border-cinema-mint bg-white/70 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full bg-cinema-mint/60">
              <Mail className="w-4 h-4 text-cinema-pine" />
            </div>
            <div>
              <div className="text-cinema-h2 mb-1">No accounts connected.</div>
              <p className="text-cinema-body">
                Connect Gmail or Outlook so Buddy can read application
                replies, draft outreach from your address, and surface
                interview invites in your Overview tracker. Multiple
                accounts supported — set one as primary.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-glass border border-cinema-mint bg-white/70 px-4 py-3"
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-base font-medium",
                  PROVIDER_COLOR[a.provider],
                )}
              >
                {PROVIDER_LABEL[a.provider]}
              </span>
              <span className="flex-1 text-base text-cinema-ink truncate">
                {a.email}
              </span>
              {a.isPrimary && (
                <span className="inline-flex items-center gap-1 text-base text-cinema-pine">
                  <Star className="w-3.5 h-3.5" /> primary
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => explain("gmail")} className="pill-cta">
          <Plus className="w-4 h-4" /> Connect Gmail
        </button>
        <button
          type="button"
          onClick={() => explain("outlook")}
          className="pill-cta-soft"
        >
          <Plus className="w-4 h-4" /> Connect Outlook
        </button>
        <button
          type="button"
          onClick={() => explain("imap")}
          className="pill-cta-soft"
        >
          <Plus className="w-4 h-4" /> Connect IMAP
        </button>
      </div>

      <p className="text-cinema-caption">
        Phase 1.5 UI stub — the `user_email_accounts` schema is live in
        Supabase (migration 0010). OAuth handshake + encrypted refresh
        tokens ship with Phase 1.6.
      </p>

      {pendingProvider && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cinema-moss/60 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="glass-panel-heavy max-w-md w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-cinema-eyebrow text-cinema-ink-mute mb-3">
              Phase 1.6 — coming soon
            </div>
            <h3 className="text-cinema-h2 mb-3">
              Connect {PROVIDER_LABEL[pendingProvider]}
            </h3>
            <p className="text-cinema-body mb-5">
              Backend OAuth handshake + encrypted token storage land in
              Phase 1.6. Until then this is a placeholder; nothing is
              sent or stored. The Supabase table is already there
              waiting (`user_email_accounts`, migration 0010).
            </p>
            <div className="flex justify-end">
              <button onClick={close} className="pill-cta">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
