// Shortcuts and world records: Mario Kart 64 world records from mkwrs.com.
// Data: Mario Kart World Records (mkwrs.com), no licence stated; via TidyTuesday 2021-05-25.
// See LICENCES.md for how the licence was checked.
import { Kind } from "../data.js";

export default {
  key: "mariokart",
  tag: "Mario Kart 64",
  icon: "🏎️",
  level: "hard",
  name: "Shortcuts and world records",
  question: "How much time does a shortcut save in Mario Kart 64 world records?",
  about: "2,334 Mario Kart 64 world records (1997–2021) on 16 tracks, in one-lap and three-lap races, with and without shortcuts. Time is in seconds.",
  order: [1, 0, 2, 3, 4],
  intro: [
    "Mario Kart 64 players have been setting world records since 1997, on 16 tracks, in one-lap and three-lap races, with and without shortcuts.",
  ],
  credit: "Mario Kart World Records (mkwrs.com)",
  origin: "https://mkwrs.com/",
  licence: { name: "no licence stated", url: null, group: "red" },
  tidytuesday: "2021-05-25",
  cause: "Shortcut",
  effect: "Time (s)",
  reads: "Using a shortcut changes the record time by {est} seconds.",
  columns: {
    Shortcut: { kind: Kind.BINARY, positive: "Shortcut" },
    "Time (s)": { kind: Kind.NUMERIC },
    Track: { kind: Kind.CATEGORIES },
    Laps: { kind: Kind.BINARY, positive: "Three laps" },
    System: { kind: Kind.CATEGORIES },
  },
  versions: [
    {
      name: "Our map",
      explain: "Freeze the track and the laps. Shortcuts only exist on some tracks, and those tracks are longer; and shortcut records are more often one-lap races, which are short anyway. With both frozen, a shortcut saves {est} seconds. The first look landed close only by luck: the two Mr Confounders cancelled out.",
      lesson: "When two Mr Confounders push in opposite directions, freeze both.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [178, 40], Track: [458, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Laps", "Shortcut"], ["Laps", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, shortcut records are {est} seconds faster. But two things are tangled up in that.",
      lesson: "A correlation can land near the truth by accident. Only the map tells you whether to trust it.",
      pos: { Shortcut: [190, 205], "Time (s)": [480, 205] },
      edges: [["Shortcut", "Time (s)"]],
    },
    {
      name: "Freeze the track only",
      mistake: true,
      explain: "What if you froze only the track? The saving balloons to {est} seconds, because shortcuts get the credit for the short one-lap races.",
      lesson: "Missing one Mr Confounder can make an effect look too big.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Track: [318, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Freeze the laps only",
      mistake: true,
      explain: "Freeze only the laps, and it swings the other way, to {est}: shortcuts exist mainly on long tracks, which hides part of the time they save.",
      lesson: "Missing a different Mr Confounder can make the same effect look too small.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [318, 40] },
      edges: [["Laps", "Shortcut"], ["Laps", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Freeze the console too",
      fine: true,
      explain: "Freezing the console as well (PAL or NTSC) changes almost nothing ({est}): it doesn't decide whether a shortcut is used.",
      lesson: "Freezing something that doesn't push on the cause changes little.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [40, 40], System: [318, 40], Track: [596, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Laps", "Shortcut"], ["Laps", "Time (s)"], ["System", "Shortcut"], ["System", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
  ],
};
