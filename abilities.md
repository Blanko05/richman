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
| D — Don | Barricade | **Done** — see below |
| Z — Enforcer | Curse | **Done** — see below |
| Y — Wrecker | Detonate | **Done** — see below |
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

### Barricade — what's actually done

- **Standing indicator** (`barrier.png`, a wall/barrier icon pinned to the
  tile): rendered straight off `room.barricade.tileId` — no seq/broadcast
  work needed for this part, since `barricade` was already sitting in
  `toState()`/`toSnapshot()` before this pass (see the correction below).
  Idle pulsing glow via CSS. `ClassicTile` (`barricaded` prop) /
  `BoardClassic.jsx`.
- **Cast moment**: board dims briefly + the targeted tile "slams" (a sharp
  squash-then-settle) with a dust-puff ring. Detected client-side by
  diffing `room.barricade`'s own identity (`tileId`+`casterId`) against the
  previous render (`prevBarricadeRef`) rather than a new seq field — a
  single object, not a list, so this simpler diff is enough (wouldn't
  generalize as-is to Curse's `activeCurses`).
- **Payoff moment**: a real screen-shake + `thud.mp3` + a red flash/squash
  "snap" on the stopped player's own token, driven off the *existing*
  `barricadeSeq`/`lastBarricadeStop` broadcast (Room.js's `applyBarricade`
  already bumped this before this pass, for reasons unrelated to any
  client visual — turned out to be exactly the seq/lastX pair this needed).

**Correction to the "no equivalent" framing above:** it's not quite
accurate for Barricade specifically. `room.barricade` (armed/not, tileId,
casterId) and `activeCurses`/`hostileTakeover` were already all present in
`toState()`/`toSnapshot()` before this pass — Room.js pushes them for
reasons unrelated to client animation. That's enough for a standing
indicator on all three with **zero server changes** (confirmed for
Barricade above); what's genuinely missing per-ability is only the
one-shot cast/payoff *event* signal, and even that's half-done for
Barricade (`barricadeSeq`/`lastBarricadeStop` already covers the payoff,
same as Wrecking Tour's own pair — only the cast moment had no server
field, and didn't end up needing one, per the diff-the-object trick above).
Hostile Takeover still needs this worked through on its own next -- Curse
closed it (see below).

---

### Curse — what's actually done

- **Cast moment**: a dark purple-red tendril line draws from Z's token to
  the target's, plus a brief board-wide vignette (tinted differently from
  Barricade's, so the two cast moments don't read as the same event). New
  `room.curseCastSeq`/`room.lastCurseCast` pair — `activeCurses` being a
  **list** (Copy Cat can stack an independent second curse) rules out
  Barricade's cheap diff-the-object trick, so this genuinely needed a new
  server field, exactly as flagged below. `CurseTendril` / `BoardClassic.jsx`.
- **Standing indicator**: a skull icon (`reaper.png`), pulsing, on *both*
  the cursed player's own token (`PlayerToken.jsx`'s `cv2-token-cursed-badge`)
  and their row in the sidebar `PlayersPanel` — the brainstorm table's
  "row" note, which Barricade never needed since it targets a tile, not a
  player. Both read straight off `activeCurses` (already broadcast) — zero
  extra plumbing, same as Barricade's standing icon.
- **Payoff moment**: a synthesized "drain" tone (two detuned descending
  sawtooth oscillators, `playCurseDrain`) + a deep purple-red flash on the
  target's own token, *plus* a distinct "💀 -$X" flash on their sidebar row.
  New `room.curseDrainSeq`/`room.lastCurseDrain` pair, bumped inside
  `settleEarning` whenever a redirect actually fires. This one mattered
  more than it might for another ability: `settleEarning` credits the
  target then claws the gain back in the same synchronous tick, so their
  balance **never visibly changes** across a broadcast — the existing
  generic balance-flash (Pass 33) silently never fires for them. Without
  this dedicated signal there'd be no client-visible evidence a drain ever
  happened to the target at all, even though the caster's side already
  shows an ordinary "+X".

**Why no landing-sync delay, unlike Barricade's payoff:** Barricade's
shake/thud had to wait for a specific token's glide to finish because the
payoff is always tied to a move. Curse's redirect can fire from any of a
dozen+ money call sites (rent, cards, bank payouts, sell/mortgage
refunds...), not specifically a move, so there's no single glide to
synchronize against — the payoff just plays immediately off the seq bump.

---

### Detonate — what's actually done

Structurally simplest of the four built so far: unlike Barricade/Curse,
targeting and resolution happen in the **same synchronous server call** —
there's no real gap in time between a "cast" and its "payoff" to justify
two separate broadcast pairs, and no standing state at all (an empty lot
or a wiped building doesn't need an ongoing indicator the way an armed
barricade or an active curse does). One new pair covers the whole thing:
`room.detonateSeq`/`room.lastDetonate`
(`{ casterId, targetId, tileId, levelsRemoved, forcedMortgage }`), bumped
once in `wrecker.js`'s `active()` covering both branches (a real demolish
and the empty-lot forced-mortgage case). `levelsRemoved` matters
specifically because `owned.houses` is already reset to 0 in the very
same broadcast — without carrying the pre-detonate count separately, the
client would have no way to know how many house/hotel icons to animate
crumbling.

