// Mountain coffee: Coffee Quality Institute ratings.
// Source: Coffee Quality Institute database (James LeDoux); via TidyTuesday 2020-07-07.
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
  order: [1, 0, 3, 2],
  intro: [
    "Coffee experts grade beans from farms all over the world, scoring each coffee out of 100. Many people say coffee grown high in the mountains tastes best. <b>Does altitude make coffee better?</b>",
  ],
  source: "Coffee Quality Institute database (James LeDoux)",
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
      explain: "So we freeze country, comparing farms only with farms in the same country. Now each kilometre is worth {est} points: about half the first glance.",
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
      explain: "But freeze the flavour score, and altitude seems to do very little ({est}). The cup score is ten tasting scores added up, and flavour is one of them: you'd be freezing part of the effect.",
      lesson: "Never freeze part of the effect.",
      pos: { "Altitude (km)": [80, 215], "Cup score": [556, 215], Country: [178, 40], "Flavour score": [458, 40] },
      edges: [["Country", "Altitude (km)"], ["Country", "Cup score"], ["Flavour score", "Altitude (km)"], ["Flavour score", "Cup score"], ["Altitude (km)", "Cup score"]],
    },
    {
      name: "Freeze moisture too",
      fine: true,
      explain: "Freezing how damp the beans were makes no difference ({est}): moisture doesn't push on how high a farm is.",
      lesson: "Freezing something that doesn't push on the cause changes nothing.",
      pos: { "Altitude (km)": [80, 215], "Cup score": [556, 215], Country: [178, 40], Moisture: [458, 40] },
      edges: [["Country", "Altitude (km)"], ["Country", "Cup score"], ["Moisture", "Altitude (km)"], ["Moisture", "Cup score"], ["Altitude (km)", "Cup score"]],
    },
  ],
};
