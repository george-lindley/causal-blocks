// Mountain coffee: Coffee Quality Institute ratings.
// Data: Coffee Quality Institute database, collected by James LeDoux, no licence stated; via TidyTuesday 2020-07-07.
// See LICENCES.md for how the licence was checked.
import { Kind } from "../data.js";

export default {
  key: "coffee",
  file: "data/samples/coffee.csv",
  tag: "Coffee farms",
  icon: "🫘",
  level: "medium",
  name: "Mountain coffee",
  question: "Does coffee grown higher up taste better?",
  about: "1,007 coffees from 19 countries, graded by the Coffee Quality Institute and scored out of 100 by trained tasters. Altitude is the farm's height in kilometres.",
  order: [1, 0, 2, 3],
  intro: [
    "Coffee experts grade beans from farms all over the world, scoring each coffee out of 100. Many people say coffee grown high in the mountains tastes best.",
  ],
  credit: "Coffee Quality Institute database, collected by James LeDoux",
  origin: "https://github.com/jldbc/coffee-quality-database",
  licence: { name: "no licence stated", url: null, group: "red" },
  tidytuesday: "2020-07-07",
  cause: "Altitude (km)",
  effect: "Cup score",
  reads: "Every extra kilometre of altitude changes the cup score by {est} points.",
  columns: {
    "Altitude (km)": { kind: Kind.NUMERIC },
    "Cup score": { kind: Kind.NUMERIC },
    Country: { kind: Kind.CATEGORIES },
    "Flavour score": { kind: Kind.NUMERIC },
    Moisture: { kind: Kind.NUMERIC },
  },
  versions: [
    {
      name: "Our map",
      explain: "Freeze country: compare farms only with farms in the same country. Each kilometre is then worth {est} points, about half the first look.",
      lesson: "Mr Confounder can be a group, like a country. Freezing it means comparing within each group.",
      pos: { "Altitude (km)": [80, 215], "Cup score": [556, 215], Country: [318, 40] },
      edges: [["Country", "Altitude (km)"], ["Country", "Cup score"], ["Altitude (km)", "Cup score"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, every kilometre higher adds {est} points out of 100. But countries differ: Ethiopia's farms are some of the highest, and its coffee is famous for other reasons too.",
      lesson: "A correlation mixes the effect up with everything else that differs between the groups.",
      pos: { "Altitude (km)": [190, 205], "Cup score": [480, 205] },
      edges: [["Altitude (km)", "Cup score"]],
    },
    {
      name: "Freeze flavour score",
      mistake: true,
      explain: "What if you froze the flavour score too? Altitude seems to do very little ({est}). But the cup score is ten tasting scores added up, and flavour is one of them: that's freezing part of the effect.",
      lesson: "Never freeze part of the effect.",
      pos: { "Altitude (km)": [80, 215], "Cup score": [556, 215], Country: [178, 40], "Flavour score": [458, 40] },
      edges: [["Country", "Altitude (km)"], ["Country", "Cup score"], ["Flavour score", "Altitude (km)"], ["Flavour score", "Cup score"], ["Altitude (km)", "Cup score"]],
    },
    {
      name: "Freeze moisture too",
      fine: true,
      explain: "Freezing how damp the beans were as well makes no difference ({est}): moisture doesn't push on how high a farm is.",
      lesson: "Freezing something that doesn't push on the cause changes nothing.",
      pos: { "Altitude (km)": [80, 215], "Cup score": [556, 215], Country: [178, 40], Moisture: [458, 40] },
      edges: [["Country", "Altitude (km)"], ["Country", "Cup score"], ["Moisture", "Altitude (km)"], ["Moisture", "Cup score"], ["Altitude (km)", "Cup score"]],
    },
  ],
};
