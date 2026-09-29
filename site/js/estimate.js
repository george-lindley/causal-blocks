// DoWhy's backdoor linear-regression estimate, in JavaScript, so "Try your own
// data" can answer instantly. Mirrors dowhy 0.14:
//   - LinearRegressionEstimator: OLS of outcome on [constant, treatment,
//     adjustment set], categories one-hot encoded with the first level dropped;
//     effect = treatment coefficient; 95% interval and p-value from the t
//     distribution, as statsmodels reports them.
//   - The refuters random_common_cause, placebo_treatment_refuter (permute)
//     and data_subset_refuter (80%), with DoWhy's significance tests.
// tests/test_estimate_parity.py checks the estimate against DoWhy itself.

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued fraction for the regularised incomplete beta function.
function betacf(a, b, x) {
  const EPS = 1e-15;
  const FPMIN = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** P(T > |t|) * 2 for Student's t with df degrees of freedom. */
export function tTwoSided(t, df) {
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** The t value with P(|T| > t) = alpha. */
export function tCritical(alpha, df) {
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSided(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function normalCdf(z) {
  // Abramowitz & Stegun 7.1.26 via erf; accurate to ~1e-7, ample for a p-value.
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
    * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// ---------------------------------------------------------------------------
// Least squares
// ---------------------------------------------------------------------------

export class CollinearError extends Error {}

/**
 * Ordinary least squares via the normal equations and a Cholesky factor.
 * X is an array of rows (each already including the constant). Returns
 * {beta, se, df} or throws CollinearError if columns repeat information.
 */
export function ols(X, y) {
  const n = X.length;
  const p = X[0].length;
  const xtx = Array.from({ length: p }, () => new Float64Array(p));
  const xty = new Float64Array(p);
  for (let r = 0; r < n; r++) {
    const row = X[r];
    for (let i = 0; i < p; i++) {
      const xi = row[i];
      if (xi === 0) continue;
      xty[i] += xi * y[r];
      for (let j = 0; j <= i; j++) xtx[i][j] += xi * row[j];
    }
  }
  // Cholesky: xtx = L Lᵀ
  const L = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = xtx[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (sum <= 1e-10 * Math.max(1, xtx[i][i])) throw new CollinearError("columns repeat information");
        L[i][i] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  const solve = (b) => {
    const z = new Float64Array(p);
    for (let i = 0; i < p; i++) {
      let s = b[i];
      for (let k = 0; k < i; k++) s -= L[i][k] * z[k];
      z[i] = s / L[i][i];
    }
    const x = new Float64Array(p);
    for (let i = p - 1; i >= 0; i--) {
      let s = z[i];
      for (let k = i + 1; k < p; k++) s -= L[k][i] * x[k];
      x[i] = s / L[i][i];
    }
    return x;
  };
  const beta = solve(xty);
  let rss = 0;
  for (let r = 0; r < n; r++) {
    let fit = 0;
    for (let i = 0; i < p; i++) fit += X[r][i] * beta[i];
    rss += (y[r] - fit) ** 2;
  }
  const df = n - p;
  const sigma2 = rss / df;
  // Only the treatment's variance is needed: (XᵀX)⁻¹[1][1].
  const e1 = new Float64Array(p);
  e1[1] = 1;
  const inv1 = solve(e1);
  return { beta, se1: Math.sqrt(sigma2 * inv1[1]), df };
}

// ---------------------------------------------------------------------------
// Design matrix
// ---------------------------------------------------------------------------

/**
 * Columns for one adjustment variable: a number stays one column; text
 * categories become one column per level except the first (sorted), as
 * DoWhy's OneHotEncoder(drop="first") does.
 */
function adjustmentColumns(values, categorical) {
  if (!categorical) return [values];
  const levels = [...new Set(values.map(String))].sort();
  return levels.slice(1).map((lvl) => values.map((v) => (String(v) === lvl ? 1 : 0)));
}

function design(data, spec, overrides = {}) {
  const t = overrides.treatment ?? data[spec.treatment];
  const cols = [t];
  for (const z of spec.adjust) cols.push(...adjustmentColumns(data[z], spec.categorical.has(z)));
  if (overrides.extra) cols.push(overrides.extra);
  const n = t.length;
  return Array.from({ length: n }, (_, r) => [1, ...cols.map((c) => Number(c[r]))]);
}

function subset(data, rows) {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, rows.map((r) => v[r])]));
}

/**
 * The effect of spec.treatment on spec.outcome, adjusting for spec.adjust.
 * `data` maps column id -> values (complete rows only). spec.categorical is
 * a Set of adjustment ids to one-hot encode.
 */
export function estimateEffect(data, spec) {
  const y = data[spec.outcome].map(Number);
  const fit = ols(design(data, spec), y);
  const effect = fit.beta[1];
  const tc = tCritical(0.05, fit.df);
  return {
    effect,
    ci: [effect - tc * fit.se1, effect + tc * fit.se1],
    p: tTwoSided(effect / fit.se1, fit.df),
    n: y.length,
  };
}

// ---------------------------------------------------------------------------
// Refutations
// ---------------------------------------------------------------------------

/** Small seedable generator (mulberry32), so a result is the same on every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function shuffle(values, rand) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// DoWhy's test_significance with test_type="auto".
function significance(value, sims) {
  if (sims.length >= 100) {
    const half = mean(sims.map((x) => (x > value ? 1 : 0) + (x === value ? 0.5 : 0)));
    return 2 * Math.min(half, 1 - half);
  }
  const m = mean(sims);
  const sd = Math.sqrt(mean(sims.map((x) => (x - m) ** 2)));
  const z = (value - m) / sd;
  return z > 0 ? 1 - normalCdf(z) : normalCdf(z);
}

/**
 * DoWhy's three refutations of an estimate. Fewer simulations are used on
 * very large data so the page stays responsive; DoWhy's own run confirms.
 */
export function refute(data, spec, estimate, { simulations = 100, seed = 20260927 } = {}) {
  const rand = rng(seed);
  const y = data[spec.outcome].map(Number);
  const n = y.length;
  const refit = (X, yy = y) => ols(X, yy).beta[1];

  const common = [];
  const placebo = [];
  const subsetSims = [];
  const keep = Math.round(n * 0.8);
  for (let s = 0; s < simulations; s++) {
    const w = Array.from({ length: n }, () => gaussian(rand));
    common.push(refit(design(data, spec, { extra: w })));
    placebo.push(refit(design(data, spec, { treatment: shuffle(data[spec.treatment], rand) })));
    const rows = shuffle([...Array(n).keys()], rand).slice(0, keep);
    const part = subset(data, rows);
    subsetSims.push(refit(design(part, spec), part[spec.outcome].map(Number)));
  }
  return {
    random_common_cause: { new_effect: mean(common), p: significance(estimate.effect, common) },
    placebo_treatment_refuter: { new_effect: mean(placebo), p: significance(0, placebo) },
    data_subset_refuter: { new_effect: mean(subsetSims), p: significance(estimate.effect, subsetSims) },
    simulations,
  };
}

/** How many simulations keep the checks to roughly a second on this data. */
export function simulationBudget(n, p) {
  const perFit = n * p * p;
  return Math.max(20, Math.min(100, Math.floor(3e8 / (3 * perFit))));
}
