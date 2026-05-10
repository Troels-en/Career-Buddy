import { describe, expect, test } from "vitest";

import {
  FILTER_PRESETS_KEY,
  loadPresets,
  persistPresets,
} from "./filter-presets";
import { DEFAULT_FILTERS } from "./job-filters";

describe("loadPresets", () => {
  test("empty storage → []", () => {
    expect(loadPresets()).toEqual([]);
  });

  test("returns persisted presets", () => {
    const presets = [
      { name: "DACH ops", filters: { ...DEFAULT_FILTERS, roleCats: ["bizops"] } },
    ];
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
    const out = loadPresets();
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("DACH ops");
    expect(out[0].filters.roleCats).toEqual(["bizops"]);
  });

  test("corrupted JSON → []", () => {
    localStorage.setItem(FILTER_PRESETS_KEY, "{not json");
    expect(loadPresets()).toEqual([]);
  });

  test("non-array root → []", () => {
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify({ not: "an array" }));
    expect(loadPresets()).toEqual([]);
  });

  test("filters out malformed entries", () => {
    const presets = [
      { name: "ok", filters: DEFAULT_FILTERS },
      { name: 42, filters: DEFAULT_FILTERS }, // bad name type
      null,
      "string-not-object",
      { name: "no-filters" }, // missing filters
    ];
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
    const out = loadPresets();
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("ok");
  });
});

describe("persistPresets", () => {
  test("writes JSON-stringified array", () => {
    const presets = [{ name: "x", filters: DEFAULT_FILTERS }];
    persistPresets(presets);
    expect(JSON.parse(localStorage.getItem(FILTER_PRESETS_KEY) ?? "[]")).toEqual(presets);
  });

  test("round-trips persist → load", () => {
    const presets = [
      { name: "Senior strategy", filters: { ...DEFAULT_FILTERS, roleCats: ["strategy"], maxYearsRequired: 8 } },
      { name: "Remote BD", filters: { ...DEFAULT_FILTERS, roleCats: ["bd"], remoteOnly: true } },
    ];
    persistPresets(presets);
    const out = loadPresets();
    expect(out).toEqual(presets);
  });

  test("empty array round-trips", () => {
    persistPresets([]);
    expect(loadPresets()).toEqual([]);
  });
});
