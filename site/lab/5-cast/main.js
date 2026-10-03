// Lab 5, Cast: wiggle and draw, and each level has a twist where a character
// changes the board. Mr Confounder sneaks on; the Messenger squeezes in and
// then gets frozen; the Bouncer shuts the door. Almost no words.
//
// Each level is one secret graph over all its blocks, shown in stages. A
// stage's visible blocks have to wiggle, and go together, exactly as the
// secret says, with hidden blocks still doing their work out of sight.

import { Role, dSeparated, roles, primaryRole } from "../../js/causal.js";
import { CAST, portrait } from "../../js/game/cast.js";
import {
  $, arrive, badge, confetti, drawPlain, escapeHtml, makeBoard, moves, progress, react, toast, togetherLines, wiggle,
} from "../lab.js";

const LEVELS = [
  {
    id: "cause",
    title: "The Cause",
    blocks: { revision: "Revision club", pass: "Pass exam" },
    layout: { revision: [110, 120], pass: [500, 290] },
    edges: [["revision", "pass"]],
    t: "revision", o: "pass",
    stages: [{ show: ["revision", "pass"], meet: [Role.TREATMENT, Role.OUTCOME] }],
  },
  {
    id: "messenger",
    title: "The Messenger",
    blocks: { revision: "Revision club", understand: "Understand topic", pass: "Pass exam" },
    layout: { revision: [60, 300], understand: [320, 70], pass: [580, 300] },
    edges: [["revision", "understand"], ["understand", "pass"]],
    t: "revision", o: "pass",
    stages: [
      { show: ["revision", "pass"] },
      { show: ["revision", "understand", "pass"], arrive: "understand", meet: [Role.MEDIATOR] },
      { show: ["revision", "understand", "pass"], freeze: "understand", demo: "revision" },
    ],
  },
  {
    id: "confounder",
    title: "Mr Confounder",
    blocks: { breakfast: "Breakfast club", pass: "Pass exam", richer: "Richer family" },
    layout: { breakfast: [80, 90], pass: [560, 90], richer: [320, 330] },
    edges: [["richer", "breakfast"], ["richer", "pass"]],
    t: "breakfast", o: "pass",
    stages: [
      { show: ["breakfast", "pass"], dead: true },
      { show: ["breakfast", "pass", "richer"], arrive: "richer", meet: [Role.CONFOUNDER] },
    ],
  },
  {
    id: "bouncer",
    title: "The Bouncer",
    blocks: { sporty: "Sporty", maths: "Maths whizz", scholar: "Scholarship" },
    layout: { sporty: [80, 90], maths: [560, 90], scholar: [320, 330] },
    edges: [["sporty", "scholar"], ["maths", "scholar"]],
    t: "sporty", o: "maths",
    stages: [
      { show: ["sporty", "maths", "scholar"] },
      { show: ["sporty", "maths", "scholar"], door: "scholar", meet: [Role.COLLIDER] },
    ],
  },
  {
    id: "everyone",
    title: "Everyone",
    blocks: { revision: "Revision club", understand: "Understand topic", pass: "Pass exam", richer: "Richer family" },
    layout: { revision: [60, 320], understand: [320, 200], pass: [580, 320], richer: [320, 30] },
    edges: [["richer", "revision"], ["revision", "understand"], ["understand", "pass"], ["richer", "pass"]],
    t: "revision", o: "pass",
    stages: [
      { show: ["revision", "pass"] },
      { show: ["revision", "pass", "richer"], arrive: "richer", meet: [Role.CONFOUNDER] },
      { show: ["revision", "understand", "pass", "richer"], arrive: "understand", meet: [Role.MEDIATOR] },
      { show: ["revision", "understand", "pass", "richer"], freeze: "understand", demo: "revision" },
    ],
  },
];

const saved = progress("cast");
const svg = $("canvas");
const state = { i: 0, s: 0, mode: "wiggle", won: false, busy: false, tries: 0 };
const level = () => LEVELS[state.i];
const stage = () => level().stages[state.s];
const label = (id) => level().blocks[id];
const secret = () => ({ nodes: Object.keys(level().blocks), edges: level().edges });

const board = makeBoard(svg, { label, onEdit: () => {}, onChange: () => render(), toast });

// A frozen block is held still: wiggles don't get through it.
function frozenCut(g) {
  const f = stage().freeze;
  return f ? { nodes: g.nodes, edges: g.edges.filter(([, c]) => c !== f) } : g;
}

function visibleMoves(g, id) {
  const shown = new Set(stage().show);
  return new Set([...moves(frozenCut(g), id)].filter((n) => shown.has(n)));
}

function togetherPairs(g) {
  const show = stage().show;
  const given = stage().door ? [stage().door] : [];
  const pairs = [];
  for (let x = 0; x < show.length; x++) {
    for (let y = x + 1; y < show.length; y++) {
      if (given.includes(show[x]) || given.includes(show[y])) continue;
      if (!dSeparated(g, [show[x]], [show[y]], given)) pairs.push([show[x], show[y]]);
    }
  }
  return pairs;
}

const key = (pairs) => new Set(pairs.map(([a, b]) => [a, b].sort().join("|")));

// What's wrong with the player's graph for this stage, as things blocks say.
function problems(player) {
  const out = [];
  for (const id of stage().show) {
    const truth = visibleMoves(secret(), id);
    const mine = visibleMoves(player, id);
    const missing = [...truth].find((n) => !mine.has(n));
    const extra = [...mine].find((n) => !truth.has(n));
    if (missing) out.push([id, `I move ${label(missing)}!`]);
    else if (extra) out.push([id, `I don't move ${label(extra)}!`]);
  }
  const want = key(togetherPairs(secret()));
  const have = key(togetherPairs(player));
  for (const p of want) if (!have.has(p)) out.push([p.split("|")[0], `${label(p.split("|")[1])} and I go together!`]);
  for (const p of have) if (!want.has(p)) out.push([p.split("|")[0], `${label(p.split("|")[1])} and I aren't linked!`]);
  return out;
}

