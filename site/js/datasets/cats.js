// Indoor cats and hunting: UK pet cats from the Kays et al. tracking study.
// Source: Kays et al. (2020), Pet cats UK, Movebank; via TidyTuesday 2023-01-31.
import { Kind } from "../data.js";

export default {
  key: "cats",
  file: "data/samples/cats.csv",
  tag: "Pet cats",
  level: "easy",
  name: "Indoor cats and hunting",
  question: "Do cats that stay indoors longer bring home less prey?",
  about: "91 pet cats in the UK. Owners reported how many hours a day each cat stays indoors and how many prey animals it brings home in a month.",
  intro: [
    "Scientists fitted GPS trackers to pet cats across the UK, and owners reported how long their cats stay indoors each day and how much prey they bring home. <b>Do cats that stay in longer bring home less prey?</b>",
    "Yes: each extra hour indoors means about a third of a prey animal less each month. Age is Mr Confounder here, because older cats stay in more and bring home less. <b>Freeze age</b> and the answer hardly moves: he's real, but weak.",
    "The tempting mistake is freezing whether the cat hunts at all. Cats that don't hunt bring home nothing, so that column is really another measure of the effect, and freezing it hides part of the answer.",
  ],
  source: "Kays et al. (2020), Pet cats UK, Movebank",
  tidytuesday: "2023-01-31",
  cause: "Hours indoors",
  effect: "Prey per month",
  reads: "Each extra hour indoors changes the prey brought home by {est} a month.",
  columns: {
    "Hours indoors": { kind: Kind.NUMERIC },
    "Prey per month": { kind: Kind.NUMERIC },
    "Age (years)": { kind: Kind.NUMERIC },
    Hunts: { kind: Kind.BINARY, positive: "Yes" },
    Sex: { kind: Kind.BINARY, positive: "Male" },
  },
  versions: [
    {
      name: "Our map",
      explain: "Older cats stay in more and bring home less, so age pushes on both and is frozen. Whether a cat hunts shows up in the prey it brings home, so it's left free.",
      lesson: "Freeze what pushes on both the cause and the effect.",
      pos: { "Hours indoors": [80, 215], "Prey per month": [556, 215], "Age (years)": [318, 40], Hunts: [318, 384] },
      edges: [["Age (years)", "Hours indoors"], ["Age (years)", "Prey per month"], ["Hours indoors", "Prey per month"], ["Prey per month", "Hunts"]],
    },
    {
      name: "Just the correlation",
      fine: true,
      explain: "Nothing frozen. The answer barely changes: age was a real Mr Confounder, but a weak one.",
      lesson: "A weak Mr Confounder only nudges the answer. Drawing the map tells you how much to worry.",
      pos: { "Hours indoors": [190, 205], "Prey per month": [480, 205] },
      edges: [["Hours indoors", "Prey per month"]],
    },
    {
      name: "Freeze \"hunts\"",
      mistake: true,
      explain: "This map treats hunting as a personality trait that decides how long a cat is let out. But cats that don't hunt bring home nothing, so the column mostly measures the effect again. Freezing it hides part of the answer.",
      lesson: "Don't freeze something that's really another measure of the effect.",
      pos: { "Hours indoors": [80, 215], "Prey per month": [556, 215], "Age (years)": [178, 40], Hunts: [458, 40] },
      edges: [["Age (years)", "Hours indoors"], ["Age (years)", "Prey per month"], ["Hunts", "Hours indoors"], ["Hunts", "Prey per month"], ["Hours indoors", "Prey per month"]],
    },
    {
      name: "Freeze sex too",
      fine: true,
      explain: "Male and female cats are kept in for about as long, so sex doesn't push on the cause. Freezing it leaves the answer where it was.",
      lesson: "Freezing something that doesn't push on the cause changes little.",
      pos: { "Hours indoors": [80, 215], "Prey per month": [556, 215], "Age (years)": [178, 40], Sex: [458, 40] },
      edges: [["Age (years)", "Hours indoors"], ["Age (years)", "Prey per month"], ["Sex", "Hours indoors"], ["Sex", "Prey per month"], ["Hours indoors", "Prey per month"]],
    },
  ],
};
