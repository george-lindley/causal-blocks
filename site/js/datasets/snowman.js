// The exploding snowman: Zürich's Böögg burn times and summer weather.
// Source: Sechseläuten Böögg burn times; MeteoSwiss Zürich weather; via TidyTuesday 2025-12-02.
import { Kind } from "../data.js";

export default {
  key: "snowman",
  file: "data/samples/snowman.csv",
  tag: "Swiss tradition",
  level: "easy",
  name: "The exploding snowman",
  question: "Does a quick-burning Böögg mean a hot summer?",
  about: "65 years of Zürich's spring festival, when a snowman called the Böögg is burned. Burn time is minutes until its head explodes; summer temperature is Zürich's June–August average in °C.",
  intro: [
    "Every April in Zürich, a giant snowman called the Böögg is set on fire. Folklore says the faster its head explodes, the hotter the summer will be. <b>Is the Böögg right?</b>",
    "Not really. Burn times range from 4 minutes to an hour, but summers barely change with them. The year is Mr Confounder: summers have warmed a lot since the 1950s. <b>Freeze the year</b> and what's left is close to zero.",
    "Every map we tried tells the same story. Finding no real effect is an answer too, and it's a good habit to ask \"how big?\", not just \"is there a pattern?\"",
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
      explain: "Summers have got warmer over the decades, and burn times have drifted too, so the year pushes on both and is frozen. What's left is tiny: even a half-hour difference in burning would mean well under half a degree, and it could easily be zero.",
      lesson: "An answer close to zero is still an answer: the folklore doesn't hold up.",
      pos: { "Burn time (min)": [80, 215], "Summer temp (C)": [556, 215], Year: [318, 40] },
      edges: [["Year", "Burn time (min)"], ["Year", "Summer temp (C)"], ["Burn time (min)", "Summer temp (C)"]],
    },
    {
      name: "Just the correlation",
      fine: true,
      explain: "Nothing frozen. The number is a little bigger, because warming over the years helps make both things go up together, but it's still tiny and uncertain.",
      lesson: "Before trusting a pattern, ask how big it is, not just whether it's there.",
      pos: { "Burn time (min)": [190, 205], "Summer temp (C)": [480, 205] },
      edges: [["Burn time (min)", "Summer temp (C)"]],
    },
    {
      name: "Freeze sunshine too",
      fine: true,
      explain: "Folklore-lovers might say a sunny year shows up even in April, so this map freezes summer sunshine as well. The answer drops to almost exactly zero.",
      lesson: "However you draw the map, the effect stays near zero.",
      pos: { "Burn time (min)": [80, 215], "Summer temp (C)": [556, 215], "Summer sun (h)": [178, 40], Year: [458, 40] },
      edges: [["Year", "Burn time (min)"], ["Year", "Summer temp (C)"], ["Summer sun (h)", "Burn time (min)"], ["Summer sun (h)", "Summer temp (C)"], ["Burn time (min)", "Summer temp (C)"]],
    },
  ],
};
