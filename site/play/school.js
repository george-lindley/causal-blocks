// Secret graphs for the wiggle variants: the same Hilltop School blocks as the
// prototype, one new shape per level. Every graph is already as lean as it can
// be (no arrow is covered by a longer route), so its arrow count is the par.
// `locked` blocks can't be tested in real life; the player has the data instead.

export const LEVELS = [
  {
    id: "two",
    title: "Two blocks",
    hint: "Tap a block to test it. Then switch to Draw and drag from one block's ⊕ to another to draw your theory.",
    blocks: { revision: "Revision club", pass: "Pass exam" },
    edges: [["revision", "pass"]],
    layout: { pass: [520, 300], revision: [120, 120] },
  },
  {
    id: "which-way",
    title: "Which way?",
    blocks: { confident: "Feel confident", pass: "Pass exam" },
    edges: [["pass", "confident"]],
    layout: { confident: [140, 110], pass: [480, 290] },
  },
  {
    id: "chain",
    title: "A chain",
    blocks: { revision: "Revision club", understand: "Understand topic", pass: "Pass exam" },
    edges: [["revision", "understand"], ["understand", "pass"]],
    layout: { pass: [90, 330], revision: [560, 330], understand: [320, 70] },
  },
  {
    id: "fork",
    title: "Can't test that",
    locked: { richer: "You can't pick a random half of families and make them richer." },
    lockIntro: true,
    blocks: { breakfast: "Breakfast club", pass: "Pass exam", richer: "Richer family" },
    edges: [["richer", "breakfast"], ["richer", "pass"]],
    layout: { breakfast: [80, 90], pass: [560, 100], richer: [330, 340] },
  },
  {
    id: "door",
    title: "Two into one",
    blocks: { scholar: "Scholarship", sporty: "Sporty", maths: "Maths whizz" },
    edges: [["sporty", "scholar"], ["maths", "scholar"]],
    layout: { scholar: [320, 80], sporty: [90, 330], maths: [560, 330] },
  },
  {
    id: "four",
    title: "Four blocks",
    blocks: { revision: "Revision club", understand: "Understand topic", pass: "Pass exam", sleep: "Good sleep" },
    edges: [["revision", "understand"], ["understand", "pass"], ["sleep", "pass"]],
    layout: { understand: [70, 60], pass: [560, 360], sleep: [560, 70], revision: [90, 340] },
  },
  {
    id: "five",
    title: "Five blocks",
    data: "locked",
    locked: { richer: "You can't pick a random half of families and make them richer." },
    blocks: { breakfast: "Breakfast club", awake: "Wide awake", pass: "Pass exam", richer: "Richer family", tutor: "Private tutor" },
    edges: [["richer", "breakfast"], ["richer", "tutor"], ["breakfast", "awake"], ["awake", "pass"], ["tutor", "pass"]],
    layout: { richer: [320, 30], pass: [600, 190], breakfast: [500, 390], awake: [130, 390], tutor: [40, 190] },
  },
];
