// Pinned CV-radar axis sets — the single source of truth shared by:
//  - the analyze-cv edge function (prompt + Zod enum), via radar.ts
//  - the frontend `parseRadar` axis-name validation, via cv-storage.ts
// so the two never drift. Pure constants — no imports, no runtime —
// safe to import from both the Deno function and the Vite frontend.

// Default (technical roles): SWE, data, DevOps, ML, design-eng.
export const RADAR_AXES_TECHNICAL = [
  "Technical depth",
  "Leadership",
  "Domain expertise",
  "Communication",
  "Execution",
  "Growth trajectory",
] as const;

// Non-technical (sales, BD, ops, product, marketing, exec).
export const RADAR_AXES_COMMERCIAL = [
  "Commercial acumen",
  "Leadership",
  "Domain expertise",
  "Communication",
  "Execution",
  "Growth trajectory",
] as const;

/** Every distinct pinned axis name across both sets. */
export const RADAR_AXIS_NAMES: readonly string[] = [
  ...new Set<string>([...RADAR_AXES_TECHNICAL, ...RADAR_AXES_COMMERCIAL]),
];
