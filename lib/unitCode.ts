/**
 * Normalises a unit code to the canonical MarkWise format:
 *   ALPHA{1+} SPACE DIGIT{1+}…
 *
 * Examples:
 *   "SCH2170"   → "SCH 2170"
 *   "sch 2170"  → "SCH 2170"
 *   "BCH301"    → "BCH 301"
 *   "SCH 2170"  → "SCH 2170"  (idempotent)
 *   ""          → ""
 */
export function normalizeUnitCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/^([A-Z]+)(\d+.*)$/);
  if (m) return `${m[1]} ${m[2]}`;
  return s; // fallback: pure letters or unrecognised format returned as-is
}
