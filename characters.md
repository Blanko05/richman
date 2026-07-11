# Playable Characters — Design Spec

**Status: server-side logic implemented and unit-tested** (see
`server/src/game/characters/`, `server/src/game/abilities/`, and the
`server/test/*.test.js` files for each character). This is the source of
truth for what each character is supposed to do — update it in place if a
number or rule changes, the same way [systemDesign.md](systemDesign.md)
tracks the current architecture. Every design/implementation decision along
the way, including a few judgment calls worth reviewing, is in
[decisions.md](decisions.md).

**Not yet done: client-side integration** — character-selection UI, ability-
use UI, cooldown/effect indicators (barricade wall, curse, hostile takeover),
and the socket events wiring `Room.selectCharacter`/`Room.useAbility` to the
client. Planned as a separate next step.

Theme: crime-boss / heist archetypes. Real portraits are decided separately.
`selectCharacter` is room-exclusive, mirroring `setPlayerIcon`'s uniqueness
pattern (see `decisions.md`) — implemented in `Room.js` already, just not
yet exposed over a socket event or given a lobby UI.

---

## D — The Don

**Passive, always on, no cost or limit.**

- Holds a **30% stake** in his turf zone — the `salmonRight` color group:
  tile 13 (اغوار الشمال), tile 14 (نهر الميراندا), tile 16 (اغوار الجنوب).
  Any rent collected on those three tiles pays D 30% of the amount, taken
  via the bank-mediated cut pattern (see below) — the payer owes the same
  rent as always, and the owner's earnings are the ones reduced.
- Takes **50% of every tax payment** any other player makes, anywhere on the
  board, not just inside his turf. Bank-mediated — never an extra charge on
  the taxed player.

**Active — Barricade, rechargeable, 10-turn cooldown.**

- Places a wall on any one tile of his choice.
- A one-shot trap, not a lasting wall: the FIRST player whose movement would
  otherwise carry them past that tile is stopped there instead, and resolves
  that tile's normal action (rent, tax, card draw, etc.) as if they'd landed
  on it exactly — even if their roll would have taken them further. The
  wall then deactivates immediately, springing only once per placement —
  everyone after that (including that same player again) passes through
  freely. If nobody crosses it, it expires unused once D's own next turn
  comes around (not a global round boundary — see "Round scoping" below).
- The caster is NOT immune to their own barricade — D's movement (or SE's, if
  copied via Copy Cat) can spring and get trapped by it, same as any other
  player.
- The barricade itself doesn't charge a toll; whatever the player owes is
  just whatever that tile would normally charge.

---

## Z — The Enforcer

**Passive, always on, no cost or limit. Purely reactive — earns nothing if
the table doesn't trade or get taxed.**

- Takes **5% of the total value of every completed trade** — cash on both
  sides plus the listed board `price` of any properties changing hands, not
  just the coins involved.
- Takes **5% of every tax payment** any player makes.
- Both percentages are bank-mediated, same as D's tax cut — never an extra
  charge on the player actually paying. (A trade or a tax payment has no
  single "earner" to deduct from, so unlike D's/H's turf cuts, the bank
  simply absorbs Z's share.)

**Active — Curse, rechargeable, 7-turn cooldown.**

- Targets any player. Until Z's own next turn comes around (not a global
  round boundary — see "Round scoping" below), **100% of whatever that
  player would earn** goes to Z instead — the cursed player gets nothing at
  all from any source for the duration.
- The redirect is the last step in resolving any payout: compute the amount
  the cursed player would have received as usual (after any other
  modifier already in play — e.g. SE's bank-payout doubling if the cursed
  player is SE, or a turf cut if the earnings came from a D/H zone), then
  send that final amount to Z instead. Only *incoming* earnings redirect —
  the cursed player's own expenses (rent owed, tax owed, etc.) are paid
  normally, uncursed.
- Drawback: Z cannot pay to leave the holding tile early — must always wait
  out the full sentence.

---

## Y — The Wrecker

**Passive, always on, no cost or limit.**

- Whenever any player demolishes a house/hotel level or mortgages a property,
  Y collects a flat **$50 from the bank**.
