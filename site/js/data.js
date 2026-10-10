// How each dataset column is used, and encoding its values for estimation.

export const Kind = Object.freeze({
  NUMERIC: "numeric", // a number with a meaningful scale
  BINARY: "binary", // exactly two values; one is "yes"
  ORDERED: "ordered", // a few categories with a natural order (low < mid < high)
  CATEGORIES: "categories", // a few categories with no order; can be adjusted for only
});

const MISSING = new Set(["", "na", "n/a", "nan", "null", "none", "-", "?", "#n/a"]);
const isMissing = (v) => v === null || v === undefined || MISSING.has(String(v).trim().toLowerCase());

const asNumber = (v) => {
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Encode one value of a column for estimation. Numbers stay numbers, yes/no
 * becomes 1/0, ordered categories become their position (0, 1, 2…), and
 * unordered categories stay text (for one-hot encoding). Missing -> null.
 */
export function encode(col, raw) {
  if (isMissing(raw)) return null;
  const v = String(raw).trim();
  switch (col.kind) {
    case Kind.NUMERIC: {
      const n = asNumber(v);
      return Number.isNaN(n) ? null : n;
    }
    case Kind.BINARY:
      return v === col.positive ? 1 : 0;
    case Kind.ORDERED: {
      const i = col.levels.indexOf(v);
      return i === -1 ? null : i;
    }
    case Kind.CATEGORIES:
      return v;
    default:
      return null;
  }
}
