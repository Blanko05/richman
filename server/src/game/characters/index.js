// Character identity (display name, portrait) lives here, entirely separate
// from ability logic (see ../abilities/) -- swapping art or a name never
// touches ability code, and vice versa. A character is just a record that
// references an ability implementation by id.
//
// Portraits are placeholders -- characters.md: "Real portraits are decided
// separately."
import { ABILITIES } from "../abilities/index.js";

export const CHARACTER_IDS = ["D", "Z", "Y", "H", "SD", "SE"];

export const CHARACTERS = {
  D:  { id: "D",  name: "The Don",       portrait: "don.png",       abilityId: "D" },
  Z:  { id: "Z",  name: "The Enforcer",  portrait: "enforcer.png",  abilityId: "Z" },
  Y:  { id: "Y",  name: "The Wrecker",   portrait: "wrecker.png",   abilityId: "Y" },
  H:  { id: "H",  name: "The Kingpin",   portrait: "kingpin.png",   abilityId: "H" },
  SD: { id: "SD", name: "The Conductor", portrait: "conductor.png", abilityId: "SD" },
  SE: { id: "SE", name: "The Fixer",     portrait: "fixer.png",     abilityId: "SE" },
};

export function abilityFor(characterId) {
  const character = CHARACTERS[characterId];
  return character ? ABILITIES[character.abilityId] : undefined;
}
