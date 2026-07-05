# Character System — Decision Log

Every decision made while designing and implementing the 6-character system
(`characters.md`), in the order they came up. "Asked" means Claude raised a
genuine ambiguity and the user picked; everything else was the user's call
directly, sometimes with Claude proposing a specific formalization of it.

---

## Design (characters.md)

- **D's turf zone** = tiles 13, 14, 16 (`salmonRight` group: اغوار الشمال,
  نهر الميراندا, اغوار الجنوب). User-provided.
- **H's turf zone** = tiles 37, 38, 39, 41, 44, 45, 47 (`salmonLeft` +
  `tealLeft` groups, بابل through اربد). User-provided. Does not overlap
  with D's zone.
- **H's Flank Seizure is cut.** H has a single active (Hostile Takeover).
  User's call.
- **Copy Cat (formerly "Heist") copies, it doesn't steal.** The target's
  own ability instance and cooldown are completely untouched; SE's copy is
  independent, unaffected by whether the target's own version is on
  cooldown. User's call. Renamed Heist → Copy Cat per user request.
- **Copy Cat's recharge rounds down**: 5 turns + half the copied ability's
  static cooldown, rounded down (e.g. 7 → 5+3=8). User's call.
- **Ability cooldowns survive a server restart** (unlike the turn/auction
  timers, which reset to full duration). This rides on the existing
  `persistence.js` / `Room.fromSnapshot` mechanism already in the codebase
  — not new infrastructure. User's call.
- **No self-targeting**, for every ability with a player/property target:
  Z can't Curse himself, Y can't Detonate his own building, H can't
  Hostile-Takeover his own tile, SE can't Copy Cat himself. (D's Barricade
  targets a tile, not a player/property, so this doesn't apply to it.)
  User's call.
- **Bank-mediated cut pattern** (general mechanism, formalized by Claude
  from the user's instruction): the bank pays the ability holder their cut
  immediately; that same amount is then deducted from whoever would
  otherwise have earned it in full, if there is such a recipient. The
  payer of the underlying transaction is never charged extra.
  - D's turf rent cut (30%) and H's turf landing cut (90%): deducted from
    the property owner's earnings.
  - D's tax cut (50%), Z's tax cut (5%), Z's trade cut (5%): no single
    player recipient exists for tax/trade value, so the bank just absorbs
    these — no deduction from any player.
- **Tax stacking**: D's 50% and Z's 5% both apply to the same tax payment
  when both are in play, independently bank-mediated. The taxed player's
  bill is unaffected either way. User's call ("yes").
- **Curse's redirect is the final step** in resolving any payout to the
  cursed player — computed after every other modifier (SE's bank-payout
  doubling, a D/H turf cut, etc.), then the fully-computed amount goes to
  Z instead. Only incoming earnings redirect; the cursed player's own
  expenses (rent owed, tax owed) are paid normally. User's call.
- **Characters are room-exclusive** — same uniqueness scope as icon
  selection (`setPlayerIcon`): at most one player per room can hold a
  given character, enforced pre-start the same way color/icon collisions
  are. User's call. This also resolves Copy Cat-on-SE for free: since at
  most one SE can exist in a room, "copying another SE's Copy Cat" is
  structurally impossible.
- **Character selection gates game start**, mirroring how icon selection
  already gates `playerStartGame` (every active player must have picked
  one). Implied by "same icon logic," not separately re-confirmed.

## Architecture

- **Character identity (name/portrait) is decoupled from ability logic.**
  A character is a data record that *references* an ability
  implementation, not a class containing one. User's requirement.
- **Each ability is its own module**, independently iterable without
  touching the character roster or other abilities. User's requirement.

## Implementation-time decisions (asked and answered)

- **Detonate is a full wipe**, not one-level-at-a-time: a single use always
  reduces the target property to an empty lot (houses = 0), regardless of
  what was built. The cooldown tiers in characters.md (4-9 turns) describe
  how much was destroyed by that one wipe, not a per-level cost. Asked;
  user picked this over "one level per use."
- **Barricade only intercepts forward movement** (dice rolls, forward
  movement cards). The two backward-movement cards (s6: -3, s12: -2) ignore
  any active barricade entirely. Asked; user picked this over "both
  directions," to avoid reverse-direction wrap-around math for two rare
  cards, matching the spec's plain "carry them past" framing.
- **Percentage-cut rounding defaults to floor** (Math.floor) for D's/H's/
  Z's cuts (30%, 50%, 90%, 5%), matching the existing floor-biased
  convention already used elsewhere in Room.js for money splits (house-sale
  refunds, mortgage value). Claude's call, not separately asked -- flagged
  here since it wasn't explicitly specified in characters.md itself (unlike
  SE's Copy Cat cooldown, which was explicitly asked and answered
  separately).
