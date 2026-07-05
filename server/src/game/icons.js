export const ICON_IDS = ["italian", "american", "russian", "arab", "japanese", "orangelad"];

// Each icon has a fixed color -- picking an icon also sets the player's
// token/owner-bar color, so the two always match (see Room.js setPlayerIcon).
// "orangelad" is the 6th icon, added so all 6 seats in a characters-mode game
// can have a distinct token.
export const ICON_COLORS = {
  italian: "#9b59b6",
  american: "#e74c3c",
  russian: "#3498db",
  arab: "#2ecc71",
  japanese: "#f1c40f",
  orangelad: "#e67e22",
};
