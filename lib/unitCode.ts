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

// A well-formed unit code: 2-6 letters immediately followed by digits (space optional).
// e.g. "SCH 2170", "sch2170", "ENG101"
const UNIT_CODE_RE = /^[A-Za-z]{2,6}\s*\d+/;

/**
 * Resolves the correct (code, title) pair from two strings that may have been
 * entered in the wrong order.
 *
 * If the submitted `code` does NOT look like a unit code but `title` DOES,
 * the fields are silently swapped before normalisation.  This prevents data
 * entered as (code="Organic Chemistry", title="SCH 2170") from ever reaching
 * the database in the wrong columns.
 *
 * Always returns a canonical code (via normalizeUnitCode) and a trimmed title.
 */
export function resolveUnitFields(
  code: string | null | undefined,
  title: string | null | undefined
): { code: string; title: string } {
  const c = (code  ?? "").trim();
  const t = (title ?? "").trim();

  const codeIsCode  = UNIT_CODE_RE.test(c);
  const titleIsCode = UNIT_CODE_RE.test(t);

  // Swap detected: "code" field holds the display name, "title" holds the code.
  if (!codeIsCode && titleIsCode) {
    return { code: normalizeUnitCode(t), title: c };
  }

  return { code: normalizeUnitCode(c), title: t };
}
