# Ability Animations & Sound — Plan

Living planning doc for making the 6 characters' active abilities feel
"cool" to trigger — animation + sound feedback, not gameplay logic. Started
because most actives currently have **zero client-side representation**:
the effect happens server-side, a log line gets pushed, and that's it.

If you implement something from here, move it from **Planned** to **Done**
in the status table below and say what actually shipped (matches
[progress.md](progress.md)'s pass-log convention — add a real pass entry
there too for anything non-trivial).

---

## Status

| Character | Ability | Status |
|---|---|---|
| SD — Conductor | Wrecking Tour | **Partially done** — see below |
| D — Don | Barricade | Not started — no visual at all currently |
| Z — Enforcer | Curse | Not started — no visual at all currently |
| Y — Wrecker | Detonate | Not started |
| H — Kingpin | Hostile Takeover | Not started — no visual at all currently |
| SE — Fixer | Copy Cat | Not started |
| *(all)* | Ready-to-cast signal | Not started |

### Wrecking Tour — what's actually done

- Token swaps from the rider's own icon to the bus glyph (`/bus.svg`,
  the same one station tiles use) for the duration of the glide.
  `PlayerToken.jsx` (`isBusRiding` prop) / `BoardClassic.jsx`
  (`busRidingId` state, cleared automatically once the rider drops out of
  `movingIds` — no manual "tour ended" signal needed).
- The token also scales up 1.4x while riding, via `--bus-scale` folded into
  `.cv2-token`'s own transform (not the inner face element, which already
  carries its own animation-driven transforms — bob/floating/celebrate —
  that a second transform source would clobber). Transition uses a bouncy
  overshoot easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) instead of plain
  `ease`, for the "pop" on scale-in/out.
- Fixed along the way (not animation work, but adjacent): the tour's own
  move animation used to not play at all when SD started already on tile 6
  (a near-full-lap-back-to-itself move that the generic move-detection
  effect couldn't see as a "move" — see progress.md Pass 47). Also fixed:
  the demolish-sound timing silently broke in that same edge case.

**Still open for Wrecking Tour specifically:** a punchier departure/impact
sound (currently just reuses the plain sell-building sound per demolished
tile — see the brainstorm table's suggestion of a horn-honk + bigger
crash/screen-shake).

---

## Brainstorm (first pass, not yet built except Wrecking Tour above)

Two real gaps to close for **every** ability below, not just cosmetic ones:

1. **No room-wide broadcast for Barricade/Curse/Hostile Takeover.** Wrecking
   Tour has `room.wreckingTourSeq` / `room.lastWreckingTour` specifically so
   every client (not just the caster) can animate it — see
   `conductor.js`/`BoardClassic.jsx`. Barricade/Curse/Hostile Takeover have
   no equivalent: only the caster's own ack ever sees the result of
   `useAbility()`. Any standing indicator or cast animation for these three
   needs a similar `xSeq`/`lastX` pair added to `Room.js` and broadcast via
   `toState()` before it can show up on anyone else's screen.
2. **No board-level visual for Barricade/Curse/Hostile Takeover at all**,
   armed or not — not even a static one. That's arguably the bigger win
   here: right now a barricaded tile, a cursed player, and a seized tile
   are all completely invisible except in the game log.

| Character | Cast moment | Standing indicator (currently missing) | Payoff moment |
|---|---|---|---|
| **Don — Barricade** | Board dims slightly, targeted tile gets a brief "slam" impact + dust puff | A visible wall/barrier icon sitting on the barricaded tile until sprung or expired | Screen-shake + wood-crack sound when a player actually hits it, token snaps to a stop |
| **Enforcer — Curse** | A dark tendril/vignette animates from Z's token to the target's token | A skull/chain icon pinned on the cursed player's row + token, pulsing ominously | A "drain" swoosh + red flash on the target's balance the instant their earnings get redirected |
| **Wrecker — Detonate** | Crosshair/targeting reticle on the chosen tile | *(instant effect, no standing state)* | Actual explosion: screen-shake, a burst/particle poof where the houses were, a boom sound as the house icons visibly crumble instead of just vanishing |
| **Kingpin — Hostile Takeover** | A "hostile" red flash sweep across the tile | Tile visibly recolors to H's color/pattern with a small crown or lock icon, distinct from normal ownership | A satisfying "cha-ching"/heist sting the instant it flips; the log line already exists but has no sound backing it |
| **Conductor — Wrecking Tour** | *(done — bus icon + scale-up)* | — | Still open: a punchier "horn honk" on departure + a bigger crash/screen-shake per building flattened, not just the current reused sell-sound |
| **Fixer — Copy Cat** | A "photocopy"/mirror-flash effect on SE's token, briefly showing the copied character's icon/color | — | Whatever the copied ability's own payoff is, plus a small "copied!" badge so it reads as Copy Cat, not the original character acting |

**Cross-ability ideas:**
- A shared "ability ready" glow/pulse on the Activate button (and maybe the
  character's own token) the instant cooldown hits 0 — nothing currently
  draws the eye back to it.
- A universal light "charge-up" sound + button-press animation on cast,
  distinct per character just by pitch/tone, so activating *feels* like
  activating even before the specific payoff plays.

---

## Infra already available to build on

- **Sound** — `client/src/sfx.js`. `makeClipPlayer(src, volume)` is the
  pattern for any new mp3 (drop a file in `client/public/sounds/`, one line
  to register it). `playMoveSwoosh` is the one example of a fully
  synthesized (no mp3 file) Web Audio oscillator sound, if a raw synth tone
  fits better than a recorded clip for something like a "charge-up."
- **Animation** — `classicVintage.css`'s existing token states: idle bob
  (`cv2-token-bob`), the buy-celebration bounce/eye/mouth burst
  (`cv2-token--celebrate`), the active-turn glow (`cv2-token-glow`), and the
  ability-targeting pulse (`cv2-targetable-pulse`). New ability effects
  should extend this existing visual language rather than invent a
  parallel one.
- **The broadcast-signal pattern** — `wreckingTourSeq`/`lastWreckingTour` on
  `Room.js`, bumped once per cast and read client-side in `BoardClassic.jsx`
  via a `prevXSeqRef` comparison (see the two effects there). This is the
  template to copy for Barricade/Curse/Hostile Takeover's own `xSeq`/`lastX`
  pairs.
- **Per-player timer isolation** — `BoardClassic.jsx`'s `glideTimersRef`
  (keyed by player id, not one shared per-effect-run array). Any new
  animation with its own `setTimeout` chain that can outlive a single
  render should follow this pattern, not the old shared-array one — see
  progress.md Pass 47 for the stuck-animation bug that pattern was fixed
  to prevent.
