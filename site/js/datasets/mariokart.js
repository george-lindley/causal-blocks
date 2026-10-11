// Shortcuts and world records: Mario Kart 64 world records from mkwrs.com.
// Source: Mario Kart World Records (mkwrs.com); via TidyTuesday 2021-05-25.
import { Kind } from "../data.js";

export default {
  key: "mariokart",
  file: "data/samples/mariokart.csv",
  tag: "Mario Kart 64",
  level: "hard",
  name: "Shortcuts and world records",
  question: "How much time does a shortcut save in Mario Kart 64 world records?",
  about: "2,334 Mario Kart 64 world records (1997–2021) on 16 tracks, in one-lap and three-lap races, with and without shortcuts. Time is in seconds.",
  intro: [
    "Mario Kart 64 players have been setting world records since 1997, on 16 tracks, in one-lap and three-lap races, with and without shortcuts. <b>How much time does a shortcut really save?</b>",
    "Two things get in the way. Shortcuts only exist on some tracks, and those tracks are longer. And shortcut records are more often one-lap races, which are short anyway. These two Mr Confounders push in opposite directions. <b>Freeze both</b>, and a shortcut saves about 38 seconds.",
    "Here's the trick: the plain comparison lands close to that answer, but only because the two Mr Confounders cancel out. Freeze just one of them and the answer swings by about ten seconds, one way or the other.",
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
      explain: "Two things push on both. Only some tracks have shortcuts, and tracks differ a lot in length. And three-lap races take longer, while shortcut records are more often one-lap. Freezing both compares records on the same track and race length.",
      lesson: "When two Mr Confounders push in opposite directions, freeze both.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [178, 40], Track: [458, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Laps", "Shortcut"], ["Laps", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "Nothing frozen. By luck, the two Mr Confounders push opposite ways and nearly cancel out, so the answer looks about right, but for the wrong reason.",
      lesson: "A correlation can land near the truth by accident. Only the map tells you whether to trust it.",
      pos: { Shortcut: [190, 205], "Time (s)": [480, 205] },
      edges: [["Shortcut", "Time (s)"]],
    },
    {
      name: "Forget the laps",
      mistake: true,
      explain: "Only the track is frozen. Shortcut records are more often one-lap races, which are short anyway, so shortcuts get credit for the short races and look even better than they are.",
      lesson: "Missing one Mr Confounder can make an effect look too big.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Track: [318, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Forget the track",
      mistake: true,
      explain: "Only the race length is frozen. Shortcuts exist mainly on long tracks, which makes shortcut times look slower and hides part of the time they save.",
      lesson: "Missing a different Mr Confounder can make the same effect look too small.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [318, 40] },
      edges: [["Laps", "Shortcut"], ["Laps", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
    {
      name: "Freeze the console too",
      fine: true,
      explain: "PAL and NTSC consoles run at slightly different speeds, but the console doesn't decide whether a shortcut is used. Freezing it as well barely moves the answer.",
      lesson: "Freezing something that doesn't push on the cause changes little.",
      pos: { Shortcut: [80, 215], "Time (s)": [556, 215], Laps: [40, 40], System: [318, 40], Track: [596, 40] },
      edges: [["Track", "Shortcut"], ["Track", "Time (s)"], ["Laps", "Shortcut"], ["Laps", "Time (s)"], ["System", "Shortcut"], ["System", "Time (s)"], ["Shortcut", "Time (s)"]],
    },
  ],
};
