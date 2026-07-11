import { nanoid } from "nanoid";
import { TILE_TYPES, BOARD, TOTAL_TILES, propertiesByGroup } from "./board.js";
import { SURPRISE_CARDS, TREASURE_CARDS, shuffledDeck } from "./cards.js";
import { ICON_IDS, ICON_COLORS } from "./icons.js";
import { CHARACTER_IDS, CHARACTERS, abilityFor } from "./characters/index.js";
import { ABILITIES } from "./abilities/index.js";

// Client-safe projection of the ability registry -- display metadata only
// (name/description/cooldown label/target type), never the actual active()/
// passives/modifyRent functions themselves, which obviously can't cross a
// JSON socket payload anyway.
const ABILITY_DISPLAY_INFO = Object.fromEntries(
  Object.entries(ABILITIES).map(([id, ability]) => [id, {
    activeName: ability.activeName,
    description: ability.description,
    passiveDescription: ability.passiveDescription,
    cooldownLabel: ability.cooldownLabel,
    targetType: ability.targetType,
  }]),
);

// Exported so the test suite can assert against these by name instead of
// hardcoding magic numbers that would silently drift out of sync if tuned here.
export const STARTING_BALANCE = 1500;
export const HOLDING_RELEASE_RENT = 50;
export const MAX_HOLDING_TURNS = 3;
export const TURN_TIME_LIMIT_MS = 4 * 60 * 1000;
export const DISCONNECT_GRACE_MS = 20 * 1000;
export const MORTGAGE_INTEREST_RATE = 0.1;
export const AUCTION_BASE_MS = 10 * 1000;
export const AUCTION_EXTEND_MS = 3 * 1000;
export const MIN_TRADE_TIME_LIMIT_SEC = 10;
export const MAX_TRADE_TIME_LIMIT_SEC = 10 * 60;
export const WASTA_SUCCESS_RATE = 0.3;
// Both of these REST-type tiles ease the landing player's ability cooldown by
// a random 1-4 turns (decisions.md) -- name-scoped rather than
// TILE_TYPES.REST-scoped, since a third REST tile (اجازة/Vacation) exists too
// and does NOT get this treatment, only the existing vacation-pot payout.
export const COOLDOWN_REST_TILE_NAMES = new Set(["عليكم الأمان", "استراحة محارب"]);

const PLAYER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c"];

// "eight" and "eleven" start with a vowel sound; every other roll total (2-12) doesn't.
function article(n) {
  return n === 8 || n === 11 ? "an" : "a";
}

const DEFAULT_RULES = {
  vacationPot:       true,
  noRentInPrison:    true,
  evenBuild:         true,
  doubleRentFullSet: true,
  auction:           true,
  startingCash:      1500,
};

export class Room {
  constructor(code, hostId, mode = "normal") {
    this.code = code;
    this.hostId = hostId;
    // "normal" (classic, no characters) or "characters" (real characters-mode
    // game -- playerStartGame requires every active player to also have a
    // character, not just an icon; see below). The dev sandbox also tags
    // itself "characters" for state consistency, even though it bypasses this
    // gate entirely via room.start() directly.
    this.mode = mode;
    this.rules = { ...DEFAULT_RULES };
    this._board = BOARD;
    this._totalTiles = TOTAL_TILES;
    this._propertiesByGroup = propertiesByGroup;
    this._holdingTileId = BOARD.find((t) => t.type === TILE_TYPES.HOLDING)?.id;
    this.vacationPot = 0;
    this.players = [];
    this.ownership = {};
    this.started = false;
    this.turnIndex = 0;
    // One full lap of the seat array (this.players), counted independently of
    // which seats are bankrupt/left -- see decisions.md ("round" definition).
    // Character effects scoped to "the rest of the round" (Curse, Barricade)
    // are active until this next increments.
    this.round = 0;
    this.surpriseDeck = shuffledDeck(SURPRISE_CARDS);
    this.treasureDeck = shuffledDeck(TREASURE_CARDS);
    this.log = [];
    this.lastRoll = null;
    this.pendingAction = null;
    this.winnerId = null;
    this.turnTimer = null;
    this.turnDeadline = null;
    this.notify = null;
    this.trades = [];
    this.auctions = [];
    this.canRollAgain = true;
    this.consecutiveDoubles = 0;
    this.rollSeq = 0;
    // Bumped on every drawCard() -- lets the client tell "a genuinely new
    // card was just drawn" apart from "lastCard is still describing a card
    // from earlier this turn and got resent in an unrelated state update",
    // the same way rollSeq disambiguates repeat dice broadcasts.
    this.cardSeq = 0;
    // Bumped on every real sendToHolding() (landing on the Go-to-Holding tile,
    // or a card that sends the player there) -- lets the client tell a jailing
    // apart from an ordinary move so it can snap the token straight to the
    // Holding Pen instead of animating it walking the whole board to get there.
    this.jailSeq = 0;
    this.jailedPlayerId = null;
    // The tile the player was actually standing on the instant they got sent
    // to the Holding Pen -- either the Go-to-Holding tile itself, or wherever
    // a card that jails them was drawn. Since sendToHolding overwrites
    // player.position in the same beat that draws/lands, the client would
    // otherwise never see this tile at all; exposing it lets the token
    // animate walking there first before the actual teleport into the pen.
    this.jailFromTileId = null;
    // Bumped on every useHoldingFreeCard() attempt -- same "tell a genuinely
    // new event apart from a resend" role as cardSeq/jailSeq, so the client
    // can pop the wasta reveal exactly once per attempt.
    this.wastaSeq = 0;
    this.lastWastaAttempt = null;
    // D's Barricade (see abilities/don.js) -- { tileId, casterId } while a
    // wall is up, null otherwise. A one-shot trap, not a lasting wall: it
    // clears itself (see applyBarricade) the instant it catches its first
    // (non-caster) player, or once the caster's own next turn comes around if
    // nobody ever crosses it (see endTurn) -- caster-relative, not a global
    // round boundary, so the duration is equally fair no matter the caster's
    // seat position (decisions.md). barricadeSeq/lastBarricadeStop follow the
    // same "tell the client a special move just happened" role as
    // jailSeq/jailFromTileId, since a barricaded move needs to animate
    // stopping short of the roll's real distance instead of walking the full
    // amount.
    this.barricade = null;
    this.barricadeSeq = 0;
    this.lastBarricadeStop = null;
    // Z's Curse (see abilities/enforcer.js) -- a list of { targetId,
    // casterId }, one per simultaneously active curse. A list, not a single
    // slot, because Copy Cat can cast an independent second Curse (its own
    // caster/target/cooldown) while Z's real one is still active -- see
    // decisions.md. Each entry only ever redirects its own targetId's earnings
    // to its own casterId; a redirect is a terminal, direct transfer, never
    // itself re-checked against another curse, so even a mutual curse (A
    // curses B, B curses A) can't ping-pong -- see settleEarning below. Expires
    // once the casting player's own next turn comes around (endTurn), not a
    // global round boundary -- decisions.md.
    this.activeCurses = [];
    // H's Hostile Takeover (see abilities/kingpin.js) -- { tileId,
    // previousOwnership, casterId } while active, null otherwise. Reverts to
    // previousOwnership (or unowned, if it was previousOwnership === null)
    // once the caster's own next turn comes around -- see the revert call in
    // endTurn. Caster-relative, not a global round boundary (decisions.md).
    this.hostileTakeover = null;
    // SD's Wrecking Tour (see abilities/conductor.js) -- bumped/set each use
    // so every client (not just the caster) can animate the bus travelling
    // startTileId -> path -> back, same "tell the client a special move just
    // happened" role as barricadeSeq/lastBarricadeStop.
    this.wreckingTourSeq = 0;
    this.lastWreckingTour = null;
  }

  updateSettings(hostId, { rules } = {}) {
    if (this.hostId !== hostId) return { error: "Only the host can change settings" };
    if (this.started) return { error: "Game already started" };
    if (rules) {
      for (const [k, v] of Object.entries(rules)) {
        if (k in DEFAULT_RULES) this.rules[k] = v;
      }
    }
    return { ok: true };
  }

  addPlayer(id, token, name = "", preferredColor = null) {
    if (this.players.find((p) => p.id === id)) return;
    const takenColors = this.players.map((p) => p.color);
    const fallback = PLAYER_COLORS[this.players.length % PLAYER_COLORS.length];
    const color = (preferredColor && !takenColors.includes(preferredColor))
      ? preferredColor
      : fallback;
    const seatNum = this.players.length + 1;
    const baseName = name.trim() || `Seat ${seatNum}`;
    // The game log and renderLogEntry (client) identify who a log line is
    // about by matching a player's name as plain text -- two players with
    // the exact same name are indistinguishable that way, so every line
    // silently attributes to whichever of them happens to match first,
    // showing that one player's icon for everyone's actions. Dedupe up
    // front, the same way color collisions are already resolved above.
    const takenNames = new Set(this.players.map((p) => p.name));
    let uniqueName = baseName;
    for (let n = 2; takenNames.has(uniqueName); n++) uniqueName = `${baseName} (${n})`;
    this.players.push({
      id,
      token,
      name: uniqueName,
      color,
      connected: true,
      graceTimer: null,
      balance: STARTING_BALANCE,
      position: 0,
      inHolding: false,
      holdingTurns: 0,
      holdingFreeCard: false,
      bankrupt: false,
      left: false,
      properties: [],
      icon: null,
      // Character selection (see characters/index.js) -- room-exclusive, same
      // uniqueness scope as icon. abilityCooldown counts down in the holder's
      // own turns only (decisions.md); abilityState is a free-form scratch
      // object each ability module manages for its own per-player state (a
      // curse target, a barricaded tile, etc.) so Room.js stays agnostic of
      // any specific character's internals.
      character: null,
      abilityCooldown: 0,
      abilityState: {},
    });
  }

  verifyToken(id, token) {
    const player = this.playerById(id);
    return !!player && player.token === token;
  }

  // Disconnects (not manual leaves) get a short window to come back before being kicked.
  startGracePeriod(playerId) {
    const player = this.playerById(playerId);
    if (!player || player.left || player.bankrupt) return;
    player.connected = false;
    this.pushLog(`${player.name} disconnected — they have ${DISCONNECT_GRACE_MS / 1000}s to reconnect before losing their seat.`);
    player.graceTimer = setTimeout(() => {
      player.graceTimer = null;
      this.kickPlayer(playerId, "didn't reconnect in time and was removed from the game");
      this.notify?.();
    }, DISCONNECT_GRACE_MS);
  }

