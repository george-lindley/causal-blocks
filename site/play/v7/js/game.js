// Causal Blocks v7 (crowd): every level is a crowd showing a link between two things,
// and the player explains the link by drawing arrows. The engine knows
// nothing about any particular story: levels are data (levels/*.json).
//
// Loop: see the link → meet the suspects → draw → the game runs the test
// (the crowd moves) → the reveal (boxes take their colours, the character
// appears) or a kind hint and another go.

import { createBoard } from "../../../js/board.js";
import { Role, roles, primaryRole } from "../../../js/causal.js";
import { CAST, portrait } from "../../../js/game/cast.js";
import { people } from "./crowd-math.js";
import { createCrowd } from "./crowd-view.js";

const $ = (id) => document.getElementById(id);
const VIEW = { w: 440, h: 260 };
const NS = "http://www.w3.org/2000/svg";

// The level files' role names, as the cast and the board know them.
const ROLE = {
  cause: Role.TREATMENT, effect: Role.OUTCOME, confounder: Role.CONFOUNDER,
  messenger: Role.MEDIATOR, bouncer: Role.COLLIDER, decoy: Role.UNRELATED,
};
const NO_CAPTIONS = Object.fromEntries(Object.values(Role).map((r) => [r, ""]));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3500);
}

const game = { order: [], index: 0, level: null, crowd: null, view: null, step: "link", busy: false, hint: "", arrived: null };
const lv = () => game.level;

const board = createBoard($("canvas"), {
  label: (id) => lv().boxes[id].label,
  locked: () => true,
  onChange: () => drawDiagram(),
  toast,
  unknownCaption: "",
  roleText: NO_CAPTIONS,
  faces: true,
  view: VIEW,
});

// ---------------------------------------------------------------------------
// The diagram: boxes, the arrows drawn, the link line, the Cause/Effect hats
// ---------------------------------------------------------------------------

function onBoard() {
  const shown = new Set([lv().question.cause, lv().question.effect]);
  if (game.step !== "link") for (const id of lv().suspects ?? []) shown.add(id);
  return shown;
}

function drawDiagram() {
  const l = lv();
  const { cause, effect } = l.question;
  const revealed = game.step === "reveal";
  let colours = Object.fromEntries([...onBoard()].map((id) => [id, [Role.PRECISION]]));
  if (revealed) {
    const truth = roles({ nodes: [...onBoard()], edges: l.correctArrows }, cause, effect);
    colours = Object.fromEntries([...onBoard()].map((id) => [id, [primaryRole(truth[id])]]));
  }
  board.draw(colours);
  const svg = $("canvas");
  linkLine(svg);
  for (const [id, role] of [[cause, Role.TREATMENT], [effect, Role.OUTCOME]]) hat(svg, id, role);
  if (game.arrived) svg.querySelector(`[data-node="${game.arrived}"]`)?.classList.add("dropping");
  svg.classList.toggle("frozen", game.busy || game.step !== "draw");
}

/** The middle of a box's bottom edge, where the link line leaves it. */
function anchor(svg, id) {
  const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(svg.querySelector(`[data-node="${id}"]`)?.getAttribute("transform") ?? "");
  return m ? [Number(m[1]) + 82, Number(m[2]) + 56] : null;
}

/**
 * The grey line between the question boxes: what the crowd shows, not an
 * arrow. Its thickness comes from the crowd, so it thins as the columns even out.
 */
