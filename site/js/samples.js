// Free Build's sample datasets. Each one opens straight onto the map, with no
// column check: its columns are known (how to use each, by name), and it
// comes with preset graphs, the right one first and the classic mistakes after.
// Built by scripts/build_free_build_samples.py.
import { Kind } from "./data.js";

const EVERYTHING = ["Region", "Deprivation", "University", "Coastal", "Adult degrees"];

export const SAMPLES = {
  towns: {
    file: "data/samples/towns.csv",
    name: "Small towns and exam results",
    columns: {
      "Town size": { kind: Kind.ORDERED, levels: ["Small", "Medium", "Large"] },
      "Education score": { kind: Kind.NUMERIC },
      Deprivation: { kind: Kind.ORDERED, levels: ["Lower", "Mid", "Higher"] },
      "Adult degrees": { kind: Kind.ORDERED, levels: ["Low", "Medium", "High"] },
      Region: { kind: Kind.CATEGORIES },
      Coastal: { kind: Kind.BINARY, positive: "Coastal" },
      University: { kind: Kind.BINARY, positive: "University" },
    },
    cause: "Town size",
    effect: "Education score",
    presets: [
      {
        name: "The deprivation story",
        note: "Larger towns tend to be more deprived, and deprivation drives exam results. So hold region fixed, but let the effect flow through deprivation.",
        pos: { Region: [24, 40], Coastal: [24, 380], "Town size": [240, 130], Deprivation: [350, 330], "Education score": [620, 215] },
        edges: [["Region", "Town size"], ["Region", "Deprivation"], ["Coastal", "Deprivation"],
          ["Town size", "Deprivation"], ["Town size", "Education score"], ["Deprivation", "Education score"]],
      },
      {
        name: "ONS: size alone",
        mistake: true,
        note: "Mistake: reading a correlation as an effect. This is the ONS comparison: town size and results, with nothing else in the graph.",
        pos: { "Town size": [190, 205], "Education score": [480, 205] },
        edges: [["Town size", "Education score"]],
      },
      {
        name: "Control for everything",
        mistake: true,
        note: "Mistake: controlling for everything. Deprivation gets held fixed too, so the part of the effect that travels through it disappears.",
        pos: { Region: [30, 30], Deprivation: [318, 30], University: [606, 30], "Town size": [150, 205],
          "Education score": [486, 205], Coastal: [150, 384], "Adult degrees": [486, 384] },
        edges: [...EVERYTHING.flatMap((v) => [[v, "Town size"], [v, "Education score"]]), ["Town size", "Education score"]],
      },
    ],
  },
  ielts: {
    file: "data/samples/ielts.csv",
    name: "Official English and IELTS scores",
    columns: {
      "Official English": { kind: Kind.BINARY, positive: "Official English" },
      "Speak-write gap": { kind: Kind.NUMERIC },
      Region: { kind: Kind.CATEGORIES },
      "Test type": { kind: Kind.CATEGORIES },
      Year: { kind: Kind.CATEGORIES },
      "Overall band": { kind: Kind.NUMERIC },
      Listening: { kind: Kind.NUMERIC },
      Reading: { kind: Kind.NUMERIC },
    },
    cause: "Official English",
    effect: "Speak-write gap",
    presets: [
      {
        name: "The blog's graph",
        note: "Region stands in for colonial history, which shaped both whether English is official and how schools teach writing. Compare countries with their neighbours: hold region fixed.",
        pos: { Region: [318, 40], "Official English": [60, 300], "Speak-write gap": [576, 300] },
        edges: [["Region", "Official English"], ["Region", "Speak-write gap"], ["Official English", "Speak-write gap"]],
      },
      {
        name: "Raw comparison",
        mistake: true,
        note: "Mistake: comparing every country with every other. The non-official group mixes regions with very different gaps.",
        pos: { "Official English": [100, 205], "Speak-write gap": [520, 205] },
        edges: [["Official English", "Speak-write gap"]],
      },
      {
        name: "Control for everything",
        mistake: true,
        note: "Mistake: controlling for everything. The overall band is partly the speaking score itself, so holding it fixed hides part of the gap.",
        pos: { Region: [30, 30], "Overall band": [318, 30], Listening: [606, 30], "Official English": [150, 205],
          "Speak-write gap": [486, 205], Reading: [150, 384], "Test type": [486, 384] },
        edges: [...["Region", "Overall band", "Listening", "Reading", "Test type"].flatMap((v) => [[v, "Official English"], [v, "Speak-write gap"]]),
          ["Official English", "Speak-write gap"]],
      },
    ],
  },
};
