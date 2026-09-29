// Turning an uploaded table into columns the sandbox can use: guess each
// column's type, flag the ones that can't be used, and encode values for
// estimation. No page code here, so it can be tested on its own.

export const MAX_ROWS = 50000;
export const MAX_CATEGORIES = 12;

export const Kind = Object.freeze({
  NUMERIC: "numeric", // a number with a meaningful scale
  BINARY: "binary", // exactly two values; one is "yes"
  ORDERED: "ordered", // a few categories with a natural order (low < mid < high)
  CATEGORIES: "categories", // a few categories with no order; can be adjusted for only
  EXCLUDE: "exclude",
});

export const KIND_LABELS = {
  [Kind.NUMERIC]: "Number",
  [Kind.BINARY]: "Yes / no",
  [Kind.ORDERED]: "Ordered categories",
  [Kind.CATEGORIES]: "Categories",
  [Kind.EXCLUDE]: "Don't use",
};

const MISSING = new Set(["", "na", "n/a", "nan", "null", "none", "-", "?", "#n/a"]);
export const isMissing = (v) => v === null || v === undefined || MISSING.has(String(v).trim().toLowerCase());

const asNumber = (v) => {
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

// Order text levels sensibly: by number if every level is numeric, otherwise
// by a known low-to-high vocabulary, otherwise alphabetically.
const SCALE = ["none", "very low", "low", "lower", "small", "medium", "mid", "moderate", "average",
  "high", "higher", "large", "very high"];
const scaleRank = (l) => {
  const words = l.toLowerCase();
  const hit = SCALE.findIndex((w) => words === w || words.startsWith(`${w} `));
  return hit === -1 ? Infinity : hit;
};
function orderLevels(levels) {
  if (levels.every((l) => !Number.isNaN(asNumber(l)))) return [...levels].sort((a, b) => asNumber(a) - asNumber(b));
  return [...levels].sort((a, b) => scaleRank(a) - scaleRank(b) || a.localeCompare(b));
}

// For a yes/no column, "yes" is the level that isn't a negation
// ("University" over "No university", "Coastal" over "Non-coastal").
const NEGATION = /^(no|non|not|none|false|0|n)\b|^non-/i;
function positiveLevel(levels) {
  const affirmative = levels.filter((l) => !NEGATION.test(l));
  return affirmative.length === 1 ? affirmative[0] : levels[1];
}

/**
 * Guess how to use one column from its raw values.
 * Returns {kind, levels?, positive?, missing, distinct, note?}.
 */
export function inferColumn(values) {
  const present = values.filter((v) => !isMissing(v)).map((v) => String(v).trim());
  const missing = values.length - present.length;
  const distinctSet = new Set(present);
  const distinct = distinctSet.size;
  const base = { missing, distinct, numeric: false, levels: undefined };

  if (!present.length) return { ...base, kind: Kind.EXCLUDE, note: "Every value is missing." };
  if (distinct === 1) return { ...base, kind: Kind.EXCLUDE, note: "Only one value, so it can't explain anything." };

  const numeric = present.every((v) => !Number.isNaN(asNumber(v)));
  const levels = distinct <= MAX_CATEGORIES ? orderLevels([...distinctSet]) : undefined;
  base.numeric = numeric;
  base.levels = levels;

  if (distinct === 2) {
    return { ...base, kind: Kind.BINARY, levels, positive: positiveLevel(levels) };
  }
  if (numeric) {
    const nums = present.map(asNumber);
    const looksLikeId = distinct === present.length && present.length > 20 && nums.every(Number.isInteger);
    if (looksLikeId) {
      return { ...base, kind: Kind.EXCLUDE, note: "Every value is a different whole number, so this looks like an ID." };
    }
    return { ...base, kind: Kind.NUMERIC };
  }
  if (distinct === present.length && present.length > 20) {
    return { ...base, kind: Kind.EXCLUDE, note: "Every value is different, so this looks like a name or ID." };
  }
  if (!levels) {
    return { ...base, kind: Kind.EXCLUDE, note: `${distinct} different values is too many to use as categories.` };
  }
  // Every level is a step on a familiar scale (low / medium / high): ordered.
  const ordered = levels.every((l) => scaleRank(l) !== Infinity);
  return { ...base, kind: ordered ? Kind.ORDERED : Kind.CATEGORIES, levels };
}

/**
 * Build the column list from parsed rows (first row = headers).
 * Each column gets a safe id ("c0", "c1", …) and keeps its header as a label.
 */
export function readTable(rows) {
  if (!rows.length) throw new Error("The file is empty.");
  const [header, ...body] = rows;
  const data = body.filter((r) => r.some((v) => !isMissing(v)));
  if (!data.length) throw new Error("The file has headers but no rows of data.");
  const truncated = data.length > MAX_ROWS;
  const used = truncated ? data.slice(0, MAX_ROWS) : data;

  const seen = new Map();
  const columns = header.map((raw, i) => {
    let label = String(raw ?? "").trim() || `Column ${i + 1}`;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    if (n > 1) label = `${label} (${n})`;
    const values = used.map((r) => r[i]);
    return { id: `c${i}`, label, values, ...inferColumn(values) };
  });
  return { columns, rows: used.length, truncated, totalRows: data.length };
}

/** The ways a column could be used, given its values. */
export function allowedKinds(col) {
  const kinds = [];
  if (col.numeric) kinds.push(Kind.NUMERIC);
  if (col.distinct === 2) kinds.push(Kind.BINARY);
  if (col.levels && col.distinct >= 2) kinds.push(Kind.ORDERED, Kind.CATEGORIES);
  kinds.push(Kind.EXCLUDE);
  return kinds;
}

/** Can this column be a treatment or outcome? Unordered categories can only be adjusted for. */
export const estimable = (col) => [Kind.NUMERIC, Kind.BINARY, Kind.ORDERED].includes(col.kind);

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

/** Rows with a value in every one of `ids`, encoded. Returns {data: {id: values[]}, dropped}. */
export function completeRows(table, ids) {
  const cols = ids.map((id) => table.columns.find((c) => c.id === id));
  const data = Object.fromEntries(ids.map((id) => [id, []]));
  let dropped = 0;
  for (let r = 0; r < table.rows; r++) {
    const row = cols.map((c) => encode(c, c.values[r]));
    if (row.some((v) => v === null)) {
      dropped++;
      continue;
    }
    row.forEach((v, i) => data[ids[i]].push(v));
  }
  return { data, dropped, n: table.rows - dropped };
}
