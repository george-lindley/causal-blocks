// Heavy Pokémon and attack: the {pokemon} R package.
// Data: {pokemon} R package (William Amorim), MIT; via TidyTuesday 2025-04-01.
// See LICENCES.md for how the licence was checked.
import { Kind } from "../data.js";

export default {
  key: "pokemon",
  file: "data/samples/pokemon.csv",
  tag: "Pokémon",
  icon: "⚡",
  level: "medium",
  name: "Heavy Pokémon and attack",
  question: "Do heavier Pokémon hit harder?",
  about: "949 Pokémon with their weight (in hundreds of kilograms), height (metres) and Attack, one of six battle stats.",
  order: [1, 0, 2, 3],
  intro: [
    "There are hundreds of Pokémon, from tiny to enormous, and each has battle stats, including Attack.",
  ],
  credit: "{pokemon} R package (William Amorim)",
  origin: "https://cran.r-project.org/package=pokemon",
  licence: { name: "MIT", url: "https://opensource.org/license/mit", group: "amber" },
  tidytuesday: "2025-04-01",
  cause: "Weight (100 kg)",
  effect: "Attack",
  reads: "Every extra 100 kg changes a Pokémon's Attack by {est}.",
  columns: {
    "Weight (100 kg)": { kind: Kind.NUMERIC },
    Attack: { kind: Kind.NUMERIC },
    "Height (m)": { kind: Kind.NUMERIC },
    "Base stat total": { kind: Kind.NUMERIC },
    Type: { kind: Kind.CATEGORIES },
  },
  versions: [
    {
      name: "Our map",
      explain: "Freeze height: compare Pokémon of the same size. Weight on its own is worth {est} Attack per 100 kg, about half the first look.",
      lesson: "Freeze what pushes on both the cause and the effect.",
      pos: { "Weight (100 kg)": [80, 215], Attack: [556, 215], "Height (m)": [318, 40] },
      edges: [["Height (m)", "Weight (100 kg)"], ["Height (m)", "Attack"], ["Weight (100 kg)", "Attack"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, every extra 100 kg comes with {est} more Attack. But heavy Pokémon are usually big ones, and big ones hit hard anyway.",
      lesson: "A strong Mr Confounder can make an effect look twice as big.",
      pos: { "Weight (100 kg)": [190, 205], Attack: [480, 205] },
      edges: [["Weight (100 kg)", "Attack"]],
    },
    {
      name: "Freeze base stat total",
      mistake: true,
      explain: "What if you froze the base stat total? The effect nearly vanishes ({est}). But the total is all six battle stats added up, Attack included, so any extra Attack has to come out of another stat.",
      lesson: "Never freeze something calculated from the effect.",
      pos: { "Weight (100 kg)": [80, 215], Attack: [556, 215], "Base stat total": [178, 40], "Height (m)": [458, 40] },
      edges: [["Height (m)", "Weight (100 kg)"], ["Height (m)", "Attack"], ["Base stat total", "Weight (100 kg)"], ["Base stat total", "Attack"], ["Weight (100 kg)", "Attack"]],
    },
    {
      name: "Freeze type too",
      fine: true,
      explain: "Rock and Steel types tend to be heavy and strong, so freezing type as well is reasonable too. It nudges the answer to {est}.",
      lesson: "A second, weaker Mr Confounder only nudges the answer.",
      pos: { "Weight (100 kg)": [80, 215], Attack: [556, 215], "Height (m)": [178, 40], Type: [458, 40] },
      edges: [["Height (m)", "Weight (100 kg)"], ["Height (m)", "Attack"], ["Type", "Weight (100 kg)"], ["Type", "Attack"], ["Weight (100 kg)", "Attack"]],
    },
  ],
};
