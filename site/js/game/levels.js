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

// The breakfast club school, shared by levels 4 and 5. Breakfast club costs
// money, so richer families use it more; family money also helps pupils
// pass. The club itself changes nothing: the link is entirely Mr Confounder.
const BREAKFAST = {
  seed: 404,
  blocks: {
    richer: { kind: "yesno", say: ["Coming from a richer family", "pupils to come from richer families"], label: "Richer family", base: 0 },
    club: { kind: "yesno", say: ["Breakfast club", "pupils to go to breakfast club"], label: "Breakfast club", base: -1.73, from: { richer: 3.12 } },
    pass: { kind: "yesno", say: ["Passing the test", "pupils to pass the test"], label: "Passed the test", base: -1.39, from: { richer: 2.77 } },
  },
};

export const LEVELS = [
  {
    id: "cause",
    hunch: "You're the detective. Your first job: turn the newspaper's claim into a theory you can test, by drawing it.",
    case: "Revision club",
    caseIntro: "Hilltop School runs a revision club before the end-of-year test.",
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
        revision: { kind: "yesno", say: ["Revision club", "pupils to go to revision club"], label: "Revision club", base: 0 },
        pass: { kind: "yesno", say: ["Passing the test", "pupils to pass the test"], label: "Passed the test", base: -0.85, from: { revision: 2.24 } },
      },
    },
    watch: {
      statement: "{a} in 10 pupils who went to revision club passed. Only {b} in 10 of the others did.",
      groups: ["Went to revision club", "Didn't go"],
      outcome: "passed",
    },
    tolerance: 0.05,
    hint: "Arrows point from the cause to the thing it changes: from Revision club to Passed the test.",
    reveal: "That arrow is a big claim. It doesn't say revision club and passing just happen to go together. It says revision club causes passing: change one, and the other changes too. You're thinking like a scientist now, and this drawing is your theory of how the school works. (Scientists call it a causal model.)",
    traps: [{ name: "arrow the wrong way", edges: [["pass", "revision"]] }],
    alsoRight: [],
  },
  {
    id: "poke",
    hunch: "Is the paper right? Your theory: revision club really does cause passing. Draw it, then test it.",
    case: "Revision club",
    title: "Test it",
    teaches: "Test: send everyone and see what changes",
    headline: "Revision club helps pupils pass",
    story: "Your theory says revision club causes passing. But maybe those pupils would have passed anyway. There's one way to find out: test it, by sending everyone.",
    stages: ["watch", "build", "poke", "verdict"],
    introduces: "poke",
    meets: [],
    question: { treatment: "revision", outcome: "pass" },
    poke: { label: "Send everyone to revision club" },
    layout: { pass: [110, 150], revision: [520, 300] },
    world: {
      seed: 102,
      blocks: {
        revision: { kind: "yesno", say: ["Revision club", "pupils to go to revision club"], label: "Revision club", base: 0 },
        pass: { kind: "yesno", say: ["Passing the test", "pupils to pass the test"], label: "Passed the test", base: -0.85, from: { revision: 2.24 } },
      },
    },
    watch: {
      statement: "{a} in 10 pupils who went to revision club passed. Only {b} in 10 of the others did.",
      groups: ["Went to revision club", "Didn't go"],
      outcome: "passed",
    },
    tolerance: 0.05,
    hint: "For sending everyone to revision club to change who passes, your theory needs an arrow from Revision club to Passed the test.",
    reveal: "Making it happen for everyone means nothing else can explain the difference. Your theory predicted what the school would do, and it did: your arrow is real.",
    traps: [
      { name: "arrow the wrong way", edges: [["pass", "revision"]] },
      { name: "no arrow", edges: [] },
    ],
    alsoRight: [],
  },
  {
    id: "messenger",
    hunch: "You think there's more to it. Revision club helps pupils understand the topic, and understanding is what gets them the pass. Draw that chain.",
    case: "Revision club",
    title: "The middle block",
    teaches: "Effects travel through other blocks",
    headline: "Revision club works because pupils understand more",
    story: "Teachers think revision club doesn't hand out passes directly. It helps pupils understand the topic, and understanding is what gets them through.",
    stages: ["watch", "build", "poke", "verdict"],
    meets: ["mediator"],
    question: { treatment: "revision", outcome: "pass" },
    poke: { label: "Send everyone to revision club" },
    layout: { understand: [70, 60], pass: [560, 70], revision: [318, 350] },
    world: {
      seed: 103,
      blocks: {
        revision: { kind: "yesno", say: ["Revision club", "pupils to go to revision club"], label: "Revision club", base: 0 },
        understand: { kind: "yesno", say: ["Understanding the topic", "pupils to understand the topic"], label: "Understands topic", base: -1.1, from: { revision: 2.83 } },
        pass: { kind: "yesno", say: ["Passing the test", "pupils to pass the test"], label: "Passed the test", base: -1.39, from: { understand: 2.77 } },
      },
    },
    watch: {
      statement: "{a} in 10 pupils who went to revision club passed. Only {b} in 10 of the others did.",
      groups: ["Went to revision club", "Didn't go"],
      outcome: "passed",
    },
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
    hunch: "You're not sure the paper's right. You wonder if family money is behind both: richer families can afford breakfast club, and their children pass more often. Draw that.",
    case: "Breakfast club",
    caseIntro: "Hilltop runs a breakfast club before school. It costs £2 a morning.",
    bonus: true,
    title: "The hidden puppet master",
    teaches: "A hidden common cause fakes a link",
    headline: "Breakfast club raises grades!",
    story: "Pupils who go to Hilltop's breakfast club are far more likely to pass the test. The head wants to make it compulsory.",
    stages: ["watch", "build", "poke", "verdict"],
    meets: ["confounder"],
    question: { treatment: "club", outcome: "pass" },
    poke: { label: "Send everyone to breakfast club" },
    introducesSwitchOff: true,
    layout: { richer: [318, 40], club: [70, 340], pass: [566, 340] },
    world: BREAKFAST,
    watch: {
      statement: "{a} in 10 pupils who went to breakfast club passed. Only {b} in 10 of the others did.",
      groups: ["Breakfast club", "No breakfast club"],
      outcome: "passed",
    },
    tolerance: 0.05,
    hint: "Breakfast club costs £2 a morning. Who can afford it? Could the same thing also affect who passes?",
    reveal: "Breakfast club costs money, so pupils from richer families go more, and family money also helps pupils pass. That's Mr Confounder: one block pushing two others, so they move together. Send everyone to breakfast club and nothing changes. The link was fake.",
    traps: [
      { name: "breakfast club raises passes", edges: [["club", "pass"]] },
      { name: "family only affects passing", edges: [["richer", "pass"], ["club", "pass"]] },
    ],
    alsoRight: [
      { name: "family pushes both, club arrow too", edges: [["richer", "club"], ["richer", "pass"], ["club", "pass"]] },
      { name: "family pushes both, no club arrow", edges: [["richer", "club"], ["richer", "pass"]] },
    ],
  },
  {
    id: "freeze",
    hunch: "You can't send everyone to breakfast club. But what if you looked only at the richer pupils, then only the poorer ones? That would freeze the effect of family money.",
    case: "Breakfast club",
    bonus: true,
    title: "Freeze",
    teaches: "Freeze: compare like with like when you can't poke",
    headline: "The council won't let you poke",
    story: "In real life, you can't send every pupil to breakfast club just to find out. But you can be clever with the data you already have.",
    stages: ["watch", "freeze", "poke", "verdict"],
    introduces: "freeze",
    freezeOnly: true,
    meets: [],
    question: { treatment: "club", outcome: "pass" },
    poke: { label: "Magic: send everyone to breakfast club" },
    layout: { richer: [318, 40], club: [70, 340], pass: [566, 340] },
    startEdges: [["richer", "club"], ["richer", "pass"], ["club", "pass"]],
    world: BREAKFAST,
    watch: {
      statement: "{a} in 10 pupils who went to breakfast club passed. Only {b} in 10 of the others did.",
      groups: ["Breakfast club", "No breakfast club"],
      outcome: "passed",
    },
    tolerance: 0.05,
    hint: "Which block pushes on both breakfast club and passing? Freeze that one.",
    reveal: "Freezing Richer family compares breakfast club with no breakfast club among pupils from the same kind of family. Inside each group, breakfast club makes no difference. That's how real researchers answer causal questions when they can't make something happen.",
    freezeTraps: [
      { name: "freeze nothing", freeze: [] },
    ],
    freezeAnswer: ["richer"],
    freezeAlsoRight: [],
  },
  {
    id: "bouncer",
    hunch: "Something feels off about this one. Who exactly did the paper talk to?",
    case: "Scholarships",
    caseIntro: "Hilltop gives scholarships to pupils who are sporty, or good at maths.",
    bonus: true,
    title: "Who got in?",
    teaches: "Looking only at who got in creates a fake link",
    headline: "Sporty pupils are worse at maths",
    story: "The paper says sporty pupils are much weaker at maths. Does sport rot your maths?",
    stages: ["watch", "build", "poke", "verdict"],
    meets: ["collider"],
    question: { treatment: "sporty", outcome: "maths" },
    poke: { label: "Make everyone sporty" },
    firstBlocks: ["sporty", "maths"],
    layout: { sporty: [60, 60], maths: [60, 350], scholar: [540, 205] },
    world: {
      seed: 606,
      blocks: {
        sporty: { kind: "yesno", say: ["Being sporty", "pupils to be sporty"], label: "Sporty", base: 0 },
        maths: { kind: "yesno", say: ["Being good at maths", "pupils to be good at maths"], label: "Good at maths", base: 0 },
        scholar: { kind: "yesno", say: ["Getting a scholarship", "pupils to get a scholarship"], label: "Scholarship", base: -3, from: { sporty: 4, maths: 4 } },
      },
      // The headline only looks at scholarship pupils.
      select: ["scholar", 1],
    },
    watch: {
      everyone: "Across the whole school, sporty pupils are just as good at maths.",
      statement: "Of the sporty pupils the paper spoke to, only {a} in 10 were good at maths, against {b} in 10 of the others.",
      twist: "But the paper only interviewed scholarship pupils. Scholarships go to pupils who are sporty, or good at maths.",
      groups: ["Sporty", "Not sporty"],
      outcome: "good at maths",
    },
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
