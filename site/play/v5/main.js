// Lab 4, Rapid fire: a headline links two things. Before the timer runs out,
// pick the shape: A causes B, B causes A, or something else causes both.
// The board then shows the answer.

import { Role } from "../../js/causal.js";
import { $, confetti, drawPlain, escapeHtml, makeBoard, progress, react, toast, wiggle } from "../lab.js";

const ROUNDS = [
  {
    id: "warm-up",
    title: "Warm up",
    seconds: 8,
    headlines: [
      { a: "Revision club", b: "Passing exams", line: "Revision club members pass more exams", answer: "ab", why: "Revising really does help you pass." },
      { a: "Umbrellas", b: "Rainy days", line: "More umbrellas out on rainy days", answer: "ba", why: "Rain makes people carry umbrellas, not the other way round." },
      { a: "Ice cream sales", b: "Sunburn", line: "Ice cream sales linked to sunburn", answer: "third", third: "Hot sunny days", why: "Sunny days sell ice cream and burn skin." },
      { a: "Wearing seatbelts", b: "Fewer injuries", line: "Seatbelt wearers have fewer injuries", answer: "ab", why: "Seatbelts really do protect you." },
    ],
  },
  {
    id: "faster",
    title: "Faster",
    seconds: 6,
    headlines: [
      { a: "Shoe size", b: "Reading skill", line: "Kids with bigger feet read better", answer: "third", third: "Age", why: "Older kids have bigger feet and read better." },
      { a: "Firefighters sent", b: "Fire damage", line: "More firefighters, more fire damage", answer: "ba", why: "Big fires get more firefighters sent to them." },
      { a: "Exercise", b: "Blood pressure", line: "Exercise linked to lower blood pressure", answer: "ab", why: "Exercise strengthens your heart." },
      { a: "Grey hair", b: "Wrinkles", line: "Grey-haired people have more wrinkles", answer: "third", third: "Getting older", why: "Age brings both." },
    ],
  },
  {
    id: "fastest",
    title: "Fastest",
    seconds: 4,
    headlines: [
      { a: "Police officers", b: "Crime", line: "Cities with more police have more crime", answer: "ba", why: "Places with more crime hire more police." },
      { a: "Chocolate eaten", b: "Nobel prizes", line: "Chocolate-loving countries win more Nobel prizes", answer: "third", third: "Wealth", why: "Rich countries buy more chocolate and fund more science." },
      { a: "Rooster crowing", b: "Sunrise", line: "Roosters crow at sunrise", answer: "ba", why: "The sunrise sets the rooster off." },
      { a: "Smoking", b: "Lung cancer", line: "Smokers get more lung cancer", answer: "ab", why: "Experiments and decades of evidence: smoking causes it." },
      { a: "Hand washing", b: "Fewer colds", line: "Hand washers catch fewer colds", answer: "ab", why: "Washing removes the germs." },
    ],
  },
];

const saved = progress("rapid");
const svg = $("canvas");
const state = { r: 0, k: 0, score: 0, streak: 0, best: 0, right: 0, answered: null, timer: null, ends: 0 };
const round = () => ROUNDS[state.r];
const item = () => round().headlines[state.k];
const names = () => ({ a: item().a, b: item().b, c: item().third ?? "Something else" });
document.body.classList.add("view-only");
const board = makeBoard(svg, { label: (id) => names()[id], onChange: () => {}, toast });

const POS = { a: [70, 210], b: [566, 210], c: [318, 40] };

function showBoard(edges = []) {
  const ids = edges.some((e) => e.includes("c")) ? ["a", "b", "c"] : ["a", "b"];
  board.load(Object.fromEntries(ids.map((id) => [id, POS[id]])), edges);
  // Once answered, the cause is orange, the effect green and a third block blue.
  const ans = state.answered === null ? null : item().answer;
  const colour = ans === "ab" ? { a: Role.TREATMENT, b: Role.OUTCOME }
    : ans === "ba" ? { a: Role.OUTCOME, b: Role.TREATMENT }
    : ans === "third" ? { c: Role.CONFOUNDER } : {};
  drawPlain(board, ids, colour);
}

function answerEdges(answer) {
  return answer === "ab" ? [["a", "b"]] : answer === "ba" ? [["b", "a"]] : [["c", "a"], ["c", "b"]];
}

function choiceLabels() {
  const { a, b } = item();
  return {
    ab: `${escapeHtml(a)} → ${escapeHtml(b)}`,
    ba: `${escapeHtml(b)} → ${escapeHtml(a)}`,
    third: "Something else causes both",
  };
}

