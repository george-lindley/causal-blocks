// Penguin bills: the palmerpenguins data (Gorman, Williams & Fraser).
// Source: palmerpenguins (Gorman, Williams & Fraser), CC0; via TidyTuesday 2020-07-28.
import { Kind } from "../data.js";

export default {
  key: "penguins",
  file: "data/samples/penguins.csv",
  tag: "Penguins",
  icon: "🐧",
  level: "hard",
  name: "Penguin bills",
  question: "Do penguins with longer bills have deeper bills?",
  about: "333 penguins of three species (Adélie, Chinstrap and Gentoo) measured near Antarctica (2007–2009). Bill length and depth are in millimetres.",
  order: [1, 0, 2, 3],
  intro: [
    "Scientists in Antarctica measured hundreds of penguins of three species. <b>Do penguins with longer bills have deeper bills?</b>",
  ],
  source: "palmerpenguins (Gorman, Williams & Fraser), CC0",
  tidytuesday: "2020-07-28",
  cause: "Bill length (mm)",
  effect: "Bill depth (mm)",
  reads: "Each extra millimetre of bill length changes bill depth by {est} mm.",
  columns: {
    "Bill length (mm)": { kind: Kind.NUMERIC },
    "Bill depth (mm)": { kind: Kind.NUMERIC },
    Species: { kind: Kind.CATEGORIES },
    Sex: { kind: Kind.BINARY, positive: "Male" },
    Island: { kind: Kind.CATEGORIES },
  },
  versions: [
    {
      name: "Our map",
      explain: "Look what happens when we freeze species and sex: the relationship turns around! Within the same species and sex, longer bills are deeper, by {est} mm per millimetre. Mixing groups had flipped the pattern. That's Simpson's paradox.",
      lesson: "Freeze every Mr Confounder you can see.",
      pos: { "Bill length (mm)": [80, 215], "Bill depth (mm)": [556, 215], Sex: [178, 40], Species: [458, 40] },
      edges: [["Species", "Bill length (mm)"], ["Species", "Bill depth (mm)"], ["Sex", "Bill length (mm)"], ["Sex", "Bill depth (mm)"], ["Bill length (mm)", "Bill depth (mm)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, longer bills come with shallower bills: {est} mm of depth for each extra millimetre of length. But three species are mixed together, and Gentoos have long, thin bills.",
      lesson: "Mixing groups can flip a pattern. This is Simpson's paradox.",
      pos: { "Bill length (mm)": [190, 205], "Bill depth (mm)": [480, 205] },
      edges: [["Bill length (mm)", "Bill depth (mm)"]],
    },
    {
      name: "Forget sex",
      mistake: true,
      explain: "Freeze species but forget sex, and the answer comes out too big ({est}): males have longer and deeper bills, so part of the link is just males versus females.",
      lesson: "Missing a Mr Confounder can make an effect look bigger than it is.",
      pos: { "Bill length (mm)": [80, 215], "Bill depth (mm)": [556, 215], Species: [318, 40] },
      edges: [["Species", "Bill length (mm)"], ["Species", "Bill depth (mm)"], ["Bill length (mm)", "Bill depth (mm)"]],
    },
    {
      name: "Freeze island instead",
      mistake: true,
      explain: "Freezing the island instead of the species doesn't work either ({est}, still the wrong way round). Two islands are home to two species each, so island is only a rough stand-in for species.",
      lesson: "Freeze the real Mr Confounder, not a stand-in for it.",
      pos: { "Bill length (mm)": [80, 215], "Bill depth (mm)": [556, 215], Island: [318, 40] },
      edges: [["Island", "Bill length (mm)"], ["Island", "Bill depth (mm)"], ["Bill length (mm)", "Bill depth (mm)"]],
    },
  ],
};
