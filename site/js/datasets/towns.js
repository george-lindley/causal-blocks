// Small towns and exam results: the UK detective story.
import { Kind } from "../data.js";

const EVERYTHING = ["Region", "Deprivation", "University", "Coastal", "Adult degrees"];

export default {
  key: "towns",
  file: "data/samples/towns.csv",
  tag: "UK schools",
  name: "Small towns and exam results",
  blurb: "1,082 English towns from the ONS. Do children in smaller towns really do better at school?",
  question: "Do children in smaller towns do better at school?",
  about: "1,082 English towns. The education score is the ONS’s measure of how well young people do at school (most towns score between −4 and +5). Town size goes small → medium → large.",
  story: { url: "https://georgelindley.com/do-small-towns-really-provide-better-education-a-uk-detective-story/", label: "The full detective story" },
  cause: "Town size",
  effect: "Education score",
  reads: "Each step up in town size changes the education score by {est}.",
  columns: {
    "Town size": { kind: Kind.ORDERED, levels: ["Small", "Medium", "Large"] },
    "Education score": { kind: Kind.NUMERIC },
    Deprivation: { kind: Kind.ORDERED, levels: ["Lower", "Mid", "Higher"] },
    "Adult degrees": { kind: Kind.ORDERED, levels: ["Low", "Medium", "High"] },
    Region: { kind: Kind.CATEGORIES },
    Coastal: { kind: Kind.BINARY, positive: "Coastal" },
    University: { kind: Kind.BINARY, positive: "University" },
  },
  versions: [
    {
      name: "Our map",
      explain: "Region pushes on both town size and results, so it's frozen: each town is compared only with towns in the same region. Deprivation is <i>how</i> size has its effect (bigger towns tend to be poorer), so it's left free.",
      lesson: "Freeze what pushes on both the cause and the effect. Leave alone what the cause pushes on.",
      pos: { Region: [24, 40], Coastal: [24, 380], "Town size": [240, 130], Deprivation: [350, 330], "Education score": [620, 215] },
      edges: [["Region", "Town size"], ["Region", "Deprivation"], ["Coastal", "Deprivation"],
        ["Town size", "Deprivation"], ["Town size", "Education score"], ["Deprivation", "Education score"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "The ONS comparison: town size against results, with nothing frozen. The regions with the most big towns happen to do well for other reasons, which hides part of the effect.",
      lesson: "A correlation mixes the effect up with everything else that differs between the groups.",
      pos: { "Town size": [190, 205], "Education score": [480, 205] },
      edges: [["Town size", "Education score"]],
    },
    {
      name: "Freeze deprivation",
      mistake: true,
      explain: "This map draws deprivation as a cause of town size, so it gets frozen. That switches off the main way size affects results, and the answer flips: bigger towns now look <i>better</i>.",
      lesson: "Never freeze a mediator: you only measure what's left of the effect.",
      pos: { Deprivation: [318, 40], "Town size": [80, 300], "Education score": [556, 300] },
      edges: [["Deprivation", "Town size"], ["Deprivation", "Education score"], ["Town size", "Education score"]],
    },
    {
      name: "Control for everything",
      mistake: true,
      explain: "Every column is frozen, deprivation included. It feels careful, but it repeats the last mistake, and the answer flips again.",
      lesson: "More controls isn't safer. Only freeze what your map says is a confounder.",
      pos: { Region: [30, 30], Deprivation: [318, 30], University: [606, 30], "Town size": [150, 205],
        "Education score": [486, 205], Coastal: [150, 384], "Adult degrees": [486, 384] },
      edges: [...EVERYTHING.flatMap((v) => [[v, "Town size"], [v, "Education score"]]), ["Town size", "Education score"]],
    },
  ],
};
