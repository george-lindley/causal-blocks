// Official English and IELTS scores: the test-it-yourself extension of the blog post.
import { Kind } from "../data.js";

const EVERYTHING = ["Region", "Overall band", "Listening", "Reading", "Test type"];

export default {
  key: "ielts",
  file: "data/samples/ielts.csv",
  tag: "English tests",
  name: "Official English and IELTS scores",
  blurb: "IELTS results for 236 groups of test-takers. Does official English make people speak better than they write?",
  question: "Does official English make people speak better than they write?",
  about: "The speak-write gap is the speaking score minus the writing score, in IELTS bands (the test is scored 0 to 9).",
  story: { url: "https://georgelindley.com/does-official-english-make-people-speak-better-than-they-write/", label: "Read the blog post" },
  cause: "Official English",
  effect: "Speak-write gap",
  reads: "In countries where English is official, speaking beats writing by an extra {est} bands.",
  columns: {
    "Official English": { kind: Kind.BINARY, positive: "Official English" },
    "Speak-write gap": { kind: Kind.NUMERIC },
    Region: { kind: Kind.CATEGORIES },
    "Test type": { kind: Kind.CATEGORIES },
    "Overall band": { kind: Kind.NUMERIC },
    Listening: { kind: Kind.NUMERIC },
    Reading: { kind: Kind.NUMERIC },
  },
  versions: [
    {
      name: "The blog’s map",
      explain: "Colonial history shaped both whether English became official and how schools teach writing. Region stands in for that history, so it's frozen: each country is compared with its neighbours.",
      lesson: "Compare like with like: freeze what pushes on both the cause and the effect.",
      pos: { Region: [318, 40], "Official English": [60, 300], "Speak-write gap": [576, 300] },
      edges: [["Region", "Official English"], ["Region", "Speak-write gap"], ["Official English", "Speak-write gap"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "Every country is compared with every other, wherever it is in the world. Regions differ a lot in their gaps, and that hides part of the effect.",
      lesson: "A correlation can hide an effect as well as fake one.",
      pos: { "Official English": [100, 205], "Speak-write gap": [520, 205] },
      edges: [["Official English", "Speak-write gap"]],
    },
    {
      name: "Freeze the overall band",
      mistake: true,
      explain: "The overall band is the average of all four skills, speaking and writing included. Freezing it compares only countries with the same total score, and part of the gap disappears.",
      lesson: "Don't freeze something built out of your result.",
      pos: { Region: [130, 40], "Overall band": [506, 40], "Official English": [60, 300], "Speak-write gap": [576, 300] },
      edges: [["Region", "Official English"], ["Region", "Speak-write gap"], ["Overall band", "Official English"],
        ["Overall band", "Speak-write gap"], ["Official English", "Speak-write gap"]],
    },
    {
      name: "Control for everything",
      mistake: true,
      explain: "Listening, reading and the overall band are all frozen too. They're results of learning English, not causes of official English, and less than half the effect is left.",
      lesson: "Freeze causes, not other results.",
      pos: { Region: [30, 30], "Overall band": [318, 30], Listening: [606, 30], "Official English": [150, 205],
        "Speak-write gap": [486, 205], Reading: [150, 384], "Test type": [486, 384] },
      edges: [...EVERYTHING.flatMap((v) => [[v, "Official English"], [v, "Speak-write gap"]]), ["Official English", "Speak-write gap"]],
    },
  ],
};
