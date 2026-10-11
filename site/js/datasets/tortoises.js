// Island life and tortoise weight: Hermann's tortoises on Golem Grad (Lake Prespa) and the nearby mainland.
// Source: Arsovski et al., Ecology Letters (2026); data CC BY 4.0 via figshare, cleaned for TidyTuesday 2026-03-03.
import { Kind } from "../data.js";

const SEX = [318, 40];
const ISLAND = [80, 215];
const MASS = [556, 215];
const BELOW = [318, 384];

export default {
  key: "tortoises",
  file: "data/samples/tortoises.csv",
  tag: "Island tortoises",
  icon: "🐢",
  level: "easy",
  order: [1, 0, 2, 3],
  name: "Island life and tortoise weight",
  question: "Does living on the island make tortoises lighter?",
  about: "2,130 Hermann's tortoises from Golem Grad, a small island in Lake Prespa, and the nearby mainland, each weighed the first time it was caught (2008–2023). Body mass is in kilograms; most weigh between 0.8 and 2 kg.",
  story: { url: "https://onlinelibrary.wiley.com/doi/10.1111/ele.70296", label: "The original study" },
  intro: [
    "On a tiny island in a lake in North Macedonia, male tortoises outnumber females by about nine to one. The males harass the females so much that some fall off the island's cliffs. Scientists weighed over 2,000 tortoises there and on the nearby mainland. <b>Does living on the island make a tortoise lighter?</b>",
  ],
  source: "Arsovski et al., Ecology Letters (2026), CC BY 4.0",
  tidytuesday: "2026-03-03",
  cause: "Island",
  effect: "Body mass (kg)",
  reads: "Living on the island changes a tortoise's body mass by {est} kg.",
  columns: {
    Island: { kind: Kind.BINARY, positive: "Island" },
    "Body mass (kg)": { kind: Kind.NUMERIC },
    Sex: { kind: Kind.BINARY, positive: "Female" },
    "Shell length (cm)": { kind: Kind.NUMERIC },
    "Condition index": { kind: Kind.NUMERIC },
  },
  versions: [
    {
      name: "Our map",
      explain: "So we freeze sex, comparing females with females and males with males. Sex pushes on both: it decides body size, and the island has hardly any females left. Shell length stays free, because getting smaller is one of the ways the island makes tortoises lighter. Under this map the island costs a tortoise {est} kg, and it hits females much harder than males.",
      lesson: "Freeze what pushes on both the cause and the effect. Leave alone what the cause pushes on.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Shell length (cm)": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Island", "Shell length (cm)"],
        ["Shell length (cm)", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, island life looks brutal: island tortoises weigh {est} kg compared with mainland ones. But look who lives where. The island is full of small males and the mainland is full of big females, so part of that gap is just who's in each group.",
      lesson: "A correlation mixes the effect up with differences in who's in each group.",
      pos: { Island: [190, 205], "Body mass (kg)": [480, 205] },
      edges: [["Island", "Body mass (kg)"]],
    },
    {
      name: "Freeze shell length",
      mistake: true,
      explain: "Now watch what happens if you also freeze shell length, as if size decided where a tortoise lives. The answer shrinks to {est} kg. Most of the effect vanishes, because being smaller is exactly how the island works.",
      lesson: "Never freeze Ms Mediator: you only measure what's left of the effect.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Shell length (cm)": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Shell length (cm)", "Island"],
        ["Shell length (cm)", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
    {
      name: "Freeze condition index",
      mistake: true,
      explain: "And if you freeze the condition index, the answer flips to {est}! That index is body mass divided by shell length: it's built from the effect itself. Comparing tortoises that are equally heavy for their size wipes out the very thing we're measuring.",
      lesson: "Never freeze something calculated from the effect.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Condition index": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Condition index", "Island"],
        ["Condition index", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
  ],
};
