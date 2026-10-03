// Shared toolkit for the lab: five experimental takes on an arrow-first game.
// Each variant builds its own loop from these pieces and the site's board.

import { createBoard } from "../js/board.js";
import { Role } from "../js/causal.js";

export const $ = (id) => document.getElementById(id);

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// Blocks in the lab have faces but no captions: what they are is for the
// player to work out.
const BLANK = Object.fromEntries(Object.values(Role).map((r) => [r, ""]));

/** A board for one level: every block neutral, with eyes. */
export function makeBoard(svg, { label, onEdit = () => {}, onChange, toast }) {
  return createBoard(svg, { label, locked: () => true, onEdit, onChange, toast, unknownCaption: "", roleText: BLANK, faces: true });
}

/** Draw the board with every block a neutral character, or with given colours. */
export function drawPlain(board, ids, colour = {}) {
  board.draw(Object.fromEntries(ids.map((id) => [id, [colour[id] ?? Role.PRECISION]])));
}

// ---------------------------------------------------------------------------
// Graphs
// ---------------------------------------------------------------------------

export function children(g, id) {
  return g.edges.filter(([p]) => p === id).map(([, c]) => c);
}

/** Everything that moves when `id` is wiggled, with how many steps away it is. */
export function ripple(g, id) {
  const depth = new Map([[id, 0]]);
  const queue = [id];
  while (queue.length) {
    const n = queue.shift();
    for (const c of children(g, n)) {
      if (!depth.has(c)) {
        depth.set(c, depth.get(n) + 1);
        queue.push(c);
      }
    }
  }
  return depth;
}

/** The blocks that move when `id` is wiggled (not counting itself). */
export function moves(g, id) {
  return new Set([...ripple(g, id).keys()].filter((n) => n !== id));
}

/**
 * Does the player's graph wiggle exactly like the secret one? Returns the
 * blocks whose wiggles differ (empty when the graphs agree).
 */
export function wiggleMismatch(player, secret) {
  const wrong = [];
  for (const id of secret.nodes) {
    const a = moves(player, id);
    const b = moves(secret, id);
    if (a.size !== b.size || [...a].some((n) => !b.has(n))) wrong.push(id);
  }
  return wrong;
}

/** The fewest arrows that wiggle like `g`: drop every arrow that a longer route already covers. */
export function minimalArrows(g) {
  return g.edges.filter(([p, c]) => {
    const without = { nodes: g.nodes, edges: g.edges.filter((e) => !(e[0] === p && e[1] === c)) };
    return !moves(without, p).has(c);
  });
}

// ---------------------------------------------------------------------------
// Animation on the board
// ---------------------------------------------------------------------------

function nodeEl(svg, id) {
  return svg.querySelector(`[data-node="${CSS.escape(id)}"]`);
}

/** Wiggle a block, then everything it causes, one step of the chain at a time. */
export function wiggle(svg, g, id) {
  for (const [n, d] of ripple(g, id)) {
    const el = nodeEl(svg, n);
    if (!el) continue;
    el.style.setProperty("--delay", `${d * 0.45}s`);
    el.classList.remove("wiggling");
    void el.getBBox(); // restart the animation
    el.classList.add("wiggling");
  }
}

