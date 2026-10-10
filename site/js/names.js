// What each causal role is called on the site, matching the game's characters,
// so a block in the Sandbox and a character in the game share a name.
import { Role } from "./causal.js";

export const CHARACTER = {
  [Role.TREATMENT]: "The cause",
  [Role.OUTCOME]: "The effect",
  [Role.CONFOUNDER]: "Mr Confounder",
  [Role.MEDIATOR]: "Mr Mediator",
  [Role.COLLIDER]: "Mr Bouncer",
  [Role.INSTRUMENT]: "Only moves the cause",
  [Role.PRECISION]: "Also moves the effect",
  [Role.UNRELATED]: "Not involved",
};
