// Rain and safe swimming: Sydney's Beachwatch water tests with Open-Meteo rainfall.
// Data: Beachwatch, NSW Government; weather by Open-Meteo.com, CC BY (Beachwatch) and CC BY 4.0 (Open-Meteo); via TidyTuesday 2025-05-20.
// See LICENCES.md for how the licence was checked.
import { Kind } from "../data.js";

export default {
  key: "beaches",
  file: "data/samples/beaches.csv",
  tag: "Sydney beaches",
  icon: "🏖️",
  level: "easy",
  name: "Rain and safe swimming",
  question: "Does rain make Sydney's beaches unsafe for swimming?",
  about: "4,000 water tests from Sydney swimming spots (2015–2025). A test is unsafe at 200 or more gut bacteria per 100 ml. Rain is the total over the test day and the day before, in centimetres.",
  order: [1, 0, 3, 2],
  intro: [
    "Sydney tests the water at its swimming spots for gut bacteria. Too many, and the water is unsafe to swim in.",
  ],
  credit: "Beachwatch, NSW Government; weather by Open-Meteo.com",
  origin: "https://www.beachwatch.nsw.gov.au/waterMonitoring/waterQualityData",
  licence: { name: "CC BY (Beachwatch) and CC BY 4.0 (Open-Meteo)", url: "https://creativecommons.org/licenses/by/4.0/", group: "amber" },
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
      explain: "Freeze nothing. Rain washes dirt and sewage from streets and drains into the sea, and the bacteria decide whether a test is unsafe, but nothing here changes how much rain falls. So the first look was already the fair answer: {est}.",
      lesson: "If nothing pushes on the cause, the simple comparison is fair.",
      pos: { "Rain (cm)": [80, 215], "Unsafe to swim": [556, 215], "Bacteria level": [178, 384], "Water temp (C)": [458, 384] },
      edges: [["Rain (cm)", "Bacteria level"], ["Bacteria level", "Unsafe to swim"], ["Rain (cm)", "Unsafe to swim"], ["Water temp (C)", "Bacteria level"]],
    },
    {
      name: "Just the correlation",
      fine: true,
      explain: "At first glance, each extra centimetre of rain raises the chance of an unsafe test by {est} (0.01 is 1 test in 100).",
      lesson: "When nothing pushes on the cause, the plain comparison is the answer.",
      pos: { "Rain (cm)": [190, 205], "Unsafe to swim": [480, 205] },
      edges: [["Rain (cm)", "Unsafe to swim"]],
    },
    {
      name: "Freeze region and temp",
      fine: true,
      explain: "Freezing region and water temperature barely moves it ({est}): every beach gets the same rain on the same day.",
      lesson: "Freezing things that don't push on the cause changes little.",
      pos: { "Rain (cm)": [80, 215], "Unsafe to swim": [556, 215], Region: [178, 40], "Water temp (C)": [458, 40] },
      edges: [["Region", "Rain (cm)"], ["Region", "Unsafe to swim"], ["Water temp (C)", "Rain (cm)"], ["Water temp (C)", "Unsafe to swim"], ["Rain (cm)", "Unsafe to swim"]],
    },
    {
      name: "Freeze bacteria level",
      mistake: true,
      explain: "What if you froze the bacteria count, to be thorough? The effect disappears ({est})! \"Unsafe\" is decided by that very count, so comparing tests with the same count leaves rain nothing to do.",
      lesson: "Never freeze the thing your result is measured with.",
      pos: { "Rain (cm)": [80, 215], "Unsafe to swim": [556, 215], "Bacteria level": [318, 40] },
      edges: [["Bacteria level", "Rain (cm)"], ["Bacteria level", "Unsafe to swim"], ["Rain (cm)", "Unsafe to swim"]],
    },
  ],
};
