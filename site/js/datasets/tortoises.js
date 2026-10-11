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
  order: [1, 3, 2, 0],
  name: "Island life and tortoise weight",
  question: "Does living on the island make tortoises lighter?",
  about: "2,130 Hermann's tortoises from Golem Grad, a small island in Lake Prespa, and the nearby mainland, each weighed the first time it was caught (2008–2023). Body mass is in kilograms; most weigh between 0.8 and 2 kg.",
  story: { url: "https://onlinelibrary.wiley.com/doi/10.1111/ele.70296", label: "The original study" },
  intro: [
    "On a tiny island in a lake in North Macedonia, male tortoises outnumber females by about nine to one. The males harass the females so much that some fall off the island's cliffs. Scientists weighed over 2,000 tortoises there and on the nearby mainland.",
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
      explain: "The fair comparison freezes only sex: females against females, males against males. Sex decides body size, and the island has hardly any females left, so it pushes on both. Shell length stays free, because getting smaller is part of how the island works. Under this map the island costs a tortoise {est} kg, and it hits females much harder than males.",
      lesson: "Freeze what pushes on both the cause and the effect. Leave alone what the cause pushes on.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Shell length (cm)": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Island", "Shell length (cm)"],
        ["Shell length (cm)", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, island life looks brutal: island tortoises weigh {est} kg compared with mainland ones. But the island is full of small males and the mainland is full of big females. Can we make the comparison fairer?",
      lesson: "A correlation mixes the effect up with differences in who's in each group.",
      pos: { Island: [190, 205], "Body mass (kg)": [480, 205] },
      edges: [["Island", "Body mass (kg)"]],
    },
    {
      name: "Freeze shell length",
      mistake: true,
      explain: "Another tempting fix: freeze shell length, as if size decided where a tortoise lives. The answer shrinks to {est} kg. But it's the island that makes tortoises smaller, so this switches off most of the effect.",
      lesson: "Never freeze Ms Mediator: you only measure what's left of the effect.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Shell length (cm)": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Shell length (cm)", "Island"],
        ["Shell length (cm)", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
    {
      name: "Freeze condition index",
      mistake: true,
      explain: "One tempting fix is to compare tortoises that are equally heavy for their size, by freezing the condition index. Look what happens: the answer flips to {est}! The index is body mass divided by shell length, so it's built from the effect itself. Freezing it wipes out the very thing we're measuring.",
      lesson: "Never freeze something calculated from the effect.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Condition index": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Condition index", "Island"],
        ["Condition index", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
  ],
};
