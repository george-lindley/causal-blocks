// The exploding snowman: Zürich's Böögg burn times and summer weather.
// Source: Sechseläuten Böögg burn times; MeteoSwiss Zürich weather; via TidyTuesday 2025-12-02.
import { Kind } from "../data.js";

export default {
  key: "snowman",
  file: "data/samples/snowman.csv",
  tag: "Swiss tradition",
  icon: "⛄",
  level: "easy",
  name: "The exploding snowman",
  question: "Does a quick-burning Böögg mean a hot summer?",
  about: "65 years of Zürich's spring festival, when a snowman called the Böögg is burned. Burn time is minutes until its head explodes; summer temperature is Zürich's June–August average in °C.",
  order: [1, 0, 2],
  intro: [
    "Every April in Zürich, a giant snowman called the Böögg is set on fire. Folklore says the faster its head explodes, the hotter the summer will be.",
  ],
  source: "Sechseläuten Böögg burn times; MeteoSwiss Zürich weather",
  tidytuesday: "2025-12-02",
  cause: "Burn time (min)",
  effect: "Summer temp (C)",
  reads: "Each extra minute of burning changes the summer temperature by {est} °C.",
  columns: {
    "Burn time (min)": { kind: Kind.NUMERIC },
    "Summer temp (C)": { kind: Kind.NUMERIC },
    Year: { kind: Kind.NUMERIC },
    "Summer sun (h)": { kind: Kind.NUMERIC },
  },
  versions: [
    {
      name: "Our map",
      explain: "Freeze the year: summers have warmed a lot since the 1950s, and burn times have drifted too. What's left is {est} °C per minute, closer still to nothing.",
      lesson: "An answer close to zero is still an answer: the folklore doesn't hold up.",
      pos: { "Burn time (min)": [80, 215], "Summer temp (C)": [556, 215], Year: [318, 40] },
      edges: [["Year", "Burn time (min)"], ["Year", "Summer temp (C)"], ["Burn time (min)", "Summer temp (C)"]],
    },
    {
      name: "Just the correlation",
      fine: true,
      explain: "At first glance, each extra minute of burning goes with a summer {est} °C warmer. That's tiny: even half an hour would barely change a summer.",
      lesson: "Before trusting a pattern, ask how big it is, not just whether it's there.",
      pos: { "Burn time (min)": [190, 205], "Summer temp (C)": [480, 205] },
      edges: [["Burn time (min)", "Summer temp (C)"]],
    },
    {
      name: "Freeze sunshine too",
      fine: true,
      explain: "Folklore fans might say a sunny year shows up even in April, so freeze summer sunshine as well. Now it's {est}, as near zero as it gets. However you draw the map, the Böögg can't predict the summer.",
      lesson: "However you draw the map, the effect stays near zero.",
      pos: { "Burn time (min)": [80, 215], "Summer temp (C)": [556, 215], "Summer sun (h)": [178, 40], Year: [458, 40] },
      edges: [["Year", "Burn time (min)"], ["Year", "Summer temp (C)"], ["Summer sun (h)", "Burn time (min)"], ["Summer sun (h)", "Summer temp (C)"], ["Burn time (min)", "Summer temp (C)"]],
    },
  ],
};
