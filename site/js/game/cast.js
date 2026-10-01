// © 2026 George Lindley. All rights reserved. The Causal Blocks characters,
// their names, personalities and artwork are not covered by the repository's
// MIT licence; see CONTENT-LICENSE.md.
//
// The cast: each causal role is a character. Artwork is drawn on a 200×200
// viewBox so it can be shown at any size.

import { Role } from "../causal.js";

const eyes = (x1, x2, y, look = 0) => `
  <circle cx="${x1}" cy="${y}" r="11" fill="#fff"/><circle cx="${x1 + look}" cy="${y + 1}" r="5.5" fill="#1f2933"/>
  <circle cx="${x2}" cy="${y}" r="11" fill="#fff"/><circle cx="${x2 + look}" cy="${y + 1}" r="5.5" fill="#1f2933"/>`;

const body = (color) => `<rect x="50" y="60" width="100" height="92" rx="24" fill="${color}"/>
  <rect x="50" y="136" width="100" height="16" rx="8" fill="#000" opacity="0.12"/>`;

export const CAST = {
  [Role.TREATMENT]: {
    name: "The Cause",
    term: "Treatment",
    color: "#fa953d",
    line: "Always pushing. The headline says it makes things happen.",
    does: "The arrow starts here. The question is always whether its push really lands.",
    art: `${body("#fa953d")}${eyes(82, 118, 98, 4)}
      <path d="M84 126 q16 12 32 0" stroke="#1f2933" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M150 104 h34 m-12 -12 l12 12 l-12 12" stroke="#1f2933" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  [Role.OUTCOME]: {
    name: "The Effect",
    term: "Outcome",
    color: "#16a085",
    line: "Easily surprised. Things keep happening to it.",
    does: "Nothing. It's the one everybody is trying to move.",
    art: `${body("#16a085")}${eyes(82, 118, 98, -3)}
      <ellipse cx="100" cy="130" rx="9" ry="11" fill="#1f2933"/>
      <path d="M16 104 h30 m-12 -12 l12 12 l-12 12" stroke="#1f2933" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  [Role.CONFOUNDER]: {
    name: "Mr Confounder",
    term: "Confounder",
    color: "#3498db",
    line: "A puppet master. Pulls two strings at once and stays out of sight.",
    does: "Makes two blocks move together, so they look linked. Freeze him and the link vanishes.",
    art: `<rect x="62" y="16" width="76" height="36" rx="6" fill="#1f2933"/><rect x="48" y="48" width="104" height="10" rx="5" fill="#1f2933"/>
      ${body("#3498db")}${eyes(82, 118, 96, 2)}
      <path d="M86 128 q14 -8 28 0" stroke="#1f2933" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M118 128 l6 -4" stroke="#1f2933" stroke-width="4" stroke-linecap="round"/>
      <path d="M58 150 v24 M142 150 v24" stroke="#1f2933" stroke-width="3" stroke-dasharray="3 4"/>
      <rect x="44" y="172" width="28" height="18" rx="6" fill="#fa953d"/><rect x="128" y="172" width="28" height="18" rx="6" fill="#16a085"/>`,
  },
  [Role.MEDIATOR]: {
    name: "The Messenger",
    term: "Mediator",
    color: "#9b59b6",
    line: "Always in a hurry. Carries the Cause's message to the Effect.",
    does: "The effect travels through him. Freeze him and the message never arrives.",
    art: `<path d="M56 60 q44 -34 88 0 z" fill="#5e2d75"/><rect x="92" y="34" width="16" height="8" rx="4" fill="#5e2d75"/>
      ${body("#9b59b6")}${eyes(82, 118, 98, 5)}
      <path d="M86 126 q14 10 28 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
      <rect x="132" y="112" width="48" height="34" rx="5" fill="#fff" stroke="#1f2933" stroke-width="3"/>
      <path d="M132 114 l24 18 l24 -18" stroke="#1f2933" stroke-width="3" fill="none"/>`,
  },
  [Role.COLLIDER]: {
    name: "The Bouncer",
    term: "Collider",
    color: "#e74c3c",
    line: "Guards the door. Talent gets you in, and so does luck.",
    does: "Nothing, until you only look at who got in. Then he makes strangers look linked.",
    art: `${body("#e74c3c")}
      <rect x="66" y="86" width="30" height="18" rx="7" fill="#1f2933"/><rect x="104" y="86" width="30" height="18" rx="7" fill="#1f2933"/>
      <rect x="94" y="92" width="12" height="5" fill="#1f2933"/>
      <path d="M84 130 h32" stroke="#1f2933" stroke-width="5" stroke-linecap="round"/>
      <rect x="18" y="120" width="8" height="54" rx="3" fill="#c9a227"/><rect x="174" y="120" width="8" height="54" rx="3" fill="#c9a227"/>
      <circle cx="22" cy="118" r="7" fill="#c9a227"/><circle cx="178" cy="118" r="7" fill="#c9a227"/>
      <path d="M26 126 q-6 30 24 22 M174 126 q6 30 -24 22" stroke="#b03a2e" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  },
};

/** Captions for blocks on the game board: character names, not jargon. */
export const CHARACTER_TEXT = {
  [Role.TREATMENT]: "The Cause",
  [Role.OUTCOME]: "The Effect",
  [Role.CONFOUNDER]: "Mr Confounder",
  [Role.MEDIATOR]: "The Messenger",
  [Role.COLLIDER]: "The Bouncer",
  [Role.INSTRUMENT]: "Instrument",
  [Role.PRECISION]: "Outcome cause",
  [Role.UNRELATED]: "Bystander",
};

/** A character's artwork as a complete SVG element. */
export function portrait(role, size = 120, label = "") {
  const c = CAST[role];
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${c.art}</svg>`;
}

/** A shadow version for characters not met yet. */
export function silhouette(size = 120) {
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">
    <rect x="50" y="60" width="100" height="92" rx="24" fill="#d5dee6"/>
    <text x="100" y="124" text-anchor="middle" font-size="56" font-weight="800" fill="#ffffff" font-family="sans-serif">?</text></svg>`;
}
