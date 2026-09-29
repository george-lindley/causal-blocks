// The demo page: a canvas of blocks over the ONS towns data, with DoWhy's
// estimate for whatever graph is drawn. Graph logic lives in causal.js; every
// number comes from data/demo.json (see scripts/build_demo_data.py).

import { ROLE_TEXT, createBoard } from "./board.js";
import { Role, dowhyBackdoor, primaryRole, roles } from "./causal.js";

// How to say "one unit of X" and "a change in Y" in words, per variable.
// Plain-English pieces for the headline sentence. As a treatment, each
// variable is a kind of town and a unit of comparison; as an outcome, it says
// how that town differs, given the size and sign of the effect.
const WORDS = {
  town_size: {
    same: "every town were the same size",
    towns: "Larger towns",
    per: "Per size band (small → medium → large)",
    differ: (x, up) => `are ${x} size bands ${up ? "larger" : "smaller"}`,
  },
  education_score: {
    same: "every town had the same education score",
    towns: "Towns with a higher education score",
    per: "Per point of education score",
    differ: (x, up) => `score ${x} points ${up ? "higher" : "lower"} on education`,
  },
  deprivation: {
    same: "every town were equally deprived",
    towns: "More deprived towns",
    per: "Per deprivation band (lower → mid → higher)",
    differ: (x, up) => `are ${x} deprivation bands ${up ? "more" : "less"} deprived`,
  },
  adult_qualifications: {
    same: "every town had the same share of adults with degrees",
    towns: "Towns with more adults holding degrees",
    per: "Per band of adults with degrees (low → medium → high)",
    differ: (x, up) => `sit ${x} bands ${up ? "higher" : "lower"} on adults with degrees`,
  },
  coastal: {
    same: "no town differed in being coastal",
    towns: "Coastal towns",
    per: "Compared with inland towns",
    differ: (x, up) => `are ${pp(x)} percentage points ${up ? "more" : "less"} likely to be on the coast`,
  },
  university: {
    same: "no town differed in having a university",
    towns: "Towns with a university",
    per: "Compared with towns without one",
    differ: (x, up) => `are ${pp(x)} percentage points ${up ? "more" : "less"} likely to have a university`,
  },
};
const pp = (x) => (Number(x) * 100).toFixed(1);

// Our graph first, then the two mistakes it argues against. A mistake preset
// is drawn as a red button so no one mistakes it for a recommendation.
const EVERYTHING = ["region", "deprivation", "university", "coastal", "adult_qualifications"];
const PRESETS = {
  deprivation: {
    label: "The deprivation story",
    caption: "Larger towns tend to be more deprived, and deprivation drives attainment. Compare the total effect with the direct effect below it.",
    pos: {
      region: [24, 40], coastal: [24, 380], town_size: [240, 130],
      deprivation: [350, 330], education_score: [620, 215],
    },
    edges: [
      ["region", "town_size"], ["region", "deprivation"], ["coastal", "deprivation"],
      ["town_size", "deprivation"], ["town_size", "education_score"], ["deprivation", "education_score"],
    ],
  },
  ons: {
    label: "ONS: size alone",
    mistake: true,
    caption: "Mistake: reading a correlation as an effect. This is the ONS comparison, town size and attainment with nothing else in the graph.",
    pos: { town_size: [190, 205], education_score: [480, 205] },
    edges: [["town_size", "education_score"]],
  },
  everything: {
    label: "Control for everything",
    mistake: true,
    caption: "Mistake: controlling for everything. Every variable is drawn as a background cause, so deprivation is held fixed too, and the result gets reported as the effect of town size.",
    pos: {
      region: [30, 30], deprivation: [318, 30], university: [606, 30],
      town_size: [150, 205], education_score: [486, 205],
      coastal: [150, 384], adult_qualifications: [486, 384],
    },
    edges: [
      ...EVERYTHING.flatMap((v) => [[v, "town_size"], [v, "education_score"]]),
      ["town_size", "education_score"],
    ],
  },
};