- Selling raw, undeveloped land does not trigger this.

**Active — Detonate, rechargeable, cooldown scales with damage done.**

- Destroys a building on a targeted property in a single action.
- If the target already has nothing built on it, there's nothing to destroy
  — Detonate **force-mortgages it instead**, for free (no payout to the
  owner, unlike a voluntary mortgage — this is punitive). If it's already
  mortgaged too, Detonate is rejected outright: there's truly nothing left
  to do to that property.
- Recharge formula, by what was destroyed:
  - Empty lot, force-mortgaged (no levels removed): 4 turns
  - One house level: 5 turns
  - Two house levels: 6 turns
  - Three house levels: 7 turns
  - Four house levels: 8 turns
  - Hotel (full level 5): 10 turns

---

## H — The Kingpin

**Passive, always on, no cost or limit.**

- Claims a turf zone spanning the `salmonLeft` and `tealLeft` groups: tile
  37 (بابل), 38 (اربيل), 39 (كربلاء), 41 (بغداد), 44 (الطفيلة), 45 (السلط),
  47 (اربد). Does not overlap with D's zone (tiles 13/14/16).
- Tracks landings on that zone across all players. Every **third landing**
  (a deterministic counter, not a random chance) triggers a **90% cut**,
  bank-mediated same as D's turf cut — the payer pays normal rent, and the
  property owner's earnings are the ones reduced by 90%.

**Active — Hostile Takeover, rechargeable, 6-turn static cooldown.**

- Takes control of any one tile until H's own next turn comes around (not a
  global round boundary — see "Round scoping" below), then it reverts.

~~Flank Seizure~~ — cut from the design. H now has a single active ability.

---

## SD — The Conductor

**Passive (station toll), always on, no cost or limit.**

- If SD owns the station a player lands on, that player pays **double** the
  normal rent.
- If SD doesn't own it, the landing player pays a flat **$50 to SD**
  regardless of who the actual owner is, in addition to whatever they owe
  that owner.

**Active — Wrecking Tour, rechargeable, 8-turn cooldown.**

- Sends a bus around the board loop starting from SD's current position,
  demolishing **2 building levels** on every property tile it passes through
  (where applicable), continuing until it reaches tile 6 (the Coster
  Station). Skips any property SD owns himself — the sweep still passes
  over his own tiles, it just doesn't tear them down.
- Can't be activated while the caster is in the Holding Pen (no bus to send
  out while jailed) — this also blocks SE from Copy Cat-ing Wrecking Tour
  while SE himself is jailed, even if the real SD is free.
- Ignores barricades entirely — the tour computes its own path and jumps
  straight to tile 6 rather than moving tile-by-tile through `movePlayer`
  (the only place barricade interception happens), so a barricade anywhere
  on the route neither stops the bus nor gets sprung/consumed by it.
  Confirmed, not a bug — user's call.

---

## SE — The Fixer

**Passive, always on, no cost or limit.**

- Collects **$400** instead of the normal $200 for passing Start.
- Collects **$800** for landing exactly on Start.
- Any payout from the bank (cards, etc.) is **doubled**.

**Active — Copy Cat, rechargeable, cooldown depends on what's copied.**

- **Copies**, not steals: targets another player's active ability and uses
  an independent instance of it once, on the spot. The target's own copy
  of that ability — its cooldown, availability, everything — is completely
  unaffected. This also means SE can copy an ability that's currently on
  cooldown for its original owner; the two are tracked separately.
- Recharge formula: **5 turns + half of the copied ability's own static
  cooldown, rounded down** (e.g. a 7-turn cooldown copies for 5 + 3 = 8).

---

## Architecture requirements

- **Character identity (name, portrait/image) must be decoupled from
  ability logic.** Swapping a character's art or display name should never
  touch ability code, and vice versa — a character is a data record that
  *references* an ability implementation, not a class that contains one.
- **Each ability is its own module**, iterable independently (numbers,
  cooldowns, and edge-case behavior can change without touching other
  abilities or the character roster).
- **Every active ability is turn-gated** — usable only on the caster's own
  turn, never off-turn.

## Board-tile cooldown ease

