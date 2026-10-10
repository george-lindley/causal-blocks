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
  level: "easy",
  name: "Island life and tortoise weight",
  question: "Does living on the island make tortoises lighter?",
  about: "2,130 Hermann's tortoises from Golem Grad, a small island in Lake Prespa, and the nearby mainland, each weighed the first time it was caught (2008–2023). Body mass is in kilograms; most weigh between 0.8 and 2 kg.",
  story: { url: "https://onlinelibrary.wiley.com/doi/10.1111/ele.70296", label: "The original study" },
  intro: [
    "On a tiny island in a lake in North Macedonia, male tortoises outnumber females by about nine to one. The males harass the females so much that some fall off the island's cliffs. Scientists weighed over 2,000 tortoises there and on the nearby mainland. <b>Does living on the island make a tortoise lighter?</b>",
    "Simply comparing the two places makes the island look terrible: island tortoises are much lighter. But that comparison is unfair. The island is full of males, and males are smaller than females anyway. Once we <b>freeze sex</b> (comparing females with females, males with males), island life still makes a tortoise lighter, by about a quarter of a kilo. That's still a big chunk of a 1 kg animal, and it's much worse for females.",
    "Then two tempting mistakes. Freezing <b>shell length</b> hides most of the effect, because being smaller is <i>how</i> the island makes tortoises lighter. Freezing the <b>condition index</b> flips the answer, because that index is calculated from body mass itself.",
  ],
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
      explain: "Sex pushes on both: females are much heavier than males, and the island has hardly any females left. Freezing sex compares females with females and males with males. Shell length is <i>how</i> the island has part of its effect, so it's left free.",
      lesson: "Freeze what pushes on both the cause and the effect. Leave alone what the cause pushes on.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Shell length (cm)": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Island", "Shell length (cm)"],
        ["Shell length (cm)", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "Island tortoises against mainland ones, with nothing frozen. The mainland is full of big females and the island is full of small males, so part of the gap is about who's in each group, not what the island does.",
      lesson: "A correlation mixes the effect up with differences in who's in each group.",
      pos: { Island: [190, 205], "Body mass (kg)": [480, 205] },
      edges: [["Island", "Body mass (kg)"]],
    },
    {
      name: "Freeze shell length",
      mistake: true,
      explain: "This map draws shell length as something that decides where a tortoise lives, so it gets frozen. But it's the island that makes tortoises smaller. Freezing size switches off that route, and most of the effect disappears.",
      lesson: "Never freeze Mr Mediator: you only measure what's left of the effect.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Shell length (cm)": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Shell length (cm)", "Island"],
        ["Shell length (cm)", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
    {
      name: "Freeze condition index",
      mistake: true,
      explain: "The condition index is body mass divided by shell length, so it's built from the effect. Freezing it compares tortoises that are equally heavy for their size, which wipes out the weight gap, and the answer flips.",
      lesson: "Never freeze something calculated from the effect.",
      pos: { Sex: SEX, Island: ISLAND, "Body mass (kg)": MASS, "Condition index": BELOW },
      edges: [["Sex", "Island"], ["Sex", "Body mass (kg)"], ["Condition index", "Island"],
        ["Condition index", "Body mass (kg)"], ["Island", "Body mass (kg)"]],
    },
  ],
};