const REFUTERS = {
  random_common_cause: {
    name: "Add a random common cause",
    expect: "The estimate should barely move.",
  },
  placebo_treatment_refuter: {
    name: "Swap the treatment for a shuffled copy",
    expect: "The effect should collapse towards zero.",
  },
  data_subset_refuter: {
    name: "Re-run on random 80% subsets",
    expect: "The estimate should stay about the same.",
  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  vars: [], // from demo.json
  results: null,
  treatment: "town_size",
  outcome: "education_score",
  preset: "deprivation",
  seen: new Map(), // result key -> {adjust, effect}, for the current treatment/outcome
  toastTimer: null,
  // For "your last change didn't move the estimate": the last graph structure
  // seen, the adjustment set it produced, and whether the latest edit kept it.
  lastGraph: null,
  lastAdjust: null,
  unchanged: false,
};

const $ = (id) => document.getElementById(id);
const byId = (id) => state.vars.find((v) => v.id === id);
const label = (id) => byId(id)?.label ?? id;
const estimable = () => state.vars.filter((v) => v.kind !== "nominal");

function fmt(x, digits = 2) {
  const s = Math.abs(x).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return (x < 0 ? "−" : "+") + s;
}

function listText(ids) {
  const names = ids.map(label);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => (t.hidden = true), 5000);
}

// ---------------------------------------------------------------------------
// Graph edits
// ---------------------------------------------------------------------------

function loadPreset(key) {
  const p = PRESETS[key];
  state.preset = key;
  $("caption").textContent = p.caption;
  $("caption").classList.toggle("mistake", Boolean(p.mistake));
  $("caption").hidden = false;
  board.load(p.pos, p.edges);
  state.treatment = "town_size";
  state.outcome = "education_score";
  update();
}

function edited() {
  state.preset = null;
  $("caption").hidden = true;
}

const board = createBoard($("canvas"), {
  label,
  locked: (id) => id === state.treatment || id === state.outcome,
  onEdit: edited,
  onChange: () => update(),
  toast,
});

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function analyse() {
  const g = board.graph();
  const r = roles(g, state.treatment, state.outcome);
  const id = dowhyBackdoor(g, state.treatment, state.outcome);
  return { g, roles: r, id };
}

function resultFor(adjust) {
  if (!state.results) return null;
  return state.results[`${state.treatment}|${state.outcome}|${[...adjust].sort().join(",")}`] ?? null;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function drawControls() {
  const chip = ([key, p]) => {
    const b = document.createElement("button");
    b.className = p.mistake ? "chip mistake" : "chip";
    b.type = "button";
    b.textContent = p.label;
    b.setAttribute("aria-pressed", String(state.preset === key));
    b.addEventListener("click", () => loadPreset(key));
    return b;
  };
  const entries = Object.entries(PRESETS);
  const mistakes = document.createElement("span");
  mistakes.className = "label mistakes-label";
  mistakes.textContent = "Common mistakes";
  $("presets").replaceChildren(
    ...entries.filter(([, p]) => !p.mistake).map(chip),
    mistakes,
    ...entries.filter(([, p]) => p.mistake).map(chip),
  );

  const unplaced = state.vars.filter((v) => !board.has(v.id));
  $("tray").replaceChildren(...(unplaced.length ? unplaced.map((v) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `+ ${v.label}`;
    b.title = v.description;
    b.addEventListener("click", () => { board.place(v.id); update(); });
    return b;
  }) : [Object.assign(document.createElement("span"), { className: "empty", textContent: "Every column is on the canvas." })]));

  for (const [sel, current] of [["treatment", state.treatment], ["outcome", state.outcome]]) {
    const s = $(sel);
    s.replaceChildren(...estimable().map((v) => new Option(v.label, v.id, false, v.id === current)));
  }

  const shown = [Role.CONFOUNDER, Role.MEDIATOR, Role.COLLIDER, Role.INSTRUMENT, Role.PRECISION, Role.UNRELATED];
  $("legend").innerHTML = shown
    .map((r) => `<span><i style="background: var(--role-${r})"></i>${ROLE_TEXT[r]}</span>`)
    .join("");
}

