import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";
import { playMoveSwoosh, playSellBuilding, playBarricadeThud, playCurseDrain, playExplosion, playSirenAlarm, primeAudio } from "../sfx";
import Dice from "./Dice";
import PlayerToken from "./PlayerToken";
import PropertyCardDetail from "./PropertyCardDetail";
import TransitCardDetail from "./TransitCardDetail";
import CardReveal from "./CardReveal";
import WastaAttemptReveal from "./WastaAttemptReveal";
import ConfirmDialog from "./ConfirmDialog";
import { ICONS } from "../data/icons";
import "../classicVintage.css";

// PropertyCardDetail assumes a property's data shape -- rent tiered by
// house count, a housePrice -- which transit tiles don't share (their rent
// scales with how many stations are owned, and they have no housePrice at
// all). Transit tiles get their own TransitCardDetail card instead; this
// board has no utility tiles so those two cover every ownable tile type.
const CLICKABLE_TYPES = ["property", "transit"];

// The other two corners (REST's regeneration.svg, TAX's pig.svg) are drawn
// with inline SVG/an existing icon; these three needed dedicated art since
// nothing in the icon set already represented "start", "sent to holding",
// or "go to holding".
const CORNER_ICON_SRC = {
  start: "/bow-and-arrow.png",
  holding: "/captive.png",
  go_to_holding: "/police.png",
};

// Eagerly fetches the three corner-tile images the instant this module
// loads, same reasoning as App.jsx's ICONS preload -- so they're already
// decoded and cached before the board's first render instead of visibly
// popping in.
Object.values(CORNER_ICON_SRC).forEach((src) => {
  const img = new Image();
  img.src = src;
});

// D's Barricade standing indicator (see ClassicTile's `barricaded` prop):
// unlike the corner icons above, this one's first-ever render can happen at
// any arbitrary point well into a game (whenever Barricade first gets
// cast), not on the board's own first paint -- without this same eager
// preload, it would visibly pop in a beat late the first time D actually
// uses the ability, since the browser only starts fetching an <img> once
// it's actually mounted.
const barrierImg = new Image();
barrierImg.src = "/barrier.png";

// Z's Curse standing indicator (the token badge, see PlayerToken.jsx) --
// same reasoning as barrierImg above: its first-ever render can land at
// any arbitrary point well into a game, not the board's first paint.
const reaperImg = new Image();
reaperImg.src = "/reaper.png";

// Y's Detonate alarm-phase scanning crosshair (see DetonateCrosshairIcon
// below) -- same reasoning as barrierImg/reaperImg above.
const crossairImg = new Image();
crossairImg.src = "/crossair.png";

