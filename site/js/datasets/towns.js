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
  about: "Each row is a town in England. The education score is the ONS’s measure of how well its young people do at school; most towns score between −4 and +5. Town size goes Small → Medium → Large.",
  story: { url: "https://georgelindley.com/do-small-towns-really-provide-better-education-a-uk-detective-story/", label: "The full detective story" },
  cause: "Town size",
  effect: "Education score",
  reads: "Each step up in town size (small → medium → large) changes the education score by {est}.",
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
      happened: "Some regions have more big towns, and regions differ in their results for lots of other reasons. So region is a confounder: we freeze it and compare each town only with towns in the same part of the country. Deprivation is different. Bigger towns tend to be poorer, and poorer places tend to do worse at school, so deprivation is a mediator: part of <i>how</i> town size has its effect. We leave it free.",
      change: "Each step up in size: <b>{est}</b>. This is our best answer, and every other map is compared with it.",
      lesson: "Freeze what pushes on both the cause and the effect. Leave alone what the cause pushes on.",
      pos: { Region: [24, 40], Coastal: [24, 380], "Town size": [240, 130], Deprivation: [350, 330], "Education score": [620, 215] },
      edges: [["Region", "Town size"], ["Region", "Deprivation"], ["Coastal", "Deprivation"],
        ["Town size", "Deprivation"], ["Town size", "Education score"], ["Deprivation", "Education score"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      happened: "This is the comparison in the ONS report: line the towns up by size and compare their results, with nothing else on the map. Nothing is frozen, so a small town in the South West is compared directly with a big town in the North West.",
      change: "<b>{est}</b>, against {ours} on our map: a difference of {diff}. The shortcut gets the direction right but makes the effect look smaller. The regions with the most big towns, the North West and the South East, happen to do well for other reasons, and that hides part of the effect.",
      lesson: "A correlation mixes the effect up with everything else that differs between the groups. That can make an effect look bigger or, like here, smaller.",
      pos: { "Town size": [190, 205], "Education score": [480, 205] },
      edges: [["Town size", "Education score"]],
    },
    {
      name: "Freeze deprivation",
      mistake: true,
      happened: "This map draws one arrow the wrong way round: it says deprivation decides how big a town is. That makes deprivation look like a confounder, so it gets frozen. Now we only compare big and small towns that are <i>equally</i> deprived, which switches off the main road from town size to results.",
      change: "<b>{est}</b>, against {ours} on our map: a difference of {diff}. The answer flips sign. With deprivation frozen, bigger towns look <i>better</i>, not worse.",
      lesson: "Never freeze a mediator. You'd only measure what's left of the effect, and here what's left points the other way.",
      pos: { Deprivation: [318, 40], "Town size": [80, 300], "Education score": [556, 300] },
      edges: [["Deprivation", "Town size"], ["Deprivation", "Education score"], ["Town size", "Education score"]],
    },
    {
      name: "Control for everything",
      mistake: true,
      happened: "Every column goes in as a confounder: region, deprivation, university, coastal and adult degrees are all frozen. It feels careful, but it repeats the last mistake and adds more. Deprivation is part of how town size works, so freezing it hides the effect we're looking for.",
      change: "<b>{est}</b>, against {ours} on our map: a difference of {diff}. The sign flips again, so bigger towns look slightly better.",
      lesson: "More controls isn't safer. Every frozen block is a claim about what causes what, so only freeze what your map says is a confounder.",
      pos: { Region: [30, 30], Deprivation: [318, 30], University: [606, 30], "Town size": [150, 205],
        "Education score": [486, 205], Coastal: [150, 384], "Adult degrees": [486, 384] },
      edges: [...EVERYTHING.flatMap((v) => [[v, "Town size"], [v, "Education score"]]), ["Town size", "Education score"]],
    },
  ],
};