Visually the most elaborate of the four, though — user's explicit request
(Pass 53) to make Detonate a real showpiece, not a quick flash, so
`BoardClassic.jsx` sequences **four** local phases off that single seq
bump instead of the original two:

1. **Alarm** (8s): `siren.mp3` (`playSirenAlarm`) + the whole board pulses
   red on a repeating 0.5s beat, while a roaming crosshair
   (`crossair.png`, user-supplied Pass 54, `DetonateCrosshairIcon`) sweeps
   tile-to-tile around the board starting from the caster's own position,
   then locks onto the real target with one slower eased-out glide for
   the alarm phase's final second — arriving exactly as this phase ends
   and the glow phase begins. `siren.mp3` is a long ~15s air-raid loop —
   only the first 8s of the wail is used, cut off with a scheduled
   `AudioBufferSourceNode.stop()` + a short fade-out rather than letting
   the whole clip run. User's own follow-up calls, both within the same
   original ask: first extending the alarm from an initial ~1.2s to a
   full 8s, then adding the scanning crosshair to fill that longer
   window with something that reads as "searching for the target"
   instead of just a static pulse.
2. **Glow** (~450ms): the target tile itself builds up a hot red glow
   (`detonateGlow` prop), like it's charging, right after the alarm.
3. **Reticle** (~300ms, exaggerated): a bigger, snappier targeting-lock
   snap than the original version (`detonateReticle` prop).
4. **Blast** (~750ms, exaggerated): a camera-flash beat, a bigger/hotter
   burst ring than the original (was 8x scale, now 11x), its own sharper
   squash-and-wobble tile keyframe (no longer reusing Barricade's slam —
   the user specifically wanted this one bigger, so it earned its own),
   crumbling house/hotel icons (unchanged from the original — still
   `cv2-building-icon`'s masked-silhouette technique, scattering and
   falling away staggered per-icon via `--i`, sourced from
   `lastDetonate.levelsRemoved` since `owned.houses` is already 0), the
   shared `boardShaking` flag (reused rather than a second flag, since
   visually it's the same effect), and `boom.mp3` (`playExplosion`,
   user-supplied — synthesizing a convincing boom needs noise texture a
   simple oscillator can't cheaply fake, unlike Curse's tone-based drain).

Total sequence is now ~9.5s, deliberately much longer than any other
ability's — every phase's timer is an absolute delay from the seq bump
(not chained nested timeouts), same one-cleanup-array pattern as
Barricade's payoff, which matters more here specifically since a sequence
this long is far more likely to still be in flight when an unrelated
re-render tears the effect down. **No landing-sync delay needed** (same
reasoning Curse's payoff didn't need one, for a different underlying
cause): Detonate isn't tied to a move or a glide at all, so the whole
four-phase sequence just runs on its own fixed local timing.

---

## Brainstorm (first pass, not yet built except Wrecking Tour + Barricade + Curse + Detonate above)

Both real gaps flagged below are now closed for **every** ability except
Hostile Takeover:

1. **No cast/payoff *event* broadcast for Hostile Takeover.** Wrecking
   Tour has `room.wreckingTourSeq`/`room.lastWreckingTour`; Barricade has
   `room.barricadeSeq`/`room.lastBarricadeStop`; Curse now has
   `curseCastSeq`/`lastCurseCast` + `curseDrainSeq`/`lastCurseDrain`.
   Hostile Takeover has neither a payoff seq nor a cast one yet — only the
   caster's own ack ever sees the immediate result of `useAbility()`.
   `hostileTakeover` is a single object (not a list, like `barricade`), so
   check whether Barricade's cheaper diff-the-object trick works for its
   cast moment before reaching for a new seq field there too.
2. **No board-level visual for Hostile Takeover at all**, seized or not —
   not even a static one, despite `hostileTakeover` already being
   broadcast in `toState()`/`toSnapshot()` (confirmed — nothing
   server-side is blocking a standing indicator, same as was true for
   Barricade and Curse before their own passes).

