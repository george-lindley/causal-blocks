// Reading a crowd, the way the player is asked to: compare the two columns.
// Pure functions, shared by the game and the level validator (run in Node).

/** Thresholds for what counts as a link. Between them a level is ambiguous. */
export const LINK = 0.15; // columns differ by at least this share: a link
export const NO_LINK = 0.05; // columns within this share: no link

/** Expand a level's crowd, written as groups with counts, into one entry per person. */
export function people(groups) {
  const out = [];
  for (const { n, ...values } of groups) {
    for (let k = 0; k < n; k++) out.push({ id: out.length, ...values });
  }
  return out;
}

/**
 * The difference between the columns: the share of `row` yes among `col`
 * yes, minus the same among `col` no. Null when a column is empty, because
 * then there is nothing to compare.
 */
export function linkStrength(crowd, col, row) {
  const share = (v) => {
    const c = crowd.filter((p) => p[col] === v);
    return c.length ? c.filter((p) => p[row]).length / c.length : null;
  };
  const yes = share(true);
  const no = share(false);
  return yes === null || no === null ? null : yes - no;
}

export const hasLink = (d) => d !== null && Math.abs(d) >= LINK;
export const noLink = (d) => d !== null && Math.abs(d) <= NO_LINK;
