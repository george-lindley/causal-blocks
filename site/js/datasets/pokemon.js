// Heavy Pokémon and attack: the {pokemon} R package.
// Source: {pokemon} R package (William Amorim), from PokéAPI; via TidyTuesday 2025-04-01.
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
  intro: [
    "There are hundreds of Pokémon, from tiny to enormous, and each has battle stats, including Attack. <b>Do heavier Pokémon hit harder?</b>",
  ],
  source: "{pokemon} R package (William Amorim), from PokéAPI",
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
      explain: "Bigger Pokémon are both heavier and stronger, so height pushes on both and is frozen: Pokémon are compared with others of the same height.",
      lesson: "Freeze what pushes on both the cause and the effect.",
      pos: { "Weight (100 kg)": [80, 215], Attack: [556, 215], "Height (m)": [318, 40] },
      edges: [["Height (m)", "Weight (100 kg)"], ["Height (m)", "Attack"], ["Weight (100 kg)", "Attack"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "Nothing frozen. Heavy Pokémon are usually big ones, and big ones hit hard anyway, so weight gets the credit for size.",
      lesson: "A strong Mr Confounder can make an effect look twice as big.",
      pos: { "Weight (100 kg)": [190, 205], Attack: [480, 205] },
      edges: [["Weight (100 kg)", "Attack"]],
    },
    {
      name: "Freeze base stat total",
      mistake: true,
      explain: "The base stat total is all six battle stats added up, Attack included. Freezing it compares Pokémon with the same total, so any extra Attack has to come out of another stat, and the effect nearly vanishes.",
      lesson: "Never freeze something calculated from the effect.",
      pos: { "Weight (100 kg)": [80, 215], Attack: [556, 215], "Base stat total": [178, 40], "Height (m)": [458, 40] },
      edges: [["Height (m)", "Weight (100 kg)"], ["Height (m)", "Attack"], ["Base stat total", "Weight (100 kg)"], ["Base stat total", "Attack"], ["Weight (100 kg)", "Attack"]],
    },
    {
      name: "Freeze type too",
      fine: true,
      explain: "Rock and Steel types tend to be heavy and strong, so type could push on both. Freezing it as well moves the answer a little, not a lot. This map is reasonable too.",
      lesson: "A second, weaker Mr Confounder only nudges the answer.",
      pos: { "Weight (100 kg)": [80, 215], Attack: [556, 215], "Height (m)": [178, 40], Type: [458, 40] },
      edges: [["Height (m)", "Weight (100 kg)"], ["Height (m)", "Attack"], ["Type", "Weight (100 kg)"], ["Type", "Attack"], ["Weight (100 kg)", "Attack"]],
    },
  ],
};
