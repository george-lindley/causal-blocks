// The wiggle loop, shared by lab variants 2 (stars for few wiggles) and 3
// (par for few arrows). Each level has a secret graph. Tap a block to wiggle
// it and see what wiggles back; draw arrows; check. Blocks your graph gets
// wrong shake and say what really happens.
//
// A level can lock blocks that can't be tested in real life (you can't make
// a random half of families richer). Those levels also show the data: dotted
// lines between blocks that go together, which is the only evidence about a
// locked block.

import { dSeparated } from "../js/causal.js";
import { $, badge, confetti, toast, testExplainer, testResult, togetherLines, drawPlain, escapeHtml, makeBoard, minimalArrows, moves, progress, stars, wiggle, wiggleMismatch, react } from "./lab.js";

export function runWiggleGame({ key, levels, scoring }) {
  const saved = progress(key);
  const svg = $("canvas");
  const state = { i: 0, mode: "wiggle", wiggles: 0, log: [], won: false, checks: 0 };
  const level = () => levels[state.i];
  const secret = () => ({ nodes: Object.keys(level().blocks), edges: level().edges });
  const label = (id) => level().blocks[id];
  const locked = () => new Set(Object.keys(level().locked ?? {}));

  /**
   * Pairs of blocks that go together in data from graph g. With `data:
   * "locked"` only pairs with a locked block count: in a bigger graph nearly
   * everything goes together, and the tests already cover the rest.
   */
  function together(g) {
    const ids = Object.keys(level().blocks);
    const onlyLocked = level().data === "locked";
    const out = [];
    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) {
        if (onlyLocked && !locked().has(ids[x]) && !locked().has(ids[y])) continue;
        if (!dSeparated(g, [ids[x]], [ids[y]], [])) out.push(`${ids[x]}|${ids[y]}`);
      }
    }
    return out;
  }

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
    if (locked().has(id)) {
      react(svg, id, "🔒 You can't test me!");
      toast(level().locked[id]);
      return;
    }
    if (state.wiggles >= limit()) {
      react(svg, id, "No tests left!");
      return;
    }
    state.wiggles++;
    state.log.unshift({ id, moved: moves(secret(), id) });
    // Show the real ripple on the board, whatever has been drawn.
    wiggle(svg, secret(), id);
    renderPanel();
  }

  function check() {
    const player = board.graph();
    const wrong = wiggleMismatch(player, secret()).filter((id) => !locked().has(id));
    // On levels with a lock, the theory must also explain the data.
    const want = locked().size ? together(secret()) : [];
    const have = locked().size ? together(player) : [];
    const missingLinks = want.filter((p) => !have.includes(p));
    const extraLinks = have.filter((p) => !want.includes(p));
    if (!wrong.length && !missingLinks.length && !extraLinks.length) {
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
      const text = missing ? `Switching me changes ${label(missing)}!` : `Switching me doesn't change ${label(extra)}!`;
      react(svg, id, text);
    }
    const spoken = new Set(wrong.slice(0, 2));
    for (const [pairs, says] of [[missingLinks, "and I go together!"], [extraLinks, "and I don't go together!"]]) {
      for (const p of pairs) {
        const [a, b] = p.split("|");
        const who = locked().has(b) ? b : a; // let the locked block speak: it's the one they can't test
        const other = who === a ? b : a;
        if (spoken.size >= 2 || spoken.has(who)) continue;
        spoken.add(who);
        react(svg, who, `${label(other)} ${says}`);
      }
    }
    const reasons = [
      wrong.length ? "tests" : "",
      missingLinks.length || extraLinks.length ? "the data" : "",
    ].filter(Boolean).join(" or ");
    $("verdict").innerHTML = `<p class="big-line lose">Not quite. Your theory doesn't fit ${reasons}.</p>`;
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
    if (locked().size) {
      togetherLines(svg, together(secret()).map((p) => p.split("|")));
      for (const id of locked()) badge(svg, id, "🔒");
    }
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
      ? `<p class="counter">Tests used: ${state.wiggles}${Number.isFinite(limit()) ? ` · ${left} left` : ""}</p>`
      : `<p class="counter">Par ${par} · Your arrows: ${arrows}</p>`;
    // Predictions are from the theory as drawn now, so they update as you draw.
    const log = state.log.slice(0, 4).map((w) => testResult(label, w.id, w.moved, moves(board.graph(), w.id))).join("");
    if (state.won) {
      const result = score();
      const last = state.i + 1 >= levels.length;
      $("panel-body").innerHTML = `
        <h2 class="win">Solved!</h2>
        ${scoring === "stars" ? stars(result) : `<p class="big-line">${golf(result)} ${arrows} arrows on a par ${par}.</p>`}
        ${scoring === "par" ? scorecard() : ""}
        <p>${scoring === "stars" ? `${state.wiggles} test${state.wiggles === 1 ? "" : "s"}, ${state.checks} wrong guess${state.checks === 1 ? "" : "es"}.` : result > 0 ? "Some of your arrows were already covered by a longer route." : "As few arrows as possible."}</p>
        <div class="row"><button type="button" class="btn primary-btn" id="next">${last ? "Play again from the start" : "Next →"}</button></div>`;
      $("next").onclick = () => start(last ? 0 : state.i + 1);
      return;
    }
    $("panel-body").innerHTML = `
      ${l.lockIntro ? lockCard(l) : testExplainer(state.i === 0)}
      ${l.hint ? `<p class="meta">${escapeHtml(l.hint)}</p>` : ""}
      ${locked().size && !l.lockIntro ? `<p class="meta legend">🔒 can't be tested · <svg width="44" height="10" aria-hidden="true"><path d="M2 5 H42" class="together-key"/></svg> go together in the data</p>` : ""}
      <div class="mode-toggle" role="group" aria-label="What tapping does">
        <button type="button" data-mode="wiggle" aria-pressed="${state.mode === "wiggle"}">🔀 Test</button>
        <button type="button" data-mode="draw" aria-pressed="${state.mode === "draw"}">✏️ Draw</button>
      </div>
      ${scoreLine}
      <ul class="evidence-list wiggle-log">${log || `<li class="meta">${state.mode === "wiggle" ? "Tap a block to test it." : "Switch to Test, then tap a block."}</li>`}</ul>
      <div id="verdict"></div>
      <div class="row"><button type="button" class="btn primary-btn" id="check">Check my graph</button></div>`;
    $("check").onclick = check;
    for (const b of $("panel-body").querySelectorAll("[data-mode]")) {
      b.onclick = () => { state.mode = b.dataset.mode; render(); };
    }
  }

  function lockCard(l) {
    const [id, why] = Object.entries(l.locked)[0];
    return `<div class="lock-card">
      <p class="new-idea">New idea</p>
      <p class="big-line">🔒 Some things can't be tested</p>
      <p>${escapeHtml(why)} So you can't run a test on <b>${escapeHtml(label(id))}</b>.</p>
      <p>Use the data instead. <svg width="44" height="10" aria-hidden="true"><path d="M2 5 H42" class="together-key"/></svg> means two blocks go together. Your theory has to fit the tests <i>and</i> the data.</p>
    </div>`;
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
