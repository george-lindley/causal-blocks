// Rain and safe swimming: Sydney's Beachwatch water tests with Open-Meteo rainfall.
// Source: NSW Beachwatch water quality; Open-Meteo weather; via TidyTuesday 2025-05-20.
import { Kind } from "../data.js";

export default {
  key: "beaches",
  file: "data/samples/beaches.csv",
  tag: "Sydney beaches",
  level: "easy",
  name: "Rain and safe swimming",
  question: "Does rain make Sydney's beaches unsafe for swimming?",
  about: "4,000 water tests from Sydney swimming spots (2015–2025). A test is unsafe at 200 or more gut bacteria per 100 ml. Rain is the total over the test day and the day before, in centimetres.",
  intro: [
    "Sydney tests the water at its swimming spots for gut bacteria. Too many, and the water is unsafe to swim in. <b>Does rain make the beaches unsafe?</b>",
    "Yes: each centimetre of rain over two days raises the chance of an unsafe test by about 3 in 100. Rain washes dirt and sewage from streets and drains into the sea. Region and water temperature don't change how much rain falls, so freezing them changes almost nothing.",
    "The mistake is freezing the bacteria count itself. \"Unsafe\" is decided by that count, so comparing tests with the same count makes rain look harmless.",
  ],
  source: "NSW Beachwatch water quality; Open-Meteo weather",
  tidytuesday: "2025-05-20",
  cause: "Rain (cm)",
  effect: "Unsafe to swim",
  reads: "Each extra centimetre of rain changes the chance of an unsafe test by {est} (0.01 is 1 test in 100).",
  columns: {
    "Rain (cm)": { kind: Kind.NUMERIC },
    "Unsafe to swim": { kind: Kind.BINARY, positive: "Unsafe" },
    "Water temp (C)": { kind: Kind.NUMERIC },
    "Bacteria level": { kind: Kind.NUMERIC },
    Region: { kind: Kind.CATEGORIES },
  },
  versions: [
    {
      name: "Our map",
      explain: "Rain washes bacteria into the water, and the bacteria decide whether a test is unsafe. Nothing here changes how much rain falls, so there's nothing to freeze: the plain comparison is the answer.",
      lesson: "If nothing pushes on the cause, the simple comparison is fair.",
      pos: { "Rain (cm)": [80, 215], "Unsafe to swim": [556, 215], "Bacteria level": [178, 384], "Water temp (C)": [458, 384] },
      edges: [["Rain (cm)", "Bacteria level"], ["Bacteria level", "Unsafe to swim"], ["Rain (cm)", "Unsafe to swim"], ["Water temp (C)", "Bacteria level"]],
    },
    {
      name: "Freeze region and temp",
      fine: true,
      explain: "This map worries that some regions or warmer water also get more rain. But every beach gets the same rain on the same day, so freezing them barely moves the answer.",
      lesson: "Freezing things that don't push on the cause changes little.",
      pos: { "Rain (cm)": [80, 215], "Unsafe to swim": [556, 215], Region: [178, 40], "Water temp (C)": [458, 40] },
      edges: [["Region", "Rain (cm)"], ["Region", "Unsafe to swim"], ["Water temp (C)", "Rain (cm)"], ["Water temp (C)", "Unsafe to swim"], ["Rain (cm)", "Unsafe to swim"]],
    },
    {
      name: "Freeze bacteria level",
      mistake: true,
      explain: "\"Unsafe\" is decided by the bacteria count. Freezing it compares tests with the same count, so rain can't make any difference, and the effect disappears.",
      lesson: "Never freeze the thing your result is measured with.",
      pos: { "Rain (cm)": [80, 215], "Unsafe to swim": [556, 215], "Bacteria level": [318, 40] },
      edges: [["Bacteria level", "Rain (cm)"], ["Bacteria level", "Unsafe to swim"], ["Rain (cm)", "Unsafe to swim"]],
    },
  ],
};
