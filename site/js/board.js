// The drawing canvas: blocks, and arrows you draw, reverse and
// remove. Shared by the demo and "Try your own data". It knows nothing about
// data or estimates; the page tells it each block's roles and is told when the
// graph changes.

import { Role, findCycle, primaryRole } from "./causal.js";

const SVG_NS = "http://www.w3.org/2000/svg";
export const BW = 164; // block width, in viewBox units
export const BH = 56;
const VIEW = { w: 800, h: 470 };

// Where new blocks go, in order, skipping any spot already taken.
const SLOTS = [
  [24, 30], [24, 205], [24, 384], [230, 30], [230, 384], [430, 30], [430, 384], [626, 30], [626, 384], [230, 205],
  [430, 205], [626, 205], [130, 118], [330, 118], [530, 118], [130, 295], [330, 295], [530, 295],
];

export const ROLE_TEXT = {
  [Role.CONFOUNDER]: "Confounder",
  [Role.MEDIATOR]: "Mediator",
  [Role.COLLIDER]: "Collider",
  [Role.INSTRUMENT]: "Instrument",
  [Role.PRECISION]: "Outcome cause",
  [Role.UNRELATED]: "Unrelated",
  [Role.TREATMENT]: "Treatment",
  [Role.OUTCOME]: "Outcome",
};
// Characters of a block's name that fit on it; longer names are cut with "…".
const MAX_LABEL = 17;
// Fills that need light text for contrast.
const STRONG_FILL = new Set([Role.MEDIATOR, Role.COLLIDER]);

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// Where the line from a block's centre towards (tx, ty) leaves its border.
function exitPoint(p, tx, ty, pad = 0) {
  const cx = p.x + BW / 2;
  const cy = p.y + BH / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const sx = dx ? (BW / 2 + pad) / Math.abs(dx) : Infinity;
  const sy = dy ? (BH / 2 + pad) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

/**
 * @param svg      the <svg> element to draw into
 * @param options  label(id): display name; locked(id): true if the block can't
 *                 be removed; onEdit(): the graph's structure was changed by
 *                 the user; onChange(): anything visible changed, re-render;
 *                 toast(message): show a short message; unknownCaption: the
 *                 caption for a block with no role given (the game leaves it blank)
 */
export function createBoard(svg, {
  label, locked = () => false, onEdit = () => {}, onChange, toast,
  unknownCaption = ROLE_TEXT[Role.UNRELATED],
  roleText = ROLE_TEXT, // captions per role; the game uses character names
  faces = false, // give blocks with a known role a pair of eyes
  view = VIEW, // the drawing area in viewBox units; must match the svg's viewBox
  // Simpler controls for players: press anywhere on a block to start an arrow
  // (blocks don't move), every arrow always shows its reverse and remove
  // buttons, and drawing over an existing arrow the other way reverses it.
  easyArrows = true,
}) {
  const s = {
    pos: new Map(), // id -> {x, y}
    edges: [], // [parent, child]
    selectedNode: null,
    selectedEdge: null, // index into edges
    drag: null, // {id, dx, dy, moved}
    connect: null, // {from, x, y, dragging, sx, sy}
    roles: {}, // last roles drawn; dragging redraws without recomputing them
    frozen: new Set(),
  };

  function edited() {
    onEdit();
    onChange();
  }

  // ---- Edits -------------------------------------------------------------

  function load(pos, edges) {
    s.pos = new Map(Object.entries(pos).map(([id, [x, y]]) => [id, { x, y }]));
    s.edges = edges.map((e) => [...e]);
    s.selectedNode = s.selectedEdge = s.connect = null;
  }

  /** Keep only the blocks in `ids` (and arrows between them), where they are. */
  function retain(ids) {
    for (const id of [...s.pos.keys()]) if (!ids.has(id)) s.pos.delete(id);
    s.edges = s.edges.filter(([p, c]) => ids.has(p) && ids.has(c));
    s.selectedNode = s.selectedEdge = s.connect = null;
  }

  function place(id) {
    if (s.pos.has(id)) return false;
    const free = SLOTS.find(([x, y]) =>
      [...s.pos.values()].every((p) => Math.abs(p.x - x) > BW - 20 || Math.abs(p.y - y) > BH + 10),
    ) ?? [view.w / 2 - BW / 2, view.h / 2 - BH / 2];
    s.pos.set(id, { x: free[0], y: free[1] });
    onEdit();
    return true;
  }

  function removeNode(id) {
    if (locked(id)) return;
    s.pos.delete(id);
    s.edges = s.edges.filter(([p, c]) => p !== id && c !== id);
    s.selectedNode = s.selectedEdge = null;
    edited();
  }

  function addEdge(from, to) {
    if (from === to) return;
    if (s.edges.some(([p, c]) => p === from && c === to)) return;
    const opposite = s.edges.findIndex(([p, c]) => p === to && c === from);
    if (opposite >= 0) {
      if (easyArrows) reverseEdge(opposite);
      else toast(`There is already an arrow from ${label(to)} to ${label(from)}. Click it and choose Reverse to flip it.`);
      return;
    }
    const next = [...s.edges, [from, to]];
    const cycle = findCycle({ nodes: [...s.pos.keys()], edges: next });
    if (cycle) {
      toast("That arrow would make a loop. Causes can't go round in a circle.");
      return;
    }
    s.edges = next;
    onEdit();
  }

  /** Add an arrow from code (no loop check needed by callers that know the graph). */
  function link(from, to) {
    if (s.pos.has(from) && s.pos.has(to) && !s.edges.some(([p, c]) => p === from && c === to)) s.edges.push([from, to]);
  }

  function reverseEdge(i) {
    const [p, c] = s.edges[i];
    const next = s.edges.map((e, j) => (j === i ? [c, p] : e));
    const cycle = findCycle({ nodes: [...s.pos.keys()], edges: next });
    if (cycle) {
      toast("Reversing that would make a loop. Causes can't go round in a circle.");
      return;
    }
    s.edges = next;
    edited();
  }

  function removeEdge(i) {
    s.edges.splice(i, 1);
    s.selectedEdge = null;
    edited();
  }

  // ---- Drawing -----------------------------------------------------------

  function tool(parent, x, y, action, arg, d, title) {
    const g = el("g", { class: "tool", transform: `translate(${x},${y})`, "data-action": action, "data-arg": arg }, parent);
    el("title", {}, g).textContent = title;
    el("circle", { r: 14 }, g);
    el("path", { d }, g);
  }

  /**
   * Redraw. `roleMap` colours and captions each block; `frozen` (a Set of
   * ids) marks blocks held steady, as the game's Freeze step shows them.
   */
  function draw(roleMap = s.roles, { frozen = s.frozen } = {}) {
    s.roles = roleMap;
    s.frozen = frozen;
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    for (const [name, color] of [["arrow", "var(--edge)"], ["arrow-on", "var(--accent)"]]) {
      const m = el("marker", {
        id: name, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse",
      }, defs);
      el("path", { d: "M0,0 L10,5 L0,10 z", fill: color }, m);
    }

    s.edges.forEach(([p, c], i) => {
      const a = s.pos.get(p);
      const b = s.pos.get(c);
      const [x1, y1] = exitPoint(a, b.x + BW / 2, b.y + BH / 2, 2);
      const [x2, y2] = exitPoint(b, a.x + BW / 2, a.y + BH / 2, 6);
      const selected = s.selectedEdge === i;
      const g = el("g", { class: `edge${selected ? " selected" : ""}`, "data-edge": i }, svg);
      const d = `M${x1},${y1} L${x2},${y2}`;
      el("path", { class: "hit", d }, g);
      el("path", { class: "line", d, "marker-end": `url(#${selected ? "arrow-on" : "arrow"})` }, g);
    });

    if (s.connect) {
      const a = s.pos.get(s.connect.from);
      const [sx, sy] = easyArrows ? [a.x + BW / 2, a.y + BH / 2] : [a.x + BW, a.y + BH / 2];
      el("path", { class: "pending", d: `M${sx},${sy} L${s.connect.x},${s.connect.y}` }, svg);
    }

    for (const [id, p] of s.pos) {
      const role = primaryRole(roleMap[id] ?? [Role.UNRELATED]);
      const g = el("g", {
        class: `node${s.drag?.id === id ? " dragging" : ""}`,
        "data-node": id,
        transform: `translate(${p.x},${p.y})`,
      }, svg);
      const text = STRONG_FILL.has(role) ? "var(--on-role-strong)" : "var(--on-role)";
      const selected = s.selectedNode === id;
      el("rect", {
        class: "body", width: BW, height: BH, rx: 12, fill: `var(--role-${role})`,
        stroke: frozen.has(id) ? "var(--frozen, #7cc4ef)" : selected ? "var(--ink)" : "rgba(0,0,0,0.18)",
        "stroke-width": frozen.has(id) ? 5 : 2,
        "stroke-dasharray": role === Role.COLLIDER ? "6 4" : "none",
      }, g);
      const full = label(id);
      const name = el("text", { class: "name", x: 14, y: 26, fill: text }, g);
      name.textContent = full.length > MAX_LABEL ? `${full.slice(0, MAX_LABEL - 1)}…` : full;
      if (full.length > MAX_LABEL) el("title", {}, g).textContent = full;
      const all = roleMap[id] ?? [];
      el("text", { class: "role", x: 14, y: 45, fill: text, opacity: 0.85 }, g).textContent =
        frozen.has(id) ? "❄ Frozen"
          : !(id in roleMap) ? unknownCaption
          : all.length > 1 ? all.map((x) => roleText[x]).join(" + ") : roleText[role];
      if (faces && id in roleMap) {
        // Two eyes peeking over the top edge: it's a character now.
        for (const ex of [BW - 46, BW - 28]) {
          el("circle", { cx: ex, cy: 0, r: 8, fill: "#fff", stroke: "rgba(0,0,0,0.18)", "stroke-width": 1.5 }, g);
          el("circle", { cx: ex + 1.5, cy: 1, r: 3.8, fill: "#1f2933" }, g);
        }
      }

      if (easyArrows) {
        if (s.connect?.from === id) g.classList.add("connecting");
      } else {
        const port = el("g", {
          class: `port${s.connect?.from === id ? " active" : ""}`,
          "data-port": id,
          transform: `translate(${BW},${BH / 2})`,
        }, g);
        el("circle", { r: 18, fill: "transparent" }, port);
        el("circle", { class: "dot", r: 9 }, port);
        el("path", { d: "M-4,0 H4 M0,-4 V4" }, port);
      }

      if (selected && !locked(id)) {
        tool(g, BW - 2, 2, "remove-node", id, "M-4,-4 L4,4 M4,-4 L-4,4", `Remove ${label(id)}`);
      }
    }

    // Edge toolbar last, so it sits on top: on every arrow with easyArrows,
    // otherwise on the selected one.
    if (easyArrows) {
      s.edges.forEach(([p, c], i) => {
        const a = s.pos.get(p);
        const b = s.pos.get(c);
        const mx = (a.x + b.x) / 2 + BW / 2;
        const my = (a.y + b.y) / 2 + BH / 2;
        tool(svg, mx - 15, my, "reverse-edge", i, "M-5,-3 H5 L2,-6 M5,3 H-5 L-2,6", "Reverse arrow");
        tool(svg, mx + 15, my, "remove-edge", i, "M-4,-4 L4,4 M4,-4 L-4,4", "Remove arrow");
      });
    } else if (s.selectedEdge !== null && s.edges[s.selectedEdge]) {
      const [p, c] = s.edges[s.selectedEdge];
      const a = s.pos.get(p);
      const b = s.pos.get(c);
      const mx = (a.x + b.x) / 2 + BW / 2;
      const my = (a.y + b.y) / 2 + BH / 2;
      tool(svg, mx - 18, my, "reverse-edge", s.selectedEdge, "M-5,-3 H5 L2,-6 M5,3 H-5 L-2,6", "Reverse arrow");
      tool(svg, mx + 18, my, "remove-edge", s.selectedEdge, "M-4,-4 L4,4 M4,-4 L-4,4", "Remove arrow");
    }
  }

  // ---- Input -------------------------------------------------------------

  function toView(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function nodeAt(x, y) {
    for (const [id, p] of s.pos) {
      if (x >= p.x && x <= p.x + BW && y >= p.y && y <= p.y + BH) return id;
    }
    return null;
  }

  svg.addEventListener("pointerdown", (evt) => {
    const target = evt.target.closest("[data-action], [data-port], [data-node], [data-edge]");
    const p = toView(evt);

    if (target?.dataset.action) {
      const arg = target.dataset.arg;
      if (target.dataset.action === "remove-node") removeNode(arg);
      if (target.dataset.action === "reverse-edge") reverseEdge(Number(arg));
      if (target.dataset.action === "remove-edge") removeEdge(Number(arg));
      evt.preventDefault();
      return;
    }
    if (target?.dataset.port) {
      s.connect = { from: target.dataset.port, x: p.x, y: p.y, dragging: true, sx: p.x, sy: p.y };
      s.selectedEdge = null;
      evt.preventDefault();
      onChange();
      return;
    }
    if (target?.dataset.node) {
      const id = target.dataset.node;
      if (s.connect && !s.connect.dragging) {
        addEdge(s.connect.from, id);
        s.connect = null;
        onChange();
        return;
      }
      if (easyArrows) {
        s.connect = { from: id, x: p.x, y: p.y, dragging: true, sx: p.x, sy: p.y };
        s.selectedEdge = null;
        evt.preventDefault();
        onChange();
        return;
      }
      const pos = s.pos.get(id);
      s.drag = { id, dx: p.x - pos.x, dy: p.y - pos.y, moved: false };
      s.selectedEdge = null;
      evt.preventDefault();
      return;
    }
    if (target?.dataset.edge) {
      s.selectedEdge = Number(target.dataset.edge);
      s.selectedNode = null;
      s.connect = null;
      onChange();
      return;
    }
    s.selectedEdge = s.selectedNode = s.connect = null;
    onChange();
  });

  window.addEventListener("pointermove", (evt) => {
    if (!s.drag && !s.connect) return;
    const p = toView(evt);
    if (s.drag) {
      const x = Math.max(0, Math.min(view.w - BW, p.x - s.drag.dx));
      const y = Math.max(0, Math.min(view.h - BH, p.y - s.drag.dy));
      const pos = s.pos.get(s.drag.id);
      if (Math.abs(pos.x - x) + Math.abs(pos.y - y) > 1) s.drag.moved = true;
      s.pos.set(s.drag.id, { x, y });
    } else {
      s.connect.x = p.x;
      s.connect.y = p.y;
    }
    draw(); // position only: roles and estimates are unchanged
  });

  window.addEventListener("pointerup", (evt) => {
    if (s.drag) {
      const { id, moved } = s.drag;
      s.drag = null;
      if (!moved) s.selectedNode = s.selectedNode === id ? null : id;
      onChange();
      return;
    }
    if (s.connect?.dragging) {
      const p = toView(evt);
      const target = nodeAt(p.x, p.y);
      const travelled = Math.hypot(p.x - s.connect.sx, p.y - s.connect.sy);
      if (target && target !== s.connect.from) {
        addEdge(s.connect.from, target);
        s.connect = null;
      } else if (travelled < 12) {
        // A tap on the handle: wait for a tap on the target block.
        s.connect.dragging = false;
        toast(`Now click the block that ${label(s.connect.from)} causes.`);
      } else {
        s.connect = null;
      }
      onChange();
    }
  });

  window.addEventListener("keydown", (evt) => {
    if (evt.target.closest?.("select, input, textarea")) return;
    if (evt.key === "Escape") {
      s.connect = s.selectedEdge = s.selectedNode = null;
      onChange();
    } else if (evt.key === "Delete" || evt.key === "Backspace") {
      if (s.selectedEdge !== null) removeEdge(s.selectedEdge);
      else if (s.selectedNode) removeNode(s.selectedNode);
    }
  });

  return {
    load,
    retain,
    place,
    link,
    draw,
    has: (id) => s.pos.has(id),
    graph: () => ({ nodes: [...s.pos.keys()], edges: s.edges }),
  };
}