  cancelGracePeriod(playerId) {
    const player = this.playerById(playerId);
    if (!player) return;
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    player.connected = true;
    this.pushLog(`${player.name} reconnected.`);
  }

  // Used only pre-start: a lobby seat for a game that hasn't begun isn't worth holding.
  removePlayer(id) {
    this.players = this.players.filter((p) => p.id !== id);
    for (const tileId of Object.keys(this.ownership)) {
      if (this.ownership[tileId].ownerId === id) delete this.ownership[tileId];
    }
    if (this.hostId === id && this.players.length > 0) {
      this.hostId = this.players[0].id;
    }
  }

  // Used mid-game: disconnects, manual leaves, and turn-timeouts all forfeit the player's
  // seat (properties released to the bank) but keep them visible in the player list.
  kickPlayer(playerId, reasonLabel) {
    const player = this.playerById(playerId);
    if (!player || player.left || player.bankrupt) return;
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    const wasCurrent = this.started && this.currentPlayer()?.id === playerId;
    for (const tileId of player.properties) {
      delete this.ownership[tileId];
    }
    player.properties = [];
    player.left = true;
    if (this.pendingAction?.playerId === playerId) this.pendingAction = null;
    this.clearTradesInvolving(playerId);
    this.clearAuctionBidsFrom(playerId);
    this.clearAbilityEffectsFrom(playerId);
    this.pushLog(`${player.name} ${reasonLabel}.`);
    this.checkWinner();
    if (!this.winnerId && wasCurrent) {
      this.endTurn();
    }
    if (this.hostId === playerId) {
      const next = this.activePlayers()[0];
      if (next) this.hostId = next.id;
    }
  }

  activePlayers() {
    return this.players.filter((p) => !p.bankrupt && !p.left);
  }

  checkWinner() {
    if (this.winnerId || !this.started) return;
    const remaining = this.activePlayers();
    if (remaining.length <= 1) {
      this.clearTurnTimer();
      if (remaining.length === 1) {
        this.winnerId = remaining[0].id;
        this.pushLog(`${remaining[0].name} wins the game!`);
      } else {
        this.pushLog("No players remaining — game over.");
      }
    }
  }

  currentPlayer() {
    return this.players[this.turnIndex];
  }

  pushLog(msg) {
    this.log.unshift(msg);
    if (this.log.length > 50) this.log.pop();
  }

  // Color is picked in-room (pre-game) rather than before joining -- each
  // player owns their own choice, the host has no special say over it.
  setPlayerColor(playerId, color) {
    const player = this.playerById(playerId);
    if (!player) return { error: "Not in this room" };
    if (this.started) return { error: "Game already started" };
    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Invalid color" };
    const taken = this.players.some((p) => p.id !== playerId && !p.left && p.color === color);
    if (taken) return { error: "Color already taken" };
    player.color = color;
    return { ok: true };
  }

  // Icon is the on-board token image -- like color, each active player must
  // have a distinct one so tokens on the same tile are visually distinguishable.
  // Each icon has a fixed color (ICON_COLORS), so picking an icon also syncs
  // the player's token/owner-bar color to match it.
  setPlayerIcon(playerId, iconId) {
    const player = this.playerById(playerId);
    if (!player) return { error: "Not in this room" };
    if (this.started) return { error: "Game already started" };
    if (!ICON_IDS.includes(iconId)) return { error: "Invalid icon" };
    const taken = this.players.some((p) => p.id !== playerId && !p.left && p.icon === iconId);
    if (taken) return { error: "Icon already taken" };
    player.icon = iconId;
    player.color = ICON_COLORS[iconId];
    return { ok: true };
  }

  // Character is room-exclusive, same uniqueness scope as icon (see
  // characters/index.js and decisions.md) -- at most one player per room can
  // hold a given character.
  selectCharacter(playerId, characterId) {
    const player = this.playerById(playerId);
    if (!player) return { error: "Not in this room" };
    if (this.started) return { error: "Game already started" };
    if (!CHARACTER_IDS.includes(characterId)) return { error: "Invalid character" };
    const taken = this.players.some((p) => p.id !== playerId && !p.left && p.character === characterId);
    if (taken) return { error: "Character already taken" };
    player.character = characterId;
    return { ok: true };
  }

  // Player-facing "Start Game" action -- unlike start() below (also called
  // directly by the test suite, which never bothers picking icons), this
  // enforces the actual pre-game rules: only the host can start, only once
  // there are enough players, and only once every active player has picked
  // an icon (previously unenforced -- the host could start before everyone
  // had one, leaving latecomers stuck with no token image and, since icons
  // also assign the player's color, no distinct board color either). The
  // character requirement only applies in "characters" mode -- normal games
  // never touch characters at all.
  playerStartGame(playerId) {
    if (this.hostId !== playerId) return { error: "Only the host can start the game" };
    if (this.started) return { error: "Game already started" };
    const active = this.players.filter((p) => !p.left);
    if (active.length < 2) return { error: "Need at least 2 players to start" };
    if (active.some((p) => !p.icon)) return { error: "Every player must choose an icon before starting" };
    if (this.mode === "characters" && active.some((p) => !p.character)) {
      return { error: "Every player must choose a character before starting" };
    }
    this.start();
    return { ok: true };
  }

  start() {
    const startBalance = this.rules.startingCash ?? STARTING_BALANCE;
    for (const player of this.players) {
      player.balance = startBalance;
    }
    this.started = true;
    this.canRollAgain = true;
    this.consecutiveDoubles = 0;
    this.pushLog("Game started!");
    this.startTurnTimer();
  }

  startTurnTimer() {
    this.clearTurnTimer();
    const player = this.currentPlayer();
    if (!player) return;
    this.turnDeadline = Date.now() + TURN_TIME_LIMIT_MS;
    this.turnTimer = setTimeout(() => {
      this.handleTurnTimeout(player.id);
      this.notify?.();
    }, TURN_TIME_LIMIT_MS);
  }

  // Running out of time just skips the turn (via the same finishTurn path a
  // voluntary "End turn" click uses -- still forces bankruptcy if they're in
  // the red, same as ending on purpose). It does NOT forfeit their seat/
  // properties the way kickPlayer does -- that stays reserved for actual
  // disconnects (see startGracePeriod above and the server-restart path in
  // fromSnapshot). Pulled out of startTurnTimer's setTimeout body so
  // it can be exercised directly in tests without waiting out the real
  // multi-minute timer.
  handleTurnTimeout(playerId) {
    const player = this.playerById(playerId);
    if (!player) return;
    this.pushLog(`${player.name} ran out of time -- turn skipped.`);
    this.finishTurn(player);
  }

  clearTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turnDeadline = null;
  }

  clearAllAuctionTimers() {
    for (const auction of this.auctions) {
      if (auction.timer) clearTimeout(auction.timer);
    }
  }

  clearAllTradeTimers() {
    for (const trade of this.trades) {
      this.clearTradeTimer(trade);
    }
  }

  rollDice(playerId) {
    const player = this.currentPlayer();
    if (!player || player.id !== playerId || player.bankrupt || player.left) return { error: "Not your turn" };
    if (this.pendingAction) return { error: "Resolve the current action first" };
    if (!this.canRollAgain) return { error: "You already rolled this turn" };

    const wasInHolding = player.inHolding;
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    this.lastRoll = [d1, d2];
    this.rollSeq += 1;
    const rolledDoubles = d1 === d2;
    const total = d1 + d2;
    this.pushLog(`${player.name} rolled ${article(total)} ${total}.`);

    if (wasInHolding) {
      player.holdingTurns += 1;
      if (rolledDoubles) {
        player.inHolding = false;
        player.holdingTurns = 0;
        this.pushLog(`${player.name} rolled doubles and left the Holding Pen.`);
      } else if (player.holdingTurns >= MAX_HOLDING_TURNS) {
        player.balance -= HOLDING_RELEASE_RENT;
        player.inHolding = false;
        player.holdingTurns = 0;
        this.pushLog(`${player.name} paid ${HOLDING_RELEASE_RENT} to leave the Holding Pen.`);
      } else {
        this.pushLog(`${player.name} is stuck in the Holding Pen (${player.holdingTurns}/${MAX_HOLDING_TURNS}).`);
        this.canRollAgain = false;
        return { rolled: [d1, d2], stayedInHolding: true };
      }
    }

    // Doubles rolled to escape the Holding Pen don't count toward "three in a row" --
    // that rule is about free play, not the unrelated escape mechanic above.
    if (rolledDoubles && !wasInHolding) {
      this.consecutiveDoubles += 1;
    } else if (!rolledDoubles) {
      this.consecutiveDoubles = 0;
    }

    if (this.consecutiveDoubles >= 3) {
      this.pushLog(`${player.name} rolled doubles three times in a row and was sent straight to the Holding Pen!`);
      this.consecutiveDoubles = 0;
      this.canRollAgain = false;
      this.sendToHolding(player);
      return { rolled: [d1, d2], doubles: true, sentToHoldingForSpeeding: true };
    }

    const steps = d1 + d2;
    this.movePlayer(player, steps);

    // A card drawn during this move might be a movement card ("advance to X" /
    // "move N spaces") -- those don't resolve immediately, they wait on the player's
    // explicit confirmCardMove (see below). Stash the bonus-roll context on the
    // pendingAction itself so confirmCardMove can finish this calculation once the
    // deferred move actually happens, instead of deciding it prematurely here.
    if (this.pendingAction?.type === "awaitCardMove") {
      this.pendingAction.rolledDoubles = rolledDoubles;
      this.pendingAction.wasInHolding = wasInHolding;
      return { rolled: [d1, d2], doubles: rolledDoubles, awaitingCardMove: true };
    }

    // A bonus roll is earned only by rolling doubles in free play (not escaping the
    // Holding Pen, and not the third-in-a-row case already handled above) -- and not
    // if this same move just sent them to the Holding Pen (landing on the "go to
    // Holding" tile, or a card effect), re-checked here rather than trusting the
    // pre-move wasInHolding snapshot, since movePlayer can change it.
    this.canRollAgain = rolledDoubles && !wasInHolding && !player.inHolding;

    return { rolled: [d1, d2], doubles: rolledDoubles };
  }

  // Barricade (D's active, decisions.md) intercepts forward movement only: if
  // a wall is up and this move's path would carry the player past the
  // barricaded tile, they stop there instead -- however far the roll would
  // otherwise have gone. Returns the (possibly shortened) steps to actually
  // move; unchanged for backward movement or when no barricade is active.
  // It's a one-shot trap, not a wall that lasts the whole round: the FIRST
  // player it catches springs it, clearing this.barricade immediately so
  // nobody else is stopped by it later -- including the caster (D himself,
  // or SE Copy-Catting Barricade): he gets no immunity from his own wall and
  // can trap himself crossing it same as anyone else. User's call, reversing
  // an earlier fix that had exempted the caster. No separate staleness check
  // is needed here: endTurn already clears an unsprung barricade the instant
  // the caster's own next turn comes around, so a non-null this.barricade at
  // this point is always still genuinely active.
  applyBarricade(prev, steps) {
    if (!this.barricade || steps <= 0) return steps;
    let distance = this.barricade.tileId - prev;
    if (distance <= 0) distance += this._totalTiles;
    if (distance < steps) {
      this.barricade = null;
      return distance;
    }
    return steps;
  }

  movePlayer(player, steps) {
    const prev = player.position;
    const effectiveSteps = this.applyBarricade(prev, steps);
    let next = (prev + effectiveSteps) % this._totalTiles;
    if (next < 0) next += this._totalTiles;
    if (effectiveSteps > 0 && next < prev) {
      // Landing exactly on Start pays double the pass-through bonus -- a
      // distinct, rarer outcome (needing the exact roll) worth the extra
      // payout, same idea as Free Parking jackpots in other variants.
      if (next === 0) {
        this.settleEarning(player.id, () => { player.balance += 400; }, { isBankPayout: true });
        this.pushLog(`${player.name} landed on Start Plaza and collected 400 coins.`);
      } else {
        this.settleEarning(player.id, () => { player.balance += 200; }, { isBankPayout: true });
        this.pushLog(`${player.name} passed Start Plaza and collected 200 coins.`);
      }
    }
    player.position = next;
    if (effectiveSteps !== steps) {
      this.barricadeSeq += 1;
      this.lastBarricadeStop = { playerId: player.id, tileId: next, fromTileId: prev };
      this.pushLog(`${player.name} was stopped short by a barricade at ${this._board[next].name}.`);
    }
    this.resolveTile(player);
  }

  resolveTile(player) {
    const tile = this._board[player.position];
    switch (tile.type) {
      case TILE_TYPES.START:
        break;
      case TILE_TYPES.PROPERTY:
      case TILE_TYPES.TRANSIT:
      case TILE_TYPES.UTILITY: {
        const owned = this.ownership[tile.id];
        // Fires unconditionally, before the ownership/rent branching below --
        // H's landing counter (characters.md) counts every landing on his
        // turf regardless of ownership state, only the *cut* depends on rent
        // actually being owed (see onRentPaid below, which reads the count
        // this just updated).
        this.triggerPassive("onLanding", { playerId: player.id, tileId: tile.id });
        if (!owned) {
          this.pendingAction = { type: "awaitBuy", tileId: tile.id, playerId: player.id };
        } else if (owned.ownerId !== player.id) {
          if (owned.mortgaged) {
            this.pushLog(`${player.name} landed on ${tile.name}, but it's mortgaged — no rent owed.`);
          } else if (this.rules.noRentInPrison && this.playerById(owned.ownerId)?.inHolding) {
            this.pushLog(`${player.name} landed on ${tile.name}, but the owner is in prison — no rent owed.`);
          } else {
            const rent = this.calcRent(tile, owned);
            const ownerName = this.playerById(owned.ownerId).name;
            // Wrapped as one span so Curse (if the owner is cursed) checks the
            // owner's NET gain after any turf cut has already been deducted,
            // not the raw rent before it -- see settleEarning. Not a bank
            // payout -- rent is player-to-player, never doubled by SE.
            this.settleEarning(owned.ownerId, () => {
              this.transferMoney(player.id, owned.ownerId, rent);
              this.triggerPassive("onRentPaid", { payerId: player.id, ownerId: owned.ownerId, tileId: tile.id, rent });
            });
            this.pushLog(`${player.name} paid ${rent} rent to ${ownerName} for ${tile.name}.`);
          }
        }
        break;
      }
      case TILE_TYPES.TAX:
        player.balance -= tile.amount;
        if (this.rules.vacationPot) this.vacationPot += tile.amount;
        this.pushLog(`${player.name} paid ${tile.amount} coins toll at ${tile.name}.`);
        this.triggerPassive("onTaxPaid", { payerId: player.id, amount: tile.amount });
        break;
      case TILE_TYPES.SURPRISE:
        this.drawCard(player, "surprise");
        break;
      case TILE_TYPES.TREASURE:
        this.drawCard(player, "treasure");
        break;
      case TILE_TYPES.GO_TO_HOLDING:
        this.sendToHolding(player);
        break;
      case TILE_TYPES.REST:
        if (this.rules.vacationPot && this.vacationPot > 0) {
          const pot = this.vacationPot;
          this.settleEarning(player.id, () => { player.balance += pot; }, { isBankPayout: true });
          this.pushLog(`${player.name} landed on Vacation and collected the pot of ${pot} coins!`);
          this.vacationPot = 0;
        }
        if (COOLDOWN_REST_TILE_NAMES.has(tile.name) && player.character && player.abilityCooldown > 0) {
          const reduction = Math.min(player.abilityCooldown, 1 + Math.floor(Math.random() * 4));
          player.abilityCooldown -= reduction;
          this.pushLog(`${player.name}'s ability cooldown eased by ${reduction} turn(s) at ${tile.name}.`);
        }
        break;
      case TILE_TYPES.HOLDING:
      default:
        break;
    }
    // Deliberately no bankruptcy check here -- a negative balance is now tolerated
    // mid-turn so the player gets a real chance to mortgage/sell/trade their way back
    // to solvent before it's actually enforced, at the end of *their own* turn (see
    // finishTurn / playerEndTurn).
  }

  calcRent(tile, owned) {
    let rent;
    if (tile.type === TILE_TYPES.PROPERTY) {
      const houses = owned.houses || 0;
      const groupTiles = this._propertiesByGroup(tile.group);
      const ownsAll = groupTiles.every((t) => this.ownership[t.id]?.ownerId === owned.ownerId);
      rent = tile.rent[houses];
      if (houses === 0 && ownsAll && this.rules.doubleRentFullSet) rent *= 2;
    } else if (tile.type === TILE_TYPES.TRANSIT) {
      const owner = owned.ownerId;
      const count = this._board.filter((t) => t.type === TILE_TYPES.TRANSIT && this.ownership[t.id]?.ownerId === owner).length;
      rent = tile.rent[Math.min(count - 1, tile.rent.length - 1)];
    } else if (tile.type === TILE_TYPES.UTILITY) {
      const owner = owned.ownerId;
      const count = this._board.filter((t) => t.type === TILE_TYPES.UTILITY && this.ownership[t.id]?.ownerId === owner).length;
      const mult = tile.multiplier[Math.min(count - 1, tile.multiplier.length - 1)];
      const roll = (this.lastRoll?.[0] || 0) + (this.lastRoll?.[1] || 0);
      rent = mult * roll;
    } else {
      return 0;
    }
    return this.applyRentModifiers(tile, owned, rent);
  }

  // A second kind of ability hook, distinct from triggerPassive: this one
  // returns a (possibly modified) value instead of firing a side effect, for
  // abilities that change the rent itself rather than reacting after it's
  // paid (SD's station-toll doubling, characters.md).
  applyRentModifiers(tile, owned, rent) {
    for (const holder of this.activePlayers()) {
      if (!holder.character) continue;
      const modify = abilityFor(holder.character)?.modifyRent;
      if (modify) rent = modify(this, { tile, owned, rent, holder });
    }
    return rent;
  }

  drawCard(player, deckName) {
    const deckKey = deckName === "surprise" ? "surpriseDeck" : "treasureDeck";
    if (this[deckKey].length === 0) {
      this[deckKey] = shuffledDeck(deckName === "surprise" ? SURPRISE_CARDS : TREASURE_CARDS);
    }
    const card = this[deckKey].shift();
    // Same deck-name convention CardReveal.jsx uses for its own label: "الحظ"
    // is literally the Surprise tile's own name everywhere it appears on the
    // board (classic-vintage.js); "الصندوق" is the recurring word across the
    // three differently-flavored Treasure tile names, since none of them
    // share one exact name the way every Surprise tile does.
    const deckArabicName = deckName === "surprise" ? "الحظ" : "الصندوق";
    this.pushLog(`سحب ${player.name} كرت ${deckArabicName}: "${card.text}"`);
    this.applyCardEffect(player, card.effect);
    // effectType lets the client single out specific cards for a custom
    // reveal design (the Get Out of Jail Free card) without hardcoding a
    // card id, which the comment atop cards.js already treats as an
    // internal, load-bearing detail.
    this.lastCard = { deck: deckName, text: card.text, playerId: player.id, effectType: card.effect.type };
    this.cardSeq += 1;
  }

  applyCardEffect(player, effect) {
    switch (effect.type) {
      case "pay":
        player.balance -= effect.amount;
        if (this.rules.vacationPot) this.vacationPot += effect.amount;
        break;
      case "collect":
        this.settleEarning(player.id, () => { player.balance += effect.amount; }, { isBankPayout: true });
        break;
      case "payEachPlayer":
        for (const other of this.players) {
          if (other.id !== player.id && !other.bankrupt) {
            this.settleEarning(other.id, () => this.transferMoney(player.id, other.id, effect.amount));
          }
        }
        break;
      case "collectFromEachPlayer":
        for (const other of this.players) {
          if (other.id !== player.id && !other.bankrupt) {
            this.settleEarning(player.id, () => this.transferMoney(other.id, player.id, effect.amount));
          }
        }
        break;
      case "advanceTo":
      case "move":
        // Movement cards don't move the player in the same beat the card is drawn --
        // they wait on an explicit confirmCardMove (the player can't decline, but they
        // do get to see the card's text before the board changes under them).
        this.pendingAction = { type: "awaitCardMove", playerId: player.id, effect };
        break;
      case "goToHolding":
        this.sendToHolding(player);
        break;
      case "getOutFree":
        player.holdingFreeCard = true;
        break;
      case "repair": {
        let total = 0;
        for (const tileId of player.properties) {
          const houses = this.ownership[tileId]?.houses || 0;
          total += houses === 5 ? effect.hotel : houses * effect.house;
        }
        player.balance -= total;
        break;
      }
      default:
        break;
    }
  }

  // Holding a Get Out of Jail Free card doesn't exempt a player from being sent
  // here in the first place -- real rules only let them spend it *after*
  // they're already in (see useHoldingFreeCard, offered alongside Pay $50 on
  // their own next turn), same as landing on the tile or drawing the card.
  sendToHolding(player) {
    this.jailFromTileId = player.position;
    player.position = this._holdingTileId;
    player.inHolding = true;
    player.holdingTurns = 0;
    this.jailedPlayerId = player.id;
    this.jailSeq += 1;
    this.pushLog(`${player.name} was sent to the Holding Pen.`);
  }

  // Voluntary alternative to rolling for doubles -- a player stuck in the Holding
  // Pen can pay the fine on their own turn instead of waiting it out, freeing them
  // to roll and move normally for the rest of this same turn.
  payToLeaveHolding(playerId) {
    const player = this.currentPlayer();
    if (!player || player.id !== playerId) return { error: "Not your turn" };
    if (!player.inHolding) return { error: "You're not in the Holding Pen" };
    // Z's permanent drawback (characters.md/decisions.md) -- always in effect,
    // not tied to whether Curse has ever been cast: Z must always wait out the
    // full sentence.
    if (player.character === "Z") return { error: "The Enforcer can't buy their way out of the Holding Pen" };
    if (player.balance < HOLDING_RELEASE_RENT) return { error: "Not enough coins" };
    player.balance -= HOLDING_RELEASE_RENT;
    player.inHolding = false;
    player.holdingTurns = 0;
    this.pushLog(`${player.name} paid ${HOLDING_RELEASE_RENT} coins to leave the Holding Pen.`);
    return { ok: true };
  }

  // The card is a phone call to a connection, not a guaranteed release -- it
  // only actually gets the player out WASTA_SUCCESS_RATE of the time, and is
  // spent either way (consumed on both outcomes, not just success). A failed
  // attempt leaves the player still inHolding, still allowed to Roll Dice/Pay
  // $50 the same turn (see BoardClassic.jsx's action row, which only hides
  // this button once holdingFreeCard is gone) -- exactly as if they'd never
  // had the card in the first place.
  useHoldingFreeCard(playerId) {
    const player = this.currentPlayer();
    if (!player || player.id !== playerId) return { error: "Not your turn" };
    if (!player.inHolding) return { error: "You're not in the Holding Pen" };
    if (!player.holdingFreeCard) return { error: "You don't have a Get Out of Jail Free card" };
    player.holdingFreeCard = false;
    const success = Math.random() < WASTA_SUCCESS_RATE;
    if (success) {
      player.inHolding = false;
      player.holdingTurns = 0;
      this.pushLog(`${player.name} used a Get Out of Jail Free card to leave the Holding Pen.`);
    } else {
      this.pushLog(`${player.name} tried to use a Get Out of Jail Free card, but the call didn't go through.`);
    }
    this.lastWastaAttempt = { playerId, success };
    this.wastaSeq += 1;
    return { ok: true, success };
  }

  // Resolves a movement card ("advance to X" / "move N spaces") that's been sitting
  // in pendingAction since the card was drawn -- the player can't decline it, but
  // this gives them a beat to actually read the card before the board updates,
  // instead of the move completing invisibly in the same instant the card flips.
  confirmCardMove(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "awaitCardMove" || this.pendingAction.playerId !== playerId) {
      return { error: "No card move to confirm" };
    }
    const { effect, rolledDoubles, wasInHolding } = this.pendingAction;
    const player = this.playerById(playerId);
    this.pendingAction = null;
    if (effect.type === "advanceTo") {
      player.position = effect.tile;
      if (effect.collectStart) {
        this.settleEarning(player.id, () => { player.balance += 200; }, { isBankPayout: true });
      }
      this.resolveTile(player);
    } else {
      this.movePlayer(player, effect.steps);
    }
    // Only finish the deferred bonus-roll calculation if nothing else (a fresh
    // awaitBuy, or another awaitCardMove from a chained card) is now blocking the turn.
    if (!this.pendingAction) {
      this.canRollAgain = !!rolledDoubles && !wasInHolding && !player.inHolding;
    }
    return { ok: true };
  }

  buyProperty(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "awaitBuy" || this.pendingAction.playerId !== playerId) {
      return { error: "No property to buy" };
    }
    const player = this.playerById(playerId);
    const tile = this._board[this.pendingAction.tileId];
    if (player.balance < tile.price) return { error: "Not enough coins" };
    player.balance -= tile.price;
    player.properties.push(tile.id);
    this.ownership[tile.id] = { ownerId: playerId, houses: 0 };
    this.pushLog(`${player.name} bought ${tile.name} for ${tile.price} coins.`);
    this.pendingAction = null;
    return { ok: true };
  }

  // Dev/test helper only -- instantly hands a player every tile in a color
  // group for free (seizing them from whoever currently owns any, if
  // anyone), so a full-set scenario (houses, hotels, doubled rent) can be
  // set up in one click instead of playing through a real game. Never wired
  // to a production UI path -- the client only exposes it behind
  // import.meta.env.DEV.
  debugGrantGroup(playerId, group) {
    const player = this.playerById(playerId);
    if (!player) return { error: "Player not found" };
    const tiles = this._board.filter((t) => t.type === TILE_TYPES.PROPERTY && t.group === group);
    if (!tiles.length) return { error: "Unknown group" };
    for (const tile of tiles) {
      const prevOwnerId = this.ownership[tile.id]?.ownerId;
      if (prevOwnerId && prevOwnerId !== playerId) {
        const prevPlayer = this.playerById(prevOwnerId);
        if (prevPlayer) prevPlayer.properties = prevPlayer.properties.filter((id) => id !== tile.id);
      }
      if (!player.properties.includes(tile.id)) player.properties.push(tile.id);
      this.ownership[tile.id] = { ownerId: playerId, houses: 0 };
    }
    this.pushLog(`[DEV] ${player.name} was granted the full "${group}" group for testing.`);
    return { ok: true };
  }

  // Dev/test helper only -- draws a card straight from the named deck for a
  // player without requiring them to actually land on a Surprise/Treasure
  // tile, so the full card-reveal UI and deck content can be exercised
  // repeatedly without playing through a real game. Since drawCard() shifts
  // off the front of an already-shuffled deck (only reshuffled once empty),
  // clicking this repeatedly cycles every card in the deck exactly once
  // before repeating -- a deliberate way to review the whole deck, not
  // truly random. Refuses while another action is already pending so it
  // can't clobber real game state (e.g. an in-progress awaitBuy).
  //
  // Restricted to the current turn's player: a movement card (advanceTo/move,
  // ~6 of 28) doesn't resolve immediately -- it sets `pendingAction.playerId`
  // to whoever drew it and waits on their own confirmCardMove. The client's
  // "Continue" button is only ever rendered for whoever the game considers
  // the active turn-holder (see BoardClassic.jsx's action zone), since in
  // every *real* draw those are the same player by construction. DevTools is
  // mounted for every player regardless of turn, so without this check, an
  // off-turn player drawing a movement card here would leave pendingAction
  // permanently unresolvable by anyone -- neither the real current player
  // (wrong playerId, confirmCardMove silently rejects) nor the drawer
  // (isMyTurn false, no Continue button ever shows) can clear it.
  debugDrawCard(playerId, deckName) {
    const player = this.playerById(playerId);
    if (!player) return { error: "Player not found" };
    if (this.started && this.currentPlayer()?.id !== playerId) {
      return { error: "Only the current turn's player can use this" };
    }
    if (this.pendingAction) return { error: "Resolve the current action first" };
    if (deckName !== "surprise" && deckName !== "treasure") return { error: "Unknown deck" };
    this.drawCard(player, deckName);
    return { ok: true };
  }

  // Dev/test helper only -- grants the Get Out of Jail Free (Wasta) card
  // directly instead of cycling the whole Treasure deck waiting for it to
  // come up, so its reveal design and the My Properties/trade-chip badges
  // can be exercised on demand. Looks up the actual card object rather than
  // duplicating the getOutFree effect/lastCard wiring that drawCard already
  // does, so this stays in sync with the real card automatically.
  debugGrantJailCard(playerId) {
    const player = this.playerById(playerId);
    if (!player) return { error: "Player not found" };
    if (this.pendingAction) return { error: "Resolve the current action first" };
    const card = TREASURE_CARDS.find((c) => c.effect.type === "getOutFree");
    this.applyCardEffect(player, card.effect);
    this.pushLog(`[DEV] ${player.name} was granted a Get Out of Jail Free card for testing.`);
    this.lastCard = { deck: "treasure", text: card.text, playerId: player.id, effectType: card.effect.type };
    this.cardSeq += 1;
    return { ok: true };
  }

  declineBuy(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "awaitBuy" || this.pendingAction.playerId !== playerId) {
      return { error: "No property to decline" };
    }
    const tileId = this.pendingAction.tileId;
    this.pushLog(`${this.playerById(playerId).name} declined to buy ${this._board[tileId].name}.`);
    this.pendingAction = null;
    if (this.rules.auction) this.startAuction(tileId);
    return { ok: true };
  }

  // Opens bidding to every active player (including whoever just declined). Several
  // auctions can be open at once -- e.g. a turn-timeout kick can hand the turn to a new
  // player who immediately lands on a different unowned tile before the first auction
  // closes -- so each gets its own independent id rather than sharing one slot.
  startAuction(tileId) {
    const auction = {
      id: nanoid(),
      tileId,
      highestBid: 0,
      highestBidderId: null,
      passedIds: [],
      deadline: Date.now() + AUCTION_BASE_MS,
      timer: null,
      // Short-form bid/pass history scoped to just this auction -- separate from
      // the room-wide game log so the auction popup can show its own play-by-play.
      log: [],
    };
    this.auctions.push(auction);
    this.pendingAction = { type: "auction", tileId, auctionId: auction.id, playerId: this.currentPlayer()?.id };
    this.pushLog(`${this._board[tileId].name} is up for auction!`);
    this.scheduleAuctionTimer(auction.id);
  }

  // Without this, an auction with no clear unanimous-pass would sit open forever
  // (real players don't always explicitly pass once they've lost interest). Every
  // auction has a 10s base window from when it opens; each bid extends the deadline
  // to at least 3s after that bid, so a flurry of late bids can't cut each other
  // off mid-exchange, but bidding has to actually go quiet for the clock to run out.
  scheduleAuctionTimer(auctionId) {
    const auction = this.auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    if (auction.timer) clearTimeout(auction.timer);
    const delay = Math.max(0, auction.deadline - Date.now());
    auction.timer = setTimeout(() => {
      auction.timer = null;
      this.resolveAuction(auctionId);
      this.notify?.();
    }, delay);
  }

  placeBid(playerId, auctionId, amount) {
    const auction = this.auctions.find((a) => a.id === auctionId);
    if (!auction) return { error: "Auction not found" };
    const player = this.playerById(playerId);
    if (!player || player.bankrupt || player.left) return { error: "You can't bid right now" };
    if (auction.passedIds.includes(playerId)) return { error: "You already passed on this auction" };
    if (!Number.isInteger(amount) || amount <= auction.highestBid) {
      return { error: "Bid must be higher than the current highest bid" };
    }
    if (amount > player.balance) return { error: "Not enough coins" };
    auction.highestBid = amount;
    auction.highestBidderId = playerId;
    auction.deadline = Math.max(auction.deadline, Date.now() + AUCTION_EXTEND_MS);
    // Newest-first (unshift), same convention as the room-wide log's pushLog --
    // structured (not pre-formatted text) so the client can pair the player's
    // icon with their name instead of one replacing the other.
    auction.log.unshift({ playerId, amount });
    this.scheduleAuctionTimer(auction.id);
    this.pushLog(`${player.name} bid ${amount} coins on ${this._board[auction.tileId].name}.`);
    this.maybeResolveAuction(auction.id);
    return { ok: true };
  }

  passAuction(playerId, auctionId) {
    const auction = this.auctions.find((a) => a.id === auctionId);
    if (!auction) return { error: "Auction not found" };
    if (!auction.passedIds.includes(playerId)) {
      auction.passedIds.push(playerId);
      auction.log.unshift({ playerId, passed: true });
      this.pushLog(`${this.playerById(playerId)?.name ?? "A player"} passed on ${this._board[auction.tileId].name}.`);
      this.maybeResolveAuction(auction.id);
    }
    return { ok: true };
  }

  // Resolves once nobody's left to bid (no one bid at all -> stays unowned), or once
  // exactly one active bidder remains *and* they're the current high bidder -- if they
  // haven't bid yet, the auction waits for them to actually act (bid or pass) rather
  // than handing them the property without a chance to choose.
  maybeResolveAuction(auctionId) {
    const auction = this.auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    const remaining = this.activePlayers().filter((p) => !auction.passedIds.includes(p.id));
    if (remaining.length === 0 || (remaining.length === 1 && remaining[0].id === auction.highestBidderId)) {
      this.resolveAuction(auctionId);
    }
  }

  resolveAuction(auctionId) {
    const auction = this.auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    if (auction.timer) clearTimeout(auction.timer);
    this.auctions = this.auctions.filter((a) => a.id !== auctionId);
    const tile = this._board[auction.tileId];
    if (auction.highestBidderId) {
      const winner = this.playerById(auction.highestBidderId);
      winner.balance -= auction.highestBid;
      winner.properties.push(auction.tileId);
      this.ownership[auction.tileId] = { ownerId: auction.highestBidderId, houses: 0 };
      this.pushLog(`${winner.name} won the auction for ${tile.name} at ${auction.highestBid} coins.`);
      // No immediate bankruptcy check here either, same reasoning as resolveTile --
      // the winner's balance could in theory have dropped between bidding and this
      // auction resolving; if that pushes them negative, it's caught at their own
      // next turn-end, not here.
    } else {
      this.pushLog(`No bids for ${tile.name} -- it remains unowned.`);
    }
    if (this.pendingAction?.type === "auction" && this.pendingAction.auctionId === auctionId) {
      this.pendingAction = null;
    }
  }

  // A kicked/bankrupt player can't be left holding the high bid (or a live seat at the
  // table) on an auction that hasn't closed yet -- voids their bid and treats them as
  // having passed, then re-checks whether that auction can now resolve.
  clearAuctionBidsFrom(playerId) {
    for (const auction of this.auctions) {
      if (auction.highestBidderId === playerId) {
        auction.highestBidderId = null;
        auction.highestBid = 0;
        this.pushLog(`A voided bid reopened the auction for ${this._board[auction.tileId].name}.`);
      }
      if (!auction.passedIds.includes(playerId)) auction.passedIds.push(playerId);
      this.maybeResolveAuction(auction.id);
    }
  }

  buyHouse(playerId, tileId) {
    const tile = this._board[tileId];
    const owned = this.ownership[tileId];
    if (!owned || owned.ownerId !== playerId || tile.type !== TILE_TYPES.PROPERTY) {
      return { error: "You do not own this property" };
    }
    if (this.hostileTakeover?.tileId === tileId) return { error: "A seized tile can't be built on" };
    if (owned.mortgaged) return { error: "You can't build on a mortgaged property" };
    const groupTiles = this._propertiesByGroup(tile.group);
    const ownsAll = groupTiles.every((t) => this.ownership[t.id]?.ownerId === playerId);
    if (!ownsAll) return { error: "You must own the full color group" };
    if (owned.houses >= 5) return { error: "Already at max (hotel)" };
    if (this.rules.evenBuild) {
      const groupTiles = this._propertiesByGroup(tile.group);
      const minHouses = Math.min(...groupTiles.map((t) => this.ownership[t.id]?.houses || 0));
      if (owned.houses > minHouses) return { error: "Build evenly — upgrade another property in this group first" };
    }
    const player = this.playerById(playerId);
    if (player.balance < tile.housePrice) return { error: "Not enough coins" };
    player.balance -= tile.housePrice;
    owned.houses += 1;
    this.pushLog(`${player.name} built on ${tile.name} (level ${owned.houses}).`);
    return { ok: true };
  }

  sellHouse(playerId, tileId) {
    const tile = this._board[tileId];
    const owned = this.ownership[tileId];
    if (!owned || owned.ownerId !== playerId || tile.type !== TILE_TYPES.PROPERTY) {
      return { error: "You do not own this property" };
    }
    if (this.hostileTakeover?.tileId === tileId) return { error: "A seized tile can't be sold from" };
    if (!owned.houses) return { error: "There's nothing built here to sell" };
    if (this.rules.evenBuild) {
      const groupTiles = this._propertiesByGroup(tile.group);
      const maxHouses = Math.max(...groupTiles.map((t) => this.ownership[t.id]?.houses || 0));
      if (owned.houses < maxHouses) return { error: "Sell evenly — downgrade another property in this group first" };
    }
    const player = this.playerById(playerId);
    const refund = Math.floor(tile.housePrice / 2);
    owned.houses -= 1;
    this.settleEarning(playerId, () => { player.balance += refund; }, { isBankPayout: true });
    this.pushLog(`${player.name} sold a house on ${tile.name} for ${refund} coins (now level ${owned.houses}).`);
    this.triggerPassive("onDemolish", { player, tileId, levelsRemoved: 1 });
    return { ok: true };
  }

  mortgageProperty(playerId, tileId) {
    const tile = this._board[tileId];
    const owned = this.ownership[tileId];
    if (!owned || owned.ownerId !== playerId || !tile?.price) {
      return { error: "You do not own this property" };
    }
    if (this.hostileTakeover?.tileId === tileId) return { error: "A seized tile can't be mortgaged" };
    if (owned.mortgaged) return { error: "Already mortgaged" };
    if (owned.houses) return { error: "Sell all houses on this property first" };
    const player = this.playerById(playerId);
    const value = Math.floor(tile.price / 2);
    owned.mortgaged = true;
    this.settleEarning(playerId, () => { player.balance += value; }, { isBankPayout: true });
    this.pushLog(`${player.name} mortgaged ${tile.name} for ${value} coins.`);
    this.triggerPassive("onMortgage", { player, tileId });
    return { ok: true };
  }

  unmortgageProperty(playerId, tileId) {
    const tile = this._board[tileId];
    const owned = this.ownership[tileId];
    if (!owned || owned.ownerId !== playerId || !owned.mortgaged) {
      return { error: "This property isn't mortgaged" };
    }
    if (this.hostileTakeover?.tileId === tileId) return { error: "A seized tile can't be unmortgaged" };
    const player = this.playerById(playerId);
    const cost = this.unmortgageCost(tileId);
    if (player.balance < cost) return { error: "Not enough coins" };
    player.balance -= cost;
    owned.mortgaged = false;
    this.pushLog(`${player.name} paid off the mortgage on ${tile.name} for ${cost} coins.`);
    return { ok: true };
  }

  unmortgageCost(tileId) {
    const tile = this._board[tileId];
    const value = Math.floor(tile.price / 2);
    return value + Math.ceil(value * MORTGAGE_INTEREST_RATE);
  }

  transferMoney(fromId, toId, amount) {
    const from = this.playerById(fromId);
    const to = this.playerById(toId);
    from.balance -= amount;
    to.balance += amount;
  }

  // Bank-mediated cut pattern (decisions.md): pays `holder` their cut straight
  // from the bank, then -- only if `fromPlayerId` is given -- deducts that same
  // amount from whoever would otherwise have earned it in full. Used for every
  // percentage-cut passive (D's turf/tax cut, Z's trade/tax cut, H's turf cut).
  // Tax and trade cuts have no single player "earner" to deduct from, so they
  // just omit fromPlayerId and the bank absorbs it, same as it always has.
  // The holder's own credit is curse-aware (self-contained -- nothing later
  // claws back from the holder over this specific credit, unlike the
  // fromPlayerId deduction, which is a raw expense and never cursed).
  bankMediatedCut(holderId, amount, fromPlayerId = null) {
    if (amount <= 0) return;
    this.settleEarning(holderId, () => {
      this.playerById(holderId).balance += amount;
    }, { isBankPayout: true });
    if (fromPlayerId) {
      this.playerById(fromPlayerId).balance -= amount;
    }
  }

  // Settles an earning event for recipientId: run `fn` (which may credit them
  // and then have some other modifier -- a turf cut, etc. -- partially claw it
  // back, all within the same span), then compare their balance before/after
  // across that WHOLE span. Two modifiers can apply to that final net gain, in
  // this order (decisions.md: Curse is explicitly the LAST step):
  //   1. SE's bank-payout doubling (abilities/fixer.js) -- only when
  //      isBankPayout is true, since it's scoped to genuine bank payouts
  //      (Start bonus, card collects, sell/mortgage refunds, ability cuts),
  //      never player-to-player money (rent, trade, payEachPlayer).
  //   2. Curse's redirect (abilities/enforcer.js) -- if recipientId is
  //      currently cursed, the fully-computed net gain (post-doubling) is
  //      reversed and handed to the curse's caster instead.
  // This must wrap the entire event, not each individual credit inside it, or
  // a later clawback would incorrectly apply to a balance already moved away.
  settleEarning(recipientId, fn, { isBankPayout = false } = {}) {
    const recipient = this.playerById(recipientId);
    const before = recipient.balance;
    fn();
    let netGain = recipient.balance - before;
    if (isBankPayout && netGain > 0) {
      const doubled = this.applyBankPayoutDoubling(recipientId, netGain);
      if (doubled !== netGain) {
        recipient.balance += doubled - netGain;
        netGain = doubled;
      }
    }
    // At most one active curse can ever target a given recipient -- Curse's
    // own active() (abilities/enforcer.js) rejects cursing someone already
    // cursed by a different caster, so this find() never has more than one
    // match to choose between. No staleness check needed: endTurn already
    // prunes an entry the instant its own caster's next turn comes around, so
    // anything still in activeCurses here is genuinely still active.
    const curse = this.activeCurses.find((c) => c.targetId === recipientId);
    if (netGain > 0 && curse) {
      recipient.balance -= netGain;
      this.playerById(curse.casterId).balance += netGain;
    }
  }

  // Barricade/Curse/Hostile Takeover now expire "until the caster's own next
  // turn" (endTurn) rather than a global round boundary -- but a bankrupt or
  // departed player's seat is skipped forever after, so turnIndex can never
  // land back on them to trigger that normal expiry. Called from
  // checkBankruptcy/kickPlayer as a safety net so these don't linger forever.
  clearAbilityEffectsFrom(playerId) {
    if (this.barricade?.casterId === playerId) this.barricade = null;
    this.activeCurses = this.activeCurses.filter((c) => c.casterId !== playerId);
    if (this.hostileTakeover?.casterId === playerId) this.revertHostileTakeover();
  }

  // A third ability-hook kind (alongside triggerPassive and applyRentModifiers):
  // returns a (possibly modified) bank-payout amount. Only SE uses this today.
  applyBankPayoutDoubling(recipientId, amount) {
    const recipient = this.playerById(recipientId);
    if (!recipient.character) return amount;
    const modify = abilityFor(recipient.character)?.modifyBankPayout;
    return modify ? modify(this, { holder: recipient, amount }) : amount;
  }

  // Reverts H's Hostile Takeover (abilities/kingpin.js) once the caster's own
  // next turn comes around (or immediately, if the caster goes bankrupt/leaves
  // first -- see clearAbilityEffectsFrom) -- restores whatever ownership
  // record the tile had before (or unowned, if it had none), including each
  // side's properties list.
  revertHostileTakeover() {
    const { tileId, previousOwnership } = this.hostileTakeover;
    const current = this.ownership[tileId];
    if (current) {
      const currentOwner = this.playerById(current.ownerId);
      if (currentOwner) currentOwner.properties = currentOwner.properties.filter((id) => id !== tileId);
    }
    if (previousOwnership) {
      this.ownership[tileId] = previousOwnership;
      const prevOwner = this.playerById(previousOwnership.ownerId);
      if (prevOwner && !prevOwner.properties.includes(tileId)) prevOwner.properties.push(tileId);
    } else {
      delete this.ownership[tileId];
    }
    this.hostileTakeover = null;
  }

  // Generic passive-ability dispatch -- calls every active player's ability
  // module's handler for `hookName`, if it has one, keeping Room.js itself
  // agnostic of what any specific character's passive actually does (see
  // abilities/index.js for the module shape). `payload` is whatever context
  // that hook needs (e.g. { tile, owner, payer, rent } for a rent payment).
  triggerPassive(hookName, payload) {
    for (const holder of this.activePlayers()) {
      if (!holder.character) continue;
      const handler = abilityFor(holder.character)?.passives?.[hookName];
      if (handler) handler(this, { ...payload, holder });
    }
  }

  // Generic active-ability dispatch -- every character's active goes through
  // this same path (Barricade, Curse, Detonate, Hostile Takeover, Wrecking
  // Tour, Copy Cat), so cooldown gating/arming is handled once instead of once
  // per character. The ability module's own active() does its own targeting/
  // validation and returns { error } to reject, or { ok: true, ...extra } on
  // success -- `extra` is passed to a variable activeCooldown function so e.g.
  // Detonate/Copy Cat's cooldown can depend on what the active actually did.
  // Turn-gated: only usable on the caster's own turn (user's call, reversing
  // the earlier "abilities aren't turn-gated" decision -- decisions.md).
  // Conductor.js's own pendingAction guard for Wrecking Tour stays regardless
  // -- even on your own turn, an unresolved decision from earlier this same
  // turn (e.g. your own still-open buy prompt) shouldn't be clobbered.
  useAbility(playerId, params) {
    const player = this.playerById(playerId);
    if (!player || player.bankrupt || player.left) return { error: "You can't use an ability right now" };
    if (!this.started) return { error: "Game hasn't started" };
    if (this.currentPlayer()?.id !== playerId) return { error: "Not your turn" };
    if (!player.character) return { error: "No character selected" };
    const ability = abilityFor(player.character);
    if (!ability) return { error: "Unknown character" };
    if (player.abilityCooldown > 0) {
      return { error: `On cooldown for ${player.abilityCooldown} more of your turns` };
    }
    const result = ability.active(this, player, params);
    if (result?.error) return result;
    player.abilityCooldown = typeof ability.activeCooldown === "function"
      ? ability.activeCooldown(result)
      : ability.activeCooldown;
    return { ok: true, ...result };
  }

  // A property can only be traded while it's undeveloped and unmortgaged -- avoids
  // juggling house counts or mortgage transfer across a swap (real rules also
  // require selling houses, and often paying off the mortgage, before trading).
  isTradeable(tileId, ownerId) {
    const owned = this.ownership[tileId];
    const tile = this._board[tileId];
    if (!owned || owned.ownerId !== ownerId || !tile) return false;
    if (tile.type !== TILE_TYPES.PROPERTY && tile.type !== TILE_TYPES.TRANSIT && tile.type !== TILE_TYPES.UTILITY) return false;
    return !owned.houses && !owned.mortgaged;
  }

  // Shared validation for any new trade, whether it's a fresh proposal or a
  // counter-offer replacing one. Returns { trade } on success, { error } otherwise --
  // never mutates this.trades itself, so callers decide what to do with the result.
  buildTrade(fromId, {
    toId, offerProperties = [], offerMoney = 0, offerJailCard = false,
    requestProperties = [], requestMoney = 0, requestJailCard = false, timeLimitSec = null,
  }) {
    const fromPlayer = this.playerById(fromId);
    const toPlayer = this.playerById(toId);
    if (!fromPlayer || fromPlayer.bankrupt || fromPlayer.left) return { error: "You can't trade right now" };
    if (!toPlayer || toPlayer.bankrupt || toPlayer.left || toId === fromId) return { error: "Invalid trade partner" };
    if (!Number.isInteger(offerMoney) || offerMoney < 0 || !Number.isInteger(requestMoney) || requestMoney < 0) {
      return { error: "Coin amounts must be non-negative whole numbers" };
    }
    if (offerProperties.length === 0 && requestProperties.length === 0 &&
      offerMoney === 0 && requestMoney === 0 && !offerJailCard && !requestJailCard) {
      return { error: "A trade needs to include at least one property, card, or coins" };
    }
    if (!offerProperties.every((id) => this.isTradeable(id, fromId))) {
      return { error: "You can only offer undeveloped properties you own" };
    }
    if (!requestProperties.every((id) => this.isTradeable(id, toId))) {
      return { error: "You can only request undeveloped properties they own" };
    }
    if (offerJailCard && !fromPlayer.holdingFreeCard) {
      return { error: "You don't have a Get Out of Jail Free card to offer" };
    }
    if (requestJailCard && !toPlayer.holdingFreeCard) {
      return { error: "They don't have a Get Out of Jail Free card" };
    }
    if (timeLimitSec != null && (!Number.isInteger(timeLimitSec) ||
      timeLimitSec < MIN_TRADE_TIME_LIMIT_SEC || timeLimitSec > MAX_TRADE_TIME_LIMIT_SEC)) {
      return { error: "Invalid time limit" };
    }
    return {
      trade: {
        id: nanoid(), fromId, toId, offerProperties, offerMoney, offerJailCard,
        requestProperties, requestMoney, requestJailCard,
        deadline: timeLimitSec ? Date.now() + timeLimitSec * 1000 : null,
        timer: null,
      },
    };
  }

  // Cancels a trade's own expiry timer (if it has one) without touching this.trades --
  // callers still decide when/whether to actually remove the trade from the array.
  clearTradeTimer(trade) {
    if (trade?.timer) {
      clearTimeout(trade.timer);
      trade.timer = null;
    }
  }

  // Time-limited trades ("30 seconds to accept or it's gone") auto-expire and drop
  // off the table on their own -- mirrors scheduleAuctionTimer/resolveAuction's
  // split between "arm a timer for this deadline" and "what happens when it fires".
  scheduleTradeTimer(tradeId) {
    const trade = this.trades.find((t) => t.id === tradeId);
    if (!trade || !trade.deadline) return;
    if (trade.timer) clearTimeout(trade.timer);
    const delay = Math.max(0, trade.deadline - Date.now());
    trade.timer = setTimeout(() => {
      trade.timer = null;
      this.expireTrade(tradeId);
      this.notify?.();
    }, delay);
  }

  expireTrade(tradeId) {
    const trade = this.trades.find((t) => t.id === tradeId);
    if (!trade) return;
    this.trades = this.trades.filter((t) => t.id !== tradeId);
    this.pushLog(`${this.playerById(trade.fromId)?.name ?? "A player"}'s trade offer to ${this.playerById(trade.toId)?.name ?? "a player"} expired.`);
  }

  proposeTrade(fromId, params) {
    const result = this.buildTrade(fromId, params);
    if (result.error) return result;
    this.trades.push(result.trade);
    this.scheduleTradeTimer(result.trade.id);
    this.pushLog(`${this.playerById(fromId).name} proposed a trade with ${this.playerById(result.trade.toId).name}.`);
    return { ok: true, tradeId: result.trade.id };
  }

  // The recipient of a trade can counter instead of just accepting/declining --
  // this replaces the original offer with a new one in the opposite direction
  // (counterer becomes fromId, original proposer becomes toId), going through the
  // exact same validation a fresh proposal would.
  counterTrade(playerId, tradeId, params) {
    const original = this.trades.find((t) => t.id === tradeId && t.toId === playerId);
    if (!original) return { error: "Trade not found" };
    const result = this.buildTrade(playerId, { ...params, toId: original.fromId });
    if (result.error) return result;
    this.clearTradeTimer(original);
    this.trades = this.trades.filter((t) => t.id !== tradeId);
    result.trade.counterOf = tradeId;
    this.trades.push(result.trade);
    this.scheduleTradeTimer(result.trade.id);
    this.pushLog(`${this.playerById(playerId).name} countered ${this.playerById(original.fromId).name}'s trade offer.`);
    return { ok: true, tradeId: result.trade.id };
  }

  respondTrade(playerId, tradeId, accept) {
    const trade = this.trades.find((t) => t.id === tradeId && t.toId === playerId);
    if (!trade) return { error: "Trade not found" };
    this.clearTradeTimer(trade);
    this.trades = this.trades.filter((t) => t.id !== tradeId);

    const fromPlayer = this.playerById(trade.fromId);
    const toPlayer = this.playerById(trade.toId);

    if (!accept) {
      this.pushLog(`${toPlayer.name} declined ${fromPlayer.name}'s trade offer.`);
      return { ok: true };
    }

    // Re-validate everything: ownership, development, and funds may have all
    // changed in the time between the offer being made and being accepted.
    if (!fromPlayer || fromPlayer.bankrupt || fromPlayer.left || !toPlayer || toPlayer.bankrupt || toPlayer.left) {
      return { error: "One of the players is no longer in the game" };
    }
    if (!trade.offerProperties.every((id) => this.isTradeable(id, trade.fromId))) {
      return { error: "The offer is no longer valid" };
    }
    if (!trade.requestProperties.every((id) => this.isTradeable(id, trade.toId))) {
      return { error: "The request is no longer valid" };
    }
    if (trade.offerJailCard && !fromPlayer.holdingFreeCard) {
      return { error: "The offer is no longer valid" };
    }
    if (trade.requestJailCard && !toPlayer.holdingFreeCard) {
      return { error: "The request is no longer valid" };
    }
    // Only actually giving money away requires affording it -- offering/requesting
    // $0 must never fail this check just because the player's current balance
    // happens to be negative (a trade is one of the few ways an indebted player can
    // legitimately recover, by *receiving* money, so a $0 offer must be exempt).
    if ((trade.offerMoney > 0 && fromPlayer.balance < trade.offerMoney) ||
      (trade.requestMoney > 0 && toPlayer.balance < trade.requestMoney)) {
      return { error: "One of the players can no longer afford this trade" };
    }

    for (const tileId of trade.offerProperties) {
      this.ownership[tileId].ownerId = trade.toId;
      fromPlayer.properties = fromPlayer.properties.filter((id) => id !== tileId);
      toPlayer.properties.push(tileId);
    }
    for (const tileId of trade.requestProperties) {
      this.ownership[tileId].ownerId = trade.fromId;
      toPlayer.properties = toPlayer.properties.filter((id) => id !== tileId);
      fromPlayer.properties.push(tileId);
    }
    if (trade.offerMoney > 0) {
      this.settleEarning(trade.toId, () => this.transferMoney(trade.fromId, trade.toId, trade.offerMoney));
    }
    if (trade.requestMoney > 0) {
      this.settleEarning(trade.fromId, () => this.transferMoney(trade.toId, trade.fromId, trade.requestMoney));
    }
    if (trade.offerJailCard) {
      fromPlayer.holdingFreeCard = false;
      toPlayer.holdingFreeCard = true;
    }
    if (trade.requestJailCard) {
      toPlayer.holdingFreeCard = false;
      fromPlayer.holdingFreeCard = true;
    }

    this.pushLog(`${fromPlayer.name} and ${toPlayer.name} completed a trade.`);
    // Z's trade cut (characters.md): cash on both sides plus the listed board
    // price of every property changing hands, not just the coins involved.
    const propertyValue = [...trade.offerProperties, ...trade.requestProperties]
      .reduce((sum, tileId) => sum + (this._board[tileId]?.price || 0), 0);
    const totalTradeValue = trade.offerMoney + trade.requestMoney + propertyValue;
    this.triggerPassive("onTradeCompleted", { fromId: trade.fromId, toId: trade.toId, totalTradeValue });
    // No bankruptcy check here -- the funds check just above already guarantees
    // neither side goes negative from this trade itself.
    this.pruneStaleTrades();
    return { ok: true };
  }

  // Whether a trade's offer/request still holds up against current game state --
  // ownership, development/mortgage status, held jail card, and affordable coins
  // can all have changed since the trade was proposed. Used by pruneStaleTrades
  // to proactively drop other open trades a just-completed one invalidated;
  // respondTrade's own accept path re-checks this same ground itself field by
  // field instead of calling this, so it can report which side broke specifically.
  tradeIsValid(trade) {
    const fromPlayer = this.playerById(trade.fromId);
    const toPlayer = this.playerById(trade.toId);
    if (!fromPlayer || fromPlayer.bankrupt || fromPlayer.left) return false;
    if (!toPlayer || toPlayer.bankrupt || toPlayer.left) return false;
    if (!trade.offerProperties.every((id) => this.isTradeable(id, trade.fromId))) return false;
    if (!trade.requestProperties.every((id) => this.isTradeable(id, trade.toId))) return false;
    if (trade.offerJailCard && !fromPlayer.holdingFreeCard) return false;
    if (trade.requestJailCard && !toPlayer.holdingFreeCard) return false;
    if (trade.offerMoney > 0 && fromPlayer.balance < trade.offerMoney) return false;
    if (trade.requestMoney > 0 && toPlayer.balance < trade.requestMoney) return false;
    return true;
  }

  // A completed trade can silently strand *other* open trades -- e.g. player A
  // has pending offers to both B and C involving the same property, or offering
  // the same Get Out of Jail Free card, or more coins than they'll have left;
  // once the trade with B goes through, the one with C references a property/
  // card/coin amount A can no longer deliver. Without this, that stale trade
  // just sits in the list until C tries (and fails) to accept it -- this closes
  // it immediately instead, the same way clearTradesInvolving does for a
  // player leaving/going bankrupt, just scoped to individual resources rather
  // than an entire player.
  pruneStaleTrades() {
    const stale = this.trades.filter((t) => !this.tradeIsValid(t));
    if (stale.length === 0) return;
    for (const trade of stale) {
      this.clearTradeTimer(trade);
      this.pushLog(`${this.playerById(trade.fromId)?.name ?? "A player"}'s trade offer to ${this.playerById(trade.toId)?.name ?? "a player"} is no longer valid and was cancelled.`);
    }
    const staleIds = new Set(stale.map((t) => t.id));
    this.trades = this.trades.filter((t) => !staleIds.has(t.id));
  }

  cancelTrade(playerId, tradeId) {
    const trade = this.trades.find((t) => t.id === tradeId && t.fromId === playerId);
    if (!trade) return { error: "Trade not found" };
    this.clearTradeTimer(trade);
    this.trades = this.trades.filter((t) => t.id !== tradeId);
    this.pushLog(`${this.playerById(playerId).name} cancelled their trade offer.`);
    return { ok: true };
  }

  // Trades referencing a player who's no longer active would otherwise dangle forever.
  clearTradesInvolving(playerId) {
    for (const trade of this.trades) {
      if (trade.fromId === playerId || trade.toId === playerId) this.clearTradeTimer(trade);
    }
    this.trades = this.trades.filter((t) => t.fromId !== playerId && t.toId !== playerId);
  }

  // Bankruptcy is no longer triggered automatically the instant a balance dips
  // below zero -- a negative balance is now tolerated for as long as it takes to
  // mortgage, sell houses, or trade your way back to solvent (none of those are
  // turn-gated, so that's possible even before your own turn comes back around).
  // This method still does the actual forfeiture *when called*; what changed is
  // when it's called -- see finishTurn, the only remaining call site.
  checkBankruptcy(player) {
    if (player.balance < 0 && !player.bankrupt) {
      player.bankrupt = true;
      for (const tileId of player.properties) {
        delete this.ownership[tileId];
      }
      player.properties = [];
      this.clearTradesInvolving(player.id);
      this.clearAuctionBidsFrom(player.id);
      this.clearAbilityEffectsFrom(player.id);
      this.pushLog(`${player.name} went bankrupt!`);
      this.checkWinner();
    }
  }

  // Ends the current player's turn via the player-facing playerEndTurn action.
  // Finalizes their bankruptcy first if they're still in the red, then advances
  // to the next player. (kickPlayer has its own similar but distinct path since
  // it calls endTurn() directly and skips the bankruptcy check -- a kicked
  // player is already handled separately.)
  finishTurn(player) {
    if (player.balance < 0) this.checkBankruptcy(player);
    if (!this.winnerId) this.endTurn();
  }

  // The player-facing "End turn" action -- unlike the internal endTurn() below
  // (also called by kickPlayer, neither of which should require a prior roll),
  // this enforces that rolling is mandatory: you can't just pass through your
  // turn without ever rolling the dice.
  playerEndTurn(playerId) {
    const player = this.currentPlayer();
    if (!player || player.id !== playerId) return { error: "Not your turn" };
    if (this.pendingAction) return { error: "Resolve the current action first" };
    if (!this.lastRoll) return { error: "Roll the dice before ending your turn" };
    this.finishTurn(player);
    return { ok: true };
  }

  endTurn() {
    this.clearTurnTimer();
    this.pendingAction = null;
    if (this.activePlayers().length <= 1) return;
    // Ability cooldowns count down in the holder's own turns only (decisions.md)
    // -- tick the ending player's here, before turnIndex moves off them.
    const endingPlayer = this.currentPlayer();
    if (endingPlayer?.abilityCooldown > 0) endingPlayer.abilityCooldown -= 1;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      // A "round" is one full lap of the seat array, regardless of which seats
      // are actually active (decisions.md) -- crossing back to seat 0 always
      // marks a new one, even mid-loop while skipping bankrupt/left seats.
      if (this.turnIndex === 0) this.round += 1;
    } while (this.players[this.turnIndex].bankrupt || this.players[this.turnIndex].left);
    // Barricade/Curse/Hostile Takeover all last "until the caster's own next
    // turn comes around" rather than until the next global round boundary --
    // decisions.md. A global-round boundary made these effects unfairly short
    // for whoever cast them from the last seat in turn order (their own turn
    // ending is what crosses back to seat 0, expiring the effect before anyone
    // else even got a chance to be affected by it) while giving an almost-full
    // lap to an early-seat caster. Checking against the player whose turn is
    // starting now gives every caster the same fair duration regardless of
    // seat position: one full lap, no matter when in the cycle they cast it.
    const newCurrentId = this.players[this.turnIndex].id;
    if (this.barricade && this.barricade.casterId === newCurrentId) this.barricade = null;
    this.activeCurses = this.activeCurses.filter((c) => c.casterId !== newCurrentId);
    if (this.hostileTakeover && this.hostileTakeover.casterId === newCurrentId) this.revertHostileTakeover();
    this.lastRoll = null;
    this.lastCard = null;
    this.canRollAgain = true;
    this.consecutiveDoubles = 0;
    this.startTurnTimer();
  }

  playerById(id) {
    return this.players.find((p) => p.id === id);
  }

  // Dev-only: teleports every active player onto one randomly chosen tile so
  // the same-tile token-stacking UI can be checked without playing a real
  // game up to the point where players naturally collide.
  debugStackOnRandomTile() {
    const active = this.activePlayers();
    if (active.length < 2) return { error: "Need at least 2 active players to test stacking" };
    const tileId = Math.floor(Math.random() * this._totalTiles);
    active.forEach((p) => { p.position = tileId; });
    const tile = this._board[tileId];
    this.pushLog(`[debug] Stacked every player on ${tile.name} (#${tileId}).`);
    return { ok: true, tileId };
  }

  toState() {
    return {
      code: this.code,
      hostId: this.hostId,
      mode: this.mode,
      started: this.started,
      turnIndex: this.turnIndex,
      round: this.round,
      players: this.players.map(({ token, graceTimer, ...pub }) => pub),
      ownership: this.ownership,
      log: this.log.slice(0, 20),
      lastRoll: this.lastRoll,
      lastCard: this.lastCard,
      pendingAction: this.pendingAction,
      winnerId: this.winnerId,
      turnDeadline: this.turnDeadline,
      trades: this.trades.map(({ timer, ...pub }) => pub),
      auctions: this.auctions.map(({ timer, ...pub }) => pub),
      canRollAgain: this.canRollAgain,
      board: this._board,
      // Character identity roster (id/name/portrait), same "expose the static
      // reference data once" role as board -- lets the client show a display
      // name for player.character without duplicating the roster itself.
      characters: CHARACTERS,
      abilities: ABILITY_DISPLAY_INFO,
      rollSeq: this.rollSeq,
      cardSeq: this.cardSeq,
      jailSeq: this.jailSeq,
      jailedPlayerId: this.jailedPlayerId,
      jailFromTileId: this.jailFromTileId,
      wastaSeq: this.wastaSeq,
      lastWastaAttempt: this.lastWastaAttempt,
      rules: this.rules,
      vacationPot: this.vacationPot,
      barricade: this.barricade,
      barricadeSeq: this.barricadeSeq,
      lastBarricadeStop: this.lastBarricadeStop,
      activeCurses: this.activeCurses,
      hostileTakeover: this.hostileTakeover,
      wreckingTourSeq: this.wreckingTourSeq,
      lastWreckingTour: this.lastWreckingTour,
    };
  }

  // Full private save-to-disk dump -- unlike toState(), this keeps each player's
  // token (needed so a rejoinRoom after a restart can still prove identity) and
  // drops only what genuinely can't survive a restart: live setTimeout handles.
  toSnapshot() {
    return {
      code: this.code,
      hostId: this.hostId,
      mode: this.mode,
      started: this.started,
      turnIndex: this.turnIndex,
      round: this.round,
      players: this.players.map(({ graceTimer, ...rest }) => rest),
      ownership: this.ownership,
      surpriseDeck: this.surpriseDeck,
      treasureDeck: this.treasureDeck,
      log: this.log,
      lastRoll: this.lastRoll,
      lastCard: this.lastCard,
      pendingAction: this.pendingAction,
      winnerId: this.winnerId,
      trades: this.trades.map(({ timer, ...rest }) => rest),
      auctions: this.auctions.map(({ timer, ...rest }) => rest),
      canRollAgain: this.canRollAgain,
      consecutiveDoubles: this.consecutiveDoubles,
      rollSeq: this.rollSeq,
      cardSeq: this.cardSeq,
      jailSeq: this.jailSeq,
      jailedPlayerId: this.jailedPlayerId,
      jailFromTileId: this.jailFromTileId,
      wastaSeq: this.wastaSeq,
      lastWastaAttempt: this.lastWastaAttempt,
      rules: this.rules,
      vacationPot: this.vacationPot,
      barricade: this.barricade,
      barricadeSeq: this.barricadeSeq,
      lastBarricadeStop: this.lastBarricadeStop,
      activeCurses: this.activeCurses,
      hostileTakeover: this.hostileTakeover,
      wreckingTourSeq: this.wreckingTourSeq,
      lastWreckingTour: this.lastWreckingTour,
    };
  }

  // Rebuilds a Room from a toSnapshot() dump (e.g. after a server restart). Two
  // things can't simply be restored as-is, since they depended on timer handles
  // that no longer exist:
  //  - Anyone mid-disconnect-grace when the snapshot was taken gets a fresh
  //    full DISCONNECT_GRACE_MS window rather than being kicked outright --
  //    same "fresh full duration, not the exact remainder" simplification as
  //    the turn timer and auction timer just below, applied here too instead
  //    of penalizing a player for a restart that had nothing to do with them
  //    (they might have been about to reconnect right as it happened).
  //  - The current player's turn timer is re-armed for a fresh full duration
  //    rather than trying to preserve exactly how much time was left.
  static fromSnapshot(snapshot) {
    const room = new Room(snapshot.code, snapshot.hostId, snapshot.mode || "normal");
    if (snapshot.rules) room.rules = { ...DEFAULT_RULES, ...snapshot.rules };
    if (snapshot.vacationPot !== undefined) room.vacationPot = snapshot.vacationPot;
    room.started = snapshot.started;
    room.turnIndex = snapshot.turnIndex;
    room.round = snapshot.round || 0;
    room.players = snapshot.players.map((p) => ({ ...p, graceTimer: null }));
    room.ownership = snapshot.ownership;
    room.surpriseDeck = snapshot.surpriseDeck;
    room.treasureDeck = snapshot.treasureDeck;
    room.log = snapshot.log;
    room.lastRoll = snapshot.lastRoll;
    room.lastCard = snapshot.lastCard;
    room.pendingAction = snapshot.pendingAction;
    room.winnerId = snapshot.winnerId;
    room.trades = snapshot.trades || [];
    // Same simplification as the turn timer below: old timer handles are gone, so
    // each restored auction gets a fresh full base window rather than trying to
    // preserve exactly how much time was left.
    room.auctions = (snapshot.auctions || []).map((a) => ({ ...a, timer: null, deadline: Date.now() + AUCTION_BASE_MS, log: a.log || [] }));
    room.canRollAgain = snapshot.canRollAgain ?? true;
    room.consecutiveDoubles = snapshot.consecutiveDoubles || 0;
    room.rollSeq = snapshot.rollSeq || 0;
    room.cardSeq = snapshot.cardSeq || 0;
    room.jailSeq = snapshot.jailSeq || 0;
    room.jailedPlayerId = snapshot.jailedPlayerId || null;
    room.jailFromTileId = snapshot.jailFromTileId ?? null;
    room.wastaSeq = snapshot.wastaSeq || 0;
    room.lastWastaAttempt = snapshot.lastWastaAttempt || null;
    room.barricade = snapshot.barricade || null;
    room.barricadeSeq = snapshot.barricadeSeq || 0;
    room.lastBarricadeStop = snapshot.lastBarricadeStop || null;
    room.activeCurses = snapshot.activeCurses || [];
    room.hostileTakeover = snapshot.hostileTakeover || null;
    room.wreckingTourSeq = snapshot.wreckingTourSeq || 0;
    room.lastWreckingTour = snapshot.lastWreckingTour || null;

    for (const player of room.players) {
      if (!player.connected && !player.left && !player.bankrupt) {
        room.startGracePeriod(player.id);
      }
    }
    if (room.started && !room.winnerId) {
      room.startTurnTimer();
    }
    for (const auction of room.auctions) {
      room.scheduleAuctionTimer(auction.id);
    }
    // Unlike auctions, a trade's deadline is preserved as-is (not reset to a fresh
    // window) -- if it's already past, scheduleTradeTimer's delay just clamps to 0
    // and it expires on the next tick instead of silently living on forever.
    for (const trade of room.trades) {
      room.scheduleTradeTimer(trade.id);
    }
    return room;
  }
}

export function generateRoomCode() {
  return nanoid(6).toUpperCase();
}