function linkLine(svg) {
  const { cause, effect } = lv().question;
  const p = anchor(svg, cause);
  const q = anchor(svg, effect);
  if (!p || !q) return;
  const s = Math.min(1, game.view.strength() / 0.5);
  const fake = game.step === "reveal" && !lv().linkReal;
  const real = game.step === "reveal" && lv().linkReal;
  const [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  // Sag below the boxes, like a rope between them.
  const [nx, ny] = [0, 110];
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", `link ${fake ? "fake" : ""} ${real ? "real" : ""}`);
  const d = `M${p[0]},${p[1]} Q${mx + nx},${my + ny} ${q[0]},${q[1]}`;
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  path.style.strokeWidth = real ? 9 : fake ? 3 : 2 + 12 * s;
  path.style.opacity = fake ? 0.5 : real ? 1 : 0.2 + 0.8 * s;
  g.appendChild(path);
  const label = document.createElementNS(NS, "text");
  label.setAttribute("x", mx + nx / 2);
  label.setAttribute("y", my + ny / 2 + 26);
  label.setAttribute("text-anchor", "middle");
  label.textContent = fake ? "fake link" : real ? "real link" : "link";
  label.style.opacity = fake ? 1 : 0.4 + 0.6 * s;
  g.appendChild(label);
  svg.insertBefore(g, svg.querySelector(".edge, .node"));
}

/** The v1 Cause and Effect characters, small, as hats on the two question boxes. */
function hat(svg, id, role) {
  const node = svg.querySelector(`[data-node="${id}"]`);
  if (!node) return;
  const h = document.createElementNS(NS, "svg");
  h.setAttribute("viewBox", "50 58 96 96"); // just the body and face
  h.setAttribute("x", -16);
  h.setAttribute("y", -30);
  h.setAttribute("width", 38);
  h.setAttribute("height", 44);
  h.setAttribute("class", "hat");
  h.innerHTML = CAST[role].art;
  node.appendChild(h);
}

// ---------------------------------------------------------------------------
// The panel: one step at a time
// ---------------------------------------------------------------------------

function render() {
  const l = lv();
  $("level-name").textContent = `${game.index + 1} · ${l.title}`;
  $("story").textContent = l.story;
  $("crowd-is").textContent = l.crowdIs ?? "";
  drawDiagram();
  $("panel").innerHTML = panel();
  for (const b of $("panel").querySelectorAll("[data-action]")) b.onclick = () => ACTIONS[b.dataset.action]();
}

function names(ids) {
  return ids.map((id) => `<b>${escapeHtml(lv().boxes[id].label)}</b>`).join(" and ");
}

function panel() {
  const l = lv();
  const t = l.text ?? {};
  switch (game.step) {
    case "link":
      return `<p>${escapeHtml(t.link ?? "")}</p>
        <button type="button" class="btn primary-btn" data-action="suspects">Next</button>`;
    case "suspects":
      return `<p>${escapeHtml(t.suspects ?? "")} ${names(l.suspects ?? [])}.</p>
        <button type="button" class="btn primary-btn" data-action="draw">Draw arrows</button>`;
    case "draw":
      return `<p>${escapeHtml(t.draw ?? "")} <span class="meta">Drag from a box's ⊕ to another box.</span></p>
        <button type="button" class="btn primary-btn" data-action="test">Test my theory</button>`;
    case "test":
      return `<p>${escapeHtml(t.test ?? "")}</p>`;
    case "wrong":
      return `<p class="v2-result lose">Not quite.</p><p class="hint-box">${escapeHtml(game.hint)}</p>
        <button type="button" class="btn primary-btn" data-action="retry">Try again</button>`;
    case "reveal": {
      const last = game.index + 1 >= game.order.length;
      const met = Object.entries(l.boxes).filter(([, b]) => ["confounder", "messenger", "bouncer"].includes(b.role));
      return `${celebrate()}
        <p class="v2-result win">You cracked it!</p>
        <p>${escapeHtml(t.reveal ?? "")}</p>
        ${met.map(([id, b]) => characterCard(ROLE[b.role], l.boxes[id].label)).join("")}
        <button type="button" class="btn primary-btn" data-action="next">${last ? "Play again" : "Next level →"}</button>`;
    }
    default:
      return "";
  }
}

// The v1 reveal: confetti and a character card.
function celebrate() {
  const colors = ["#fa953d", "#16a085", "#3498db", "#9b59b6", "#e74c3c", "#f1c40f"];
  const bits = Array.from({ length: 18 }, (_, k) =>
    `<i style="--x:${(k * 37) % 100}%;--d:${(k % 6) * 0.08}s;background:${colors[k % 6]}"></i>`).join("");
  return `<div class="confetti" aria-hidden="true">${bits}</div>`;
}

function characterCard(role, boxLabel) {
  const c = CAST[role];
  return `<div class="new-character" style="--c: ${c.color}">
    ${portrait(role, 92, c.name)}
    <div><span class="label">${escapeHtml(boxLabel)} was</span>
      <h4>${c.name}</h4>
      <p>${escapeHtml(c.line)}</p></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Checking the arrows
// ---------------------------------------------------------------------------

const key = ([a, b]) => `${a}>${b}`;

function isRight(edges) {
  const mine = new Set(edges.map(key));
  const want = new Set(lv().correctArrows.map(key));
  return mine.size === want.size && [...want].every((k) => mine.has(k));
}

/** The first hint whose condition fits what was drawn. */
function hintFor(edges) {
  const mine = new Set(edges.map(key));
  for (const h of lv().hints ?? []) {
    const has = (h.has ?? []).every((e) => mine.has(key(e)));
    const missing = (h.missing ?? []).every((e) => !mine.has(key(e)));
    if (has && missing) return h.text;
  }
  return lv().fallbackHint ?? "Not quite. Have another look at the crowd.";
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function runTest() {
  const l = lv();
  if (l.test === "split") await game.view.arrange({ kind: "split", by: l.splitBy });
  // force and doors arrive with their levels
}

const ACTIONS = {
  suspects() {
    game.step = "suspects";
    board.load(Object.fromEntries([...onBoard()].map((id) => [id, lv().layout[id]])), []);
    game.arrived = (lv().suspects ?? [])[0] ?? null;
    render();
    game.arrived = null;
  },
  draw() {
    game.step = "draw";
    render();
  },
  async test() {
    const edges = board.graph().edges;
    if (!edges.length) {
      toast("Draw at least one arrow first.");
      return;
    }
    game.step = "test";
    game.busy = true;
    render();
    await runTest();
    game.busy = false;
    if (isRight(edges)) {
      game.step = "reveal";
    } else {
      game.step = "wrong";
      game.hint = hintFor(edges);
    }
    render();
  },
  async retry() {
    game.step = "draw";
    game.busy = true;
    render();
    await game.view.arrange({ kind: "combined" });
    game.busy = false;
    render();
  },
  next() {
    start((game.index + 1) % game.order.length);
  },
};

async function start(index) {
  game.index = index;
  const id = game.order[index];
  game.level = await (await fetch(`levels/${id}.json`)).json();
  game.crowd = people(lv().crowd);
  game.step = "link";
  game.view = createCrowd($("crowd"), lv(), game.crowd);
  game.view.arrange({ kind: "combined" }, { instant: true });
  const { cause, effect } = lv().question;
  board.load({ [cause]: lv().layout[cause], [effect]: lv().layout[effect] }, []);
  render();
}

game.order = await (await fetch("levels/index.json")).json();
const asked = new URLSearchParams(location.search).get("level");
start(Math.max(0, game.order.indexOf(asked)));
