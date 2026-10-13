// Wages and coffee prices: James Hoffmann's Cappuccino Index.
// Data: James Hoffmann's Cappuccino Index, no licence stated; via TidyTuesday 2026-09-08.
// See LICENCES.md for how the licence was checked.
import { Kind } from "../data.js";

export default {
  key: "cappuccino",
  tag: "Cappuccino Index",
  icon: "☕",
  level: "medium",
  name: "Wages and coffee prices",
  question: "Do places with higher wages charge more for a cappuccino?",
  about: "2,451 cafés in 36 countries: the price of a small cappuccino and the local hourly wage, both in pounds.",
  order: [1, 0, 2, 3],
  intro: [
    "Coffee YouTuber James Hoffmann collected the price of a cappuccino and local wages from cafés around the world.",
  ],
  credit: "James Hoffmann's Cappuccino Index",
  origin: "https://www.youtube.com/watch?v=WtlE3BW9Nqs",
  licence: { name: "no licence stated", url: null, group: "red" },
  tidytuesday: "2026-09-08",
  cause: "Hourly wage (£)",
  effect: "Cappuccino (£)",
  reads: "Every extra £1 an hour in wages changes the price of a cappuccino by £{est}.",
  columns: {
    "Hourly wage (£)": { kind: Kind.NUMERIC },
    "Cappuccino (£)": { kind: Kind.NUMERIC },
    Country: { kind: Kind.CATEGORIES },
    City: { kind: Kind.BINARY, positive: "City" },
  },
  versions: [
    {
      name: "Our map",
      explain: "Freeze country, and city versus countryside. Now £1 more in wages comes with only {est} pounds more, about a third of the first look: most of the link was rich countries versus poorer ones.",
      lesson: "Freeze every Mr Confounder on the map, big and small.",
      pos: { "Hourly wage (£)": [80, 215], "Cappuccino (£)": [556, 215], City: [178, 40], Country: [458, 40] },
      edges: [["Country", "Hourly wage (£)"], ["Country", "Cappuccino (£)"], ["City", "Hourly wage (£)"], ["City", "Cappuccino (£)"], ["Hourly wage (£)", "Cappuccino (£)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, every extra £1 an hour in wages comes with a cappuccino {est} pounds dearer. But rich countries have higher wages and higher costs of almost everything.",
      lesson: "Comparing across very different groups mixes the effect up with the groups.",
      pos: { "Hourly wage (£)": [190, 205], "Cappuccino (£)": [480, 205] },
      edges: [["Hourly wage (£)", "Cappuccino (£)"]],
    },
    {
      name: "Freeze city only",
      mistake: true,
      explain: "What if you froze only city versus countryside? It barely helps ({est}): that's the small Mr Confounder, and the big one is still mixed in.",
      lesson: "Freezing the wrong Mr Confounder doesn't fix the right one.",
      pos: { "Hourly wage (£)": [80, 215], "Cappuccino (£)": [556, 215], City: [318, 40] },
      edges: [["City", "Hourly wage (£)"], ["City", "Cappuccino (£)"], ["Hourly wage (£)", "Cappuccino (£)"]],
    },
    {
      name: "Freeze country only",
      fine: true,
      explain: "Freezing country alone gives almost the same answer as the best map ({est}). Country does nearly all the work.",
      lesson: "Find the Mr Confounder that matters most first.",
      pos: { "Hourly wage (£)": [80, 215], "Cappuccino (£)": [556, 215], Country: [318, 40] },
      edges: [["Country", "Hourly wage (£)"], ["Country", "Cappuccino (£)"], ["Hourly wage (£)", "Cappuccino (£)"]],
    },
  ],
};
