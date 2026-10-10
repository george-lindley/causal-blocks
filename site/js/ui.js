// Number formatting for results.

/** +0.70 / −1.28, with a real minus sign and no "−0.00". */
export function fmt(x, digits = 2) {
  const s = Math.abs(x).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return (x < 0 ? "−" : "+") + s;
}
