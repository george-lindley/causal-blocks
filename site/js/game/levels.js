// © 2026 George Lindley. All rights reserved. The level stories, headlines
// and explanations in this file are not covered by the repository's MIT
// licence; see CONTENT-LICENSE.md.
//
// The levels. Each one is a small fictional town (its true equations), a
// headline to test, and the words around it. The towns are invented, with
// realistic-looking numbers; because we made them, we know the true answer.
//
// `traps` are graphs a player is likely to build. `alsoRight` are graphs that
// differ from the truth but still predict the poke correctly (an extra arrow
// that makes no difference), so they must win too. tests/test_levels.py checks
// that right answers land within `tolerance` of the truth and every trap
// misses by a clear margin, so a level can't be won by luck or lost to noise.

export const LEVELS = [
  {
    id: "school",
    layout: { revised: [40, 205], knowledge: [318, 205], score: [596, 205] },
    place: "The school",
    lesson: "Effects pass through things",
    headline: "Revising raises test scores",
    meets: "mediator",
    watch: {
      statement: "Pupils who revised scored {diff} higher.",
      detail: "Average score: {a} for pupils who went to revision club, {b} for those who didn't.",
      groups: ["Revised", "Didn't revise"],
    },
    challenge: {
      text: "Build a model that says revising does nothing, then see how far its prediction lands from the truth.",
      model: { edges: [["knowledge", "revised"], ["knowledge", "score"], ["revised", "score"]] },
    },
    prompts: [
      "Draw an arrow from Knowledge to Revised instead. Your model now freezes Knowledge. What happens to the prediction?",
      "Remove the arrow into Knowledge. Is revising still connected to the score?",
    ],
    story: "Some pupils at Hilltop School went to revision club before the maths test. Did it help?",
    question: { treatment: "revised", outcome: "score" },
    poke: { block: "revised", label: "Send everyone to revision club" },
    world: {
      seed: 101,
      blocks: {
        revised: { kind: "yesno", label: "Revised", base: -0.2 },
        knowledge: { kind: "number", label: "Knowledge", base: 50, sd: 8, from: { revised: 8 } },
        score: { kind: "number", label: "Test score", base: 20, sd: 6, from: { knowledge: 0.9 } },
      },
    },
    units: "points",
    tolerance: 1.5,
    hint: "Revising doesn't hand out marks directly. What does it change first?",
    reveal: "Revising builds knowledge, and knowledge raises the score. The effect travels along a chain. Freeze Knowledge and the effect of revising disappears, because Knowledge is the road it travels on. That middle block is called a mediator.",
    alsoRight: [
      { name: "an extra direct arrow", edges: [["revised", "knowledge"], ["knowledge", "score"], ["revised", "score"]] },
    ],
    traps: [
      // Knowledge drawn as a cause of revising: the graph then holds it steady, hiding the effect.
      { name: "knowledge as a common cause", edges: [["knowledge", "revised"], ["knowledge", "score"], ["revised", "score"]] },
      { name: "revising unconnected", edges: [["knowledge", "score"]] },
    ],
  },
  {
    id: "beach",
    layout: { sunny: [318, 40], icecream: [70, 340], sunburn: [566, 340] },
    place: "The beach",
    lesson: "A hidden common cause fakes a link",
    headline: "Ice cream causes sunburn!",
    meets: "confounder",
    watch: {
      statement: "Ice-cream eaters are {ratio} as likely to get sunburnt.",
      detail: "{a} of children with an ice cream went home burnt. Only {b} of those without one did.",
      groups: ["With ice cream", "No ice cream"],
    },
    challenge: {
      text: "Build the newspaper's model, where ice cream causes sunburn and nothing else matters.",
      model: { edges: [["icecream", "sunburn"]] },
    },
    prompts: [
      "Delete the arrow from Sunny day to Ice cream. What does your model predict now, and why?",
      "Add an arrow from Ice cream to Sunburn, keeping both arrows from Sunny day. Does the prediction move?",
    ],
    story: "At Seaview beach, children eating ice cream are far more likely to go home sunburnt. Should the ice cream van be banned?",
    question: { treatment: "icecream", outcome: "sunburn" },
    poke: { block: "icecream", label: "Hand everyone an ice cream" },
    world: {
      seed: 202,
      blocks: {
        sunny: { kind: "yesno", label: "Sunny day", base: 0 },
        icecream: { kind: "yesno", label: "Ice cream", base: -1.6, from: { sunny: 2.4 } },
        sunburn: { kind: "yesno", label: "Sunburn", base: -2.6, from: { sunny: 2.6 } },
      },
    },
    units: "percentage points",
    tolerance: 0.05,
    hint: "Ice cream and sunburn both happen more on certain days. What else is going on?",
    reveal: "Sunny days bring out the ice creams and the sunburn. Ice cream itself does nothing. Sunshine is a hidden common cause: it makes two things move together without either causing the other. That's called a confounder.",
    alsoRight: [
      { name: "sun causes both, headline arrow kept", edges: [["sunny", "icecream"], ["sunny", "sunburn"], ["icecream", "sunburn"]] },
    ],
    traps: [
      { name: "ice cream causes sunburn", edges: [["icecream", "sunburn"]] },
      { name: "sun only causes sunburn", edges: [["sunny", "sunburn"], ["icecream", "sunburn"]] },
    ],
  },
  {
    id: "football",
    layout: { talent: [60, 60], luck: [60, 350], team: [540, 205] },
    place: "The football ground",
    lesson: "Only looking at winners creates a link",
    headline: "Lucky players are less talented",
    meets: "collider",
    watch: {
      everyone: "In the whole town, luck and talent aren't linked.",
      everyoneDetail: "The line is flat: lucky and unlucky players are just as talented.",
      statement: "On the team, luckier players are less talented.",
      detail: "Only {kept} of {total} players made the team. Among them, the line slopes down.",
    },
    challenge: {
      text: "Build the scouts' model, where luck really does lower talent.",
      model: { edges: [["luck", "talent"], ["talent", "team"], ["luck", "team"]] },
    },
    prompts: [
      "Draw an arrow from Luck to Talent. The model now trusts the team-only data. What does it predict?",
      "Remove Made the team from your thinking: if you could see everyone, would luck and talent be linked?",
    ],
    story: "Scouts studied the players who made Riverside's team. The luckiest ones turned out to be the least talented. Does luck make you worse?",
    question: { treatment: "luck", outcome: "talent" },
    poke: { block: "luck", label: "Give everyone a lucky break" },
    world: {
      seed: 303,
      blocks: {
        talent: { kind: "number", label: "Talent", base: 0, sd: 1 },
        luck: { kind: "number", label: "Luck", base: 0, sd: 1 },
        team: { kind: "yesno", label: "Made the team", base: -2.2, from: { talent: 1.8, luck: 1.8 } },
      },
      // We only ever see players who made the team.
      select: ["team", 1],
    },
    units: "talent points",
    tolerance: 0.08,
    hint: "You're only looking at players who made the team. How do you get picked?",
    reveal: "Talent and luck each help you make the team. Among the players who got in, someone with little talent must have had a lot of luck, so the two look opposite. In the whole town they're unrelated. Making the team is a collider: two arrows meet there, and looking only at one side of it creates a fake link.",
    alsoRight: [
      { name: "luck and talent unconnected", edges: [] },
    ],
    traps: [
      { name: "luck lowers talent", edges: [["luck", "talent"], ["talent", "team"], ["luck", "team"]] },
      { name: "luck lowers talent, no team", edges: [["luck", "talent"]] },
    ],
  },
  {
    id: "detective",
    layout: { income: [318, 30], club: [40, 250], energy: [318, 390], grades: [596, 250] },
    place: "The detective's office",
    lesson: "Freeze the right block",
    headline: "Breakfast club lowers grades!",
    meets: "confounder",
    watch: {
      statement: "Children at breakfast club score {absdiff} lower.",
      detail: "Average grade: {a} at breakfast club, {b} for everyone else.",
      groups: ["Breakfast club", "No breakfast club"],
    },
    challenge: {
      text: "Freeze nothing, like the council did, and see what that predicts.",
      model: { freeze: [] },
    },
    prompts: [
      "Freeze Morning energy as well as Family income. Why does the effect disappear?",
      "Freeze only Morning energy. What goes wrong?",
    ],
    story: "Pupils who go to Oakfield's free breakfast club get lower grades. The council wants to close it. You can't send every child to breakfast club to find out, so you'll have to be a detective.",
    question: { treatment: "club", outcome: "grades" },
    poke: { block: "club", label: "Send every child to breakfast club" },
    freezeOnly: true,
    world: {
      seed: 404,
      blocks: {
        income: { kind: "number", label: "Family income", base: 0, sd: 1 },
        club: { kind: "yesno", label: "Breakfast club", base: -0.4, from: { income: -1.3 } },
        energy: { kind: "number", label: "Morning energy", base: 0, sd: 1, from: { club: 0.8 } },
        grades: { kind: "number", label: "Grades", base: 60, sd: 4, from: { income: 4, energy: 2 } },
      },
    },
    units: "grade points",
    tolerance: 0.6,
    hint: "Who goes to breakfast club? Compare like with like.",
    reveal: "Breakfast club is free, so children from poorer families go more, and family income also affects grades. Freeze income, comparing children from similar families, and breakfast club helps, by giving them energy for the morning. Freezing energy would hide that, because energy is how the club works.",
    // Freezing, not graph-building: each trap is a set of blocks held still.
    freezeTraps: [
      { name: "freeze nothing", freeze: [] },
      { name: "freeze energy", freeze: ["energy"] },
      { name: "freeze income and energy", freeze: ["income", "energy"] },
    ],
    freezeAnswer: ["income"],
    freezeAlsoRight: [],
  },
];
