// The crowd: little people standing in a four-corner grid. Columns are the
// Cause (yes, no), rows are the Effect (yes on top). People are SVG groups
// that keep their identity, so changing the arrangement (one grid, or one grid
// per pile) makes them walk to their new places.

import { linkStrength } from "./crowd-math.js";

const NS = "http://www.w3.org/2000/svg";
export const CROWD_VIEW = { w: 440, h: 300 };
const LABEL = 94; // left strip for the row labels
const STEP_X = 24; // spacing between people
const STEP_Y = 42;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function text(parent, x, y, str, cls, anchor = "middle") {
  el("text", { x, y, class: cls, "text-anchor": anchor }, parent).textContent = str;
}

/**
 * @param svg     the <svg> to draw into (viewBox 0 0 440 300)
 * @param level   the level: boxes, question, crowd people
 * @param crowd   expanded people (crowd-math people())
 */
export function createCrowd(svg, level, crowd) {
  const { cause, effect } = level.question;
  const cb = level.boxes[cause];
  const eb = level.boxes[effect];
  svg.replaceChildren();
  const back = el("g", { class: "crowd-back" }, svg);
  const front = el("g", { class: "crowd-people" }, svg);

  const figs = new Map();
  for (const p of crowd) {
    const g = el("g", { class: "person" }, front);
    g.style.setProperty("--delay", `${((p.id * 7) % 11) * 0.05}s`);
    el("circle", { cx: 8, cy: 7, r: 7 }, g);
    el("rect", { x: 0, y: 15, width: 16, height: 19, rx: 6 }, g);
    figs.set(p.id, g);
  }

  /** One grid in the rectangle (x, y, w, h); returns where each person stands. */
  function grid(group, x, y, w, h, { head, compact }) {
    const colW = w / 2;
    const top = y + head;
    const rowH = (h - head) / 2;
    const spots = new Map();
    const perRow = Math.max(1, Math.floor((colW - 10) / STEP_X));
    for (const [c, cv] of [[0, true], [1, false]]) {
      text(back, x + colW * c + colW / 2, top - 8, compact ? (cv ? cb.yes : cb.no) : (cv ? cb.yes : cb.no), `col-label ${cv ? "cause-yes" : ""}`);
      for (const [r, rv] of [[0, true], [1, false]]) {
        const cx = x + colW * c;
        const cy = top + rowH * r;
        const inCell = group.filter((p) => p[cause] === cv && p[effect] === rv);
        el("rect", {
          x: cx + 3, y: cy + 3, width: colW - 6, height: rowH - 6, rx: 12,
          class: `cell ${rv ? "effect-yes" : ""} ${cv ? "cause-yes" : ""} ${inCell.length ? "" : "empty"}`,
        }, back);
        inCell.forEach((p, k) => {
          spots.set(p.id, [cx + 9 + (k % perRow) * STEP_X, cy + 10 + Math.floor(k / perRow) * STEP_Y]);
        });
      }
    }
    return spots;
  }

  function rowLabels(top, h) {
    const rowH = (h - top) / 2;
    text(back, LABEL - 8, top + rowH / 2 + 4, eb.yes, "row-label effect-yes", "end");
    text(back, LABEL - 8, top + rowH * 1.5 + 4, eb.no, "row-label", "end");
  }

  const show = (visible) => crowd.filter((p) => visible(p));
  let current = { kind: "combined" };

  /**
   * Arrange the crowd. `{kind: "combined"}` is one grid; `{kind: "split", by}`
   * is one grid per value of the box `by`. Resolves when everyone has arrived.
   */
  function arrange(mode = current, { instant = false } = {}) {
    current = mode;
    back.replaceChildren();
    const { w, h } = CROWD_VIEW;
    let spots;
    if (mode.kind === "split") {
      const pileW = (w - LABEL) / 2;
      const byBox = level.boxes[mode.by];
      spots = new Map();
      [true, false].forEach((v, k) => {
        const px = LABEL + pileW * k;
        el("rect", { x: px + 1, y: 1, width: pileW - 2, height: h - 2, rx: 14, class: `pile ${v ? "pile-yes" : ""}` }, back);
        text(back, px + pileW / 2, 20, v ? byBox.yes : byBox.no, "pile-label");
        const pile = show((p) => p[mode.by] === v);
        for (const [id, at] of grid(pile, px + 4, 4, pileW - 8, h - 8, { head: 46, compact: true })) spots.set(id, at);
      });
      rowLabels(50, h - 4);
    } else {
      spots = grid(show(() => true), LABEL, 0, w - LABEL, h, { head: 30 });
      rowLabels(30, h);
    }
    for (const p of crowd) {
      const g = figs.get(p.id);
      const [x, y] = spots.get(p.id);
      g.style.transform = `translate(${x}px, ${y}px)`;
      g.classList.toggle("pile-yes", mode.kind === "split" && p[mode.by] === true);
    }
    // Placing the crowd for the first time: no walking in from the corner.
    front.classList.toggle("instant", instant);
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => front.classList.remove("instant")));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return new Promise((done) => setTimeout(done, reduce || instant ? 0 : 1900));
  }

  /** How strong the link between the question boxes looks right now (0 = none). */
  function strength() {
    if (current.kind === "split") {
      // Inside the piles: the biggest difference in any pile.
      return Math.max(...[true, false].map((v) =>
        Math.abs(linkStrength(crowd.filter((p) => p[current.by] === v), cause, effect) ?? 0)));
    }
    return Math.abs(linkStrength(crowd, cause, effect) ?? 0);
  }

  return { arrange, strength, mode: () => current };
}
