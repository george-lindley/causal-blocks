// Wages and coffee prices: James Hoffmann's Cappuccino Index.
// Source: James Hoffmann's Cappuccino Index; via TidyTuesday 2026-09-08.
import { Kind } from "../data.js";

export default {
  key: "cappuccino",
  file: "data/samples/cappuccino.csv",
  tag: "Cappuccino Index",
  icon: "☕",
  level: "medium",
  name: "Wages and coffee prices",
  question: "Do places with higher wages charge more for a cappuccino?",
  about: "2,451 cafés in 36 countries: the price of a small cappuccino and the local hourly wage, both in pounds.",
  intro: [
    "Coffee YouTuber James Hoffmann collected the price of a cappuccino and local wages from cafés around the world. <b>Do places with higher wages charge more for coffee?</b>",
  ],
  source: "James Hoffmann's Cappuccino Index",
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
      explain: "Rich countries have both higher wages and pricier coffee (rent, taxes, ingredients), and cities are pricier than the countryside. Both push on wages and prices, so both are frozen.",
      lesson: "Freeze every Mr Confounder on the map, big and small.",
      pos: { "Hourly wage (£)": [80, 215], "Cappuccino (£)": [556, 215], City: [178, 40], Country: [458, 40] },
      edges: [["Country", "Hourly wage (£)"], ["Country", "Cappuccino (£)"], ["City", "Hourly wage (£)"], ["City", "Cappuccino (£)"], ["Hourly wage (£)", "Cappuccino (£)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "Nothing frozen. Most of the link is just rich countries versus poorer ones, so wages get the credit for everything that makes a country expensive.",
      lesson: "Comparing across very different groups mixes the effect up with the groups.",
      pos: { "Hourly wage (£)": [190, 205], "Cappuccino (£)": [480, 205] },
      edges: [["Hourly wage (£)", "Cappuccino (£)"]],
    },
    {
      name: "Freeze city only",
      mistake: true,
      explain: "Only city versus countryside is frozen. That's a small Mr Confounder; the big one, country, is still mixed in, so the answer hardly improves.",
      lesson: "Freezing the wrong Mr Confounder doesn't fix the right one.",
      pos: { "Hourly wage (£)": [80, 215], "Cappuccino (£)": [556, 215], City: [318, 40] },
      edges: [["City", "Hourly wage (£)"], ["City", "Cappuccino (£)"], ["Hourly wage (£)", "Cappuccino (£)"]],
    },
    {
      name: "Freeze country only",
      fine: true,
      explain: "Country alone does almost all the work: adding city on top barely changes the answer. Both maps are reasonable.",
      lesson: "Find the Mr Confounder that matters most first.",
      pos: { "Hourly wage (£)": [80, 215], "Cappuccino (£)": [556, 215], Country: [318, 40] },
      edges: [["Country", "Hourly wage (£)"], ["Country", "Cappuccino (£)"], ["Hourly wage (£)", "Cappuccino (£)"]],
    },
  ],
};