Landing on either **"عليكم الأمان"** (tiles 17, 46) or **"استراحة محارب"**
(tile 24) eases the landing player's own active-ability cooldown by a random
**1–4 turns** (clamped at 0), if they have a character with a cooldown
currently ticking. A third REST-type tile (اجازة/Vacation) is unaffected —
this is scoped by tile name, not by tile type.

## Bank-mediated cut pattern

The standard mechanism for every percentage-cut ability in this spec: the
bank pays the ability holder their cut immediately, and — only where the
underlying payment has an actual player recipient — that same amount is
then deducted from whoever would otherwise have earned it in full. The
player who initiated the payment (rent payer, taxpayer) is never charged
extra; only the intended recipient's take is reduced, and only if there is
one.

- **D's turf rent cut (30%)** and **H's turf landing cut (90%)** — deducted
  from the property owner's earnings. Payer pays the same rent as always.
- **D's tax cut (50%)** and **Z's tax cut (5%)** — a tax payment has no
  player recipient (it goes to the bank), so nothing is deducted from any
  player; the bank simply absorbs the cut.
- **Z's trade cut (5%)** — same reasoning as tax: no single player "earns"
  a trade, so the bank absorbs it.

Multiple cuts on the same event stack independently and don't interact —
e.g. a tax payment with both D and Z active pays out 50% + 5% = 55% from
the bank, on top of the taxpayer's unchanged tax bill.

## Round scoping

Barricade, Curse, and Hostile Takeover are all "for the round" effects, but
"round" here means **until the casting player's own next turn comes
around** — not a global table-wide round boundary. Each caster gets exactly
one full lap of opportunity (or exposure) regardless of their seat position.

Scoping it to a global round counter instead was tried first and found
unfair: that counter increments whenever the turn pointer wraps back to seat
0, which happens to be triggered by whichever player is LAST in turn order
ending their own turn. That made the last-seated player's own Barricade/
Curse/Hostile Takeover expire the instant their own turn ended — before
anyone else even got a chance to be caught by it — while a first-seated
caster effectively got an almost-full lap. Caster-relative scoping fixes
this: every caster's effect lasts the same one full lap no matter when in
turn order they cast it.

## Resolved

- **Tax stacking**: D's 50% and Z's 5% both apply to the same tax payment
  when both are in play, each independently bank-mediated. The taxed player
  pays the normal tax amount, unaffected either way.
- **Bank-mediated cut pattern** established as the standard mechanism for
  every percentage-cut ability — see above.
- **Copy Cat copies, it doesn't steal** — the target's own ability and
  cooldown are untouched; SE uses an independent instance, unaffected by
  the target's cooldown state.
- **Curse's redirect is the final step** in resolving a payout — it applies
  to the fully-computed amount (after any other modifier, e.g. SE's
  doubling or a turf cut), and only to incoming earnings, never expenses.
- **Characters are room-exclusive** — same uniqueness scope as icon
  selection (`setPlayerIcon` in `Room.js`): a character can only be held by
  one active, non-left player per room, enforced pre-start the same way
  color/icon are (`selectCharacter` follows that exact pattern). This also
  settles Copy Cat-on-SE for free — since at most one SE can ever exist in
  a room, "copying another SE's Copy Cat" can't happen.

- Recharge/cooldown state **survives a server restart** — unlike the turn
  and auction timers (which reset to full duration per `systemDesign.md`
  §6), ability cooldowns must persist across restarts.
- Flank Seizure (H's second active) is cut. H has one active ability.
- SE's Copy Cat recharge rounds **down** on odd copied cooldowns.
- D's turf zone is the `salmonRight` group: tiles 13, 14, 16.
- H's turf zone is the `salmonLeft` + `tealLeft` groups: tiles 37, 38, 39,
  41, 44, 45, 47. No overlap with D's zone.
- **No self-targeting**, across every ability that takes a player or
  property target: Z cannot Curse himself, Y cannot Detonate his own
  building, H cannot Hostile-Takeover a tile he already controls, SE
  cannot Copy Cat himself. (D's Barricade targets a tile, not a player or
  property he owns, so this restriction doesn't apply to it.)