function tick() {
  const left = Math.max(0, state.ends - performance.now());
  const bar = $("bar");
  if (bar) bar.style.transform = `scaleX(${left / (round().seconds * 1000)})`;
  if (left <= 0) answer(null);
  else state.timer = requestAnimationFrame(tick);
}

function answer(choice) {
  if (state.answered !== null) return;
  cancelAnimationFrame(state.timer);
  const left = Math.max(0, state.ends - performance.now()) / 1000;
  const right = choice === item().answer;
  state.answered = choice ?? "timeout";
  if (right) {
    state.streak++;
    state.right++;
    state.best = Math.max(state.best, state.streak);
    state.score += Math.round((100 + left * 25) * Math.min(state.streak, 4));
  } else {
    state.streak = 0;
  }
  const edges = answerEdges(item().answer);
  showBoard(edges);
  const cause = item().answer === "ab" ? "a" : item().answer === "ba" ? "b" : "c";
  wiggle(svg, { nodes: ["a", "b", "c"], edges }, cause);
  if (!right) react(svg, cause, choice === null ? "Too slow!" : "It's me!", "bad");
  renderPanel(right);
}

function next() {
  state.k++;
  if (state.k >= round().headlines.length) {
    finish();
    return;
  }
  ask();
}

function ask() {
  state.answered = null;
  showBoard();
  renderPanel();
  state.ends = performance.now() + round().seconds * 1000;
  state.timer = requestAnimationFrame(tick);
}

function finish() {
  const r = round();
  const best = saved.get(r.id) ?? 0;
  if (state.score > best) saved.set(r.id, state.score);
  const last = state.r + 1 >= ROUNDS.length;
  board.load({}, []);
  drawPlain(board, []);
  dots();
  $("panel-body").innerHTML = `
    <h2 class="${state.right === r.headlines.length ? "win" : ""}">${state.right} of ${r.headlines.length} right</h2>
    <p class="big-line">Score ${state.score.toLocaleString()}</p>
    <p class="meta">Best streak ${state.best}${state.score > best ? " · New best!" : ` · Best score ${best.toLocaleString()}`}</p>
    <div class="row">
      <button type="button" class="btn" id="again">Try again</button>
      <button type="button" class="btn primary-btn" id="next-round">${last ? "Back to the start" : `Next: ${ROUNDS[state.r + 1].title} →`}</button>
    </div>`;
  if (state.right === r.headlines.length) confetti($("panel"));
  $("again").onclick = () => startRound(state.r);
  $("next-round").onclick = () => startRound(last ? 0 : state.r + 1);
}

function dots() {
  $("level-title").textContent = round().title;
  $("dots").innerHTML = ROUNDS.map((rd, k) =>
    `<i class="${k === state.r ? "now" : saved.get(rd.id) ? "done" : ""}"></i>`).join("");
}

function renderPanel(right) {
  dots();
  const it = item();
  const labels = choiceLabels();
  const status = `<p class="counter">${state.k + 1} / ${round().headlines.length} · Score ${state.score.toLocaleString()}${state.streak > 1 ? ` · 🔥 ×${Math.min(state.streak, 4)}` : ""}</p>`;
  const buttons = Object.entries(labels).map(([key, text]) => {
    const cls = state.answered === null ? "" : key === it.answer ? "right" : key === state.answered ? "wrong" : "";
    return `<button type="button" data-choice="${key}" class="${cls}" ${state.answered !== null ? "disabled" : ""}>${text}</button>`;
  }).join("");
  $("panel-body").innerHTML = `
    ${status}
    <div class="headline-card">${escapeHtml(it.line)}</div>
    ${state.answered === null ? `<div class="timer"><i id="bar"></i></div>` : ""}
    <div class="choices">${buttons}</div>
    ${state.answered === null ? "" : `
      <p class="big-line ${right ? "win" : "lose"}">${right ? "Yes!" : state.answered === "timeout" ? "Time's up." : "Not quite."} ${escapeHtml(it.why)}</p>
      <div class="row"><button type="button" class="btn primary-btn" id="next">Next →</button></div>`}`;
  for (const b of $("panel-body").querySelectorAll("[data-choice]")) b.onclick = () => answer(b.dataset.choice);
  if (state.answered !== null) $("next").onclick = next;
}

function startRound(r) {
  Object.assign(state, { r, k: 0, score: 0, streak: 0, best: 0, right: 0 });
  ask();
}

// Keys 1, 2, 3 pick a shape; Enter moves on.
window.addEventListener("keydown", (e) => {
  if (state.answered === null && ["1", "2", "3"].includes(e.key)) answer(["ab", "ba", "third"][Number(e.key) - 1]);
  else if (state.answered !== null && e.key === "Enter") $("next")?.click();
});

startRound(0);