| Character | Cast moment | Standing indicator | Payoff moment |
|---|---|---|---|
| **Don — Barricade** | *(done — board dim + tile slam + dust puff)* | *(done — pulsing wall icon)* | *(done — screen-shake + thud + token snap)* |
| **Enforcer — Curse** | *(done — dark tendril + purple-red board vignette)* | *(done — pulsing skull badge, token + sidebar row)* | *(done — synthesized drain tone + token flash + sidebar "💀 -$X")* |
| **Wrecker — Detonate** | *(done — 8s siren + board alarm pulse, tile glow, exaggerated reticle)* | *(instant effect, no standing state)* | *(done — camera flash + bigger burst ring + crumbling house/hotel icons + boom.mp3, ~9.5s showpiece sequence)* |
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
  via a `prevXSeqRef` comparison (see the two effects there). Template for a
  one-shot *event* (cast or payoff) that needs its own dedicated field —
  Barricade's payoff reused an existing one (`barricadeSeq`/
  `lastBarricadeStop`) this way; Curse needed two brand new ones
  (`curseCastSeq`/`lastCurseCast`, `curseDrainSeq`/`lastCurseDrain`), and
  Hostile Takeover will likely need at least one too. For a *standing*
  indicator, check first whether the state is already broadcast plain in
  `toState()`/`toSnapshot()` before adding anything new —
  `barricade`/`activeCurses`/`hostileTakeover` all already are, so a
  standing indicator for any of them needs zero server changes (see
  Barricade's `barricaded` prop / Curse's `isCursed` for the pattern). And
  for a cast moment specifically, check whether diffing the existing
  object/ref against the previous render is enough before reaching for a
  new seq field at all — it was for Barricade (see `prevBarricadeRef`), but
  NOT for Curse, since `activeCurses` is a list and there's no cheap way to
  tell "a new entry got added" apart from "the list changed for an
  unrelated reason" by diffing alone — that's exactly when a new seq field
  earns its keep instead.
- **Per-player timer isolation** — `BoardClassic.jsx`'s `glideTimersRef`
  (keyed by player id, not one shared per-effect-run array). Any new
  animation with its own `setTimeout` chain that can outlive a single
  render should follow this pattern, not the old shared-array one — see
  progress.md Pass 47 for the stuck-animation bug that pattern was fixed
  to prevent.
- **Eager-preload every new asset — never let one load lazily on first
  trigger.** Confirmed real (not just theoretical) in Pass 49: Barricade's
  `barrier.png`/`thud.mp3` both visibly lagged the first time they
  actually fired, because an ability's own first cast can land at any
  arbitrary point well into a game, not on the board's first paint the way
  most other art does. Two mechanical patterns, one per asset type, both
  already wired up generically so a new ability rarely needs more than one
  new line each:
  - **Images** — a module-level `new Image(); img.src = "/whatever.png"`
    at the top of `BoardClassic.jsx`, same as `CORNER_ICON_SRC`'s own
    preload block and `barrier.png`'s (see that comment for the reasoning).
  - **Sounds** — nothing extra needed beyond registering it the normal way
    via `makeClipPlayer` in `sfx.js` — every clip registered that way is
    now automatically preloaded (fetched + decoded) the moment
    `primeAudio()` first creates the shared `AudioContext`, via
    `preloadAllClips()`. Don't hand-roll a separate preload call per sound;
    just add the `makeClipPlayer(...)` export and this happens for free.
- **Any tile-level standing-icon overlay (rendered inside `ClassicTile`,
  a sibling of `.cv2-body`) hit two real bugs building Barricade's
  `barricaded` icon — check for both before shipping the next one
  (Hostile Takeover's crown/lock icon is the same shape of feature, so
  both are likely to recur there specifically):**
  1. **Left/right tile rotation.** `.cv2-body` itself rotates 180° on
     `.cv2-side-left`/`.cv2-side-right` (so its text reads outward along
     the rim), and every other icon on those edges follows suit
     (`cv2-building-icon`: ±90°, `cv2-icon-center`: 90°). A brand-new icon
     added without its own `.cv2-side-left .your-icon` /
     `.cv2-side-right .your-icon` rotation rule will render sideways or
     upside-down the first time it lands on a left/right tile — it won't
     show up testing only top/bottom tiles. See `.cv2-barricade-icon`'s
     own left/right rules (Pass 51) for the pattern — pick a rotation
     angle that matches what the icon is actually depicting (Barricade
     used ±90°, matching the building-icon convention, since a "wall"
     reads better perpendicular to the rim than lying flat).
  2. **The Chromium layout-cache bug.** Any sibling element inside
     `.cv2-tile` appearing/disappearing (mortgaged state, house count, the
     barricade icon, Detonate's reticle/blast) can leave `.cv2-body`'s own
     rotated/vertical-writing-mode text visually "stuck" mid-tile until a
     full reload — a real Chromium bug, not anything wrong in the CSS
     itself (see the fix comment on `.cv2-body`'s own `key={...}` in
     `ClassicTile`). The fix is always the same: fold whatever boolean
     controls your new icon's visibility into that same `key` string, so
     React force-remounts `.cv2-body` the instant it changes, the same way
     `mortgaged`/`houses`/`barricaded`/`detonating` already do. **Do this
     for any new tile-level conditional render, not just an icon** —
     skipping it doesn't fail loudly, it just leaves a stale-looking tile
     until someone happens to refresh, which is exactly what made it easy
     to miss the first two times.
