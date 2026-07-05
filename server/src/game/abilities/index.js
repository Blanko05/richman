// Registry of ability modules, keyed by the same short id used in characters.md
// (D, Z, Y, H, SD, SE) and in characters/index.js's abilityId field. Deliberately
// empty entries get filled in one at a time as each character is implemented --
// see characters.md and decisions.md for the build order and why.
//
// Ability module shape (see any implemented ability for a concrete example):
//   {
//     id,                          // matches its key here
//     activeCooldown: number | (activeResult) => number,
//     passives: { [hookName]: (room, payload) => void },
//     active: (room, casterPlayer, params) => { ok: true, ... } | { error }
//   }
import { wrecker } from "./wrecker.js";
import { don } from "./don.js";
import { enforcer } from "./enforcer.js";
import { kingpin } from "./kingpin.js";
import { conductor } from "./conductor.js";
import { fixer } from "./fixer.js";

export const ABILITIES = {
  Y: wrecker,
  D: don,
  Z: enforcer,
  H: kingpin,
  SD: conductor,
  SE: fixer,
};