function colours() {
  const all = roles(secret(), level().t, level().o);
  const done = state.won;
  return Object.fromEntries(stage().show.map((id) => {
    const r = primaryRole(all[id]);
    const known = done || r === Role.TREATMENT || r === Role.OUTCOME || id === stage().arrive || id === stage().door || id === stage().freeze;
    return [id, known ? r : Role.PRECISION];
  }));
}

function render() {
  board.draw(Object.fromEntries(Object.entries(colours()).map(([id, r]) => [id, [r]])),
    { frozen: new Set(stage().freeze ? [stage().freeze] : []) });
  togetherLines(svg, togetherPairs(secret()));
  if (stage().door) badge(svg, stage().door, "🚪");
  document.body.classList.toggle("wiggle-mode", state.mode === "wiggle" && !state.won);
  renderPanel();
}

function renderPanel() {
  const l = level();
  $("level-title").textContent = l.title;
  $("dots").innerHTML = LEVELS.map((lv, k) =>
    `<i class="${k === state.i ? "now" : saved.get(lv.id) ? "done" : ""}"></i>`).join("");
  const meet = (stage().meet ?? []).map((r) =>
    `<div class="portrait-pop">${portrait(r, 120, CAST[r].name)}<b>${escapeHtml(CAST[r].name)}</b></div>`).join("");
  const steps = l.stages.map((_, k) => (k < state.s || state.won ? "●" : k === state.s ? "◉" : "○")).join(" ");
  if (state.won) {
    const last = state.i + 1 >= LEVELS.length;
    $("panel-body").innerHTML = `
      <h2 class="win">You got it!</h2>
      <div class="row">${[...new Set(Object.values(colours()))].filter((r) => CAST[r]).map((r) => portrait(r, 72, CAST[r].name)).join("")}</div>
      <div class="row"><button type="button" class="btn primary-btn" id="next">${last ? "Play again from the start" : "Next →"}</button></div>`;
    $("next").onclick = () => start(last ? 0 : state.i + 1);
    return;
  }
  $("panel-body").innerHTML = `
    ${meet ? `<div class="row" style="justify-content:center">${meet}</div>` : ""}
    ${stage().freeze ? `<div class="portrait-pop" style="font-size:64px" aria-label="Frozen">❄️</div>` : ""}
    <p class="counter" aria-label="Stage ${state.s + 1} of ${l.stages.length}">${steps}</p>
    ${state.i === 0 && state.s === 0 ? `<p class="meta">👆 tap a block to wiggle it. ✏️ drag from a dot to draw.</p>` : ""}
    <div class="mode-toggle" role="group" aria-label="What tapping does">
      <button type="button" data-mode="wiggle" aria-pressed="${state.mode === "wiggle"}">👆 Wiggle</button>
      <button type="button" data-mode="draw" aria-pressed="${state.mode === "draw"}">✏️ Draw</button>
    </div>
    <p class="meta legend"><svg width="44" height="10" aria-hidden="true"><path d="M2 5 H42" class="together-key"/></svg> go together in the data</p>
    <div class="row"><button type="button" class="btn primary-btn" id="check" ${state.busy ? "disabled" : ""}>Check ✓</button></div>`;
  $("check").onclick = check;
  for (const b of $("panel-body").querySelectorAll("[data-mode]")) {
    b.onclick = () => { state.mode = b.dataset.mode; render(); };
  }
}

svg.addEventListener("pointerdown", (e) => {
  if (state.mode !== "wiggle" || state.won || state.busy) return;
  const node = e.target.closest("[data-node]");
  if (!node) return;
  e.stopPropagation();
  e.preventDefault();
  wiggle(svg, frozenCut(secret()), node.dataset.node);
}, { capture: true });

function check() {
  if (state.busy) return;
  state.tries++;
  const found = problems(board.graph());
  for (const [who, text] of found.slice(0, 2)) react(svg, who, text);
  if (stage().dead) {
    // Nothing on the board can explain the link: someone is hiding.
    if (!found.length) react(svg, stage().show[0], "Hmm…", "bad");
    later(() => nextStage(), 1900);
    return;
  }
  if (found.length) return;
  for (const id of stage().show) react(svg, id, "", "good");
  if (state.s + 1 < level().stages.length) later(() => nextStage(), 900);
  else win();
}

function later(fn, ms) {
  state.busy = true;
  renderPanel();
  setTimeout(() => { state.busy = false; fn(); }, ms);
}

function nextStage() {
  state.s++;
  const st = stage();
  const pos = Object.fromEntries(st.show.map((id) => [id, level().layout[id]]));
  board.load(pos, board.graph().edges.filter(([p, c]) => p in pos && c in pos));
  state.mode = "wiggle";
  render();
  if (st.arrive) arrive(svg, st.arrive);
  if (st.demo) later(() => { wiggle(svg, frozenCut(secret()), st.demo); renderPanel(); }, 500);
}

function win() {
  state.won = true;
  if (!saved.get(level().id)) saved.set(level().id, true);
  render();
  confetti($("panel"));
}

function start(i) {
  Object.assign(state, { i, s: 0, mode: "wiggle", won: false, busy: false, tries: 0 });
  const pos = Object.fromEntries(stage().show.map((id) => [id, level().layout[id]]));
  board.load(pos, []);
  render();
}

start(0);
