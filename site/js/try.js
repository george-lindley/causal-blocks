// "Try your own data": load a CSV, check how each column will be used, then
// draw a causal graph over the chosen columns on the shared board.

import { ROLE_TEXT, createBoard } from "./board.js";
import { CHARACTER } from "./names.js";
import { SAMPLES } from "./samples.js";
import { Role, dowhyBackdoor, primaryRole, roles } from "./causal.js";
import { KIND_LABELS, Kind, allowedKinds, completeRows, estimable, readTable } from "./data.js";
import { CollinearError, estimateEffect, refute, simulationBudget } from "./estimate.js";
import { fmt, intervalSvg } from "./ui.js";

const MAX_BLOCKS = 15;
const $ = (id) => document.getElementById(id);

const state = {
  sample: null, // which sample dataset is loaded (null for your own file)
  preset: null, // which of its preset graphs is showing (null once you edit it)
  table: null,
  fileName: "",
  treatment: null,
  outcome: null,
  toastTimer: null,
  seen: new Map(), // adjustment key -> {adjust, effect}, for the current question
  lastGraph: null, // for "your last change didn't move the estimate"
  lastAdjust: null,
  unchanged: false,
  run: 0, // guards the robustness checks against a graph that has since changed
  dowhy: { worker: null, state: "idle", message: "", version: "", verdict: null }, // verdict for state.run
};

const column = (id) => state.table.columns.find((c) => c.id === id);
const label = (id) => column(id)?.label ?? id;
const usable = () => state.table.columns.filter((c) => c.kind !== Kind.EXCLUDE);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => (t.hidden = true), 5000);
}

// ---------------------------------------------------------------------------
// 1. Load
// ---------------------------------------------------------------------------

function loadError(message) {
  const e = $("load-error");
  e.textContent = message;
  e.hidden = false;
}

function parse(source, name) {
  $("load-error").hidden = true;
  Papa.parse(source, {
    skipEmptyLines: "greedy",
    complete: (res) => {
      if (res.errors.length && !res.data.length) {
        loadError(`Couldn't read ${name} as a CSV: ${res.errors[0].message}.`);
        return;
      }
      try {
        state.table = readTable(res.data);
      } catch (err) {
        loadError(`Couldn't use ${name}: ${err.message}`);
        return;
      }
      state.fileName = name;
      state.sample = null;
      state.preset = null;
      renderPresets();
      state.treatment = state.outcome = null;
      startDoWhy();
      renderColumns();
      $("columns-step").hidden = false;
      $("draw-step").hidden = true;
      $("columns-step").scrollIntoView({ behavior: "smooth", block: "start" });
    },
    error: (err) => loadError(`Couldn't read ${name}: ${err.message}`),
  });
}

$("file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) parse(file, file.name);
});

const dz = $("dropzone");
dz.addEventListener("dragover", (e) => {
  e.preventDefault();
  dz.classList.add("over");
});
dz.addEventListener("dragleave", () => dz.classList.remove("over"));
dz.addEventListener("drop", (e) => {
  e.preventDefault();
  dz.classList.remove("over");
  const file = e.dataTransfer.files[0];
  if (file) parse(file, file.name);
});

// ---------------------------------------------------------------------------
// Samples: known columns, so straight onto the map with preset graphs
// ---------------------------------------------------------------------------

