// Generic archetype ids, matching characters.md's ability spec 1:1. Deliberately
// no real-world names or references here -- this file is the engine's only
// notion of "who" a character is, and stays clean/generic by design so it's
// safe to open-source. Display names/portraits ("skins") live entirely in the
// client (client/src/data/characters.js) and are swappable without touching
// this file or any ability logic.
export const CHARACTER_IDS = ["don", "enforcer", "wrecker", "kingpin", "conductor", "fixer"];

export const CHARACTER_NAMES = {
  don: "الدون",
  enforcer: "المنفّذ",
  wrecker: "الهدّام",
  kingpin: "العقل المدبر",
  conductor: "الكمساري",
  fixer: "المُصلح",
};

// One entry per active ability, keyed by character id (Kingpin is the only
// one with two). `cooldownTurns` is the number of that player's own elapsed
// turns before the ability is usable again -- for the two abilities whose
// real cooldown formula depends on the size of the action taken (Wrecker's
// Detonate, Fixer's Heist -- see characters.md), this is just the
// documented minimum/baseline, used until the actual effect (and therefore
// the real formula) is implemented; see Room.useAbility.
export const ABILITIES = {
  don: [{ id: "barricade", cooldownTurns: 10 }],
  enforcer: [{ id: "curse", cooldownTurns: 7 }],
  wrecker: [{ id: "detonate", cooldownTurns: 3 }],
  kingpin: [
    { id: "flankSeizure", cooldownTurns: 12 },
    { id: "hostileTakeover", cooldownTurns: 7 },
  ],
  conductor: [{ id: "wreckingTour", cooldownTurns: 8 }],
  fixer: [{ id: "heist", cooldownTurns: 5 }],
};
