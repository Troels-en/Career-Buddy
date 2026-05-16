// Deno tests for the news-feed edge handler (F3).
//
// Run: deno test supabase/functions/news-feed/handler.test.ts
//
// Covers the auth gate (never anonymous), CORS preflight, and the
// company-name shaping helper. The happy-path DB join is integration-
// level (live Supabase) and is not exercised here.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  distinctCompanies,
  handleRequest,
  mergeSection,
  type NewsItem,
} from "./handler.ts";

function newsItem(company: string, isoDate: string): NewsItem {
  return {
    id: `${company}-${isoDate}`,
    company_name: company,
    headline: `${company} headline ${isoDate}`,
    url: `https://news.test/${company}/${isoDate}`,
    summary: null,
    source: "Test",
    published_at: isoDate,
  };
}

Deno.test("OPTIONS preflight returns CORS headers, no body", async () => {
  const res = await handleRequest(
    new Request("http://localhost/news-feed", { method: "OPTIONS" }),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("missing Authorization header → 401", async () => {
  const res = await handleRequest(
    new Request("http://localhost/news-feed", { method: "POST" }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assert(typeof body.error === "string" && body.error.length > 0);
});

Deno.test("empty Bearer token → 401 (never anonymous)", async () => {
  const res = await handleRequest(
    new Request("http://localhost/news-feed", {
      method: "POST",
      headers: { Authorization: "Bearer " },
    }),
  );
  assertEquals(res.status, 401);
});

Deno.test("distinctCompanies dedupes, trims, drops empties, keeps order", () => {
  const out = distinctCompanies([
    { company: "Stripe" },
    { company: " Stripe " },
    { company: "Notion" },
    { company: "" },
    { company: null },
    { company: "Stripe" },
  ]);
  assertEquals(out, ["stripe", "notion"]);
});

Deno.test("distinctCompanies returns [] for empty input", () => {
  assertEquals(distinctCompanies([]), []);
});

Deno.test("distinctCompanies lowercases so casing never hides news", () => {
  const out = distinctCompanies([{ company: "Stripe" }, { company: "stripe" }]);
  assertEquals(out, ["stripe"]);
});

Deno.test("mergeSection interleaves companies newest-first", () => {
  const stripe = [
    newsItem("stripe", "2026-05-15T10:00:00Z"),
    newsItem("stripe", "2026-05-13T10:00:00Z"),
  ];
  const notion = [
    newsItem("notion", "2026-05-14T10:00:00Z"),
    newsItem("notion", "2026-05-12T10:00:00Z"),
  ];
  const out = mergeSection([stripe, notion]);
  assertEquals(
    out.map((r) => r.published_at),
    [
      "2026-05-15T10:00:00Z",
      "2026-05-14T10:00:00Z",
      "2026-05-13T10:00:00Z",
      "2026-05-12T10:00:00Z",
    ],
  );
});

Deno.test("mergeSection caps the section at 50 items", () => {
  const big = Array.from({ length: 80 }, (_, i) =>
    newsItem("stripe", `2026-01-01T00:${String(i).padStart(2, "0")}:00Z`),
  );
  assertEquals(mergeSection([big]).length, 50);
});
