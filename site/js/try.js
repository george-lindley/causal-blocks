// "Try your own data": load a CSV, check how each column will be used, then
// draw a causal graph over the chosen columns on the shared board.

import { ROLE_TEXT, createBoard } from "./board.js";
import { Role, roles } from "./causal.js";
import { KIND_LABELS, Kind, allowedKinds, estimable, readTable } from "./data.js";

const MAX_BLOCKS = 15;
const $ = (id) => document.getElementById(id);

const state = {
  table: null,
  fileName: "",
  treatment: null,
  outcome: null,
  toastTimer: null,
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
      state.treatment = state.outcome = null;
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

$("use-towns").addEventListener("click", async () => {
  const text = await fetch("data/english_education.csv").then((r) => r.text());
  parse(text, "english_education.csv");
});

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
  onChange: () => update(),
  toast,
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
  $("legend").innerHTML = shown.map((r) => `<span><i style="background: var(--role-${r})"></i>${ROLE_TEXT[r]}</span>`).join("");
}

function update() {
  const g = board.graph();
  const ready = state.treatment && state.outcome && board.has(state.treatment) && board.has(state.outcome);
  let roleMap = {};
  if (ready) {
    try {
      roleMap = roles(g, state.treatment, state.outcome);
    } catch (err) {
      toast(err.message);
    }
  }
  board.draw(roleMap);
  drawControls();
  $("draw-hint").hidden = Boolean(ready);
  $("result").hidden = !ready;
}

function setQuestion(which, value) {
  const other = which === "treatment" ? "outcome" : "treatment";
  if (state[other] === value) state[other] = state[which]; // swap rather than collide
  state[which] = value;
  if (value && board.graph().nodes.length < MAX_BLOCKS) board.place(value);
  if (state[other] && board.graph().nodes.length < MAX_BLOCKS) board.place(state[other]);
  update();
}
$("treatment").addEventListener("change", (e) => setQuestion("treatment", e.target.value));
$("outcome").addEventListener("change", (e) => setQuestion("outcome", e.target.value));
