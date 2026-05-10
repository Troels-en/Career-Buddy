import { defineConfig, devices } from "@playwright/test";

// Local preview pipeline (round-10 wrap):
// - vite build emits dist/server/index.js (cloudflare-vite-plugin's
//   default top-level Worker entry).
// - TanStack Start's preview-server-plugin imports
//   dist/server/<basename(tanstackStart.server.entry)>.js, i.e.
//   dist/server/server.js (because vite.config.ts pins
//   `tanstackStart: { server: { entry: "server" } }`).
// - These two filenames disagree → `vite preview` 500s on every
//   route. Workaround until the upstream plugins reconcile: copy
//   dist/server/index.js → dist/server/server.js after build, then
//   start preview. Tracked separately; see CLAUDE_COORDINATION.md
//   round-10 entry.
//
// PLAYWRIGHT_BASE_URL still wins when set so CI / live-deploy smokes
// keep working.
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? PREVIEW_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // webServer only runs when no PLAYWRIGHT_BASE_URL override —
  // skipped against live deploys. Bash shim handles the
  // index→server.js copy so vite preview boots cleanly.
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command:
            "bun run build && cp dist/server/index.js dist/server/server.js && bun run preview --port " +
            PREVIEW_PORT,
          url: PREVIEW_URL,
          reuseExistingServer: !process.env.CI,
          // Cold build ~90-150s (TanStack + Cloudflare + Tailwind),
          // preview boot ~5s; give it 4 min.
          timeout: 240_000,
        },
      }),
});