async function loadSample(key) {
  const sample = SAMPLES[key];
  const text = await fetch(sample.file).then((r) => r.text());
  Papa.parse(text, {
    skipEmptyLines: "greedy",
    complete: (res) => {
      state.table = readTable(res.data);
      for (const col of state.table.columns) {
        const how = sample.columns[col.label];
        if (!how) {
          col.kind = Kind.EXCLUDE;
          continue;
        }
        col.kind = how.kind;
        if (how.levels) col.levels = how.levels;
        if (how.positive) col.positive = how.positive;
      }
      state.fileName = sample.file.split("/").pop();
      state.sample = key;
      startDoWhy();
      $("columns-step").hidden = true;
      $("draw-step").hidden = false;
      usePreset(0);
      $("draw-step").scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });
}

/** Lay out one of the sample's preset graphs and show its numbers. */
function usePreset(i) {
  const sample = SAMPLES[state.sample];
  const p = sample.presets[i];
  const id = (name) => state.table.columns.find((c) => c.label === name).id;
  board.load(Object.fromEntries(Object.entries(p.pos).map(([n, xy]) => [id(n), xy])), p.edges.map(([a, b]) => [id(a), id(b)]));
  state.treatment = id(sample.cause);
  state.outcome = id(sample.effect);
  state.seen.clear();
  state.lastGraph = null;
  state.preset = i;
  renderPresets();
  update();
}

function renderPresets() {
  const sample = SAMPLES[state.sample];
  const bar = $("presets-bar");
  bar.hidden = !sample;
  if (!sample) return;
  const chip = (p, i) => `<button type="button" class="chip${p.mistake ? " mistake" : ""}" data-preset="${i}" aria-pressed="${state.preset === i}">${escapeHtml(p.name)}</button>`;
  const good = sample.presets.map((p, i) => [p, i]).filter(([p]) => !p.mistake);
  const bad = sample.presets.map((p, i) => [p, i]).filter(([p]) => p.mistake);
  $("presets").innerHTML = `<span class="label">Start from</span>${good.map(([p, i]) => chip(p, i)).join("")}
    ${bad.length ? `<span class="label mistakes-label">Common mistakes</span>${bad.map(([p, i]) => chip(p, i)).join("")}` : ""}`;
  $("preset-note").textContent = state.preset === null ? "" : sample.presets[state.preset].note;
  for (const b of $("presets").querySelectorAll("[data-preset]")) b.onclick = () => usePreset(Number(b.dataset.preset));
}

for (const b of document.querySelectorAll("[data-sample]")) b.addEventListener("click", () => loadSample(b.dataset.sample));
// A link like free-build.html?sample=towns opens that sample straight away.
const asked = new URLSearchParams(location.search).get("sample");
if (asked && SAMPLES[asked]) loadSample(asked);

// ---------------------------------------------------------------------------
// 2. Check columns
// ---------------------------------------------------------------------------

function range(col) {
  const nums = col.values.map(Number).filter(Number.isFinite);
  const fmt = (x) => (Math.abs(x) >= 1000 ? Math.round(x).toLocaleString() : +x.toFixed(2));
  return `${fmt(Math.min(...nums))} to ${fmt(Math.max(...nums))}`;
}

function valuesCell(col) {
  switch (col.kind) {
    case Kind.NUMERIC:
      return `<span class="meta">${range(col)}</span>`;
    case Kind.BINARY:
      return `<label class="inline">Yes means
        <select data-positive="${col.id}">${col.levels.map((l) =>
          `<option ${l === col.positive ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></label>`;
    case Kind.ORDERED:
      return `<span>${col.levels.map(escapeHtml).join(" &lt; ")}</span>
        <button type="button" class="link-button small" data-reverse="${col.id}">Reverse order</button>`;
    case Kind.CATEGORIES:
      return `<span class="meta">${col.levels.map(escapeHtml).join(", ")}</span>`;
    default:
      return `<span class="meta">${escapeHtml(col.note ?? "")}</span>`;
  }
}

function renderColumns() {
  const t = state.table;
  $("table-summary").textContent = `${state.fileName}: ${t.rows.toLocaleString()} rows, ${t.columns.length} columns.`
    + (t.truncated ? ` Only the first ${t.rows.toLocaleString()} of ${t.totalRows.toLocaleString()} rows are used.` : "");
  $("columns-table").querySelector("tbody").innerHTML = t.columns.map((col) => `
    <tr class="${col.kind === Kind.EXCLUDE ? "excluded" : ""}">
      <th scope="row">${escapeHtml(col.label)}</th>
      <td><select data-kind="${col.id}" aria-label="Use ${escapeHtml(col.label)} as">
        ${allowedKinds(col).map((k) => `<option value="${k}" ${k === col.kind ? "selected" : ""}>${KIND_LABELS[k]}</option>`).join("")}
      </select></td>
      <td>${valuesCell(col)}</td>
      <td class="num">${col.missing ? col.missing.toLocaleString() : "–"}</td>
    </tr>`).join("");
  const n = usable().length;
  const causes = t.columns.filter(estimable).length;
  $("usable-count").textContent = `${n} column${n === 1 ? "" : "s"} in use, ${causes} of them can be causes or effects.`;
  $("to-draw").disabled = causes < 2;
}

$("columns-table").addEventListener("change", (e) => {
  const { kind, positive } = e.target.dataset;
  if (kind) {
    const col = column(kind);
    col.kind = e.target.value;
    if (col.kind === Kind.BINARY && !col.positive) col.positive = col.levels[1];
  }
  if (positive) column(positive).positive = e.target.value;
  renderColumns();
  if (!$("draw-step").hidden) startDrawing(); // column choices changed the blocks available
});

$("columns-table").addEventListener("click", (e) => {
  const id = e.target.dataset.reverse;
  if (!id) return;
  column(id).levels.reverse();
  renderColumns();
});

// ---------------------------------------------------------------------------
// 3. Draw
// ---------------------------------------------------------------------------

const board = createBoard($("canvas"), {
  label,
  locked: (id) => id === state.treatment || id === state.outcome,
  onEdit: () => {
    if (state.preset !== null && state.preset !== undefined) {
      state.preset = null;
      renderPresets();
    }
  },
  onChange: () => update(),
  toast,
  roleText: CHARACTER,
  faces: true,
});

function startDrawing() {
  const ids = new Set(usable().map((c) => c.id));
  const keep = (id) => (ids.has(id) && estimable(column(id)) ? id : null);
  state.treatment = keep(state.treatment);
  state.outcome = keep(state.outcome);
  board.retain(ids);
  $("draw-step").hidden = false;
  update();
}

$("to-draw").addEventListener("click", () => {
  board.load({}, []);
  state.treatment = state.outcome = null;
  startDrawing();
  $("draw-step").scrollIntoView({ behavior: "smooth", block: "start" });
});

function drawControls() {
  const onCanvas = board.graph().nodes.length;
  const unplaced = usable().filter((c) => !board.has(c.id));
  $("tray").replaceChildren(...unplaced.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `+ ${c.label}`;
    b.disabled = onCanvas >= MAX_BLOCKS;
    b.title = onCanvas >= MAX_BLOCKS ? `Up to ${MAX_BLOCKS} blocks at once. Remove one to add another.` : `${c.label} (${KIND_LABELS[c.kind].toLowerCase()})`;
    b.addEventListener("click", () => {
      board.place(c.id);
      update();
    });
    return b;
  }));
  if (!unplaced.length) {
    $("tray").append(Object.assign(document.createElement("span"), { className: "empty", textContent: "Every column is on the canvas." }));
  }

  const choices = state.table.columns.filter(estimable);
  for (const which of ["treatment", "outcome"]) {
    const s = $(which);
    s.replaceChildren(
      new Option(which === "treatment" ? "Choose a cause" : "Choose an effect", "", true, !state[which]),
      ...choices.map((c) => new Option(c.label, c.id, false, c.id === state[which])),
    );
    s.options[0].disabled = true;
  }

  const shown = [Role.CONFOUNDER, Role.MEDIATOR, Role.COLLIDER, Role.INSTRUMENT, Role.PRECISION, Role.UNRELATED];
  $("legend").innerHTML = shown.map((r) => `<span><i style="background: var(--role-${r})"></i>${CHARACTER[r]}</span>`).join("");
}

// ---------------------------------------------------------------------------
// 4. Estimate
// ---------------------------------------------------------------------------

function listText(ids) {
  const names = ids.map((id) => `<b>${escapeHtml(label(id))}</b>`);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const quote = (s) => `“${escapeHtml(s)}”`;

/** "A one-unit increase in hours", "Cases where smoker is “yes”", "One step up in income band". */
function causePhrase(col) {
  const name = `<b>${escapeHtml(col.label)}</b>`;
  if (col.kind === Kind.BINARY) {
    // "Official English, rather than not," when the yes-value is just the column's own name.
    if (col.positive.trim().toLowerCase() === col.label.trim().toLowerCase()) return `${name}, rather than not,`;
    return `${name} being ${quote(col.positive)}, rather than not,`;
  }
  if (col.kind === Kind.ORDERED) return `One step up in ${name}`;
  return `A one-unit increase in ${name}`;
}

/** "Steps: Low → Medium → High." for an ordered cause, shortened when long. */
function stepsNote(col) {
  if (col.kind !== Kind.ORDERED) return "";
  const l = col.levels.map(escapeHtml);
  return `Steps: ${(l.length > 5 ? [l[0], l[1], "…", l.at(-1)] : l).join(" → ")}. `;
}

/** "...changes exam score by +2.31." / "...changes the chance that passed is “yes” by +4.0 percentage points." */
function effectSentence(value, lead) {
  const out = column(state.outcome);
  const name = `<b>${escapeHtml(out.label)}</b>`;
  if (out.kind === Kind.BINARY) {
    return `${lead} changes the chance that ${name} is ${quote(out.positive)} by <b>${fmt(value * 100, 1)} percentage points</b>.`;
  }
  if (out.kind === Kind.ORDERED) return `${lead} moves ${name} by <b>${fmt(value)} steps</b>.`;
  return `${lead} changes ${name} by <b>${fmt(value)}</b>.`;
}

function specFor(adjust) {
  const categorical = new Set(adjust.filter((id) => [Kind.ORDERED, Kind.CATEGORIES].includes(column(id).kind)));
  return { treatment: state.treatment, outcome: state.outcome, adjust, categorical };
}

/** Estimate, or a plain-English reason it can't be done. */
function tryEstimate(data, adjust) {
  const spec = specFor(adjust);
  try {
    return { spec, result: estimateEffect(data, spec) };
  } catch (err) {
    if (err instanceof CollinearError) {
      return { spec, error: "Two of the columns being used carry the same information (or one never varies in these rows), so the regression can't tell them apart. Try removing one." };
    }
    return { spec, error: `Couldn't estimate this: ${err.message}.` };
  }
}

// Did the latest edit leave the adjustment set where it was? Moving or
// selecting blocks is not an edit, so only the graph's structure is compared.
function trackChange(g, id) {
  const graph = [state.treatment, state.outcome, [...g.nodes].sort().join(), g.edges.map((e) => e.join(">")).sort().join()].join("|");
  if (graph === state.lastGraph) return;
  const adjust = id.noDirectedPath ? "no-path" : (id.adjustmentSet ?? []).join();
  state.unchanged = state.lastGraph !== null && adjust === state.lastAdjust;
  state.lastGraph = graph;
  state.lastAdjust = adjust;
}

function hideCards(...ids) {
  for (const id of ids) $(id).hidden = true;
}

function drawResult(g, roleMap, id) {
  const T = `<b>${escapeHtml(label(state.treatment))}</b>`;
  const Y = `<b>${escapeHtml(label(state.outcome))}</b>`;
  const result = $("result");
  result.hidden = false;
  state.run++;

  const { data, dropped, n } = completeRows(state.table, g.nodes);
  const droppedNote = dropped
    ? `${dropped.toLocaleString()} row${dropped === 1 ? "" : "s"} with a missing value in a column on the canvas ${dropped === 1 ? "was" : "were"} left out, so ${n.toLocaleString()} are used.`
    : `All ${n.toLocaleString()} rows are used.`;
  if (n < 10) {
    result.innerHTML = `<span class="label">Estimate</span><p class="lede">Only ${n} row${n === 1 ? " has" : "s have"} a value in every column on the canvas. That's too few to estimate anything. Remove a block with many missing values.</p>`;
    hideCards("reading", "checks", "history");
    return;
  }

  const naive = tryEstimate(data, []).result;
  if (id.noDirectedPath) {
    result.innerHTML = `
      <span class="label">Estimate</span>
      <div class="estimate-value zero">0</div>
      <p class="lede">Your graph has no path of arrows from ${T} to ${Y}, so it claims ${T} has no effect at all. There's nothing to estimate.</p>
      ${naive ? `<p class="meta" style="margin-top:10px">For comparison, the raw association in the data is <span class="mono">${fmt(naive.effect)}</span>. If you believe ${T} matters, draw the arrows that say how.</p>` : ""}`;
    hideCards("reading", "checks");
    drawHistory(null, null);
    return;
  }

  const adjust = id.adjustmentSet ?? [];
  const main = tryEstimate(data, adjust);
  if (main.error) {
    result.innerHTML = `<span class="label">Estimate</span><p class="lede">${main.error}</p>`;
    hideCards("reading", "checks", "history");
    return;
  }
  const r = main.result;
  const excludesZero = r.ci[0] > 0 || r.ci[1] < 0;
  const cause = column(state.treatment);

  const mediators = Object.keys(roleMap).filter((k) => roleMap[k].includes(Role.MEDIATOR));
  let direct = "";
  if (mediators.length) {
    const dId = dowhyBackdoor(g, state.treatment, state.outcome, { directEffect: true });
    const d = dId.adjustmentSet ? tryEstimate(data, dId.adjustmentSet).result : null;
    if (d) {
      direct = `<div class="direct">
        <span class="label">Direct effect, holding ${mediators.map((m) => escapeHtml(label(m))).join(", ")} fixed</span>
        <p class="headline">${effectSentence(d.effect, `With ${listText(mediators)} held fixed, ${causePhrase(cause).replace(/^./, (c) => c.toLowerCase())}`)}</p>
        <p class="lede">The difference between the two, <span class="mono">${fmt(r.effect - d.effect)}</span>, is the part that runs through ${listText(mediators)}.
          95% interval <span class="mono">${fmt(d.ci[0])}</span> to <span class="mono">${fmt(d.ci[1])}</span>.</p>
      </div>`;
    }
  }

  result.innerHTML = `
    <span class="label">${direct ? "Total effect" : "Estimate"}, ${adjust.length ? `adjusting for ${adjust.map((a) => escapeHtml(label(a))).join(", ")}` : "no adjustment"}</span>
    <div class="estimate-value">${fmt(r.effect)}</div>
    <p class="headline">${effectSentence(r.effect, causePhrase(cause))}</p>
    <p class="lede">${stepsNote(cause)}If your graph is right. ${droppedNote}</p>
    ${intervalSvg(r, adjust.length ? naive : null)}
    <p class="meta">95% interval <span class="mono">${fmt(r.ci[0])}</span> to <span class="mono">${fmt(r.ci[1])}</span>.
      ${excludesZero ? "It does not include zero." : "It includes zero, so the data cannot tell this apart from no effect."}
      ${adjust.length && naive ? ` The hollow marker is the raw association with no adjustment: <span class="mono">${fmt(naive.effect)}</span>.` : ""}</p>
    <p class="dowhy-status" id="dowhy-status"></p>
    ${direct}`;

  confirmWithDoWhy(data, g, main.spec, r);
  drawReading(g, roleMap, adjust);
  drawHistory(adjust, r);
  scheduleChecks(data, main.spec, r);
}

function drawReading(g, roleMap, adjust) {
  const T = `<b>${escapeHtml(label(state.treatment))}</b>`;
  const Y = `<b>${escapeHtml(label(state.outcome))}</b>`;
  const of = (role) => Object.keys(roleMap).filter((n) => primaryRole(roleMap[n]) === role);
  const notes = [];
  const note = (role, html) => notes.push(`<li><span class="sw" style="background: var(--role-${role})"></span><span>${html}</span></li>`);

  if (state.unchanged) {
    note(Role.TREATMENT, `<b>Your last change didn't change what gets adjusted for</b>, so the estimate stayed the same.
      Only arrows that open or close a backdoor path into ${T} move the number.`);
  }
  note(Role.TREATMENT, `Your graph says to estimate ${adjust.length ? `adjusting for ${listText(adjust)}` : "with <b>no adjustment</b>"}. That choice comes from the arrows, not from the data.`);
  if (!g.edges.some(([, c]) => c === state.treatment)) {
    note(Role.TREATMENT, `Nothing in your graph points into ${T}, so there are no backdoor paths to close.
      Every graph where ${T} has no causes gives this same answer: the raw association.
      To change it, draw an arrow into ${T} from something that also affects ${Y}.`);
  }
  const mediators = of(Role.MEDIATOR);
  if (mediators.length) {
    note(Role.MEDIATOR, `This is the <b>total effect</b>. It includes the part that runs through ${listText(mediators)}.
      Holding it fixed answers a different question, the direct effect, shown under the total.`);
  }
  const blocked = of(Role.CONFOUNDER).filter((n) => !adjust.includes(n));
  if (blocked.length) {
    const many = blocked.length > 1;
    note(Role.CONFOUNDER, `${listText(blocked)} ${many ? "are confounders" : "is a confounder"}, but adjusting for ${listText(adjust)} already blocks ${many ? "their paths" : "its path"}, so ${many ? "they are" : "it is"} left out.`);
  }
  const colliders = of(Role.COLLIDER).filter((n) => !adjust.includes(n));
  if (colliders.length) {
    const many = colliders.length > 1;
    note(Role.COLLIDER, `${listText(colliders)} ${many ? "are colliders" : "is a collider"}: two arrows meet there. Adjusting for ${many ? "them" : "it"} would open a path and create bias, so ${many ? "they are" : "it is"} left out.`);
  }
  const instruments = of(Role.INSTRUMENT);
  if (instruments.length) {
    note(Role.INSTRUMENT, `${listText(instruments)} only reaches ${Y} through ${T}. Adjusting for it would add noise without removing bias.`);
  }
  const precision = of(Role.PRECISION);
  if (precision.length) {
    note(Role.PRECISION, `${listText(precision)} only affects ${Y}. It can't bias this estimate, so it is left out.`);
  }
  for (const [n, rs] of Object.entries(roleMap)) {
    if (rs.length > 1 && n !== state.treatment && n !== state.outcome) {
      note(primaryRole(rs), `${listText([n])} plays two roles at once (${rs.map((x) => ROLE_TEXT[x].toLowerCase()).join(" and ")}). No adjustment choice for it is clean.`);
    }
  }
  const missing = usable().filter((c) => !board.has(c.id)).map((c) => c.id);
  if (missing.length) {
    const shown = missing.slice(0, 6);
    note(Role.UNRELATED, `Not on your canvas: ${listText(shown)}${missing.length > shown.length ? ` and ${missing.length - shown.length} more` : ""}.
      Leaving a column off says it does not cause both ${T} and ${Y}. If it does, this estimate is biased.`);
  }
  $("reading").innerHTML = `<h2>What your graph did</h2><ul class="notes">${notes.join("")}</ul>`;
  $("reading").hidden = false;
}

const REFUTERS = {
  random_common_cause: { name: "Add a random common cause", expect: "The estimate should barely move." },
  placebo_treatment_refuter: { name: "Swap the cause for a shuffled copy", expect: "The effect should collapse towards zero." },
  data_subset_refuter: { name: "Re-run on random 80% subsets", expect: "The estimate should stay about the same." },
};

function scheduleChecks(data, spec, r) {
  const run = state.run;
  const checks = $("checks");
  checks.hidden = false;
  checks.innerHTML = `<h2>Robustness checks</h2><p class="meta">Running DoWhy's three checks…</p>`;
  // Let the estimate paint first; the checks refit the model a few hundred times.
  setTimeout(() => {
    if (run !== state.run) return;
    const p = 2 + spec.adjust.length * 3;
    const refs = refute(data, spec, r, { simulations: simulationBudget(r.n, p) });
    if (run !== state.run) return;
    const rows = Object.entries(REFUTERS).map(([key, info]) => {
      const ref = refs[key];
      const pass = ref.p >= 0.05;
      return `<div class="check">
        <dt>${info.name}</dt>
        <dd>${info.expect} Got <span class="mono">${fmt(ref.new_effect)}</span>, p = <span class="mono">${ref.p.toFixed(2)}</span>.</dd>
        <span class="pill ${pass ? "pass" : "flag"}">${pass ? "Passed" : "Flagged"}</span>
      </div>`;
    });
    const allPass = Object.keys(REFUTERS).every((key) => refs[key].p >= 0.05);
    checks.innerHTML = `
      <h2>Robustness checks</h2>
      <dl class="checks">${rows.join("")}</dl>
      <p class="meta" style="margin-top:10px">${refs.simulations} simulations each.</p>
      ${allPass ? "" : `<p class="caution"><strong>Something is off.</strong> At least one check failed, so this estimate is fragile even if your graph is right.</p>`}`;
  }, 30);
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
      <span>${s.adjust.length ? `Adjusting for ${s.adjust.map((a) => escapeHtml(label(a))).join(", ")}` : "No adjustment"}</span>
      <span class="mono">${fmt(s.effect)}</span>
    </li>`);
  box.innerHTML = `<h2>Same data, your answers so far</h2><ul class="history">${items.join("")}</ul>
    <p class="meta" style="margin-top:10px">Effect of ${escapeHtml(label(state.treatment))} on ${escapeHtml(label(state.outcome))}. Only the graph changed.</p>`;
  box.hidden = false;
}

// ---------------------------------------------------------------------------
// 5. Confirm with DoWhy, loaded in the background
// ---------------------------------------------------------------------------

function startDoWhy() {
  const d = state.dowhy;
  if (d.worker) return;
  d.state = "loading";
  d.message = "Loading DoWhy in your browser. The first time takes a little while.";
  d.worker = new Worker("js/dowhy-worker.js", { type: "module" });
  d.worker.onmessage = ({ data: m }) => {
    if (m.type === "status") d.message = m.message;
    if (m.type === "ready") {
      d.state = "ready";
      d.version = m.version;
      update(); // confirm whatever is on screen now
      return;
    }
    if (m.type === "failed") {
      d.state = "failed";
      d.message = m.message;
    }
    if (m.type === "result" && m.id === state.run) d.verdict = verdictFor(m);
    renderDoWhy();
  };
  d.worker.onerror = () => {
    d.state = "failed";
    d.message = "The background worker stopped.";
    renderDoWhy();
  };
}

let pending = null; // what the page estimated for state.run, to compare with DoWhy

function verdictFor(m) {
  if (m.error) return { ok: false, text: `DoWhy couldn't run this estimate: ${escapeHtml(m.error)}` };
  const same = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  const matches = pending && same(pending.effect, m.effect) && same(pending.ci[0], m.ci[0]) && same(pending.ci[1], m.ci[1]);
  if (!matches) return { ok: false, text: `DoWhy's own estimate is <span class="mono">${fmt(m.effect)}</span>, which differs from the one shown. Please report this on GitHub.` };
  const sameSet = pending.adjust.join() === [...m.adjust].sort().join();
  return {
    ok: true,
    text: sameSet
      ? `Confirmed by DoWhy ${escapeHtml(state.dowhy.version)}: same adjustment, same estimate.`
      : `Confirmed by DoWhy ${escapeHtml(state.dowhy.version)}. Reading your graph, DoWhy would adjust for ${listText(m.adjust)} instead, an equally valid choice here.`,
  };
}

function renderDoWhy() {
  const el = $("dowhy-status");
  if (!el) return;
  const d = state.dowhy;
  let cls = "loading";
  let html = `<span class="spinner" aria-hidden="true"></span>${escapeHtml(d.message)}`;
  if (d.state === "failed") {
    cls = "off";
    html = `DoWhy couldn't load in this browser (${escapeHtml(d.message)}). The estimate above uses the same method, tested against DoWhy.`;
  } else if (d.state === "ready" && !d.verdict) {
    html = `<span class="spinner" aria-hidden="true"></span>Checking with DoWhy…`;
  } else if (d.verdict) {
    cls = d.verdict.ok ? "ok" : "off";
    html = `${d.verdict.ok ? "✓ " : ""}${d.verdict.text}`;
  }
  el.className = `dowhy-status ${cls}`;
  el.innerHTML = html;
}

function confirmWithDoWhy(data, g, spec, r) {
  const d = state.dowhy;
  d.verdict = null;
  pending = { effect: r.effect, ci: r.ci, adjust: [...spec.adjust].sort() };
  if (d.state === "ready") {
    d.worker.postMessage({
      type: "estimate",
      id: state.run,
      data,
      graph: { nodes: g.nodes, edges: g.edges },
      spec: { ...spec, categorical: [...spec.categorical] },
    });
  }
  renderDoWhy();
}

function update() {
  const g = board.graph();
  const ready = state.treatment && state.outcome && board.has(state.treatment) && board.has(state.outcome);
  let roleMap = {};
  let id = null;
  if (ready) {
    try {
      roleMap = roles(g, state.treatment, state.outcome);
      id = dowhyBackdoor(g, state.treatment, state.outcome);
    } catch (err) {
      toast(err.message);
    }
  }
  board.draw(roleMap);
  drawControls();
  $("draw-hint").hidden = Boolean(ready && id);
  if (ready && id) {
    trackChange(g, id);
    drawResult(g, roleMap, id);
  } else {
    state.run++;
    hideCards("result", "reading", "checks", "history");
  }
}

function setQuestion(which, value) {
  const other = which === "treatment" ? "outcome" : "treatment";
  if (state[other] === value) state[other] = state[which]; // swap rather than collide
  state[which] = value;
  state.seen.clear();
  state.lastGraph = null; // a new question is not an edit to the old one
  if (value && board.graph().nodes.length < MAX_BLOCKS) board.place(value);
  if (state[other] && board.graph().nodes.length < MAX_BLOCKS) board.place(state[other]);
  // On an empty graph, start from the claim being tested: cause -> effect.
  if (state.treatment && state.outcome && !board.graph().edges.length) board.link(state.treatment, state.outcome);
  update();
}
$("treatment").addEventListener("change", (e) => setQuestion("treatment", e.target.value));
$("outcome").addEventListener("change", (e) => setQuestion("outcome", e.target.value));
