// v8, Hot day, cold day: the same beach on two days, side by side. The hot
// day sells more ice cream and has shark attacks; the cold day doesn't. The
// newspaper says ice cream causes shark attacks. The player experiments on
// both days at once (close the stand, ban swimming), then draws what really
// causes what.
//
// The truth: Hot weather → Ice cream sales, Hot weather → Swimmers → Shark attacks.

import { createBoard } from "../../js/board.js";
import { Role } from "../../js/causal.js";
import { CAST, portrait } from "../../js/game/cast.js";

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

const BOXES = { icecream: "Ice cream sales", sharks: "Shark attacks", hot: "Hot weather", swimmers: "Swimmers" };
const LAYOUT = { icecream: [24, 20], sharks: [412, 20], swimmers: [24, 176], hot: [412, 176] };
const TRUTH = [["hot", "icecream"], ["hot", "swimmers"], ["swimmers", "sharks"]];
// Colours at the reveal: the newspaper's cause and effect, the puppet master, and his messenger.
const REVEAL = { icecream: Role.TREATMENT, sharks: Role.OUTCOME, hot: Role.CONFOUNDER, swimmers: Role.MEDIATOR };

const HINTS = [
  { has: [["icecream", "sharks"]], text: "Close the ice cream stand. Do the shark attacks stop?" },
  { has: [["sharks", "icecream"]], text: "Ban swimming: the attacks stop. Does the stand sell any less ice cream?" },
  { has: [["icecream", "swimmers"]], text: "Close the ice cream stand. Does anyone stop swimming?" },
  { has: [["hot", "sharks"]], text: "Ban swimming on the hot day. It's still hot, so why do the attacks stop?" },
  { missing: [["hot", "icecream"]], text: "Compare the two days. Why does the stand sell so much more on the hot day?" },
  { missing: [["hot", "swimmers"]], text: "Compare the two days. Why are there so many more swimmers on the hot day?" },
  { missing: [["swimmers", "sharks"]], text: "Ban swimming. What happens to the shark attacks?" },
];

const state = { step: "look", stand: true, swim: true, won: false };

// ---------------------------------------------------------------------------
// The two days
// ---------------------------------------------------------------------------

const DAYS = {
  hot: { icecreams: 9, swimmers: 8 },
  cold: { icecreams: 2, swimmers: 1 },
};
/** What happens on a day, given the experiments. One attack for every four swimmers. */
function outcome(day) {
  const icecreams = state.stand ? DAYS[day].icecreams : 0;
  const swimmers = state.swim ? DAYS[day].swimmers : 0;
  return { icecreams, swimmers, attacks: Math.floor(swimmers / 4) };
}

const SWIM_SPOTS = [[236, 196], [300, 222], [356, 188], [262, 252], [330, 262], [214, 236], [376, 238], [282, 182]];