export function TreasureIcon() {
  return (
    <svg className="cv2-tile-icon" viewBox="0 0 100 84" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="44" width="84" height="34" rx="9" fill="#f59e0b"/>
      <rect x="8" y="44" width="84" height="16" rx="9" fill="#b45309" opacity="0.3"/>
      <path d="M8 46 C8 18 22 6 50 6 C78 6 92 18 92 46 Z" fill="#f59e0b"/>
      <path d="M15 46 C15 24 26 16 50 16 C74 16 85 24 85 46 Z" fill="#78350f" opacity="0.28"/>
      <rect x="8" y="40" width="84" height="14" rx="4" fill="#b45309"/>
      <rect x="34" y="32" width="32" height="30" rx="8" fill="#fbbf24" stroke="#d97706" strokeWidth="2"/>
      <circle cx="50" cy="44" r="7" fill="#3d1a00"/>
      <rect x="46.5" y="48" width="7" height="9" rx="2" fill="#3d1a00"/>
      <path d="M16 16 Q36 8 54 13" stroke="rgba(255,255,255,0.55)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <path d="M18 24 Q32 18 44 21" stroke="rgba(255,255,255,0.28)" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function TaxIcon() {
  return <img src="/pig.svg" className="cv2-tile-icon" alt="" />;
}

export function SurpriseIcon() {
  return (
    <svg className="cv2-tile-icon" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="qmarkGrad" x1="0.2" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#ff9ee0"/>
          <stop offset="45%" stopColor="#f046a8"/>
          <stop offset="100%" stopColor="#b5126e"/>
        </linearGradient>
      </defs>
      <text
        x="50%" y="62%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="82"
        fontWeight="900"
        fill="url(#qmarkGrad)"
        fontFamily="Georgia, serif"
      >?</text>
    </svg>
  );
}

// Generic square-loop layout: corners sit every `sideLen` ids (0, sideLen,
// 2*sideLen, 3*sideLen), ids increase clockwise from the top-left corner.
// For the 48-tile classic-vintage board, sideLen = 12, grid = 13x13.
function getLayout(id, sideLen) {
  const N = sideLen + 1;
  const local = id % sideLen;
  const seg = Math.floor(id / sideLen);
  const corner = local === 0;
  const edge = corner ? "corner" : ["top", "right", "bottom", "left"][seg];
  let row, col;
  switch (seg) {
    case 0: row = 1;          col = local + 1; break; // top: left -> right
    case 1: row = local + 1;  col = N;          break; // right: top -> bottom
    case 2: row = N;          col = N - local;  break; // bottom: right -> left
    default: row = N - local; col = 1;          break; // left: bottom -> top
  }
  return { edge, row, col, N };
}

// Percentage (of the board's width/height) of the center of each of the N
// grid tracks, given the same rim/inner fr weighting used for the tile grid
// itself (see RIM_FR/INNER_FR below) -- lets a token be positioned with
// plain left/top percentages instead of CSS grid placement, so a CSS
// transition can glide it smoothly between tiles instead of snapping.
// Index 0 = track 1 (first row/col), index N-1 = track N (last row/col).
function buildTrackCenters(N, rimFr, innerFr) {
  const totalFr = rimFr * 2 + innerFr * (N - 2);
  const centers = [];
  let acc = 0;
  for (let t = 1; t <= N; t++) {
    const fr = (t === 1 || t === N) ? rimFr : innerFr;
    centers.push(((acc + fr / 2) / totalFr) * 100);
    acc += fr;
  }
  return centers;
}

// Every ordinary move (including a card-driven teleport-to-a-tile like
// "Advance to X") walks forward tile by tile, wrapping past the last tile
// back to 0 -- matches how movement already works server-side, and is what
// lets a token visually trace the board instead of jumping straight to
// wherever it landed.
function computeForwardPath(from, to, totalTiles) {
  const path = [];
  let cur = from;
  while (cur !== to) {
    cur = (cur + 1) % totalTiles;
    path.push(cur);
  }
  return path;
}

// A "move back N spaces" card is the one move that actually goes the other
// way around the board -- walking it forward instead would have the token
// loop almost all the way around to end up "behind" where it started.
// Wraps past 0 back to the last tile, the mirror image of the forward path.
function computeBackwardPath(from, to, totalTiles) {
  const path = [];
  let cur = from;
  while (cur !== to) {
    cur = (cur - 1 + totalTiles) % totalTiles;
    path.push(cur);
  }
  return path;
}

// A move only needs to stop at the corners it turns at, not every tile it
// passes over -- the rim is straight between corners, so gliding straight
// to each corner (rather than snapping tile by tile) is what lets the
// token move continuously instead of visibly stopping along the way. Each
// leg also carries how many original tiles it covers, so a long straight
// run can be given proportionally more time than a short one -- otherwise
// a leg crossing 10 tiles would take exactly as long as one crossing 1.
// Splits an already-known tile sequence into corner-to-corner legs (the
// grouping step of computeLegWaypoints, factored out so a caller that
// already has its own authoritative path -- Wrecking Tour's server-computed
// route, see the wreckingTourSeq effect below -- can reuse it directly
// instead of re-deriving the same path from a from/to pair.
function groupPathIntoLegs(path, sideLen) {
  const legs = [];
  let legStart = 0;
  path.forEach((tileId, idx) => {
    const isCorner = tileId % sideLen === 0;
    if (isCorner || idx === path.length - 1) {
      legs.push({ tileId, tileCount: idx + 1 - legStart });
      legStart = idx + 1;
    }
  });
  return legs;
}

function computeLegWaypoints(from, to, sideLen, totalTiles, backward = false) {
  const path = backward
    ? computeBackwardPath(from, to, totalTiles)
    : computeForwardPath(from, to, totalTiles);
  return groupPathIntoLegs(path, sideLen);
}

// A single leg eases in and out on its own (feels natural in the very
// common case of a move that only crosses one edge). For a move spanning
// several legs, only the first eases in and only the last eases out --
// the legs in between run at constant speed -- so the whole multi-leg trip
// reads as one continuous accelerate/cruise/decelerate motion instead of
// visibly re-accelerating at every corner it passes through.
// Sharp accelerate-in, snappy expo-out settle -- reads as "fast, but lands
// smooth" instead of the generic ease-in-out/ease-out keyword curves, which
// decelerate too gradually for a quick per-tile hop.
const LEG_EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";
const LEG_EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const LEG_EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

function legEasing(index, total) {
  if (total === 1) return LEG_EASE_IN_OUT;
  if (index === 0) return LEG_EASE_IN;
  if (index === total - 1) return LEG_EASE_OUT;
  return "linear";
}

// The Holding corner's "just visiting" outer frame vs. "in prison" inner
// cell -- mirrors the real board's split jail tile. Only classic-vintage's
// HOLDING tile sets `visitingLabel`; other boards' HOLDING tiles (English
// names, no visitingLabel) fall through to the plain corner-icon layout
// below instead of half-rendering this split with blank frame text.
function HoldingCornerArt({ name, visitingLabel }) {
  return (
    <div className="cv2-holding-corner">
      <span className="cv2-holding-frame-top">{visitingLabel}</span>
      <div className="cv2-holding-cell">
        <img src={CORNER_ICON_SRC.holding} className="cv2-holding-cell-icon" alt="" />
        <span className="cv2-holding-cell-name">{name}</span>
      </div>
    </div>
  );
}

function ClassicTile({ tile, owned, players, sideLen, onSelect, isSelected, targeting, barricaded, barricadeCasting, detonateGlow, detonateReticle, detonateBlast }) {
  const { id, name, price, amount, groupColor, type, visitingLabel } = tile;
  const { edge, row, col } = getLayout(id, sideLen);
  const hasIcon = type === "treasure" || type === "surprise" || type === "tax" || type === "transit" || type === "rest" || type in CORNER_ICON_SRC;
  const isLRSide = edge === "left" || edge === "right";
  const nameParts = name.split(" ");
  const isCorner = edge === "corner";
  // Mortgaged tiles go dull grey regardless of owner, so the board reads
  // "not earning rent" at a glance instead of still flashing the owner color.
  const ownerColor = owned?.ownerId
    ? (owned.mortgaged ? "#5a5a5a" : players.find((p) => p.id === owned.ownerId)?.color)
    : null;
  // While an ability's tile-targeting is active (App.jsx's shared targeting
  // state machine), every tile becomes clickable -- e.g. Barricade can target
  // a tax/rest/corner tile that's never otherwise selectable -- and the
  // server's own validation is what actually rejects an invalid pick.
  const isClickable = CLICKABLE_TYPES.includes(type) || targeting;

  const badgeValue = price != null ? price : amount;
  const houses = owned?.houses || 0;
  const isHotel = houses >= 5;

  return (
    <div
      className={`cv2-tile ${isCorner ? "cv2-corner" : `cv2-side-${edge}`}${type === "transit" ? " cv2-transit" : ""}${type === "rest" ? " cv2-rest" : ""}${isClickable ? " cv2-tile-clickable" : ""}${isSelected ? " cv2-tile-selected" : ""}${targeting ? " cv2-tile-targetable" : ""}${barricadeCasting ? " cv2-tile--barricade-slam" : ""}${detonateGlow ? " cv2-tile--detonate-glow" : ""}${detonateBlast ? " cv2-tile--detonate-blast" : ""}`}
      style={{ gridRow: row, gridColumn: col, ...(!isCorner && ownerColor ? { background: ownerColor } : {}) }}
      onClick={isClickable ? (e) => onSelect(id, e.currentTarget, edge) : undefined}
    >
      {!isCorner && groupColor && !owned?.mortgaged && <div className="cv2-band" style={{ background: groupColor }} />}
      {!isCorner && badgeValue != null && (
        <div className="cv2-price-tag">
          <span className="cv2-price">${badgeValue}</span>
        </div>
      )}

      {/* Keyed on mortgaged/houses/barricaded/detonating -- all are purely
          cosmetic sibling changes elsewhere in this tile (the band
          appearing/disappearing, the building badge appearing/
          disappearing, the barricade icon and Detonate's reticle/burst/
          crumble overlays below appearing/disappearing) that don't touch
          cv2-body's own box model at all, yet reliably left its rotated/
          vertical-writing-mode text visually "stuck" mid-tile until a full
          page reload recomputed it (a Chromium layout-cache bug, not
          anything wrong in this CSS) -- barricaded/detonating were added
          to this key for the same reason mortgaged/houses are here: it's
          the same bug, a new trigger each time. Forcing React to unmount/
          remount this node instead of patching it in place sidesteps the
          stale layout entirely -- same effect a refresh has, without one. */}
      <div key={`${!!owned?.mortgaged}-${houses}-${barricaded}-${!!detonateReticle}-${!!detonateBlast}`} className={`cv2-body${hasIcon ? " cv2-body--icon" : ""}`}>
        {type === "transit" ? (
          <div className="cv2-transit-layout">
            <span className="cv2-transit-name">{nameParts[0]}</span>
            <img src="/bus.svg" className="cv2-bus-icon" alt="" />
            <span className="cv2-transit-name">{nameParts.slice(1).join(" ")}</span>
          </div>
        ) : type === "holding" && visitingLabel ? (
          <HoldingCornerArt name={name} visitingLabel={visitingLabel} />
        ) : hasIcon ? (
          <div className="cv2-icon-center">
            <span className="cv2-special-name">
              {isLRSide && name.includes(" ")
                ? name.split(" ").map((word, i) => (
                    <span key={i} style={{ display: "block", textAlign: "center" }}>{word}</span>
                  ))
                : name}
            </span>
            {type === "treasure" ? (
              <TreasureIcon />
            ) : type === "surprise" ? (
              <SurpriseIcon />
            ) : type === "tax" ? (
              <TaxIcon />
            ) : CORNER_ICON_SRC[type] ? (
              <img src={CORNER_ICON_SRC[type]} className="cv2-tile-icon" alt="" />
            ) : (
              <img src="/regeneration.svg" className="cv2-tile-icon" alt="" />
            )}
          </div>
        ) : (
          <span className="cv2-name">{name}</span>
        )}
      </div>

      {!owned?.mortgaged && houses > 0 && (
        <div className={`cv2-building-badge${isHotel ? " cv2-building-badge--hotel" : ""}`}>
          {isHotel ? (
            <span
              className="cv2-building-icon cv2-building-icon--hotel"
              style={{ "--icon-url": "url(/icons/hotel.svg)" }}
            />
          ) : (
            Array.from({ length: houses }, (_, i) => (
              <span
                key={i}
                className="cv2-building-icon"
                style={{ "--icon-url": "url(/icons/house.svg)" }}
              />
            ))
          )}
        </div>
      )}

      {/* Standing indicator: D's Barricade (see Room.js's this.barricade),
          driven straight off room state -- no seq/broadcast plumbing needed
          for this part, unlike the cast/payoff moments below, since it's
          just "is this field currently non-null for this tile", already
          pushed to every client via toState(). Cleared automatically the
          instant Room.js nulls this.barricade (sprung or the caster's own
          next turn), same as everything else driven straight off state. */}
      {barricaded && (
        <img src="/barrier.png" className="cv2-barricade-icon" alt="" />
      )}

      {/* Y's Detonate -- cast+payoff, one combined broadcast event (see
          Room.js's detonateSeq comment: unlike Barricade/Curse there's no
          real gap in time between targeting and resolution, so
          BoardClassic.jsx just sequences the reticle then the blast
          locally off a single seq bump instead of two). */}
      {detonateReticle && <div className="cv2-tile-detonate-reticle" />}
      {detonateBlast && (
        <>
          <div className="cv2-tile-detonate-burst" />
          {/* Crumbling house/hotel icons -- sourced from
              detonateBlast.levelsRemoved, NOT owned.houses, since
              owned.houses is already reset to 0 by the same broadcast that
              carries this event (see wrecker.js). A forced mortgage
              (nothing was built) has nothing to crumble -- just the burst
              above. */}
          {!detonateBlast.forcedMortgage &&
            Array.from({ length: detonateBlast.levelsRemoved }, (_, i) => (
              <span
                key={i}
                className={`cv2-detonate-crumble${detonateBlast.levelsRemoved >= 5 ? " cv2-detonate-crumble--hotel" : ""}`}
                style={{
                  "--icon-url": `url(${detonateBlast.levelsRemoved >= 5 ? "/icons/hotel.svg" : "/icons/house.svg"})`,
                  "--i": i,
                }}
              />
            ))}
        </>
      )}
    </div>
  );
}

// Renders every occupied tile's token stack in a single board-wide overlay,
// as a sibling of the tiles rather than nested inside one (so a token is
// never clipped by a tile's own `overflow: hidden` while elevated/stacked).
// Grouped by `visualPositions` (the tile a token's glide has currently
// reached -- see BoardClassic below), not the authoritative
// `player.position`; the two only match once a glide finishes. Every
// player always has exactly one current tile, in flight or not, so
// stacking (stackIndex/stackTotal) works the same way whether a token is
// sitting still or mid-glide through the tile it's passing.
function TokenLayer({ players, sideLen, trackCenters, cellPct, holdingTileId, currentPlayerId, visualPositions, floatingIds, landingIds, celebratingIds, busRidingId, barricadeSnapId, activeCurses, curseDrainTargetId }) {
  // The Holding tile splits into two sub-zones -- everywhere else, all
  // occupants of a tile still share one shared "main" stack exactly as
  // before.
  const byGroup = new Map();
  players.forEach((p) => {
    if (p.bankrupt || p.left) return;
    const entry = visualPositions.get(p.id);
    if (entry == null) return;
    const zone = entry.tileId === holdingTileId ? (p.inHolding ? "cell" : "frame") : "main";
    const key = `${entry.tileId}:${zone}`;
    if (!byGroup.has(key)) byGroup.set(key, { tileId: entry.tileId, zone, occupants: [] });
    byGroup.get(key).occupants.push({ player: p, glideMs: entry.glideMs, glideEase: entry.glideEase });
  });

  return (
    <div className="cv2-token-layer">
      {[...byGroup.values()].flatMap(({ tileId, zone, occupants }) => {
        const { row, col, N } = getLayout(tileId, sideLen);
        let leftPct = trackCenters[col - 1];
        let topPct = trackCenters[row - 1];
        // "frame" (just visiting) sits toward the tile's own outward
        // corner, along the walkable rim; "cell" (in prison) sits toward
        // the board's interior -- mirrors HoldingCornerArt's layout in
        // classicVintage.css.
        if (zone !== "main") {
          const dx = col === 1 ? -1 : col === N ? 1 : 0;
          const dy = row === 1 ? -1 : row === N ? 1 : 0;
          const sign = zone === "frame" ? 1 : -1;
          leftPct += dx * cellPct * 0.27 * sign;
          topPct += dy * cellPct * 0.27 * sign;
        }
        return occupants.map(({ player: p, glideMs, glideEase }, i) => (
          <PlayerToken
            key={p.id}
            player={p}
            stackIndex={i}
            stackTotal={occupants.length}
            leftPct={leftPct}
            topPct={topPct}
            glideMs={glideMs}
            glideEase={glideEase}
            isMoving={floatingIds.has(p.id)}
            isLanding={landingIds.has(p.id)}
            justBought={celebratingIds.has(p.id)}
            isActiveTurn={p.id === currentPlayerId}
            isBusRiding={busRidingId === p.id}
            isBarricadeSnap={barricadeSnapId === p.id}
            isCursed={activeCurses.some((c) => c.targetId === p.id)}
            isCurseDraining={curseDrainTargetId === p.id}
          />
        ));
      })}
    </div>
  );
}

// Z's Curse cast moment: a dark tendril drawn straight from the caster's
// current tile to the target's, board-wide overlay same as TokenLayer (not
// nested in either tile, for the same clipping reason). Coordinates reuse
// the exact same getLayout/trackCenters conversion TokenLayer uses, off
// visualPositions rather than raw player.position, so the tendril's
// endpoints track a token still mid-glide instead of snapping to its final
// tile early. `event` is null whenever no cast is currently animating (see
// BoardClassic's curseCastEvent state) -- this returns null itself in that
// case rather than the parent conditionally mounting/unmounting it, so the
// fade-out transition below actually has something to animate from.
function CurseTendril({ event, sideLen, trackCenters, visualPositions }) {
  if (!event) return null;
  const casterEntry = visualPositions.get(event.casterId);
  const targetEntry = visualPositions.get(event.targetId);
  if (!casterEntry || !targetEntry) return null;
  const casterLayout = getLayout(casterEntry.tileId, sideLen);
  const targetLayout = getLayout(targetEntry.tileId, sideLen);
  const x1 = trackCenters[casterLayout.col - 1];
  const y1 = trackCenters[casterLayout.row - 1];
  const x2 = trackCenters[targetLayout.col - 1];
  const y2 = trackCenters[targetLayout.row - 1];
  return (
    <svg className="cv2-curse-tendril" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
    </svg>
  );
}

// Y's Detonate alarm phase: the roaming crosshair that sweeps the board
// during the siren/flash before locking onto the actual target (user's
// own request, Pass 54). `pos` is `{ tileId, glideMs, glideEase }` --
// same shape as a single TokenLayer entry's own visualPositions value,
// but this is one standalone icon, not a per-player map, so it's simpler
// to just track directly rather than reusing TokenLayer's grouping logic.
// glideMs/glideEase vary per hop (fast constant-speed steps while
// scanning, then one slower eased-out glide for the final lock-on) so the
// same left/top-transition trick PlayerToken already uses for a token's
// own glide works here too, just driven by BoardClassic's own scan timer
// chain instead of a real move.
function DetonateCrosshairIcon({ pos, sideLen, trackCenters }) {
  if (!pos) return null;
  const { row, col } = getLayout(pos.tileId, sideLen);
  return (
    <img
      src="/crossair.png"
      alt=""
      className="cv2-detonate-crosshair"
      style={{
        left: `${trackCenters[col - 1]}%`,
        top: `${trackCenters[row - 1]}%`,
        "--glide-ms": `${pos.glideMs}ms`,
        "--glide-ease": pos.glideEase,
      }}
    />
  );
}

export default function BoardClassic({ state, myId, tokenMoving, onTokenMovingChange, tileTargeting, onTileTarget }) {
  const { board, ownership, players, lastRoll, turnIndex, rollSeq, jailSeq, jailedPlayerId, jailFromTileId, wreckingTourSeq, lastWreckingTour, barricade, barricadeSeq, lastBarricadeStop, activeCurses, curseCastSeq, lastCurseCast, curseDrainSeq, lastCurseDrain, detonateSeq, lastDetonate } = state;

  // Rim tracks (row 1 / row N / col 1 / col N) are wider than inner tracks so
  // tiles take up more of the board and the center shrinks. Tiles become
  // rectangular as a result (taller on top/bottom, wider on left/right) --
  // confirmed look via prototype before implementing. Computed up front
  // (not just where gridTemplate needs it below) because the token-glide
  // effect further down also needs trackCenters to convert a tile id into
  // an on-screen coordinate. Memoized on board.length alone (it never
  // actually changes mid-game) -- without this, buildTrackCenters ran fresh
  // on every render for any reason at all (opening a tile card, the dice
  // tick, someone else's unrelated action), and since trackCenters sat in
  // the glide effect's dependency array below, every single one of those
  // renders tore down and restarted that effect, killing every in-flight
  // glide mid-air.
  const RIM_FR = 1.7;
  const INNER_FR = 1;
  // cellPct: a rim track's own width/height, as a % of the whole board --
  // used to offset tokens within the Holding tile's frame/cell sub-zones
  // (see TokenLayer). holdingTileId looks up the HOLDING tile once here
  // rather than re-scanning `board` on every render.
  const { sideLen, N, trackCenters, cellPct, holdingTileId } = useMemo(() => {
    const sideLen = board.length / 4;
    const N = sideLen + 1;
    const totalFr = RIM_FR * 2 + INNER_FR * (N - 2);
    return {
      sideLen,
      N,
      trackCenters: buildTrackCenters(N, RIM_FR, INNER_FR),
      cellPct: (RIM_FR / totalFr) * 100,
      holdingTileId: board.find((t) => t.type === "holding")?.id,
    };
  }, [board.length]);

  // Which tile's info card is currently open, if any, and its on-screen
  // position (px, relative to the board container). Build/sell/mortgage
  // controls live here now (moved off the My Properties panel, which is
  // read-only) -- propertyErrors tracks a per-tile error message the same
  // way MyProperties.jsx did.
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const [propertyErrors, setPropertyErrors] = useState({});
  // Ending your turn while still in debt immediately bankrupts you
  // server-side (see Room.finishTurn) -- gate it behind a confirmation
  // instead of letting one misclick end the game for that player.
  const [confirmingBankruptcy, setConfirmingBankruptcy] = useState(false);
  // The per-turn timer can end this turn out from under the player (see
  // Room.startTurnTimer) while the dialog above is still open -- reset it
  // once the turn actually moves on, so it doesn't linger `true` and pop
  // back up unprompted the next time this player's turn comes around.
  useEffect(() => {
    setConfirmingBankruptcy(false);
  }, [turnIndex]);

  // Don't let an already-open property card sit on screen at the same time as
  // a fresh ability-targeting prompt -- close it the moment targeting starts.
  useEffect(() => {
    if (tileTargeting) closeTile();
  }, [tileTargeting]);
  const boardRef = useRef(null);
  const cardRef = useRef(null);
  const selectedTileElRef = useRef(null);
  const CARD_GAP = 10;

  function emitPropertyAction(tileId, event) {
    setPropertyErrors((e) => ({ ...e, [tileId]: "" }));
    socket.emit(event, { tileId }, (res) => {
      if (res?.error) setPropertyErrors((e) => ({ ...e, [tileId]: res.error }));
    });
  }

  // Records which tile is open and a live reference to its DOM node (not a
  // one-time snapshot of its position -- re-measured fresh on every layout
  // pass below, so the card's offset stays correct even if the board
  // resizes while it's open).
  function openTile(tileId, tileEl, edge) {
    setSelectedTileId(tileId);
    setSelectedEdge(edge);
    selectedTileElRef.current = tileEl;
  }

  function closeTile() {
    setSelectedTileId(null);
    setSelectedEdge(null);
    selectedTileElRef.current = null;
  }

  // Click-only: opens the card, or closes it if the already-open tile is
  // clicked again. Stays open until an explicit click (this or elsewhere on
  // the board) -- no hover-preview, which was the source of a string of
  // flicker/mis-position bugs.
  function selectTile(tileId, tileEl, edge) {
    if (selectedTileId === tileId) {
      closeTile();
      return;
    }
    openTile(tileId, tileEl, edge);
  }

  // Routes a tile click to ability-targeting instead of the normal open/close
  // card behavior while tileTargeting is active (App.jsx's shared targeting
  // state machine) -- the property card and targeting are mutually exclusive,
  // never both from the same click.
  function handleTileClick(tileId, tileEl, edge) {
    if (tileTargeting) {
      onTileTarget?.(tileId);
      return;
    }
    selectTile(tileId, tileEl, edge);
  }

  // Positions the card OFFSET from the tile that opened it -- never on top
  // of it -- by pushing outward from whichever edge of the board the tile
  // sits on (top edge -> card opens below it, bottom edge -> above it, left
  // edge -> to its right, right edge -> to its left), then clamps the result
  // so the card still lands fully inside the board's own borders regardless
  // of its (content-dependent) rendered size. Runs after every render --
  // re-measuring the tile/card/board live each time, rather than trusting a
  // stale click-time snapshot -- but bails out via the "same object back"
  // idiom the instant nothing needs to move, so it settles in one extra
  // pass instead of looping.
  useLayoutEffect(() => {
    if (selectedTileId == null) return;
    const boardEl = boardRef.current;
    const cardEl = cardRef.current;
    const tileEl = selectedTileElRef.current;
    if (!boardEl || !cardEl || !tileEl) return;
    const boardRect = boardEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const tileRect = tileEl.getBoundingClientRect();
    const tileTop = tileRect.top - boardRect.top;
    const tileLeft = tileRect.left - boardRect.left;

    let top = tileTop;
    let left = tileLeft;
    if (selectedEdge === "top") top = tileTop + tileRect.height + CARD_GAP;
    else if (selectedEdge === "bottom") top = tileTop - CARD_GAP - cardRect.height;
    else if (selectedEdge === "left") left = tileLeft + tileRect.width + CARD_GAP;
    else if (selectedEdge === "right") left = tileLeft - CARD_GAP - cardRect.width;

    const margin = 6;
    const maxLeft = Math.max(margin, boardRect.width - cardRect.width - margin);
    const maxTop = Math.max(margin, boardRect.height - cardRect.height - margin);
    const clampedLeft = Math.min(Math.max(left, margin), maxLeft);
    const clampedTop = Math.min(Math.max(top, margin), maxTop);

    setCardPos((pos) =>
      pos.left === clampedLeft && pos.top === clampedTop ? pos : { left: clampedLeft, top: clampedTop }
    );
  });

  // Re-run the layout pass above on viewport resize too (the board is
  // responsive), not just when the card first opens.
  useEffect(() => {
    if (selectedTileId == null) return;
    const onResize = () => setCardPos((pos) => ({ ...pos }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [selectedTileId]);

  // Detect per-player position/property-count changes across state
  // broadcasts (prev-ref idiom) to drive one-shot animations instead of a
  // continuous state-driven one. A move steps through only its corner
  // waypoints (computeLegWaypoints), not every tile -- each leg is a single
  // CSS transition (see .cv2-token in classicVintage.css, driven by the
  // --glide-ms/--glide-ease custom properties PlayerToken sets per token),
  // so the browser itself performs the interpolation instead of a hand
  // -rolled animation loop. This is deliberately the same "one entry per
  // player, advanced via a timer chain" shape the very first version of
  // this board used (proven reliable across many passes) -- the only
  // change from that baseline is stopping at corners instead of every
  // tile, and holding a constant-elevation float (floatingIds) for the
  // whole multi-leg move instead of a bounce fired once on arrival.
  // If the move came from a dice roll (rollSeq changed in this same
  // update), it waits for the dice's own 1s tumble animation to finish
  // before the token sets off.
  const MS_PER_TILE = 70;
  const LEG_MIN_MS = 220;
  const LEG_MAX_MS = 650;
  const [visualPositions, setVisualPositions] = useState(
    () => new Map(players.map((p) => [p.id, { tileId: p.position, glideMs: 0, glideEase: "ease" }]))
  );
  const [floatingIds, setFloatingIds] = useState(() => new Set());
  // Held briefly right after floatingIds drops a player, so the token
  // transitions smoothly back down to its idle bob baseline instead of
  // snapping -- removing --floating has no transition of its own to ride
  // (its transition rule lives only on the --floating class itself, and the
  // idle bob keyframe animation that resumes after it takes over `transform`
  // outright, so without this in-between state the landing was an instant cut).
  const [landingIds, setLandingIds] = useState(() => new Set());
  const LANDING_MS = 220;
  // Marked the instant a move is detected (before the dice-tumble startDelay
  // even begins) and only cleared once the token has fully landed, so the
  // action buttons can block on this for the whole journey -- not just the
  // floatingIds window -- closing the gap where a premature click (e.g. an
  // early Buy/Decline or End Turn) would fire mid-glide.
  const [movingIds, setMovingIds] = useState(() => new Set());
  const [celebratingIds, setCelebratingIds] = useState(() => new Set());
  // SD's (or a Copy-Catting SE's) token during a Wrecking Tour glide --
  // swapped out for a bus in place of the rider's own icon while it plays.
  // Set explicitly wherever a tour-caused glide is kicked off (both the
  // generic move effect and the full-lap edge case further down), then
  // clears itself the moment that rider actually stops moving, rather than
  // needing a completion callback threaded through stepTokenAlongLegs.
  const [busRidingId, setBusRidingId] = useState(null);
  useEffect(() => {
    if (busRidingId && !movingIds.has(busRidingId)) setBusRidingId(null);
  }, [movingIds, busRidingId]);
  // D's Barricade: cast-moment tile id (drives the slam+dust+dim effects,
  // see the prevBarricadeRef effect further down), whole-board shake flag
  // and the payoff's snapped-token id (both driven from inside the generic
  // move-detection effect below, timed to the token's own glide -- see
  // barricadeJustHappened there) -- all one-shot, self-clearing via their
  // own setTimeout rather than any external "effect ended" signal, same
  // shape as celebratingIds above.
  const [barricadeCastTileId, setBarricadeCastTileId] = useState(null);
  const [boardShaking, setBoardShaking] = useState(false);
  const [barricadeSnapId, setBarricadeSnapId] = useState(null);
  // Standing-indicator persistence: Room.js's applyBarricade nulls
  // this.barricade the instant the stop is computed -- the same broadcast
  // that carries the move itself -- so without this, the wall icon would
  // vanish before the token has even finished walking up to it, and
  // certainly before the stopped player's turn actually ends. Set the
  // moment the stop event arrives (see the barricadeSeq-watching effect
  // below) and held at that tileId until the turn actually advances (the
  // turnIndex effect further down), independent of how long the glide or
  // the payoff animation itself takes.
  const [barricadeLingerTileId, setBarricadeLingerTileId] = useState(null);
  // Z's Curse: cast-moment tendril event (see CurseTendril above, and the
  // curseCastSeq effect further down) and the payoff's draining-token id
  // (see PlayerToken's isCurseDraining) -- both one-shot, self-clearing via
  // their own setTimeout, same shape as Barricade's own cast/payoff state.
  // No linger-until-turn-ends equivalent needed here the way Barricade's
  // standing icon has one -- Curse's standing indicator (the token/sidebar
  // skull badge) reads straight off activeCurses, which Room.js itself only
  // ever clears at the actual "their turn is over" moment (endTurn), not
  // earlier the way barricade nulls immediately on spring.
  const [curseCastEvent, setCurseCastEvent] = useState(null);
  const [curseDrainTargetId, setCurseDrainTargetId] = useState(null);
  // Y's Detonate: unlike Barricade/Curse, cast and payoff aren't separated
  // in time at all (see Room.js's detonateSeq comment) -- one seq bump
  // drives a short local four-phase sequence instead of independent
  // broadcasts (see the detonateSeq effect further down for the full
  // phase breakdown -- alarm, glow, reticle, blast). Each phase gets its
  // own state, cleared by the one that follows it.
  const [detonateAlarm, setDetonateAlarm] = useState(false);
  const [detonateGlowTileId, setDetonateGlowTileId] = useState(null);
  const [detonateReticleTileId, setDetonateReticleTileId] = useState(null);
  const [detonateBlast, setDetonateBlast] = useState(null);
  // Roaming crosshair during the alarm phase (DetonateCrosshairIcon) --
  // `{ tileId, glideMs, glideEase }` while sweeping/locking on, null once
  // the blast phase takes over. A standalone position, not folded into
  // visualPositions (which is keyed per-player) since this icon isn't
  // attached to any player's token.
  const [detonateCrosshairPos, setDetonateCrosshairPos] = useState(null);
  const prevPositionsRef = useRef(new Map(players.map((p) => [p.id, p.position])));
  const prevRollSeqRef = useRef(rollSeq);
  const prevJailSeqRef = useRef(jailSeq);
  const prevPropCountsRef = useRef(new Map(players.map((p) => [p.id, p.properties.length])));
  // A trip to the Holding Pen (landing on the Go-to-Holding tile, or a card
  // that sends the player there) plays as an ordinary walk up to whichever
  // tile actually triggered the jailing (jailFromTileId -- the Go-to-Holding
  // tile itself, or wherever the card was drawn), a short pause so that
  // arrival actually reads before anything else happens, and then a fast
  // teleport hop into the Holding Pen tile itself -- the one stretch of the
  // trip that's never walked tile-by-tile. jailSeq (bumped only by a real
  // sendToHolding) is how the server tells the client which of this
  // broadcast's moves, if any, is that kind.
  const JAIL_TELEPORT_MS = 450;
  const JAIL_PAUSE_MS = 500;

  // Resolves a move into a flat list of ready-to-play legs, each already
  // carrying its own tileId/glideMs/glideEase plus an optional
  // pauseBeforeMs (a beat of held stillness before that leg starts). Every
  // ordinary move is just its corner-to-corner walk, resolved up front
  // instead of computed lazily per leg. A jail-bound move is that same walk
  // (but only as far as jailFromTileId) followed by the teleport leg described
  // above -- pauseBeforeMs on the teleport leg is what actually produces the
  // "arrive, pause, then vanish into the pen" read instead of the walk's own
  // deceleration and the teleport's snap blurring together back to back.
  function buildResolvedLegs({ from, to, isJailTeleport, jailFromDestination, backward }) {
    const resolve = (path) =>
      path.map((leg, i, arr) => ({
        tileId: leg.tileId,
        glideMs: Math.min(LEG_MAX_MS, Math.max(LEG_MIN_MS, leg.tileCount * MS_PER_TILE)),
        glideEase: legEasing(i, arr.length),
        pauseBeforeMs: 0,
      }));

    if (!isJailTeleport) {
      return resolve(computeLegWaypoints(from, to, sideLen, board.length, backward));
    }
    // Falls back to `to` itself (a zero-length walk, straight to the plain
    // teleport) on the off chance jailFromDestination is ever missing --
    // always set alongside isJailTeleport in practice, this is just insurance.
    const walkTarget = jailFromDestination ?? to;
    const walkLegs = resolve(computeLegWaypoints(from, walkTarget, sideLen, board.length));
    const teleportLeg = { tileId: to, glideMs: JAIL_TELEPORT_MS, glideEase: LEG_EASE_IN_OUT, pauseBeforeMs: JAIL_PAUSE_MS };
    return [...walkLegs, teleportLeg];
  }

  // Per-player, not per-effect-run: a move's glide+landing sequence is a
  // chain of setTimeouts that can span 1-3+ seconds, but the move-detection
  // effect below re-runs on EVERY server broadcast to the room -- including
  // ones that have nothing to do with this player (another player buying a
  // house, a reconnect, anything). Effect cleanups only clear timers created
  // during that same run, so if every run stored its timers in one shared
  // per-run array, an unrelated broadcast landing mid-glide would cancel the
  // in-flight chain and orphan that player in movingIds/floatingIds forever
  // (prevPositionsRef was already bumped to the final position at the START
  // of the run that began the glide, so no later run ever sees a "move" for
  // them again to restart it) -- stuck showing "Moving..."/no End Turn
  // button until a refresh reset the component's state from scratch. Keying
  // timers by player id in a ref that survives across renders, and only ever
  // clearing a given id's OWN previous chain right before starting its next
  // one, isolates each player's animation from every other broadcast.
  const glideTimersRef = useRef(new Map());
  useEffect(() => () => {
    for (const list of glideTimersRef.current.values()) list.forEach(clearTimeout);
    glideTimersRef.current.clear();
  }, []);

  // Walks a single token through an already-resolved leg list -- floats it
  // for the duration, glides tileId-by-tileId (each leg's own pauseBeforeMs
  // held first, if any), then settles into a brief landing state before
  // clearing movingIds. Factored out of the generic move-detection effect
  // below so the Wrecking Tour effect (further down) can drive the same
  // glide manually for the one case that effect can't see on its own: SD
  // starting the tour already on tile 6, where position ends up unchanged
  // (a full lap back to itself) and so never registers as a "move".
  // `delayMs` (0 by default) is when the very first leg starts -- lets the
  // generic move effect stagger the glide behind its post-roll pause without
  // that delay itself being vulnerable to the same cross-player cancellation.
  function stepTokenAlongLegs(id, legs, delayMs = 0) {
    const stale = glideTimersRef.current.get(id);
    if (stale) stale.forEach(clearTimeout);
    const myTimers = [];
    glideTimersRef.current.set(id, myTimers);

    const begin = () => {
      setFloatingIds((s) => new Set(s).add(id));
      let i = 0;
      const stepLeg = () => {
        if (i >= legs.length) {
          setFloatingIds((s) => {
            const next = new Set(s); next.delete(id); return next;
          });
          setLandingIds((s) => new Set(s).add(id));
          myTimers.push(setTimeout(() => {
            setLandingIds((s) => {
              const next = new Set(s); next.delete(id); return next;
            });
            setMovingIds((s) => {
              const next = new Set(s); next.delete(id); return next;
            });
            glideTimersRef.current.delete(id);
          }, LANDING_MS));
          return;
        }
        const leg = legs[i];
        const runLeg = () => {
          setVisualPositions((m) => new Map(m).set(id, { tileId: leg.tileId, glideMs: leg.glideMs, glideEase: leg.glideEase }));
          i += 1;
          myTimers.push(setTimeout(stepLeg, leg.glideMs));
        };
        if (leg.pauseBeforeMs) {
          myTimers.push(setTimeout(runLeg, leg.pauseBeforeMs));
        } else {
          runLeg();
        }
      };
      stepLeg();
    };

    if (delayMs) {
      myTimers.push(setTimeout(begin, delayMs));
    } else {
      begin();
    }
  }

  // A "move back N spaces" card's direction only exists on the broadcast
  // where it's sitting in pendingAction, waiting on confirmCardMove --
  // confirmCardMove clears pendingAction in the very same beat it actually
  // applies the move, so by the time the position change shows up in
  // `players` the negative `steps` that says "walk this one backward" is
  // already gone from the *current* state. Read from the PREVIOUS render's
  // pendingAction instead (prevPendingActionRef, captured into a local at
  // the top of the effect below before being overwritten with the current
  // one) -- that's the awaitCardMove broadcast this move is resolving,
  // still intact one render back. Critically, this also means the very
  // first broadcast -- where the roll's own forward move and a fresh
  // awaitCardMove both land together in the same update -- reads the *old*
  // pendingAction from before that card existed, so it doesn't mistake the
  // dice-roll's own move for the (still-pending) card's.
  const prevPendingActionRef = useRef(state.pendingAction);
  // Independent from the Wrecking Tour effect's own prevWreckingTourSeqRef
  // (further down) -- both effects react to the same wreckingTourSeq bump in
  // the same commit, so sharing one ref would let whichever effect runs
  // first silently consume the change before the other ever sees it.
  const prevTourSeqForBusRef = useRef(wreckingTourSeq);
  // D's Barricade payoff: the shake/thud/snap need to land when the token
  // VISUALLY arrives at the barricaded tile, not the instant the broadcast
  // carrying barricadeSeq shows up (which is also the instant the move
  // itself is dispatched -- the token's glide hasn't even started yet at
  // that point). Reading barricadeJustHappened here, inside the same effect
  // that resolves each move's own leg timings below, is what lets the
  // impact be scheduled against that specific move's real glide duration
  // instead of guessing at one separately.
  const prevBarricadeSeqForImpactRef = useRef(barricadeSeq);

  useEffect(() => {
    const prevPositions = prevPositionsRef.current;
    const rollJustHappened = rollSeq !== prevRollSeqRef.current;
    prevRollSeqRef.current = rollSeq;
    const jailJustHappened = jailSeq !== prevJailSeqRef.current;
    prevJailSeqRef.current = jailSeq;
    const tourJustHappened = wreckingTourSeq !== prevTourSeqForBusRef.current;
    prevTourSeqForBusRef.current = wreckingTourSeq;
    const barricadeJustHappened = barricadeSeq !== prevBarricadeSeqForImpactRef.current;
    prevBarricadeSeqForImpactRef.current = barricadeSeq;
    const prevPendingAction = prevPendingActionRef.current;
    prevPendingActionRef.current = state.pendingAction;
    const backwardMoverId =
      prevPendingAction?.type === "awaitCardMove" &&
      prevPendingAction.effect?.type === "move" &&
      prevPendingAction.effect.steps < 0
        ? prevPendingAction.playerId
        : null;

    const moves = [];
    players.forEach((p) => {
      const prev = prevPositions.get(p.id);
      if (prev !== undefined && prev !== p.position) moves.push({ id: p.id, from: prev, to: p.position });
      prevPositions.set(p.id, p.position);
    });

    const prevPropCounts = prevPropCountsRef.current;
    const boughtIds = [];
    players.forEach((p) => {
      const prevCount = prevPropCounts.get(p.id);
      if (prevCount !== undefined && p.properties.length > prevCount) boughtIds.push(p.id);
      prevPropCounts.set(p.id, p.properties.length);
    });

    const timers = [];

    if (moves.length) {
      setMovingIds((s) => new Set([...s, ...moves.map((m) => m.id)]));
      const startDelay = rollJustHappened ? 1000 : 0;
      // Sound-only, so it's fine for this one to still ride the shared
      // per-run `timers` array -- losing a swoosh to an unlucky re-render is
      // harmless, unlike losing a movingIds cleanup.
      timers.push(setTimeout(() => playMoveSwoosh(), startDelay));
      moves.forEach(({ id, from, to }) => {
        const isJailTeleport = jailJustHappened && id === jailedPlayerId;
        const isBackwardCardMove = !isJailTeleport && backwardMoverId === id;
        const legs = buildResolvedLegs({
          from, to, isJailTeleport, jailFromDestination: jailFromTileId, backward: isBackwardCardMove,
        });
        if (tourJustHappened && lastWreckingTour?.casterId === id) setBusRidingId(id);
        // Fires once the glide this same move just kicked off actually
        // finishes -- summing every leg's own glideMs (plus any
        // pauseBeforeMs, though a barricade stop is never a jail teleport
        // so that's always 0 in practice) gives the real wall-clock time
        // the token takes to reach `to`, on top of the shared post-roll
        // startDelay every move already waits out.
        if (barricadeJustHappened && lastBarricadeStop?.playerId === id) {
          const totalGlideMs = legs.reduce((sum, leg) => sum + leg.glideMs + (leg.pauseBeforeMs || 0), 0);
          const impactDelay = startDelay + totalGlideMs;
          timers.push(setTimeout(() => {
            playBarricadeThud();
            setBoardShaking(true);
            setBarricadeSnapId(id);
          }, impactDelay));
          timers.push(setTimeout(() => setBoardShaking(false), impactDelay + 400));
          timers.push(setTimeout(() => setBarricadeSnapId(null), impactDelay + 450));
        }
        stepTokenAlongLegs(id, legs, startDelay);
      });
    }

    if (boughtIds.length) {
      setCelebratingIds((s) => new Set([...s, ...boughtIds]));
      timers.push(setTimeout(() => setCelebratingIds((s) => {
        const next = new Set(s); boughtIds.forEach((id) => next.delete(id)); return next;
      }), 700));
    }
    return () => timers.forEach(clearTimeout);
  }, [players, rollSeq, jailSeq, jailedPlayerId, jailFromTileId, state.pendingAction, board.length, sideLen, trackCenters, wreckingTourSeq, lastWreckingTour, barricadeSeq, lastBarricadeStop]);

  // SD's Wrecking Tour (decisions.md): player.position now genuinely changes
  // to the tour's destination (see conductor.js), so the generic move-
  // detection effect above already animates SD's token gliding there same as
  // any other move -- EXCEPT when SD starts the tour already sitting on tile
  // 6 (the destination): the tour is then a near-full lap all the way back
  // to the same tile, so position ends up unchanged and that effect's
  // prev-vs-current diff never sees a move to animate. Handled below by
  // driving the glide manually for that one case, using the exact path the
  // server already computed (also fixes the demolish-sound timing for the
  // same case -- it used to be derived from a fresh from/to walk that
  // degenerates to zero legs whenever from === to, same root cause).
  const prevWreckingTourSeqRef = useRef(wreckingTourSeq);
  useEffect(() => {
    if (wreckingTourSeq === prevWreckingTourSeqRef.current) return;
    prevWreckingTourSeqRef.current = wreckingTourSeq;
    const tour = lastWreckingTour;
    if (!tour) return;
    const { casterId, startTileId, path, demolished } = tour;
    const destinationTileId = path[path.length - 1];
    const timers = [];
    const legs = groupPathIntoLegs(path, sideLen).map((leg, i, arr) => ({
      ...leg,
      glideMs: Math.min(LEG_MAX_MS, Math.max(LEG_MIN_MS, leg.tileCount * MS_PER_TILE)),
      glideEase: legEasing(i, arr.length),
    }));

    if (startTileId === destinationTileId) {
      setMovingIds((s) => new Set(s).add(casterId));
      setBusRidingId(casterId);
      stepTokenAlongLegs(casterId, legs);
    }

    // Demolished tiles don't line up with leg boundaries (a leg can span
    // several tiles at once), so this estimates each one's arrival time
    // proportionally within its leg -- close enough to play the sound
    // roughly as the bus reaches that tile, without needing tile-by-tile
    // glide steps.
    if (demolished.length) {
      let elapsedMs = 0;
      const arrivalDelayByPathIndex = [];
      legs.forEach((leg) => {
        const perTileMs = leg.glideMs / leg.tileCount;
        for (let t = 0; t < leg.tileCount; t++) {
          elapsedMs += perTileMs;
          arrivalDelayByPathIndex.push(elapsedMs);
        }
      });
      demolished.forEach(({ tileId }) => {
        const pathIndex = path.indexOf(tileId);
        const delay = pathIndex >= 0 ? arrivalDelayByPathIndex[pathIndex] : null;
        if (delay != null) timers.push(setTimeout(() => playSellBuilding(), delay));
      });
    }

    return () => timers.forEach(clearTimeout);
  }, [wreckingTourSeq, lastWreckingTour, board.length, sideLen]);

  // D's Barricade -- cast moment (abilities.md brainstorm table). Unlike
  // Wrecking Tour, Room.js has no dedicated seq field for the cast itself
  // (only barricadeSeq, bumped on the PAYOFF -- see the next effect), so
  // this diffs room.barricade's own identity (tileId+casterId) against the
  // previous render instead of a seq counter. That's enough to tell a
  // genuinely new cast apart from the same barricade re-arriving on an
  // unrelated broadcast (someone else's turn, a reconnect snapshot, etc.),
  // since a fresh cast always changes at least one of those two fields and
  // a stale resend changes neither. Only a single object to track (not a
  // list, unlike Curse's activeCurses), so this simpler diff is enough --
  // wouldn't generalize as-is to a multi-entry ability.
  const prevBarricadeRef = useRef(barricade);
  useEffect(() => {
    const prev = prevBarricadeRef.current;
    prevBarricadeRef.current = barricade;
    if (!barricade) return;
    if (prev && prev.tileId === barricade.tileId && prev.casterId === barricade.casterId) return;
    setBarricadeCastTileId(barricade.tileId);
    const t = setTimeout(() => setBarricadeCastTileId(null), 500);
    return () => clearTimeout(t);
  }, [barricade]);

  // D's Barricade -- payoff moment. The shake/thud/snap themselves are
  // scheduled from inside the generic move-detection effect above
  // (barricadeJustHappened), timed against that specific move's own glide
  // duration -- not here. barricadeSeq/lastBarricadeStop already exist
  // server-side (Room.js's applyBarricade) specifically so every client,
  // not just the one who got stopped, can react -- same seq/lastX
  // broadcast pattern as wreckingTourSeq/lastWreckingTour, just
  // pre-existing rather than new.
  //
  // This effect only owns the standing-indicator's persistence: it flips
  // barricadeLingerTileId on the instant the stop event arrives (not
  // delayed to match the glide -- the icon should never actually vanish,
  // just hold at this tile, so there's no "too early" to guard against the
  // way there is for the shake/thud/snap). Ref starts at the current value
  // (not 0) so restoring an already-sprung barricade from a snapshot on
  // mount doesn't replay this for an event that already happened.
  const prevBarricadeSeqForLingerRef = useRef(barricadeSeq);
  useEffect(() => {
    if (barricadeSeq === prevBarricadeSeqForLingerRef.current) return;
    prevBarricadeSeqForLingerRef.current = barricadeSeq;
    if (lastBarricadeStop) setBarricadeLingerTileId(lastBarricadeStop.tileId);
  }, [barricadeSeq, lastBarricadeStop]);

  // Clears the standing-indicator persistence above once the stopped
  // player's own turn actually ends -- Room.js already nulls
  // this.barricade well before that (the instant the stop is computed), so
  // turnIndex changing is the only remaining signal for "their turn is
  // over now." Not scoped to the specific player who got stopped: by the
  // time turnIndex moves at all, it can only have moved off of them (a
  // barricade-stopped player still finishes out the rest of their own
  // turn like normal), so any turnIndex change is unambiguous here.
  const prevTurnIndexForBarricadeRef = useRef(turnIndex);
  useEffect(() => {
    if (turnIndex === prevTurnIndexForBarricadeRef.current) return;
    prevTurnIndexForBarricadeRef.current = turnIndex;
    setBarricadeLingerTileId(null);
  }, [turnIndex]);

  // Z's Curse -- cast moment. Unlike Barricade, activeCurses is a LIST (Copy
  // Cat can stack an independent second curse), so there's no single object
  // to cheaply diff the way prevBarricadeRef does -- curseCastSeq/
  // lastCurseCast exist specifically to give this an unambiguous "a new one
  // just happened" edge (see Room.js/enforcer.js). The tendril only needs
  // to READ visualPositions at render time (via CurseTendril below), not
  // drive any glide itself, so this effect is much simpler than Barricade's
  // cast handling -- just flip curseCastEvent on, then off after the
  // animation's own duration.
  const prevCurseCastSeqRef = useRef(curseCastSeq);
  useEffect(() => {
    if (curseCastSeq === prevCurseCastSeqRef.current) return;
    prevCurseCastSeqRef.current = curseCastSeq;
    if (!lastCurseCast) return;
    setCurseCastEvent(lastCurseCast);
    const t = setTimeout(() => setCurseCastEvent(null), 700);
    return () => clearTimeout(t);
  }, [curseCastSeq, lastCurseCast]);

  // Z's Curse -- payoff moment. Unlike Barricade's payoff, there's no glide
  // to sync against here -- a redirect can fire from any of a dozen+ money
  // call sites (rent, cards, bank payouts...), not specifically a move, so
  // curseDrainSeq/lastCurseDrain (Room.js's settleEarning) can just be
  // played immediately rather than delayed to match an animation in
  // flight. Ref starts at the current value so restoring a snapshot mid-
  // curse doesn't replay a drain that already happened.
  const prevCurseDrainSeqRef = useRef(curseDrainSeq);
  useEffect(() => {
    if (curseDrainSeq === prevCurseDrainSeqRef.current) return;
    prevCurseDrainSeqRef.current = curseDrainSeq;
    if (!lastCurseDrain) return;
    playCurseDrain();
    setCurseDrainTargetId(lastCurseDrain.targetId);
    const t = setTimeout(() => setCurseDrainTargetId(null), 500);
    return () => clearTimeout(t);
  }, [curseDrainSeq, lastCurseDrain]);

  // Y's Detonate -- cast+payoff, sequenced locally off ONE seq bump (see
  // Room.js's detonateSeq comment -- unlike Barricade/Curse, targeting and
  // resolution happen in the same synchronous server call, so there's no
  // real gap in time to justify two separate broadcast pairs; the server
  // has already fully resolved the ability by the time this broadcast
  // arrives, everything below is purely cosmetic). User's own request --
  // meant to read as a real showpiece, not just a quick flash -- so this
  // is four staged phases instead of the original two:
  //   1. Alarm (ALARM_MS): siren wail + the whole board pulses red, while
  //      a crosshair (DetonateCrosshairIcon) sweeps around the board --
  //      starting from the caster's own tile -- for most of this phase,
  //      then locks onto the real target for the final stretch, arriving
  //      exactly as this phase ends.
  //   2. Glow (GLOW_MS): the target tile itself builds up a hot red glow,
  //      like it's charging.
  //   3. Reticle (RETICLE_MS): an exaggerated targeting-lock snap.
  //   4. Blast (BLAST_MS): the explosion -- burst + crumbling icons +
  //      boardShaking (reused from Barricade, same visual effect, no
  //      reason for a second flag) + the boom sound. The crosshair is
  //      cleared right as this starts -- the burst/reticle take over the
  //      "something's happening here" job from this point on.
  // Every phase's own start is an absolute delay from `now`, not a chain
  // of nested timeouts, so the whole sequence is independently cancelable
  // in one cleanup array (same pattern Barricade's payoff effect uses) --
  // important here specifically since this sequence is much longer than
  // any other ability's, so it's far more likely to still be in flight
  // when an unrelated re-render tears this effect down.
  const prevDetonateSeqRef = useRef(detonateSeq);
  useEffect(() => {
    if (detonateSeq === prevDetonateSeqRef.current) return;
    prevDetonateSeqRef.current = detonateSeq;
    if (!lastDetonate) return;
    const ALARM_MS = 8000;
    const GLOW_MS = 450;
    const RETICLE_MS = 300;
    const BLAST_MS = 750;
    const glowStart = ALARM_MS;
    const reticleStart = glowStart + GLOW_MS;
    const blastStart = reticleStart + RETICLE_MS;

    playSirenAlarm(ALARM_MS / 1000);
    setDetonateAlarm(true);
    const timers = [];

    // Crosshair scan+lock: fast constant-speed hops around the board
    // perimeter (HOP_MS each) for SCAN_MS, then one slower eased-out glide
    // straight to the real target for the remaining LOCK_MS -- the two
    // durations are chosen so they always sum to exactly ALARM_MS,
    // regardless of how many whole hops fit into SCAN_MS (the last
    // partial hop's worth of time just becomes part of the lock-in's own
    // travel time instead of leaving an awkward gap). Starts from the
    // caster's own current tile (reads as "searching outward from Y"),
    // falling back to tile 0 on the off chance their position isn't in
    // visualPositions yet.
    const totalTiles = board.length;
    const HOP_MS = 140;
    const LOCK_MS = 1000;
    const SCAN_MS = ALARM_MS - LOCK_MS;
    const startTileId = visualPositions.get(lastDetonate.casterId)?.tileId ?? 0;
    let scanTileId = startTileId;
    for (let elapsed = 0; elapsed < SCAN_MS; elapsed += HOP_MS) {
      scanTileId = (scanTileId + 1) % totalTiles;
      const tileId = scanTileId;
      timers.push(setTimeout(() => {
        setDetonateCrosshairPos({ tileId, glideMs: HOP_MS, glideEase: "linear" });
      }, elapsed));
    }
    timers.push(setTimeout(() => {
      setDetonateCrosshairPos({ tileId: lastDetonate.tileId, glideMs: LOCK_MS, glideEase: LEG_EASE_OUT });
    }, SCAN_MS));

    timers.push(setTimeout(() => {
      setDetonateAlarm(false);
      setDetonateGlowTileId(lastDetonate.tileId);
    }, glowStart));
    timers.push(setTimeout(() => {
      setDetonateGlowTileId(null);
      setDetonateReticleTileId(lastDetonate.tileId);
    }, reticleStart));
    timers.push(setTimeout(() => {
      setDetonateReticleTileId(null);
      setDetonateBlast(lastDetonate);
      setDetonateCrosshairPos(null);
      playExplosion();
      setBoardShaking(true);
    }, blastStart));
    timers.push(setTimeout(() => setBoardShaking(false), blastStart + 450));
    timers.push(setTimeout(() => setDetonateBlast(null), blastStart + BLAST_MS));
    return () => timers.forEach(clearTimeout);
    // visualPositions is deliberately NOT a dependency, unlike board.length
    // (which is here purely to satisfy the linter -- it never actually
    // changes mid-game, same reasoning the wreckingTourSeq effect's own
    // deps array already includes it for). visualPositions changes on
    // every single player's move, and this effect must only ever run when
    // detonateSeq itself changes -- including visualPositions would
    // restart this entire ~9.5s sequence (cancelling every in-flight timer
    // above) the instant anyone else took a turn while it was still
    // playing. The read at the top (startTileId) intentionally captures
    // whatever visualPositions holds at the moment detonateSeq changes,
    // once, not a value this effect should ever react to changing.
  }, [detonateSeq, lastDetonate, board.length]);

  // Tracks whether the dice's own jump/spin animation (1s, see dice.css
  // `d3-jump`) is still playing for the roll that just happened, so the
  // center action button doesn't swap to "End Turn" out from under the dice
  // mid-tumble -- it waits for the animation to actually finish first.
  const [diceAnimating, setDiceAnimating] = useState(false);
  const lastRollSeqRef = useRef(rollSeq);
  useEffect(() => {
    if (rollSeq === lastRollSeqRef.current) return;
    lastRollSeqRef.current = rollSeq;
    setDiceAnimating(true);
    const t = setTimeout(() => setDiceAnimating(false), 1000);
    return () => clearTimeout(t);
  }, [rollSeq]);

  const gridTemplate = `${RIM_FR}fr repeat(${N - 2}, ${INNER_FR}fr) ${RIM_FR}fr`;

  const currentPlayerId = players[turnIndex]?.id;
  const currentTokenMoving = movingIds.has(currentPlayerId);

  useEffect(() => {
    onTokenMovingChange?.(currentTokenMoving);
  }, [currentTokenMoving, onTokenMovingChange]);

  const selectedTile = selectedTileId != null ? board[selectedTileId] : null;
  const selectedOwned = selectedTileId != null ? ownership[selectedTileId] : null;
  const selectedOwnerPlayer = selectedOwned ? players.find((p) => p.id === selectedOwned.ownerId) : null;
  const selectedHouses = selectedOwned?.houses || 0;
  const selectedMortgaged = !!selectedOwned?.mortgaged;
  const selectedStationsOwned = selectedOwned
    ? board.filter((t) => t.type === "transit" && ownership[t.id]?.ownerId === selectedOwned.ownerId).length
    : 0;
  // Build/sell/mortgage only make sense on a tile the viewing player actually
  // owns -- everyone else (and unowned tiles) just see the read-only card.
  const isMySelectedProperty = !!selectedOwned && selectedOwnerPlayer?.id === myId;

  return (
    <div className="cv2-root" style={{ width: "100%", height: "100%" }}>
      <div
        ref={boardRef}
        className={`cv2-board${boardShaking ? " cv2-board--shake" : ""}${barricadeCastTileId != null ? " cv2-board--barricade-dim" : ""}${curseCastEvent ? " cv2-board--curse-dim" : ""}${detonateAlarm ? " cv2-board--detonate-alarm" : ""}`}
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          gridTemplateRows: gridTemplate,
          height: "100%",
          width: "auto",
          maxWidth: "100%",
          maxHeight: "1400px",
          aspectRatio: "1",
        }}
        onClick={(e) => {
          // A tile's own onClick (below) already manages open/close/switch --
          // this only handles the "clicked somewhere else entirely" case
          // (empty board space, non-property tiles, the center panel).
          if (selectedTileId == null) return;
          if (e.target.closest(".cv2-tile-clickable")) return;
          if (e.target.closest(".cv2-tile-card-wrap")) return;
          closeTile();
        }}
      >
        {board.map((tile) => (
          <ClassicTile
            key={tile.id}
            tile={tile}
            owned={ownership[tile.id]}
            players={players}
            sideLen={sideLen}
            onSelect={handleTileClick}
            isSelected={selectedTileId === tile.id}
            targeting={tileTargeting}
            barricaded={barricade?.tileId === tile.id || barricadeLingerTileId === tile.id}
            barricadeCasting={barricadeCastTileId === tile.id}
            detonateGlow={detonateGlowTileId === tile.id}
            detonateReticle={detonateReticleTileId === tile.id}
            detonateBlast={detonateBlast?.tileId === tile.id ? detonateBlast : null}
          />
        ))}

        {/* Below TokenLayer in source order (and lower z-index, see its own
            CSS) so it reads as passing under/between the tokens rather than
            drawn on top of their faces -- tokens must always render above
            anything tile/effect-related (see cv2-token-layer's own z-index
            comment). */}
        <CurseTendril event={curseCastEvent} sideLen={sideLen} trackCenters={trackCenters} visualPositions={visualPositions} />
        <DetonateCrosshairIcon pos={detonateCrosshairPos} sideLen={sideLen} trackCenters={trackCenters} />

        <TokenLayer
          players={players}
          sideLen={sideLen}
          trackCenters={trackCenters}
          cellPct={cellPct}
          holdingTileId={holdingTileId}
          currentPlayerId={currentPlayerId}
          visualPositions={visualPositions}
          floatingIds={floatingIds}
          landingIds={landingIds}
          celebratingIds={celebratingIds}
          busRidingId={busRidingId}
          barricadeSnapId={barricadeSnapId}
          activeCurses={activeCurses}
          curseDrainTargetId={curseDrainTargetId}
        />

        {selectedTile && (
          <div
            ref={cardRef}
            className="cv2-tile-card-wrap"
            // Below .trade-modal-overlay's z-index: 100 (App.css) on purpose --
            // a trade/auction popup should always sit above this card, not be
            // hidden behind it.
            style={{ position: "absolute", top: cardPos.top, left: cardPos.left, zIndex: 60 }}
          >
            {selectedTile.type === "transit" ? (
              <TransitCardDetail
                tile={selectedTile}
                mortgaged={selectedMortgaged}
                ownedCount={selectedStationsOwned}
                owner={
                  selectedOwnerPlayer && {
                    name: selectedOwnerPlayer.name,
                    color: selectedOwnerPlayer.color,
                    iconImg: selectedOwnerPlayer.icon
                      ? ICONS.find((i) => i.id === selectedOwnerPlayer.icon)?.img
                      : null,
                  }
                }
                onMortgage={() =>
                  emitPropertyAction(selectedTile.id, selectedMortgaged ? "unmortgageProperty" : "mortgageProperty")
                }
                canMortgage={isMySelectedProperty}
                showActions={isMySelectedProperty}
                error={propertyErrors[selectedTile.id]}
              />
            ) : (
              <PropertyCardDetail
                tile={selectedTile}
                houses={selectedHouses}
                mortgaged={selectedMortgaged}
                owner={
                  selectedOwnerPlayer && {
                    name: selectedOwnerPlayer.name,
                    color: selectedOwnerPlayer.color,
                    iconImg: selectedOwnerPlayer.icon
                      ? ICONS.find((i) => i.id === selectedOwnerPlayer.icon)?.img
                      : null,
                  }
                }
                onBuildHouse={() => emitPropertyAction(selectedTile.id, "buyHouse")}
                onSellHouse={() => emitPropertyAction(selectedTile.id, "sellHouse")}
                onMortgage={() =>
                  emitPropertyAction(selectedTile.id, selectedMortgaged ? "unmortgageProperty" : "mortgageProperty")
                }
                canBuildHouse={isMySelectedProperty && !selectedMortgaged && selectedHouses < 5}
                canSellHouse={isMySelectedProperty && selectedHouses > 0}
                canMortgage={isMySelectedProperty && (selectedMortgaged || selectedHouses === 0)}
                showActions={isMySelectedProperty}
                error={propertyErrors[selectedTile.id]}
              />
            )}
          </div>
        )}

        <CardReveal state={state} myId={myId} tokenMoving={tokenMoving} />
        <WastaAttemptReveal state={state} myId={myId} />

        <div className="cv2-center" style={{ gridRow: `2 / ${N}`, gridColumn: `2 / ${N}` }}>
          <div className="cv2-title">Monoboly عرب</div>

          <div className="cv2-dice-zone">
            <Dice roll={lastRoll} rollSeq={rollSeq} />
          </div>

          <div className="cv2-action-zone">
            {(() => {
              const isMyTurn = players[turnIndex]?.id === myId;
              const pending = state.pendingAction;
              const me = players.find((p) => p.id === myId);
              // The token is still gliding to its destination tile -- block
              // every action (including Buy/Decline, which the server marks
              // pending as soon as the destination is known, well before the
              // client-side glide finishes) until it actually lands there.
              // Checks the `tokenMoving` prop too, not just this component's
              // own currentTokenMoving -- that local value comes from
              // movingIds, which only updates via a useEffect one render
              // after a fresh broadcast lands, so on the very first render
              // of a new roll/card-move `pending` is already set but
              // currentTokenMoving hasn't caught up yet. That's exactly what
              // flashed Buy/Decline or Continue on screen for a frame before
              // hiding it again. `tokenMoving` is detected synchronously in
              // App.jsx's raw socket handler (in the same batch as the state
              // update itself), so it's already true on that first render.
              if (isMyTurn && (tokenMoving || currentTokenMoving)) {
                return <p className="cv2-turn-status">Moving…</p>;
              }
              // Buy/Decline takes priority over everything else -- it's the
              // action blocking the turn whenever it's pending.
              if (isMyTurn && pending?.type === "awaitBuy") {
                return (
                  <div className="cv2-action-row">
                    <button className="cv2-roll-btn cv2-decline-btn" onClick={() => socket.emit("declineBuy")}>
                      Decline
                    </button>
                    <button className="cv2-roll-btn" onClick={() => socket.emit("buyProperty")}>
                      Buy
                    </button>
                  </div>
                );
              }
              // A drawn card that moves the player somewhere must be
              // acknowledged before anything else can happen this turn.
              if (isMyTurn && pending?.type === "awaitCardMove") {
                return (
                  <button className="cv2-roll-btn" onClick={() => socket.emit("confirmCardMove")}>
                    Continue
                  </button>
                );
              }
              // Stuck in the Holding Pen at the start of the turn (before
              // rolling): try rolling doubles to escape on the spot, pay the
              // fine, or use a free card instead -- rollDice itself already
              // handles the "rolled doubles" escape server-side, this just
              // exposes it as a choice alongside the other two instead of
              // only ever showing Pay $50.
              if (isMyTurn && !pending && me?.inHolding && !state.lastRoll) {
                return (
                  <div className="cv2-action-row">
                    <button className="cv2-roll-btn" onClick={() => { primeAudio(); socket.emit("rollDice"); }}>
                      Roll Dice
                    </button>
                    {/* Z's permanent drawback (Room.js's payToLeaveHolding,
                        characters.md) -- always rejected server-side, never
                        tied to whether Curse has been cast, so there's
                        nothing this button could ever do for him. Was
                        rendering anyway and silently no-opping on click
                        (the emit has no ack callback to surface an error
                        with) -- hidden rather than shown-and-broken. */}
                    {me.character !== "Z" && (
                      <button className="cv2-roll-btn" onClick={() => socket.emit("payToLeaveHolding")}>
                        Pay $50
                      </button>
                    )}
                    {me.holdingFreeCard && (
                      <button className="cv2-roll-btn cv2-decline-btn" onClick={() => socket.emit("useHoldingFreeCard")}>
                        رن عالواسطة
                      </button>
                    )}
                  </div>
                );
              }
              if (isMyTurn && !pending && state.canRollAgain) {
                return (
                  <button className="cv2-roll-btn" onClick={() => { primeAudio(); socket.emit("rollDice"); }}>
                    Roll Dice
                  </button>
                );
              }
              // Once the roll is used up (no bonus roll earned) and nothing
              // else is blocking the turn, swap this same button to "End
              // Turn" -- but only once the dice animation has actually
              // finished, so the button doesn't change out from under it
              // mid-tumble.
              if (isMyTurn && !pending && !state.canRollAgain && !diceAnimating) {
                return (
                  <button
                    className="cv2-roll-btn"
                    onClick={() => {
                      if (me?.balance < 0) setConfirmingBankruptcy(true);
                      else socket.emit("endTurn");
                    }}
                  >
                    End Turn
                  </button>
                );
              }
              if (!isMyTurn) {
                const current = players[turnIndex];
                return <p className="cv2-turn-status">Waiting for {current?.name}…</p>;
              }
              return null;
            })()}
            {(() => {
              const isMyTurn = players[turnIndex]?.id === myId;
              const pending = state.pendingAction;
              const me = players.find((p) => p.id === myId);
              if (isMyTurn && !pending && me?.balance < 0) {
                return (
                  <p className="cv2-turn-status cv2-debt-warning">
                    You're ${Math.abs(me.balance)} in debt — mortgage or trade before ending your turn.
                  </p>
                );
              }
              return null;
            })()}
            {/* Also re-checks isMyTurn -- the per-turn timer can end this
                turn out from under the player (see Room.startTurnTimer)
                while this is still open; without this it'd linger open for
                a turn that's already someone else's. */}
            {confirmingBankruptcy && players[turnIndex]?.id === myId && (() => {
              const me = players.find((p) => p.id === myId);
              return (
                <ConfirmDialog
                  title="End turn while in debt?"
                  message={`You're $${Math.abs(me?.balance || 0)} in debt. Ending your turn now will declare you bankrupt and release your properties to the bank.`}
                  confirmLabel="End Turn & Go Bankrupt"
                  cancelLabel="Cancel"
                  danger
                  onCancel={() => setConfirmingBankruptcy(false)}
                  onConfirm={() => { setConfirmingBankruptcy(false); socket.emit("endTurn"); }}
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