- **Barricade needs its own client-animation signal**, same role as
  jailSeq/jailFromTileId for Holding Pen teleports: `barricadeSeq` and
  `lastBarricadeStop` ({playerId, tileId, fromTileId}) are exposed on Room
  state so the client can animate "stopped short of the roll" instead of
  walking the full distance. Server-side plumbing is done; actual client
  animation code is a separate follow-up once all 6 characters are built.
- **Z's "can't pay to leave Holding Pen" is a permanent character trait**,
  not a temporary cost tied to casting/cooling down Curse. Always in effect
  whenever Z himself is in the Holding Pen. Asked; user picked this over
  "only while Curse is active/on cooldown."
- **Curse's "any source" is implemented literally and broadly**: every
  balance increase in Room.js now routes through `settleEarning`,
  including ones that might read as "liquidating your own asset" rather
  than "earning" -- house-sale refunds, mortgage payouts, not just
  rent/tax/trade/cards/Start bonus. Claude's call, following the user's
  explicit "regardless of where that money comes from" instruction
  literally rather than narrowing it; flagged here in case a narrower scope
  was actually intended.
- **Curse redirect is implemented as an outer wrap spanning the WHOLE
  earning event** (`Room.settleEarning`), not a check at each individual
  balance increment. This was necessary, not just a style choice: cuts like
  D's turf cut claw back part of what was just credited to the owner, so
  redirecting at the moment of the *initial* credit (before the clawback
  runs) would let the clawback then incorrectly subtract from a balance
  that was never actually retained. The wrap measures the recipient's net
  balance change across the entire event (credit + any subsequent
  claw-backs) and only then, once, checks whether they're cursed. Verified
  directly by a test asserting D's cut and Z's curse compose correctly on
  the same rent payment. Claude's design call, following from the user's
  "final step" requirement.
- **H's landing counter increments on every landing on his turf tiles,
  regardless of ownership state** (unowned, self-owned, mortgaged, owner-
  in-holding all still count toward the next multiple of 3) -- the 90% cut
  only actually fires if that specific landing happens to owe rent. A 3rd
  landing with nothing to cut still consumes the count and resets it toward
  the next 3. Claude's call (not explicitly asked), flagged here since
  characters.md doesn't spell this edge case out -- a narrower reading
  ("only rent-producing landings count") is a one-line change in
  `abilities/kingpin.js`'s `onLanding` handler if this isn't what was
  intended.
- **Hostile Takeover preserves whatever's on the tile** (houses, mortgage
  status) -- only `ownerId` temporarily flips to H, then reverts exactly at
  round end. Can target any ownable tile not already his, owned or unowned;
  reverts to the previous owner or back to unowned accordingly. Claude's
  call, reading "takes control of" as an ownership-only transfer rather
  than also resetting development.
- **SD's flat $50 toll applies on ANY station landing SD doesn't own**,
  including a completely unowned station (no rent owed to anyone, just the
  toll) -- not only stations owned by another player. Claude's call,
  reading "regardless of who the actual owner is" as "any station not
  his," rather than restricting it to only the owned-by-someone-else case.
- **Rent modification needed a new hook kind** (`modifyRent`, via
  `Room.applyRentModifiers`, baked directly into `calcRent`) distinct from
  `triggerPassive` -- SD's doubling has to change the rent number itself
  before it's paid, not react after the fact like every other passive so
  far. Baking it into `calcRent` means every caller (including tests
  calling `calcRent` directly for ground truth) sees the real final rent.