/** Shake a block and give it a speech bubble for a moment. */
export function react(svg, id, text, tone = "bad") {
  const el = nodeEl(svg, id);
  if (!el) return;
  el.classList.remove("shaking");
  void el.getBBox();
  el.classList.add("shaking");
  if (!text) return;
  const ns = "http://www.w3.org/2000/svg";
  const bubble = document.createElementNS(ns, "g");
  bubble.setAttribute("class", `bubble-svg ${tone}`);
  const width = Math.max(90, text.length * 8.4 + 24);
  // Keep the bubble inside the 800-wide board, wherever the block sits.
  const bx = Number(/translate\(([-\d.]+)/.exec(el.getAttribute("transform"))?.[1] ?? 0);
  const left = Math.min(Math.max(-width / 2 + 82, 4 - bx), 796 - bx - width);
  bubble.innerHTML = `<rect x="${left}" y="-58" width="${width}" height="34" rx="12"/>
    <path d="M74 -25 l8 10 l8 -10 z"/><text x="${left + width / 2}" y="-36" text-anchor="middle">${escapeHtml(text)}</text>`;
  el.appendChild(bubble);
  setTimeout(() => bubble.remove(), 2600);
}

export function confetti(container) {
  const colors = ["#fa953d", "#16a085", "#3498db", "#9b59b6", "#e74c3c", "#f1c40f"];
  const bits = Array.from({ length: 22 }, (_, k) =>
    `<i style="--x:${(k * 37) % 100}%;--d:${(k % 6) * 0.07}s;background:${colors[k % 6]}"></i>`).join("");
  container.insertAdjacentHTML("beforeend", `<div class="confetti" aria-hidden="true">${bits}</div>`);
  setTimeout(() => container.querySelector(".confetti")?.remove(), 2200);
}

export function stars(n, of = 3) {
  return `<span class="stars" aria-label="${n} of ${of} stars">${"★".repeat(n)}<span class="off">${"★".repeat(of - n)}</span></span>`;
}

// ---------------------------------------------------------------------------
// Progress, per variant, in this browser only
// ---------------------------------------------------------------------------

export function progress(key) {
  const storageKey = `causalblocks-lab-${key}`;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey)) ?? {};
  } catch {
    // Storage blocked: nothing remembered.
  }
  return {
    get: (level) => saved[level],
    set(level, value) {
      saved[level] = value;
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch {
        // Ignore: progress just isn't kept.
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Decorations drawn on top of a board after board.draw()
// ---------------------------------------------------------------------------

function centreOf(svg, id) {
  const el = nodeEl(svg, id);
  const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(el?.getAttribute("transform") ?? "");
  return m ? [Number(m[1]) + 82, Number(m[2]) + 28] : null;
}

/** Wavy dashed lines between blocks that move together in the data. */
export function togetherLines(svg, pairs) {
  const ns = "http://www.w3.org/2000/svg";
  const first = svg.querySelector(".node, .edge");
  for (const [a, b] of pairs) {
    const p = centreOf(svg, a);
    const q = centreOf(svg, b);
    if (!p || !q) continue;
    const [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const [nx, ny] = [-(q[1] - p[1]) / len * 26, (q[0] - p[0]) / len * 26];
    const path = document.createElementNS(ns, "path");
    path.setAttribute("class", "together");
    path.setAttribute("d", `M${p[0]},${p[1]} Q${mx + nx},${my + ny} ${q[0]},${q[1]}`);
    path.dataset.pair = `${a}|${b}`;
    svg.insertBefore(path, first);
  }
}

/** Put a small badge (an emoji) on a block. */
export function badge(svg, id, emoji) {
  const el = nodeEl(svg, id);
  if (!el) return;
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("class", "block-badge");
  t.setAttribute("x", 140);
  t.setAttribute("y", 44);
  t.textContent = emoji;
  el.appendChild(t);
}

/** Mark a block as just arrived, so it slides onto the board. */
export function arrive(svg, id) {
  nodeEl(svg, id)?.classList.add("arriving");
}

/** A short message over the board. */
export function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
}

// ---------------------------------------------------------------------------
// Tests: what tapping a block means in real life
// ---------------------------------------------------------------------------

const TEST_MEANS = "A test is a real experiment: switch a block on for a random half of the kids, then see what changes for them compared with everyone else. The answer comes from the real world, not from your drawing.";

/** One line on the first level; tucked behind "What's a test?" after that. */
export function testExplainer(first) {
  return first
    ? `<p class="test-explainer">🔀 ${TEST_MEANS}</p>`
    : `<details class="test-explainer"><summary>What's a test?</summary>${TEST_MEANS}</details>`;
}

/** A test's result: what really changed, beside what your theory predicted. */
export function testResult(label, id, real, predicted) {
  const list = (ids) => (ids.size ? [...ids].map((n) => `<b>${escapeHtml(label(n))}</b>`).join(", ") + " changed" : "nothing else changed");
  const same = real.size === predicted.size && [...real].every((n) => predicted.has(n));
  return `<li class="test-result ${same ? "pass" : "fail"}">
    <span class="test-what">🔀 Test: switch on <b>${escapeHtml(label(id))}</b></span>
    <span>🌍 Real world: ${list(real)}</span>
    <span>✏️ Your theory: ${list(predicted)} ${same ? "✓" : "✗"}</span></li>`;
}