function scene(day) {
  const hot = day === "hot";
  const { icecreams, swimmers, attacks } = outcome(day);
  const sky = hot
    ? `<rect width="400" height="160" fill="url(#sky-hot)"/>
       <g class="sun"><circle cx="330" cy="58" r="30" fill="#ffd23f"/>${Array.from({ length: 8 }, (_, k) =>
          `<path d="M330 58 m0 -42 v-14" stroke="#ffd23f" stroke-width="6" stroke-linecap="round" transform="rotate(${k * 45} 330 58)"/>`).join("")}</g>`
    : `<rect width="400" height="160" fill="url(#sky-cold)"/>
       <g class="cloud"><ellipse cx="110" cy="54" rx="58" ry="24" fill="#e9edf0"/><ellipse cx="150" cy="40" rx="40" ry="24" fill="#e9edf0"/></g>
       <g class="cloud slow"><ellipse cx="300" cy="70" rx="64" ry="22" fill="#dfe5e9"/><ellipse cx="270" cy="56" rx="36" ry="20" fill="#dfe5e9"/></g>
       <g class="rain">${Array.from({ length: 14 }, (_, k) => `<path d="M${30 + k * 27} ${95 + (k % 3) * 12} l-6 14" stroke="#8aa1b1" stroke-width="2.5" stroke-linecap="round"/>`).join("")}</g>`;
  const sea = `<path d="M196 160 H400 V300 H196 Z" fill="${hot ? "#2f8fd8" : "#4d6b7c"}"/>
    <path class="wave" d="M196 172 q14 -8 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="3"/>`;
  const sand = `<path d="M0 160 H210 L196 300 H0 Z" fill="${hot ? "#f3d38a" : "#c7bb98"}"/>`;
  const stand = state.stand
    ? `<rect x="34" y="96" width="120" height="84" rx="6" fill="#ffffff" stroke="#1f2933" stroke-width="3"/>
       <path d="M26 98 h136 l-10 -26 h-116 z" fill="#e74c3c" stroke="#1f2933" stroke-width="3"/>
       ${[0, 1, 2, 3].map((k) => `<path d="M${46 + k * 28} 72 h14 l3 26 h-20 z" fill="#ffffff"/>`).join("")}
       <text x="94" y="128" text-anchor="middle" class="sign">ICE CREAM</text>`
    : `<rect x="34" y="96" width="120" height="84" rx="6" fill="#9aa5ae" stroke="#1f2933" stroke-width="3"/>
       ${[0, 1, 2, 3, 4].map((k) => `<path d="M34 ${108 + k * 14} h120" stroke="#7d8891" stroke-width="2"/>`).join("")}
       <path d="M26 98 h136 l-10 -26 h-116 z" fill="#b8c0c6" stroke="#1f2933" stroke-width="3"/>
       <rect x="54" y="122" width="80" height="24" rx="5" fill="#c0392b"/><text x="94" y="139" text-anchor="middle" class="sign closed">CLOSED</text>`;
  const cones = Array.from({ length: icecreams }, (_, k) => {
    const x = 18 + (k % 5) * 34;
    const y = 200 + Math.floor(k / 5) * 46;
    return `<g class="cone" style="--d:${k * 0.12}s"><path d="M${x} ${y + 14} l12 26 l12 -26 z" fill="#e0a458" stroke="#a86b2d" stroke-width="2"/>
      <circle cx="${x + 12}" cy="${y + 10}" r="11" fill="${["#f7b2c4", "#fff4d6", "#a8e0c5"][k % 3]}"/></g>`;
  }).join("");
  const people = SWIM_SPOTS.slice(0, swimmers).map(([x, y], k) =>
    `<g class="swimmer" style="--d:${k * 0.15}s"><circle cx="${x}" cy="${y}" r="9" fill="#f2c094"/><path d="M${x - 15} ${y + 9} q15 -8 30 0" stroke="#f2c094" stroke-width="5" fill="none" stroke-linecap="round"/></g>`).join("");
  // Two sharks live off this beach whatever the weather. They only bite where there are swimmers.
  const fin = (x, y, cls) => `<path class="fin ${cls}" d="M${x} ${y} l14 -26 l10 26 z" fill="#34495e"/>`;
  const fins = fin(244, 286, "a") + fin(340, 214, "b");
  const bites = SWIM_SPOTS.slice(0, attacks).map(([x, y], k) =>
    `<g class="bite" style="--d:${0.8 + k * 0.4}s"><path d="M${x} ${y - 30} l5 12 l12 -4 l-6 11 l11 7 l-13 1 l1 13 l-9 -9 l-9 9 l1 -13 l-13 -1 l11 -7 l-6 -11 l12 4 z" fill="#ffffff" stroke="#c0392b" stroke-width="2.5"/>
      <text x="${x}" y="${y - 11}" text-anchor="middle" class="bang">!</text></g>`).join("");
  return `<defs>
      <linearGradient id="sky-hot" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4fb3ff"/><stop offset="1" stop-color="#bfe6ff"/></linearGradient>
      <linearGradient id="sky-cold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7f8e99"/><stop offset="1" stop-color="#b8c3ca"/></linearGradient>
    </defs>${sky}${sea}${sand}${stand}${cones}${fins}${people}${bites}`;
}

function drawDays() {
  for (const day of ["hot", "cold"]) {
    const { icecreams, attacks } = outcome(day);
    const svg = $(`scene-${day}`);
    svg.innerHTML = scene(day);
    svg.setAttribute("aria-label", `A ${day} day: ${icecreams} ice creams sold, ${attacks} shark attacks.`);
    $(`count-${day}`).innerHTML = `<span>🍦 <b>${icecreams}</b> ice cream${icecreams === 1 ? "" : "s"} sold</span>
      <span>🦈 <b>${attacks}</b> shark attack${attacks === 1 ? "" : "s"}</span>`;
  }
}

// ---------------------------------------------------------------------------
// Experiments: each switch acts on both days at once
// ---------------------------------------------------------------------------

