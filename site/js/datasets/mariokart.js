// Shortcuts and world records: Mario Kart 64 world records from mkwrs.com.
// Source: Mario Kart World Records (mkwrs.com); via TidyTuesday 2021-05-25.
import { Kind } from "../data.js";

export default {
  key: "mariokart",
  file: "data/samples/mariokart.csv",
  tag: "Mario Kart 64",
  icon: "🏎️",
  level: "hard",
  name: "Shortcuts and world records",
  question: "How much time does a shortcut save in Mario Kart 64 world records?",
  about: "2,334 Mario Kart 64 world records (1997–2021) on 16 tracks, in one-lap and three-lap races, with and without shortcuts. Time is in seconds.",
  order: [1, 0, 2, 3, 4],
  intro: [
    "Mario Kart 64 players have been setting world records since 1997, on 16 tracks, in one-lap and three-lap races, with and without shortcuts. <b>How much time does a shortcut really save?</b>",
  ],
  source: "Mario Kart World Records (mkwrs.com)",
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
      explain: "Shortcuts only exist on some tracks, and those tracks are longer. And shortcut records are more often one-lap races, which are short anyway. Freeze both the track and the laps, and a shortcut saves {est} seconds. The first glance landed close, but only because these two Mr Confounders pushed in opposite directions and cancelled out.",
      lesson: "When two Mr Confounders push in opposite directions, freeze both.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [178, 40], Track: [458, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Laps", "Shortcut"], ["Laps", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "At first glance, shortcut records are {est} seconds faster. That sounds about right, but two things are tangled up in it.",
      lesson: "A correlation can land near the truth by accident. Only the map tells you whether to trust it.",
      pos: { Shortcut: [190, 205], "Time (s)": [480, 205] },
      edges: [["Shortcut", "Time (s)"]],
    },
    {
      name: "Forget the laps",
      mistake: true,
      explain: "Watch what happens if you freeze only the track and forget the laps: shortcuts get the credit for the short races, and the saving balloons to {est} seconds.",
      lesson: "Missing one Mr Confounder can make an effect look too big.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Track: [318, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Forget the track",
      mistake: true,
      explain: "Forget the track instead, and it swings the other way, to {est}: shortcut tracks are long, which hides part of the time saved.",
      lesson: "Missing a different Mr Confounder can make the same effect look too small.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [318, 40] },
      edges: [["Laps", "Shortcut"], ["Laps", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Freeze the console too",
      fine: true,
      explain: "Freezing the console as well (PAL or NTSC) changes almost nothing ({est}). It doesn't decide whether a shortcut is used.",
      lesson: "Freezing something that doesn't push on the cause changes little.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [40, 40], System: [318, 40], Track: [596, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Laps", "Shortcut"], ["Laps", "Time (s)"], ["System", "Shortcut"], ["System", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
  ],
};
