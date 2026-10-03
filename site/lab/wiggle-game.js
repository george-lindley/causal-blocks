// The wiggle loop, shared by lab variants 2 (stars for few wiggles) and 3
// (par for few arrows). Each level has a secret graph. Tap a block to wiggle
// it and see what wiggles back; draw arrows; check. Blocks your graph gets
// wrong shake and say what really happens.

import { $, confetti, toast, drawPlain, escapeHtml, makeBoard, minimalArrows, moves, progress, stars, wiggle, wiggleMismatch, react } from "./lab.js";

export function runWiggleGame({ key, levels, scoring }) {
  const saved = progress(key);
  const svg = $("canvas");
  const state = { i: 0, mode: "wiggle", wiggles: 0, log: [], won: false, checks: 0 };
  const level = () => levels[state.i];
  const secret = () => ({ nodes: Object.keys(level().blocks), edges: level().edges });
  const label = (id) => level().blocks[id];

  const board = makeBoard(svg, {
    label,
    onEdit: () => { state.won = false; },
    onChange: () => render(),
    toast,
  });

  // In wiggle mode a tap wiggles; it must reach us before the board starts a drag.
  svg.addEventListener("pointerdown", (e) => {
    if (state.mode !== "wiggle" || state.won) return;
    const node = e.target.closest("[data-node]");
    if (!node) return;
    e.stopPropagation();
    e.preventDefault();
    doWiggle(node.dataset.node);
  }, { capture: true });

  function limit() {
    return scoring === "stars" ? secret().nodes.length + 2 : Infinity;
  }

  function doWiggle(id) {
    if (state.wiggles >= limit()) {
      react(svg, id, "No wiggles left!");
      return;
    }
    state.wiggles++;
    const moved = [...moves(secret(), id)];
    state.log.unshift({ id, moved });
    // Show the real ripple on the board, whatever has been drawn.
    wiggle(svg, secret(), id);
    renderPanel();
  }

  function check() {
    const player = board.graph();
    const wrong = wiggleMismatch(player, secret());
    if (!wrong.length) {
      win();
      return;
    }
    state.checks++; // wrong checks cost a star
    // Let up to two wrong blocks explain themselves.
    for (const id of wrong.slice(0, 2)) {
      const truth = moves(secret(), id);
      const mine = moves(player, id);
      const missing = [...truth].find((n) => !mine.has(n));
      const extra = [...mine].find((n) => !truth.has(n));
      const text = missing ? `${label(missing)} moves when I wiggle!` : `${label(extra)} doesn't move when I wiggle!`;
      react(svg, id, text);
    }
    $("verdict").innerHTML = `<p class="big-line lose">Not quite. ${wrong.length === 1 ? "One block wiggles" : `${wrong.length} blocks wiggle`} differently from your graph.</p>`;
  }

  function score() {
    if (scoring === "stars") {
      const over = state.wiggles > secret().nodes.length - 1 ? 1 : 0;
      return Math.max(1, 3 - over - state.checks);
    }
    const par = minimalArrows(secret()).length;
    return board.graph().edges.length - par; // 0 = par
  }

  function golf(diff) {
    return { "-1": "Birdie!", 0: "Par!", 1: "Bogey", 2: "Double bogey" }[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
  }

  function scorecard() {
    const cells = levels.map((lv, k) => {
      const v = saved.get(lv.id);
      return `<td class="${k === state.i ? "now" : ""}">${v === undefined ? "·" : v === 0 ? "E" : `+${v}`}</td>`;
    }).join("");
    const total = levels.reduce((t, lv) => t + (saved.get(lv.id) ?? 0), 0);
    return `<table class="scorecard"><tr>${levels.map((_, k) => `<th>${k + 1}</th>`).join("")}<th>Total</th></tr>
      <tr>${cells}<td><b>${total === 0 ? "E" : `+${total}`}</b></td></tr></table>`;
  }

  function win() {
    state.won = true;
    const result = score();
    const best = saved.get(level().id);
    if (scoring === "stars" ? (best ?? 0) < result : best === undefined || result < best) saved.set(level().id, result);
    render();
    confetti($("panel"));
    for (const id of secret().nodes) react(svg, id, "", "good");
  }

  function render() {
    drawPlain(board, secret().nodes);
    document.body.classList.toggle("wiggle-mode", state.mode === "wiggle" && !state.won);
    renderPanel();
  }

  function renderPanel() {
    const l = level();
    $("level-title").textContent = l.title;
    $("dots").innerHTML = levels.map((lv, k) =>
      `<i class="${k === state.i ? "now" : saved.get(lv.id) !== undefined ? "done" : ""}"></i>`).join("");
    const arrows = board.graph().edges.length;
    const par = minimalArrows(secret()).length;
    const left = limit() - state.wiggles;
    const scoreLine = scoring === "stars"
      ? `<p class="counter">Wiggles used: ${state.wiggles}${Number.isFinite(limit()) ? ` · ${left} left` : ""}</p>`
      : `<p class="counter">Par ${par} · Your arrows: ${arrows}</p>`;
    const log = state.log.slice(0, 6).map((w) =>
      `<li><b>${escapeHtml(label(w.id))}</b> → ${w.moved.length ? w.moved.map((m) => escapeHtml(label(m))).join(", ") : "<span class='meta'>nothing moved</span>"}</li>`).join("");
    if (state.won) {
      const result = score();
      const last = state.i + 1 >= levels.length;
      $("panel-body").innerHTML = `
        <h2 class="win">Solved!</h2>
        ${scoring === "stars" ? stars(result) : `<p class="big-line">${golf(result)} ${arrows} arrows on a par ${par}.</p>`}
        ${scoring === "par" ? scorecard() : ""}
        <p>${scoring === "stars" ? `${state.wiggles} wiggle${state.wiggles === 1 ? "" : "s"}, ${state.checks} wrong guess${state.checks === 1 ? "" : "es"}.` : result > 0 ? "Some of your arrows were already covered by a longer route." : "As few arrows as possible."}</p>
        <div class="row"><button type="button" class="btn primary-btn" id="next">${last ? "Play again from the start" : "Next →"}</button></div>`;
      $("next").onclick = () => start(last ? 0 : state.i + 1);
      return;
    }
    $("panel-body").innerHTML = `
      ${l.hint ? `<p class="meta">${escapeHtml(l.hint)}</p>` : ""}
      <div class="mode-toggle" role="group" aria-label="What tapping does">
        <button type="button" data-mode="wiggle" aria-pressed="${state.mode === "wiggle"}">👆 Wiggle</button>
        <button type="button" data-mode="draw" aria-pressed="${state.mode === "draw"}">✏️ Draw</button>
      </div>
      ${scoreLine}
      <ul class="evidence-list wiggle-log">${log || `<li class="meta">${state.mode === "wiggle" ? "Tap a block to wiggle it." : "Switch to Wiggle to test blocks."}</li>`}</ul>
      <div id="verdict"></div>
      <div class="row"><button type="button" class="btn primary-btn" id="check">Check my graph</button></div>`;
    $("check").onclick = check;
    for (const b of $("panel-body").querySelectorAll("[data-mode]")) {
      b.onclick = () => { state.mode = b.dataset.mode; render(); };
    }
  }

  function start(i) {
    state.i = i;
    state.mode = "wiggle";
    state.wiggles = 0;
    state.log = [];
    state.won = false;
    state.checks = 0;
    board.load(level().layout, []);
    render();
  }

  start(0);
}
