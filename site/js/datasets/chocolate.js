// Dark chocolate and ratings: Flavors of Cacao chocolate bar reviews.
// Source: Flavors of Cacao chocolate bar ratings (Brady Brelinski); via TidyTuesday 2022-01-18.
import { Kind } from "../data.js";

export default {
  key: "chocolate",
  file: "data/samples/chocolate.csv",
  tag: "Chocolate",
  icon: "🍫",
  level: "easy",
  name: "Dark chocolate and ratings",
  question: "Does very dark chocolate get worse ratings?",
  about: "2,443 chocolate bars reviewed by Flavors of Cacao (2006–2021), rated from 1 to 4. A bar counts as very dark at 80% cocoa or more.",
  order: [1, 0, 2],
  intro: [
    "Chocolate experts have rated thousands of bars from around the world, on a scale from 1 to 4. Bars with 80% cocoa or more are intensely dark and bitter.",
  ],
  source: "Flavors of Cacao chocolate bar ratings (Brady Brelinski)",
  tidytuesday: "2022-01-18",
  cause: "Very dark",
  effect: "Rating",
  reads: "Being very dark changes a bar's rating by {est}.",
  columns: {
    "Very dark": { kind: Kind.BINARY, positive: "Very dark" },
    Rating: { kind: Kind.NUMERIC },
    "Year reviewed": { kind: Kind.NUMERIC },
    "Cocoa butter": { kind: Kind.BINARY, positive: "Added" },
  },
  versions: [
    {
      name: "Our map",
      explain: "The year is a real, if small, Mr Confounder: ratings crept up over time while fewer very dark bars were reviewed. Freeze it, and the answer is {est}. Barely different: here the first look was already almost fair.",
      lesson: "Freeze what pushes on both the cause and the effect.",
      pos: { "Very dark": [80, 215], Rating: [556, 215], "Year reviewed": [318, 40] },
      edges: [["Year reviewed", "Very dark"], ["Year reviewed", "Rating"], ["Very dark", "Rating"]],
    },
    {
      name: "Just the correlation",
      fine: true,
      explain: "At first glance, very dark bars score {est} on the 1–4 scale compared with the rest. Before believing it, ask: is anything pushing on both how dark a bar is and how it's rated?",
      lesson: "Sometimes correlation and causation nearly agree. The map is how you know when.",
      pos: { "Very dark": [190, 205], Rating: [480, 205] },
      edges: [["Very dark", "Rating"]],
    },
    {
      name: "Freeze cocoa butter",
      fine: true,
      explain: "Freezing added cocoa butter as well gives {est}, the same again: it isn't linked to ratings. Not everything you could freeze matters.",
      lesson: "Freezing something that doesn't push on both leaves the answer alone.",
      pos: { "Very dark": [80, 215], Rating: [556, 215], "Cocoa butter": [178, 40], "Year reviewed": [458, 40] },
      edges: [["Year reviewed", "Very dark"], ["Year reviewed", "Rating"], ["Cocoa butter", "Very dark"], ["Cocoa butter", "Rating"], ["Very dark", "Rating"]],
    },
  ],
};
