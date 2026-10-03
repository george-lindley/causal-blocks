// Lab 1, Evidence: no article, just evidence cards. Draw a theory; Check
// asks each card whether your theory could have produced it. Cards it
// couldn't turn red and the blocks involved complain.

import { dSeparated } from "../../js/causal.js";
import { $, confetti, drawPlain, escapeHtml, makeBoard, moves, progress, react, stars, toast } from "../lab.js";

// Card kinds:
//   link    [a, b]            a and b go together in the data
//   apart   [a, b]            a and b have nothing to do with each other
//   within  [a, b, z]         among kids with the same z, a and b ... (linked: bool)
//   test    [a, b, moves]     switch a on: b changes (or doesn't)
export const LEVELS = [
  {
    id: "first",
    title: "First arrow",
    blocks: { revision: "Revision club", pass: "Pass exam" },
    layout: { revision: [110, 120], pass: [500, 290] },
    cards: [
      { kind: "link", a: "revision", b: "pass" },
      { kind: "test", a: "revision", b: "pass", moves: true },
    ],
  },
  {
    id: "backwards",
    title: "Backwards",
    blocks: { confident: "Feel confident", pass: "Pass exam" },
    layout: { confident: [120, 110], pass: [480, 290] },
    cards: [
      { kind: "link", a: "confident", b: "pass" },
      { kind: "test", a: "confident", b: "pass", moves: false },
    ],
  },
  {
    id: "middle",
    title: "Someone in the middle",
    blocks: { revision: "Revision club", understand: "Understand topic", pass: "Pass exam" },
    layout: { revision: [560, 330], understand: [320, 70], pass: [90, 330] },
    cards: [
      { kind: "link", a: "revision", b: "pass" },
      { kind: "within", a: "revision", b: "pass", z: "understand", linked: false },
      { kind: "test", a: "revision", b: "pass", moves: true },
    ],
  },
  {
    id: "puppet",
    title: "Pulling strings",
    blocks: { breakfast: "Breakfast club", pass: "Pass exam", richer: "Richer family" },
    layout: { breakfast: [80, 90], pass: [560, 100], richer: [330, 340] },
    cards: [
      { kind: "link", a: "breakfast", b: "pass" },
      { kind: "test", a: "breakfast", b: "pass", moves: false },
      { kind: "within", a: "breakfast", b: "pass", z: "richer", linked: false },
      { kind: "test", a: "richer", b: "breakfast", moves: true },
    ],
  },
  {
    id: "door",
    title: "The door",
    blocks: { scholar: "Scholarship", sporty: "Sporty", maths: "Maths whizz" },
    layout: { scholar: [320, 80], sporty: [90, 330], maths: [560, 330] },
    cards: [
      { kind: "apart", a: "sporty", b: "maths" },
      { kind: "link", a: "sporty", b: "scholar" },
      { kind: "link", a: "maths", b: "scholar" },
      { kind: "within", a: "sporty", b: "maths", z: "scholar", linked: true },
    ],
  },
  {
    id: "four",
    title: "Four blocks",
    blocks: { revision: "Revision club", understand: "Understand topic", pass: "Pass exam", sleep: "Good sleep" },
    layout: { revision: [60, 60], understand: [330, 200], pass: [600, 360], sleep: [600, 60] },
    cards: [
      { kind: "link", a: "revision", b: "pass" },
      { kind: "link", a: "sleep", b: "pass" },
      { kind: "apart", a: "sleep", b: "revision" },
      { kind: "apart", a: "sleep", b: "understand" },
      { kind: "within", a: "revision", b: "pass", z: "understand", linked: false },
      { kind: "test", a: "revision", b: "understand", moves: true },
    ],
  },
];

/** Could a theory have produced this card? */
export function holds(g, card) {
  switch (card.kind) {
    case "link": return !dSeparated(g, [card.a], [card.b], []);
    case "apart": return dSeparated(g, [card.a], [card.b], []);
    case "within": return dSeparated(g, [card.a], [card.b], [card.z]) !== card.linked;
    case "test": return moves(g, card.a).has(card.b) === card.moves;
    default: throw new Error(card.kind);
  }
}

