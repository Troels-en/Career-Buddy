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
  fairTrim,
  handleRequest,
  type NewsItem,
} from "./handler.ts";

function newsItem(company: string, n: number): NewsItem {
  return {
    id: `${company}-${n}`,
    company_name: company,
    headline: `${company} headline ${n}`,
    url: `https://news.test/${company}/${n}`,
    summary: null,
    source: "Test",
    published_at: new Date().toISOString(),
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

Deno.test("fairTrim caps per company so one loud company can't dominate", () => {
  const rows = [
    ...Array.from({ length: 20 }, (_, i) => newsItem("stripe", i)),
    ...Array.from({ length: 3 }, (_, i) => newsItem("notion", i)),
  ];
  const out = fairTrim(rows);
  assertEquals(out.filter((r) => r.company_name === "stripe").length, 8);
  assertEquals(out.filter((r) => r.company_name === "notion").length, 3);
});