const WOULD = { score: "would score", are: "would be", sit: "would sit", show: "would show" };

/** "Larger towns score 0.70 points lower on education." With would: "...would score...". */
function headline(value, would = false) {
  const t = WORDS[state.treatment];
  const size = Math.abs(value).toFixed(2);
  const phrase = Number(size) === 0
    ? `show no difference in ${label(state.outcome).toLowerCase()}`
    : WORDS[state.outcome].differ(size, value > 0);
  return `${t.towns} ${would ? phrase.replace(/^\w+/, (v) => WOULD[v] ?? v) : phrase}.`;
}

function intervalSvg(r, naive) {
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

function drawPanel(analysis) {
  const result = $("result");
  const reading = $("reading");
  const checks = $("checks");
  if (!state.results) return;

  const { g, roles: roleMap, id } = analysis;
  const T = label(state.treatment);
  const Y = label(state.outcome);
  const naive = resultFor([]);

  if (id.noDirectedPath) {
    result.innerHTML = `
      <span class="label">DoWhy estimate</span>
      <div class="estimate-value zero">0</div>
      <p class="lede">Your graph has no path of arrows from ${T} to ${Y}, so it claims ${T} has no effect at all.
        DoWhy takes that at face value and does not estimate anything.</p>
      ${naive ? `<p class="meta" style="margin-top:10px">For comparison, the raw association in the data is <span class="mono">${fmt(naive.effect)}</span>. If you believe ${T} matters, draw the arrows that say how.</p>` : ""}`;
    reading.hidden = checks.hidden = true;
    drawHistory(null, null);
    return;
  }
  if (!id.adjustmentSet) {
    result.innerHTML = `<span class="label">DoWhy estimate</span><p class="lede">DoWhy found no set of variables that closes every backdoor path in this graph.</p>`;
    reading.hidden = checks.hidden = true;
    return;
  }

  const adjust = id.adjustmentSet;
  const r = resultFor(adjust);
  const sign = Math.abs(r.effect) < 0.005 ? "zero" : r.effect < 0 ? "neg" : "pos";
  const excludesZero = r.ci[0] > 0 || r.ci[1] < 0;

  // With a mediator, the total effect hides the direct one. Show both: the
  // difference between them is what flows through the mediator.
  const mediatorIds = Object.keys(roleMap).filter((n) => roleMap[n].includes(Role.MEDIATOR));
  let direct = "";
  if (mediatorIds.length) {
    const dId = dowhyBackdoor(g, state.treatment, state.outcome, { directEffect: true });
    const d = dId.adjustmentSet ? resultFor(dId.adjustmentSet) : null;
    if (d) {
      const via = listText(mediatorIds);
      direct = `<div class="direct">
        <span class="label">Direct effect, holding ${via} fixed</span>
        <p class="headline">If ${mediatorIds.length === 1 ? WORDS[mediatorIds[0]].same : `${via} were the same in every town`},
          ${headline(d.effect, true).replace(/^./, (c) => c.toLowerCase())} <span class="mono">${fmt(d.effect)}</span></p>
        <p class="lede">The difference between the two, <span class="mono">${fmt(r.effect - d.effect)}</span>, is the part that runs through ${via}.
          95% interval <span class="mono">${fmt(d.ci[0])}</span> to <span class="mono">${fmt(d.ci[1])}</span>.</p>
      </div>`;
    }
  }
  const adjustedText = adjust.length ? `adjusting for <b>${listText(adjust)}</b>` : "with <b>no adjustment</b>";

  result.innerHTML = `
    <span class="label">${direct ? "Total effect" : "DoWhy estimate"}, ${adjust.length ? `adjusting for ${listText(adjust)}` : "no adjustment"}</span>
    <div class="estimate-value ${sign}">${fmt(r.effect)}</div>
    <p class="headline">${headline(r.effect)}</p>
    <p class="lede">${WORDS[state.treatment].per}, if your graph is right.</p>
    ${intervalSvg(r, adjust.length ? naive : null)}
    <p class="meta">95% interval <span class="mono">${fmt(r.ci[0])}</span> to <span class="mono">${fmt(r.ci[1])}</span>.
      ${excludesZero ? "It does not include zero." : "It includes zero, so the data cannot tell this apart from no effect."}
      ${adjust.length && naive ? ` The hollow marker is the raw association with no adjustment: <span class="mono">${fmt(naive.effect)}</span>.` : ""}</p>
    ${direct}`;

  // What the graph did to the estimate
  const of = (role) => Object.keys(roleMap).filter((n) => primaryRole(roleMap[n]) === role);
  const notes = [];
  const note = (role, html) => notes.push(`<li><span class="sw" style="background: var(--role-${role})"></span><span>${html}</span></li>`);

  if (state.unchanged) {
    note(Role.TREATMENT, `<b>Your last change didn't change what DoWhy adjusts for</b>, so the estimate stayed the same.
      Only arrows that open or close a backdoor path into ${T} move the number.`);
  }
  note(Role.TREATMENT, `DoWhy read your graph and estimated ${adjustedText}. That choice comes from the arrows, not from the data.`);
  if (!g.edges.some(([, c]) => c === state.treatment)) {
    note(Role.TREATMENT, `Nothing in your graph points into ${T}, so there are no backdoor paths to close.
      Every graph where ${T} has no causes gives this same answer: the raw association.
      To change it, draw an arrow into ${T} from something that also affects ${Y}.`);
  }

  const mediators = of(Role.MEDIATOR);
  if (mediators.length) {
    note(Role.MEDIATOR, `This is the <b>total effect</b>. It includes the part of the effect that runs through ${listText(mediators)}.
      Holding it fixed answers a different question, the direct effect, shown under the total.`);
  }
  const blocked = of(Role.CONFOUNDER).filter((n) => !adjust.includes(n));
  if (blocked.length) {
    note(Role.CONFOUNDER, `${listText(blocked)} ${blocked.length > 1 ? "are confounders" : "is a confounder"}, but adjusting for ${listText(adjust)} already blocks ${blocked.length > 1 ? "their paths" : "its path"}, so DoWhy leaves ${blocked.length > 1 ? "them" : "it"} out.`);
  }
  const colliders = of(Role.COLLIDER).filter((n) => !adjust.includes(n));
  if (colliders.length) {
    note(Role.COLLIDER, `${listText(colliders)} ${colliders.length > 1 ? "are colliders" : "is a collider"}: two arrows meet there. Adjusting for ${colliders.length > 1 ? "them" : "it"} would open a path and create bias, so DoWhy doesn't.`);
  }
  const instruments = of(Role.INSTRUMENT);
  if (instruments.length) {
    note(Role.INSTRUMENT, `${listText(instruments)} only reaches ${Y} through ${T}. Adjusting for it would add noise without removing bias.`);
  }
  const precision = of(Role.PRECISION);
  if (precision.length) {
    note(Role.PRECISION, `${listText(precision)} only affects ${Y}. It can't bias this estimate, so it is left out.`);
  }
  const multi = Object.entries(roleMap).filter(([n, rs]) => rs.length > 1 && n !== state.treatment && n !== state.outcome);
  for (const [n, rs] of multi) {
    note(primaryRole(rs), `${label(n)} plays two roles at once (${rs.map((x) => ROLE_TEXT[x].toLowerCase()).join(" and ")}). No adjustment choice for it is clean.`);
  }
  const missing = state.vars.filter((v) => !board.has(v.id)).map((v) => v.id);
  if (missing.length) {
    note(Role.UNRELATED, `Not on your canvas: ${listText(missing)}. Leaving a block off says it does not cause both ${T} and ${Y}. If it does, this estimate is biased.`);
  }

  reading.innerHTML = `<h2>What your graph did</h2><ul class="notes">${notes.join("")}</ul>`;
  reading.hidden = false;

  const rows = Object.entries(REFUTERS).map(([key, info]) => {
    const ref = r.refutations[key];
    const pass = ref.p === null || ref.p >= 0.05;
    return `<div class="check">
      <dt>${info.name}</dt>
      <dd>${info.expect} Got <span class="mono">${fmt(ref.new_effect)}</span>${ref.p === null ? "" : `, p = <span class="mono">${ref.p.toFixed(2)}</span>`}.</dd>
      <span class="pill ${pass ? "pass" : "flag"}">${pass ? "Passed" : "Flagged"}</span>
    </div>`;
  });
  const allPass = Object.values(r.refutations).every((ref) => ref.p === null || ref.p >= 0.05);
  checks.innerHTML = `
    <h2>DoWhy's robustness checks</h2>
    <dl class="checks">${rows.join("")}</dl>
    ${allPass ? "" : `<p class="caution"><strong>Something is off.</strong>
      At least one check failed, so this estimate is fragile even if your graph is right.</p>`}`;
  checks.hidden = false;

  drawHistory(adjust, r);
}

function drawHistory(adjust, r) {
  const box = $("history");
  const k = adjust ? adjust.join(",") : null;
  if (adjust && !state.seen.has(k)) state.seen.set(k, { adjust, effect: r.effect });
  if (state.seen.size < 2) {
    box.hidden = true;
    return;
  }
  const items = [...state.seen.entries()].map(([key, s]) => `
    <li class="${key === k ? "current" : ""}">
      <span>${s.adjust.length ? `Adjusting for ${listText(s.adjust)}` : "No adjustment"}</span>
      <span class="mono">${fmt(s.effect)}</span>
    </li>`);
  box.innerHTML = `<h2>Same data, your answers so far</h2><ul class="history">${items.join("")}</ul>
    <p class="meta" style="margin-top:10px">Effect of ${label(state.treatment)} on ${label(state.outcome)}. Only the graph changed.</p>`;
  box.hidden = false;
}

// Did the latest edit leave DoWhy's adjustment set where it was? Moving or
// selecting blocks is not an edit, so only the graph's structure is compared.
function trackChange({ g, id }) {
  const graph = [
    state.treatment,
    state.outcome,
    [...g.nodes].sort().join(),
    g.edges.map((e) => e.join(">")).sort().join(),
  ].join("|");
  if (graph === state.lastGraph) return;
  const adjust = id.noDirectedPath ? "no-path" : (id.adjustmentSet ?? []).join();
  state.unchanged = state.lastGraph !== null && state.preset === null && adjust === state.lastAdjust;
  state.lastGraph = graph;
  state.lastAdjust = adjust;
}

function update() {
  let analysis;
  try {
    analysis = analyse();
  } catch (err) {
    toast(err.message);
    return;
  }
  trackChange(analysis);
  board.draw(analysis.roles);
  drawControls();
  drawPanel(analysis);
}

function setQuestion(which, value) {
  const other = which === "treatment" ? "outcome" : "treatment";
  if (state[other] === value) state[other] = state[which]; // swap rather than collide
  state[which] = value;
  board.place(value);
  board.place(state[other]);
  state.seen.clear();
  state.lastGraph = null; // a new question is not an edit to the old one
  update();
}
$("treatment").addEventListener("change", (e) => setQuestion("treatment", e.target.value));
$("outcome").addEventListener("change", (e) => setQuestion("outcome", e.target.value));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const demo = await fetch("data/demo.json").then((r) => r.json());
state.vars = demo.variables;
state.results = demo.results;
loadPreset("deprivation");
