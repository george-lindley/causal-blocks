// Small towns and exam results: the UK detective story.
import { Kind } from "../data.js";

const EVERYTHING = ["Region", "Deprivation", "University", "Coastal", "Adult degrees"];

export default {
  key: "towns",
  file: "data/samples/towns.csv",
  tag: "UK schools",
  icon: "🏫",
  level: "hard",
  order: [1, 0, 2, 3],
  name: "Small towns and exam results",
  question: "Do children in smaller towns do better at school?",
  about: "1,082 English towns. The education score is the ONS’s measure of how well young people do at school (most towns score between −4 and +5). Town size goes small → medium → large.",
  story: { url: "https://georgelindley.com/do-small-towns-really-provide-better-education-a-uk-detective-story/", label: "The full detective story" },
  intro: [
    "In England, children who grow up in small towns tend to do better at school than children in big towns. The Office for National Statistics spotted this in 2023 by comparing 1,082 towns.",
  ],
  source: "ONS, Why do children and young people in smaller towns do better academically? (2023)",
  tidytuesday: "2024-01-23",
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
      explain: "Freeze region only: some regions have lots of big towns and do well at school for other reasons, so each town is compared with towns in the same region. Deprivation stays free: bigger towns tend to be poorer, and that's Ms Mediator, the route the effect travels along. The whole effect is {est} per step.",
      lesson: "Freeze what pushes on both the cause and the effect. Leave alone what the cause pushes on.",
      pos: { Region: [24, 40], Coastal: [24, 380], "Town size": [240, 130], Deprivation: [350, 330], "Education score": [620, 215] },
      edges: [["Region", "Town size"], ["Region", "Deprivation"], ["Coastal", "Deprivation"],
        ["Town size", "Deprivation"], ["Town size", "Education score"], ["Deprivation", "Education score"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, the ONS comparison says yes: each step up in town size goes with an education score {est} lower. But is that the whole story?",
      lesson: "A correlation mixes the effect up with everything else that differs between the groups.",
      pos: { "Town size": [190, 205], "Education score": [480, 205] },
      edges: [["Town size", "Education score"]],
    },
    {
      name: "Freeze deprivation",
      mistake: true,
      explain: "<b>And here's the twist.</b> Freeze deprivation, so you only compare towns that are <i>equally</i> deprived, and the answer flips the other way: bigger towns now do <i>better</i>, by {est} a step. So under this map, being a big town isn't what holds results back (unlike reported in the correlation study). Being poorer is. That's a different question from the whole effect of town size, the direct effect, but it's the most surprising thing in the data.",
      lesson: "Freezing a mediator leaves only the direct effect. Fine if that's your question; a mistake if you wanted the whole effect.",
      pos: { Deprivation: [318, 40], "Town size": [80, 300], "Education score": [556, 300] },
      edges: [["Deprivation", "Town size"], ["Deprivation", "Education score"], ["Town size", "Education score"]],
    },
    {
      name: "Control for everything",
      mistake: true,
      explain: "And if you freeze every column at once? It feels careful, but it freezes deprivation too, repeating the twist, and the answer flips again ({est}).",
      lesson: "More controls isn't safer. Only freeze what your map says is a confounder.",
      pos: { Region: [30, 30], Deprivation: [318, 30], University: [606, 30], "Town size": [150, 205],
        "Education score": [486, 205], Coastal: [150, 384], "Adult degrees": [486, 384] },
      edges: [...EVERYTHING.flatMap((v) => [[v, "Town size"], [v, "Education score"]]), ["Town size", "Education score"]],
    },
  ],
};
