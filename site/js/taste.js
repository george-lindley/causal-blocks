// The homepage's ten-second taste: ice cream sales and shark attacks are
// linked (the dotted line). Draw Hot weather → both, and the link vanishes:
// Mr Confounder made it. Uses the same board as the game and the Sandbox.
import { createBoard } from "./board.js";
import { Role } from "./causal.js";

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const NAMES = { ice: "Ice cream sales", sharks: "Shark attacks", hot: "Hot weather" };
// A narrow board, so the blocks stay readable on a phone.
const LAYOUT = { ice: [10, 22], sharks: [226, 22], hot: [118, 226] };
const svg = $("taste");
let solved = false;

const board = createBoard(svg, {
  label: (id) => NAMES[id],
  locked: () => true,
  onChange: () => draw(),
  onEdit: () => { $("taste-toast").hidden = true; },
  toast: (m) => { $("taste-toast").textContent = m; $("taste-toast").hidden = false; },
  unknownCaption: "",
  roleText: Object.fromEntries(Object.values(Role).map((r) => [r, ""])),
  faces: true,
  view: { w: 400, h: 300 },
});

const has = (edges, a, b) => edges.some(([p, c]) => p === a && c === b);

function draw() {
  const edges = board.graph().edges;
  const right = has(edges, "hot", "ice") && has(edges, "hot", "sharks") && !has(edges, "ice", "sharks") && !has(edges, "sharks", "ice");
  if (right && !solved) solved = true;
  board.draw({ ice: [Role.TREATMENT], sharks: [Role.OUTCOME], hot: [solved ? Role.CONFOUNDER : Role.PRECISION] });
  svg.classList.toggle("solved", solved);
  svg.classList.toggle("board-locked", solved);
  // The dotted line: what the data shows (they go up together), not an arrow.
  const path = document.createElementNS(NS, "path");
  path.setAttribute("class", "together");
  path.setAttribute("d", "M92 78 Q200 170 308 78");
  const label = document.createElementNS(NS, "text");
  label.setAttribute("class", "together-label");
  label.setAttribute("x", 200);
  label.setAttribute("y", 152);
  label.setAttribute("text-anchor", "middle");
  label.textContent = "they go up together";
  svg.insertBefore(label, svg.querySelector(".edge, .node"));
  svg.insertBefore(path, label);
  const result = $("taste-result");
  if (solved) {
    result.className = "taste-result won";
    result.innerHTML = `<img src="https://play.causalblocks.com/img/cast/confounder.svg" alt="">Fake link! Hot weather was behind both. Meet Mr Confounder.`;
  } else if (has(edges, "ice", "sharks") || has(edges, "sharks", "ice")) {
    result.className = "taste-result nope";
    result.textContent = "That's the newspaper's guess. Can a cone make a shark bite?";
  } else {
    result.className = "taste-result";
    result.textContent = "";
  }
  svg.style.pointerEvents = solved ? "none" : "";
}

function start() {
  solved = false;
  board.load(LAYOUT, []);
  draw();
}
$("taste-reset").addEventListener("click", start);
start();
