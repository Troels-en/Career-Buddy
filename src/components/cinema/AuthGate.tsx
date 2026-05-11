import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { getCurrentUserId, onAuthChange } from "@/lib/auth";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/jobs",
  "/email-oauth-callback",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return pathname.startsWith("/email-oauth-callback");
}

/**
 * Client-side auth gate. On mount + on every route change, resolves
 * the current Supabase user. If anonymous and the current path is
 * not public, navigates to /login.
 *
 * Anonymous-mode contract: /jobs and / stay public so the marketing
 * surface keeps working without an account. Sign-out triggers
 * onAuthChange and immediately re-evaluates.
 *
 * SSR-safe: the redirect only fires after the client-side auth probe
 * resolves, so initial render never blocks.
 */
export function AuthGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUserId().then((id) => {
      if (!cancelled) setSignedIn(!!id);
    });
    const unsubscribe = onAuthChange((id) => {
      setSignedIn(!!id);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (signedIn === null) return;
    if (signedIn) return;
    if (isPublicPath(pathname)) return;
    void navigate({ to: "/login" });
  }, [signedIn, pathname, navigate]);

  return null;
}
