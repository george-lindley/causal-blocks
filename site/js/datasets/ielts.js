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
  about: "Each row is the average IELTS result for one country’s test-takers, by test type and year. The speak-write gap is the speaking score minus the writing score, in IELTS bands (the test is scored from 0 to 9).",
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
      happened: "Region stands in for history. Colonial history shaped both whether English became an official language and how schools teach writing. So region is a confounder: we freeze it and compare each country with its neighbours.",
      change: "Speaking beats writing by an extra <b>{est}</b> bands where English is official. This is our best answer, and every other map is compared with it.",
      lesson: "When you can't run an experiment, compare like with like: freeze what pushes on both the cause and the effect.",
      pos: { Region: [318, 40], "Official English": [60, 300], "Speak-write gap": [576, 300] },
      edges: [["Region", "Official English"], ["Region", "Speak-write gap"], ["Official English", "Speak-write gap"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      happened: "Every official-English country is compared with every other country, wherever it is in the world. The “not official” group mixes regions with very different speak-write gaps, so the comparison isn't fair.",
      change: "<b>{est}</b>, against {ours} on the blog’s map: a difference of {diff}. The shortcut still finds an effect, but a smaller one.",
      lesson: "A correlation can hide part of an effect as well as fake one. You only know which once you've drawn the map.",
      pos: { "Official English": [100, 205], "Speak-write gap": [520, 205] },
      edges: [["Official English", "Speak-write gap"]],
    },
    {
      name: "Freeze the overall band",
      mistake: true,
      happened: "This map treats the overall band as a confounder and freezes it. But the overall band is the average of all four skills, <i>including speaking and writing</i>. It's partly made out of the very scores we're measuring, so it comes after them, not before.",
      change: "<b>{est}</b>, against {ours} on the blog’s map: a difference of {diff}. Freezing it means only comparing countries that already ended up with the same total score, and part of the gap disappears.",
      lesson: "Don't freeze something that's built out of your result. It comes after the effect, so freezing it bends the answer.",
      pos: { Region: [130, 40], "Overall band": [506, 40], "Official English": [60, 300], "Speak-write gap": [576, 300] },
      edges: [["Region", "Official English"], ["Region", "Speak-write gap"], ["Overall band", "Official English"],
        ["Overall band", "Speak-write gap"], ["Official English", "Speak-write gap"]],
    },
    {
      name: "Control for everything",
      mistake: true,
      happened: "Every column goes in as a confounder: region, the overall band, listening, reading and test type are all frozen. But listening and reading are other <i>results</i> of how people learned English. They can't decide whether a country's official language is English.",
      change: "<b>{est}</b>, against {ours} on the blog’s map: a difference of {diff}. Less than half the effect is left.",
      lesson: "Freeze causes, not other results. Piling in every score you have makes the answer worse, not safer.",
      pos: { Region: [30, 30], "Overall band": [318, 30], Listening: [606, 30], "Official English": [150, 205],
        "Speak-write gap": [486, 205], Reading: [150, 384], "Test type": [486, 384] },
      edges: [...EVERYTHING.flatMap((v) => [[v, "Official English"], [v, "Speak-write gap"]]), ["Official English", "Speak-write gap"]],
    },
  ],
};