const saved = progress("evidence");
const svg = $("canvas");
const state = { i: 0, checked: false, checks: 0, won: false, stars: 0 };
const level = () => LEVELS[state.i];
const label = (id) => level().blocks[id];

const board = makeBoard(svg, {
  label,
  onEdit: () => { state.checked = false; },
  onChange: () => render(),
  toast,
});

function cardText(c) {
  const a = `<b>${escapeHtml(label(c.a))}</b>`;
  const b = `<b>${escapeHtml(label(c.b))}</b>`;
  switch (c.kind) {
    case "link": return `<span class="tag">📈 Data</span> ${a} and ${b} go together`;
    case "apart": return `<span class="tag">📈 Data</span> ${a} and ${b}: no link at all`;
    case "within": return `<span class="tag">📈 Data</span> Same <b>${escapeHtml(label(c.z))}</b>: ${a} and ${b} ${c.linked ? "<u>do</u> go together" : "no longer go together"}`;
    case "test": return `<span class="tag">🔀 Test</span> Switch on ${a}: ${b} ${c.moves ? "changes" : "doesn't change"}`;
    default: return "";
  }
}

// What a block says when your theory gets its card wrong.
function complaint(c) {
  switch (c.kind) {
    case "link": return [c.a, `${label(c.b)} and I go together!`];
    case "apart": return [c.a, `${label(c.b)} and I aren't linked!`];
    case "within": return [c.z, c.linked ? "Look inside my group!" : "I explain their link!"];
    case "test": return [c.a, c.moves ? `Switching me moves ${label(c.b)}!` : `I don't move ${label(c.b)}!`];
    default: return [c.a, "?"];
  }
}

function check() {
  state.checks++;
  state.checked = true;
  const g = board.graph();
  const failed = level().cards.filter((c) => !holds(g, c));
  if (!failed.length) {
    state.won = true;
    state.stars = state.checks === 1 ? 3 : state.checks === 2 ? 2 : 1;
    if ((saved.get(level().id) ?? 0) < state.stars) saved.set(level().id, state.stars);
    render();
    confetti($("panel"));
    return;
  }
  render();
  const spoken = new Set();
  for (const c of failed) {
    const [who, text] = complaint(c);
    if (spoken.has(who)) continue;
    spoken.add(who);
    react(svg, who, text);
  }
}

function render() {
  drawPlain(board, Object.keys(level().blocks));
  const l = level();
  $("level-title").textContent = l.title;
  $("dots").innerHTML = LEVELS.map((lv, k) =>
    `<i class="${k === state.i ? "now" : saved.get(lv.id) ? "done" : ""}"></i>`).join("");
  const g = board.graph();
  const cards = l.cards.map((c) => {
    const cls = state.checked ? (holds(g, c) ? "pass" : "fail") : "";
    const mark = state.checked ? (holds(g, c) ? "✅" : "❌") : "";
    return `<li class="${cls}"><span>${cardText(c)}</span><span>${mark}</span></li>`;
  }).join("");
  if (state.won) {
    const last = state.i + 1 >= LEVELS.length;
    $("panel-body").innerHTML = `
      <h2 class="win">Every card fits!</h2>
      ${stars(state.stars)}
      <ul class="evidence-list">${cards}</ul>
      <div class="row"><button type="button" class="btn primary-btn" id="next">${last ? "Play again from the start" : "Next →"}</button></div>`;
    $("next").onclick = () => start(last ? 0 : state.i + 1);
    return;
  }
  $("panel-body").innerHTML = `
    <p class="meta">${state.i === 0 ? "Drag from a block's dot to another block to draw an arrow. Your theory has to fit every card." : "Draw a theory that fits every card."}</p>
    <ul class="evidence-list">${cards}</ul>
    <div class="row"><button type="button" class="btn primary-btn" id="check">Check</button>
    <span class="meta">${state.checks ? `Checks: ${state.checks}` : ""}</span></div>`;
  $("check").onclick = check;
}

function start(i) {
  Object.assign(state, { i, checked: false, checks: 0, won: false });
  board.load(level().layout, []);
  render();
}

start(0);
