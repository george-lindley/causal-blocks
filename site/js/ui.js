// Small pieces of result display shared by the demo and "Try your own data".

/** +0.70 / −1.28, with a real minus sign and no "−0.00". */
export function fmt(x, digits = 2) {
  const s = Math.abs(x).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return (x < 0 ? "−" : "+") + s;
}

/** The estimate and its 95% interval on a line through zero, with an optional hollow comparison marker. */
export function intervalSvg(r, naive) {
  const vals = [...r.ci, r.effect, ...(naive ? [...naive.ci, naive.effect] : [])].map(Math.abs);
  const m = Math.max(...vals, 1e-6) * 1.15;
  const x = (v) => 160 + (v / m) * 145;
  const parts = [
    `<line x1="15" x2="305" y1="34" y2="34" stroke="var(--line)" stroke-width="1.5"/>`,
    `<line x1="160" x2="160" y1="12" y2="56" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`,
    `<text x="160" y="70" text-anchor="middle">0</text>`,
  ];
  if (naive) {
    parts.push(
      `<line x1="${x(naive.ci[0])}" x2="${x(naive.ci[1])}" y1="46" y2="46" stroke="var(--muted)" stroke-width="2" opacity="0.6"/>`,
      `<circle cx="${x(naive.effect)}" cy="46" r="4.5" fill="var(--surface)" stroke="var(--muted)" stroke-width="2"/>`,
    );
  }
  parts.push(
    `<line x1="${x(r.ci[0])}" x2="${x(r.ci[1])}" y1="26" y2="26" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>`,
    `<circle cx="${x(r.effect)}" cy="26" r="7" fill="var(--role-treatment)" stroke="var(--ink)" stroke-width="2"/>`,
  );
  return `<svg class="interval" viewBox="0 0 320 76" role="img" aria-label="Estimate ${fmt(r.effect)} with 95% interval ${fmt(r.ci[0])} to ${fmt(r.ci[1])}${naive ? `; unadjusted ${fmt(naive.effect)}` : ""}">${parts.join("")}</svg>`;
}
