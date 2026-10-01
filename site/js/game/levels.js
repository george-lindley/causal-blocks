// © 2026 George Lindley. All rights reserved. The level stories, headlines
// and explanations in this file are not covered by the repository's MIT
// licence; see CONTENT-LICENSE.md.
//
// Chapter 1: Hilltop School. Every level happens in the same school, so the
// player learns causal ideas rather than a new world each time, and each
// level adds exactly one new idea. Every block is yes/no, so every pattern
// can be shown as crowds you can count.
//
// Each level is a small fictional school (its true equations), a headline to
// test, and the words around it. `stages` lists the steps the level uses.
// `traps` are models a player is likely to build; `alsoRight` are models
// that differ from the truth but still predict the poke. tests/test_levels.py
// checks right answers land within `tolerance` of the truth and every trap
// misses by a clear margin, so no level can be won by luck or lost to noise.

// The breakfast club school, shared by levels 4 and 5.
const BREAKFAST = {
  seed: 404,
  blocks: {
    poorer: { kind: "yesno", label: "Poorer family", base: 0 },
    club: { kind: "yesno", label: "Breakfast club", base: -1.73, from: { poorer: 3.12 } },
    pass: { kind: "yesno", label: "Passed the test", base: 1.39, from: { poorer: -4.19, club: 1.4 } },
  },
};

