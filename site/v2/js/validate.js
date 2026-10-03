// Checks that a level's crowd really shows what the level claims, so a story
// can never ask the player to explain a link that isn't there. Pure: runs in
// the browser or in Node (tests/js/v2_levels_harness.mjs).

import { hasLink, linkStrength, noLink, people } from "./crowd-math.js";

const ROLES = ["cause", "effect", "confounder", "messenger", "bouncer", "decoy"];

/** Arrows each role must have, given the question pair. */
function expectedArrows(id, role, cause, effect) {
  switch (role) {
    case "confounder": return [[id, cause], [id, effect]];
    case "messenger": return [[cause, id], [id, effect]];
    case "bouncer": return [[cause, id], [effect, id]];
    default: return [];
  }
}

const key = ([a, b]) => `${a}>${b}`;

/** Every problem with a level, as sentences. Empty means the level is sound. */
export function validateLevel(level) {
  const errors = [];
  const fail = (msg) => errors.push(msg);
  const { boxes = {}, question = {}, test } = level;
  const ids = Object.keys(boxes);
  const { cause, effect } = question;

  for (const field of ["id", "title", "story", "boxes", "question", "crowd", "correctArrows", "test", "layout"]) {
    if (level[field] === undefined) fail(`missing field "${field}"`);
  }
  if (errors.length) return errors;
  if (!boxes[cause] || !boxes[effect]) return [`question boxes must both be in boxes`];
  for (const [id, b] of Object.entries(boxes)) {
    if (!ROLES.includes(b.role)) fail(`box ${id}: unknown role "${b.role}"`);
    if (!level.layout[id]) fail(`box ${id}: no layout position`);
  }
  if (boxes[cause].role !== "cause") fail(`question cause ${cause} must have role "cause"`);
  if (boxes[effect].role !== "effect") fail(`question effect ${effect} must have role "effect"`);

  // Arrows: only between known boxes, and exactly what the roles imply.
  const arrows = new Set(level.correctArrows.map(key));
  for (const [a, b] of level.correctArrows) {
    if (!boxes[a] || !boxes[b]) fail(`arrow ${a} → ${b} uses an unknown box`);
  }
  const implied = new Set();
  for (const [id, b] of Object.entries(boxes)) {
    for (const arrow of expectedArrows(id, b.role, cause, effect)) implied.add(key(arrow));
  }
  if (level.linkReal && !ids.some((id) => boxes[id].role === "messenger")) implied.add(key([cause, effect]));
  for (const k of implied) if (!arrows.has(k)) fail(`correctArrows is missing ${k.replace(">", " → ")}`);
  for (const k of arrows) if (!implied.has(k)) fail(`correctArrows has ${k.replace(">", " → ")}, which no role explains`);

  // Crowd: every person has a yes/no for every box.
  const crowd = people(level.crowd);
  if (!crowd.length) return [...errors, "the crowd is empty"];
  for (const p of crowd) {
    for (const id of ids) {
      if (typeof p[id] !== "boolean") {
        fail(`a crowd group has no yes/no for ${id}`);
        return errors;
      }
    }
  }

  // The crowd must show what the test type claims.
  const whole = linkStrength(crowd, cause, effect);
  const role = (r) => ids.filter((id) => boxes[id].role === r);
  if (test === "split") {
    if (level.linkReal) fail(`a split level's link should be fake (linkReal: false)`);
    if (!hasLink(whole)) fail(`the whole crowd should show a link, but the columns differ by ${fmt(whole)}`);
    const by = level.splitBy;
    if (!boxes[by] || boxes[by].role !== "confounder") fail(`splitBy must name the confounder box`);
    else {
      for (const v of [true, false]) {
        const pile = crowd.filter((p) => p[by] === v);
        const d = linkStrength(pile, cause, effect);
        if (!noLink(d)) fail(`the ${by}=${v ? "yes" : "no"} pile should show no link, but the columns differ by ${fmt(d)}`);
      }
    }
  } else if (test === "force") {
    if (!level.linkReal) fail(`a force level's link should be real (linkReal: true)`);
    if (!hasLink(whole)) fail(`the whole crowd should show a link, but the columns differ by ${fmt(whole)}`);
    const forced = people(level.forced ?? []);
    if (!forced.length) fail(`a force level needs a "forced" crowd`);
    else {
      if (forced.some((p) => p[cause] !== true)) fail(`everyone in "forced" must have ${cause} yes`);
      const before = crowd.filter((p) => !p[cause]);
      const share = (c) => c.filter((p) => p[effect]).length / c.length;
      const gain = share(forced) - share(before);
      if (gain < 0.15) fail(`forcing should clearly raise ${effect}, but the share only moves by ${fmt(gain)}`);
    }
  } else if (test === "doors") {
    if (level.linkReal) fail(`a doors level's link should be fake (linkReal: false)`);
    if (!hasLink(linkStrength(crowd.filter((p) => p.visible !== false), cause, effect))) fail(`the people let in should show a link`);
    if (!noLink(whole)) fail(`the full crowd should show no link, but the columns differ by ${fmt(whole)}`);
  } else {
    fail(`unknown test "${test}"`);
  }

  // A decoy goes with neither question box.
  for (const d of role("decoy")) {
    for (const q of [cause, effect]) {
      const s = linkStrength(crowd, d, q);
      if (!noLink(s)) fail(`decoy ${d} should show no link with ${q}, but the columns differ by ${fmt(s)}`);
    }
  }
  return errors;
}

function fmt(d) {
  return d === null ? "nothing (a column is empty)" : d.toFixed(2);
}