- **Wrecking Tour's path**: starts at the tile immediately after SD's
  current position (not SD's own tile), travels forward wrapping the board
  loop as needed, and stops at/including tile 6. If SD happens to already
  be sitting on tile 6, this means a near-full lap (47 tiles) back to it,
  rather than a zero-length no-op. Claude's call -- not separately asked,
  flagged here as this exact edge case isn't spelled out in characters.md.
  Demolished levels clamp at min(2, currently built) per property, and
  each demolish still fires Y's onDemolish passive.
- **SE's Start bonuses aren't special-cased** -- they're the general "any
  bank payout is doubled" rule applying to the existing 200/400 Start
  bonus, nothing more. "Bank payout" was scoped concretely to: Start bonus,
  card `collect` effects, sellHouse/mortgageProperty refunds, and other
  characters' bank-mediated ability cuts. Explicitly NOT doubled: rent,
  trade money, and payEachPlayer/collectFromEachPlayer card effects (all
  player-to-player, never bank-sourced). Claude's call, narrowing the
  earlier-flagged ambiguity now that a concrete mechanism (`isBankPayout`
  flag on `Room.settleEarning`) had to be decided one way or the other.
- **`Room.withCurseRedirect` was renamed to `settleEarning`** and extended
  to run SE's doubling before Curse's redirect, in that order, inside the
  same wrapped span -- both needed to compose against the same "final net
  gain" the wrapper already computed for Curse alone. Verified by a test
  where a cursed SE's doubled card payout goes to Z as the doubled amount,
  not the raw one.
- **Copy Cat's copy runs as SE himself** (game-state context: SE's own
  board position, ownership, targeting), not the original character's --
  e.g. copying Wrecking Tour sweeps from SE's position, not the real SD's.
  This follows directly from "as if SE owned it" in characters.md.