export const LEVELS = [
  {
    id: "cause",
    title: "Meet the Cause and the Effect",
    teaches: "An arrow means “causes”",
    headline: "Revision club helps pupils pass",
    story: "Hilltop School runs a revision club before the end-of-year test. The headline says going to it makes pupils pass.",
    stages: ["watch", "build", "verdict"],
    tutorial: true,
    meets: ["treatment", "outcome"],
    question: { treatment: "revision", outcome: "pass" },
    layout: { revision: [130, 205], pass: [500, 205] },
    world: {
      seed: 101,
      blocks: {
        revision: { kind: "yesno", label: "Revision club", base: 0 },
        pass: { kind: "yesno", label: "Passed the test", base: -0.85, from: { revision: 2.24 } },
      },
    },
    watch: {
      statement: "Pupils at revision club were {ratio} as likely to pass.",
      groups: ["Went to revision club", "Didn't go"],
      outcome: "passed",
    },
    units: "percentage points",
    tolerance: 0.05,
    hint: "Arrows point from the cause to the thing it changes: from Revision club to Passed the test.",
    reveal: "That arrow is a big claim. It doesn't say revision club and passing just happen to go together. It says revision club causes passing: change one, and the other changes too. Every block-and-arrow drawing in this game is a set of claims like that.",
    traps: [{ name: "arrow the wrong way", edges: [["pass", "revision"]] }],
    alsoRight: [],
  },
  {
    id: "poke",
    title: "Poke it",
    teaches: "Poke: test an arrow by forcing the cause",
    headline: "Revision club helps pupils pass",
    story: "Your arrow says revision club causes passing. But maybe those pupils would have passed anyway. There's one way to find out: send everyone.",
    stages: ["watch", "build", "poke", "verdict"],
    introduces: "poke",
    meets: [],
    question: { treatment: "revision", outcome: "pass" },
    poke: { label: "Send everyone to revision club" },
    layout: { revision: [130, 205], pass: [500, 205] },
    world: {
      seed: 102,
      blocks: {
        revision: { kind: "yesno", label: "Revision club", base: 0 },
        pass: { kind: "yesno", label: "Passed the test", base: -0.85, from: { revision: 2.24 } },
      },
    },
    watch: {
      statement: "Pupils at revision club were {ratio} as likely to pass.",
      groups: ["Went to revision club", "Didn't go"],
      outcome: "passed",
    },
    units: "percentage points",
    tolerance: 0.05,
    hint: "Your model needs an arrow from Revision club to Passed the test for poking revision club to change anything.",
    reveal: "Poking forces a block for everyone, so nothing else can explain the difference. Your model predicted what the poked school would do, and it was right: your arrow is real.",
    traps: [
      { name: "arrow the wrong way", edges: [["pass", "revision"]] },
      { name: "no arrow", edges: [] },
    ],
    alsoRight: [],
  },
  {
    id: "messenger",
    title: "The middle block",
    teaches: "Effects travel through other blocks",
    headline: "Revision club works because pupils understand more",
    story: "Teachers think revision club doesn't hand out passes directly. It helps pupils understand the topic, and understanding is what gets them through.",
    stages: ["watch", "build", "poke", "verdict"],
    meets: ["mediator"],
    question: { treatment: "revision", outcome: "pass" },
    poke: { label: "Send everyone to revision club" },
    layout: { revision: [40, 205], understand: [318, 205], pass: [596, 205] },
    world: {
      seed: 103,
      blocks: {
        revision: { kind: "yesno", label: "Revision club", base: 0 },
        understand: { kind: "yesno", label: "Understands topic", base: -1.1, from: { revision: 2.83 } },
        pass: { kind: "yesno", label: "Passed the test", base: -1.39, from: { understand: 2.77 } },
      },
    },
    watch: {
      statement: "Pupils at revision club were {ratio} as likely to pass.",
      groups: ["Went to revision club", "Didn't go"],
      outcome: "passed",
    },
    units: "percentage points",
    tolerance: 0.05,
    hint: "Does revision club change the result directly, or does it change something else first?",
    reveal: "Revision club causes understanding, and understanding causes the pass. The effect travels along a chain. The block in the middle is the Messenger: he carries the effect from the Cause to the Effect.",
    traps: [
      // Understanding drawn as a cause of going to revision club: the model then holds it steady and hides the effect.
      { name: "understanding as a common cause", edges: [["understand", "revision"], ["understand", "pass"], ["revision", "pass"]] },
      { name: "revision unconnected", edges: [["understand", "pass"]] },
    ],
    alsoRight: [
      { name: "an extra direct arrow", edges: [["revision", "understand"], ["understand", "pass"], ["revision", "pass"]] },
    ],
  },
  {
    id: "confounder",
    title: "The hidden puppet master",
    teaches: "A hidden common cause fakes a link",
    headline: "Breakfast club lowers grades!",
    story: "Hilltop's free breakfast club looks like a disaster: pupils who go are far less likely to pass. The council wants to close it.",
    stages: ["watch", "build", "poke", "verdict"],
    meets: ["confounder"],
    question: { treatment: "club", outcome: "pass" },
    poke: { label: "Send everyone to breakfast club" },
    layout: { poorer: [318, 40], club: [70, 340], pass: [566, 340] },
    world: BREAKFAST,
    watch: {
      statement: "Pupils at breakfast club were {ratio} as likely to pass.",
      groups: ["Breakfast club", "No breakfast club"],
      outcome: "passed",
    },
    units: "percentage points",
    tolerance: 0.05,
    hint: "Who goes to a free breakfast club? Could the same thing also affect who passes?",
    reveal: "Breakfast club is free, so pupils from poorer families go more, and family money also affects who passes. That's Mr Confounder: one block pushing two others, so they move together. Send everyone to breakfast club and passes go up. The club helps.",
    traps: [
      { name: "breakfast club lowers passes", edges: [["club", "pass"]] },
      { name: "poorer only affects passing", edges: [["poorer", "pass"], ["club", "pass"]] },
    ],
    alsoRight: [
      { name: "family pushes both, club arrow too", edges: [["poorer", "club"], ["poorer", "pass"], ["club", "pass"]] },
    ],
  },
  {
    id: "freeze",
    title: "Freeze",
    teaches: "Freeze: compare like with like when you can't poke",
    headline: "The council won't let you poke",
    story: "In real life, you can't send every pupil to breakfast club just to find out. But you can be clever with the data you already have.",
    stages: ["watch", "freeze", "poke", "verdict"],
    introduces: "freeze",
    freezeOnly: true,
    meets: [],
    question: { treatment: "club", outcome: "pass" },
    poke: { label: "A magic poke: breakfast club for everyone" },
    layout: { poorer: [318, 40], club: [70, 340], pass: [566, 340] },
    startEdges: [["poorer", "club"], ["poorer", "pass"], ["club", "pass"]],
    world: BREAKFAST,
    watch: {
      statement: "Pupils at breakfast club were {ratio} as likely to pass.",
      groups: ["Breakfast club", "No breakfast club"],
      outcome: "passed",
    },
    units: "percentage points",
    tolerance: 0.05,
    hint: "Which block pushes on both breakfast club and passing? Freeze that one.",
    reveal: "Freezing Poorer family compares breakfast club with no breakfast club among pupils from the same kind of family. Inside each group, breakfast club helps. That's how real researchers answer causal questions without poking.",
    freezeTraps: [
      { name: "freeze nothing", freeze: [] },
      { name: "freeze passing", freeze: ["pass"] },
    ],
    freezeAnswer: ["poorer"],
    freezeAlsoRight: [],
  },
  {
    id: "bouncer",
    title: "Who got in?",
    teaches: "Looking only at who got in creates a fake link",
    headline: "Sporty pupils are worse at maths",
    story: "Hilltop gives scholarships for sport and for maths. Among the scholarship pupils, the sporty ones are much weaker at maths. Does sport rot your maths?",
    stages: ["watch", "build", "poke", "verdict"],
    meets: ["collider"],
    question: { treatment: "sporty", outcome: "maths" },
    poke: { label: "Make everyone sporty" },
    layout: { sporty: [60, 60], maths: [60, 350], scholar: [540, 205] },
    world: {
      seed: 606,
      blocks: {
        sporty: { kind: "yesno", label: "Sporty", base: 0 },
        maths: { kind: "yesno", label: "Good at maths", base: 0 },
        scholar: { kind: "yesno", label: "Scholarship", base: -3, from: { sporty: 4, maths: 4 } },
      },
      // The headline only looks at scholarship pupils.
      select: ["scholar", 1],
    },
    watch: {
      everyone: "Across the whole school, sporty pupils are just as good at maths.",
      statement: "Among scholarship pupils, sporty ones are much less likely to be good at maths.",
      groups: ["Sporty", "Not sporty"],
      outcome: "good at maths",
    },
    units: "percentage points",
    tolerance: 0.05,
    hint: "The headline only looks at scholarship pupils. How do you get a scholarship?",
    reveal: "Sport gets you a scholarship, and so does maths. So a sporty scholarship pupil didn't need to be good at maths to get in, while a non-sporty one did. Looking only at who got in creates the link. Scholarship is the Bouncer: two arrows meet at his door.",
    traps: [
      { name: "sport lowers maths", edges: [["sporty", "maths"], ["sporty", "scholar"], ["maths", "scholar"]] },
      { name: "sport lowers maths, no scholarship", edges: [["sporty", "maths"]] },
    ],
    alsoRight: [
      { name: "sport and maths unconnected", edges: [] },
    ],
  },
];
