import { createFileRoute, redirect } from "@tanstack/react-router";

// /cv was a stub sub-page. CV upload now lives inside /profile.
// This route exists ONLY to keep old links + bookmarks working —
// it 308-redirects to the CV section of Profile.
export const Route = createFileRoute("/cv")({
  beforeLoad: () => {
    throw redirect({ to: "/profile", hash: "cv-upload" });
  },
});