function switchTo(id, on, words) {
  const b = $(id);
  b.setAttribute("aria-pressed", String(on));
  b.querySelector("b").textContent = on ? words[0] : words[1];
}

$("stand").onclick = () => {
  state.stand = !state.stand;
  switchTo("stand", state.stand, ["open", "closed"]);
  drawDays();
};
$("swim").onclick = () => {
  state.swim = !state.swim;
  switchTo("swim", state.swim, ["allowed", "banned"]);
  drawDays();
};

// ---------------------------------------------------------------------------
// Your theory
// ---------------------------------------------------------------------------

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3500);
}

const board = createBoard($("canvas"), {
  label: (id) => BOXES[id],
  locked: () => true,
  onChange: () => drawBoard(),
  toast,
  unknownCaption: "",
  roleText: Object.fromEntries(Object.values(Role).map((r) => [r, ""])),
  faces: true,
  view: { w: 600, h: 250 },
});

function drawBoard() {
  const colours = Object.fromEntries(Object.keys(BOXES).map((id) => [id, [state.won ? REVEAL[id] : Role.PRECISION]]));
  if (!state.won) {
    colours.icecream = [Role.TREATMENT];
    colours.sharks = [Role.OUTCOME];
  }
  board.draw(colours);
  $("canvas").classList.toggle("done", state.won);
}

const key = ([a, b]) => `${a}>${b}`;

function check() {
  const mine = new Set(board.graph().edges.map(key));
  if (!mine.size) {
    toast("Draw at least one arrow first.");
    return;
  }
  const right = mine.size === TRUTH.length && TRUTH.every((e) => mine.has(key(e)));
  if (right) {
    state.won = true;
    state.step = "won";
  } else {
    state.step = "wrong";
    state.hint = HINTS.find((h) => (h.has ?? []).every((e) => mine.has(key(e))) && (h.missing ?? []).every((e) => !mine.has(key(e))))?.text
      ?? "Not quite. Try both switches again and watch both days.";
  }
  render();
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function celebrate() {
  const colors = ["#fa953d", "#16a085", "#3498db", "#9b59b6", "#e74c3c", "#f1c40f"];
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, k) =>
    `<i style="--x:${(k * 37) % 100}%;--d:${(k % 6) * 0.08}s;background:${colors[k % 6]}"></i>`).join("")}</div>`;
}

function card(role, who, line) {
  const c = CAST[role];
  return `<div class="new-character" style="--c: ${c.color}">${portrait(role, 72, c.name)}
    <div><span class="label">${who} was</span><h4>${c.name}</h4><p>${line}</p></div></div>`;
}

function render() {
  const p = $("panel");
  if (state.step === "look") {
    p.innerHTML = `<p>The same beach on two days. On the hot day the stand sold lots of ice cream, and there were shark attacks.
      On the cold day, hardly any ice cream and no attacks. So does ice cream cause shark attacks?</p>
      <button type="button" class="btn primary-btn" id="go">Investigate</button>`;
    $("go").onclick = () => {
      state.step = "draw";
      $("controls").hidden = false;
      $("diagram").hidden = false;
      board.load(LAYOUT, []);
      render();
    };
  } else if (state.step === "draw") {
    p.innerHTML = `<p>Experiment with the switches: they change <b>both</b> days. Then draw what you think causes what.
      <span class="meta">Drag from a box's ⊕ to another box.</span></p>
      <button type="button" class="btn primary-btn" id="check">Check my theory</button>`;
    $("check").onclick = check;
  } else if (state.step === "wrong") {
    p.innerHTML = `<p class="v8-result lose">Not quite.</p><p class="hint-box">${state.hint}</p>
      <button type="button" class="btn primary-btn" id="check">Check again</button>`;
    $("check").onclick = check;
  } else {
    p.innerHTML = `${celebrate()}<p class="v8-result win">You cracked it!</p>
      <p>Ice cream doesn't cause shark attacks. Hot weather sells ice cream <i>and</i> sends people into the sea, where the sharks are.</p>
      <div class="v8-cards">
        ${card(Role.CONFOUNDER, "Hot weather", "Pulls two strings at once: ice cream sales and swimmers.")}
        ${card(Role.MEDIATOR, "Swimmers", "Carry the hot weather's effect out to the sharks. Ban swimming and the attacks stop.")}
      </div>`;
  }
  drawBoard();
}

drawDays();
render();
