// Indoor cats and hunting: UK pet cats from the Kays et al. tracking study.
// Data: Kays et al. (2020), Pet cats UK, Movebank, CC0; via TidyTuesday 2023-01-31.
// See LICENCES.md for how the licence was checked.
import { Kind } from "../data.js";

export default {
  key: "cats",
  tag: "Pet cats",
  icon: "🐈",
  level: "easy",
  name: "Indoor cats and hunting",
  question: "Do cats that stay indoors longer bring home less prey?",
  about: "91 pet cats in the UK. Owners reported how many hours a day each cat stays indoors and how many prey animals it brings home in a month.",
  order: [1, 0, 2, 3],
  intro: [
    "Scientists fitted GPS trackers to pet cats across the UK, and owners reported how long their cats stay indoors each day and how much prey they bring home.",
  ],
  credit: "Kays et al. (2020), Pet cats UK, Movebank",
  origin: "https://doi.org/10.5441/001/1.pf315732",
  licence: { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/", group: "green" },
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
      explain: "Freeze age: older cats stay in more and bring home less. Comparing cats of the same age, the answer is {est}. Close to the first look: age is a real Confounder, but a weak one.",
      lesson: "Freeze what pushes on both the cause and the effect.",
      pos: { "Hours indoors": [80, 215], "Prey per month": [556, 215], "Age (years)": [318, 40], Hunts: [318, 384] },
      edges: [["Age (years)", "Hours indoors"], ["Age (years)", "Prey per month"], ["Hours indoors", "Prey per month"], ["Prey per month", "Hunts"]],
    },
    {
      name: "Just the correlation",
      fine: true,
      explain: "At first glance, each extra hour indoors means {est} prey animals a month. But is something else pushing on both?",
      lesson: "A weak Confounder only nudges the answer. Drawing the map tells you how much to worry.",
      pos: { "Hours indoors": [190, 205], "Prey per month": [480, 205] },
      edges: [["Hours indoors", "Prey per month"]],
    },
    {
      name: "Freeze \"hunts\"",
      mistake: true,
      explain: "What if you froze whether a cat hunts? The answer shrinks to {est}. But cats that don't hunt bring home nothing, so that column is really another measure of the effect: freezing it hides part of the answer.",
      lesson: "Don't freeze something that's really another measure of the effect.",
      pos: { "Hours indoors": [80, 215], "Prey per month": [556, 215], "Age (years)": [178, 40], Hunts: [458, 40] },
      edges: [["Age (years)", "Hours indoors"], ["Age (years)", "Prey per month"], ["Hunts", "Hours indoors"], ["Hunts", "Prey per month"], ["Hours indoors", "Prey per month"]],
    },
    {
      name: "Freeze sex too",
      fine: true,
      explain: "Freezing sex as well changes almost nothing ({est}): male and female cats are kept in for about as long.",
      lesson: "Freezing something that doesn't push on the cause changes little.",
      pos: { "Hours indoors": [80, 215], "Prey per month": [556, 215], "Age (years)": [178, 40], Sex: [458, 40] },
      edges: [["Age (years)", "Hours indoors"], ["Age (years)", "Prey per month"], ["Sex", "Hours indoors"], ["Sex", "Prey per month"], ["Hours indoors", "Prey per month"]],
    },
  ],
};