- **Resolved: multiple simultaneous curses are now supported.**
  `room.activeCurse` (single slot) became `room.activeCurses` (a list) --
  Z's real Curse and a Copy-Cat-copied Curse can coexist, each an
  independent { targetId, casterId, roundPlaced } entry. User's call,
  choosing this over blocking Copy Cat from targeting Curse specifically.
  - **Redirects are terminal, one-hop transfers** -- a curse only ever
    checks its own targetId against the earning event's recipient, and the
    payout to that curse's casterId is a raw balance transfer, never
    itself re-run through `settleEarning`. This is what actually prevents
    a mutual curse (A curses B, B curses A back) from ping-ponging: each
    earning event only cares about its own recipient's curse entry, so
    there's no chain to loop. Verified by a dedicated test.
  - **Resolved further: two different casters can never curse the same
    victim.** Curse's active() now explicitly rejects casting on a target
    already cursed by a different caster ("X is already cursed by someone
    else") -- user's call, ruling out the "shouldn't be allowed to happen"
    case rather than leaving it to an arbitrary tiebreak. Only multiple
    curses on DIFFERENT targets (from different casters) can coexist.
    `settleEarning`'s lookup is now guaranteed at most one match.
  - Same-caster double-casting is structurally impossible already (Curse's
    own cooldown always outlasts a curse's round-scoped duration), but
    `enforcer.js`'s active() defensively drops any stale entry from the
    same caster before pushing a new one anyway.

- **Cooldown unit = the ability holder's own turns**, not global turns
  across all players. A "10-turn cooldown" ticks down once each time the
  holder's own turn ends; length doesn't shrink as more players join.
  Asked; user picked this over "global turns."
- **"Round" = one full table cycle.** Tracked as a new `room.round` counter
  on `Room`, incremented every time the turn pointer completes a lap of
  the seat array (crosses back to seat index 0), independent of how many
  seats are currently active/bankrupt/left. An effect lasting "the rest of
  the round" (Curse, Barricade) is active until this counter next
  increments. Asked; user picked this over "just until my own next turn."

## Implementation order

Scaffolding first (character/ability module split, cooldown/round state,
`selectCharacter`), then **Y → D → Z → H → SD → SE**, one at a time with
unit tests before moving on. SE is deliberately last since Copy Cat depends
on every other character's active already existing to copy from. Claude's
proposal, accepted by the user.

## Board tiles

- **"عليكم الأمان" tiles (17, 46) ease the landing player's ability
  cooldown by a random 1-2 turns**, clamped at 0 (no-op if they have no
  character or their cooldown is already 0). User's call.
- **Scoped by tile name, not tile type** -- tile 24 ("استراحة محارب") is
  also `TILE_TYPES.REST` but a deliberately distinct flavor; it keeps only
  the existing vacation-pot payout, unaffected by this new mechanic. Asked;
  user picked this over applying it to all 3 REST tiles uniformly. Matched
  via a new `COOLDOWN_REST_TILE_NAME` constant in `Room.js` compared
  against `tile.name`, the first tile-name-keyed (rather than
  tile-type-keyed) branch in the codebase.
- Stacks with the vacation-pot payout on the same landing (both fire
  independently; landing on 17/46 with pot > 0 does both).

## Sandbox / client wiring

- **Wrecking Tour ends the tour AT the destination tile (6)** -- SD's actual
  `player.position` updates there and `resolveTile` runs normally (rent if
  someone else owns it, or the usual unowned-station buy prompt), the same
  shape as a card's `advanceTo` effect. User's call, overriding the earlier
  assumption that SD would return to where he started. Since abilities
  aren't turn-gated, `active()` now refuses to run at all while ANY
  `pendingAction` is already open (not just SD's own) -- otherwise this new
  `resolveTile` call could clobber another player's in-progress decision
  (e.g. their own unresolved buy prompt). Claude's call, a direct consequence
  of the position-ending decision, not separately asked.
  - Because `player.position` now genuinely changes, the **existing generic
    move-detection effect in BoardClassic.jsx animates the glide
    automatically** -- no custom token-glide code needed at all. The
    Wrecking Tour broadcast (`room.wreckingTourSeq` +
    `room.lastWreckingTour`: {casterId, startTileId, path, demolished},
    added because the ability's result otherwise only reaches the caster's
    own ack, never the room) is used for exactly one remaining thing: timing
    `playSellBuilding()` (the existing sell-house/hotel sound) once per
    demolished tile, estimated proportionally along the same leg math the
    generic move effect computes for this same start/destination -- legs can
    span several tiles at once, so it's an estimate, not a tile-by-tile stop,
    but tracks the real glide closely since both use identical inputs.
  - Known limitation, not fixed: a demolished tile's house count on the
    board updates the instant state re-renders (same render as everything
    else), not delayed until the token visually arrives there -- so an
    attentive player can see the building already gone slightly before the
    bus reaches it. Fixing that would need per-tile "pending reveal" state
    to mask the count briefly; out of scope for this pass.
- **Copy Cat's two-step targeting**: its `targetType` is `"copyFrom"`, a
  distinct value from Curse's plain `"player"`, so the client can tell them
  apart. Step 1 (a player-row click) picks who to copy; the client looks up
  that player's character's ability `targetType` from `state.abilities` --
  `"none"` (Wrecking Tour) submits immediately, otherwise targeting mode
  transitions to THAT targetType with `copyFromId` stashed, so the second
  tile/player click submits `{ copyFromId, params: {tileId|targetId} }`.
  No server changes were needed for this -- `Room.useAbility`/`fixer.js`
  already accepted exactly this shape.

- **Barricade is a one-shot trap, not a lasting wall.** It only stops the
  FIRST player whose forward movement crosses it, then deactivates
  immediately (`Room.applyBarricade` clears `this.barricade` the instant it
  intercepts someone) -- everyone else that round, including the same
  player again later, passes through freely. Previously it stopped every
  qualifying move for the rest of the round. User's call, overriding the
  original characters.md wording ("any player... is stopped there instead,"
  read as unlimited); characters.md's Barricade section and don.js's
  description were updated to match.

## Process

- Implement one character at a time; append unit tests verifying both
  abilities before moving to the next.
- Ask when unsure rather than guessing — every such question and answer
  gets logged here.
- Report back once all 6 are done, for integration/cross-ability testing.
