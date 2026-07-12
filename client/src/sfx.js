// Shared sound-effect module. Owns a single lazily-created AudioContext so
// all game sounds share one mute flag and one context.
const KEY = "richman-sound-enabled";

let ctx = null;
// Default ON -- gameplay is expected to have sound, and the browser's autoplay
// policy only blocks audio before the first user gesture.
let enabled = localStorage.getItem(KEY) !== "false";

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(v) {
  enabled = v;
  localStorage.setItem(KEY, String(v));
}

// Call from a real user gesture (click) to create/resume the shared context.
// Also kicks off preloadAllClips() the first time ctx actually gets created
// -- without this, every clip stayed fully lazy (see loadClipBuffer below),
// so whichever sound happened to be a player's FIRST time hearing it (often
// an ability payoff a dozen turns in, not one of the early/frequent sounds
// like the dice throw) paid its own fetch+decode latency right at the
// moment it was supposed to play, instead of that cost being paid once, in
// the background, right after this same click already created the context.
export function primeAudio() {
  const isFirstPrime = !ctx;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (isFirstPrime) preloadAllClips();
  return ctx;
}

export function getAudioContext() {
  return ctx;
}

function safeCtx() {
  if (!enabled || !ctx || ctx.state !== "running") return null;
  return ctx;
}

// Every src passed to makeClipPlayer registers itself here so
// preloadAllClips can walk the full set without a separate hand-maintained
// list that could drift out of sync with the exports below.
const registeredClipSrcs = [];

const clipBufferCache = new Map();
function loadClipBuffer(c, src) {
  if (clipBufferCache.has(src)) return clipBufferCache.get(src);
  const promise = fetch(src)
    .then((res) => res.arrayBuffer())
    .then((data) => c.decodeAudioData(data));
  clipBufferCache.set(src, promise);
  return promise;
}

// Fires off every registered clip's fetch+decode in parallel against the
// now-created context, populating clipBufferCache ahead of time -- a clip's
// own player function (makeClipPlayer's returned closure) still awaits the
// same cached promise, so nothing changes about how/when a sound actually
// plays, only how early its decode work started.
function preloadAllClips() {
  const c = ctx;
  if (!c) return;
  registeredClipSrcs.forEach((src) => loadClipBuffer(c, src).catch(() => {}));
}

function makeClipPlayer(src, volume = 1) {
  registeredClipSrcs.push(src);
  return () => {
    const c = safeCtx();
    if (!c) return;
    loadClipBuffer(c, src).then((buffer) => {
      const node = c.createBufferSource();
      node.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = volume * 0.7;
      node.connect(gain);
      gain.connect(c.destination);
      node.start();
    }).catch(() => {});
  };
}

export const playDiceThrow      = makeClipPlayer("/sounds/dice_throw.mp3", 0.8);
export const playDoubleDice     = makeClipPlayer("/sounds/doubleDice.mp3", 0.8);
export const playThirdDouble    = makeClipPlayer("/sounds/thirdDouble.mp3");
export const playGoToPrison     = makeClipPlayer("/sounds/when_player_goes_to_priosn.mp3");
export const playMoneyGained    = makeClipPlayer("/sounds/money_gained.mp3");
export const playMoneyLost      = makeClipPlayer("/sounds/money_lost.mp3");
export const playAuctionStart   = makeClipPlayer("/sounds/auction_start.mp3");
export const playWin            = makeClipPlayer("/sounds/win.mp3");
export const playBuild          = makeClipPlayer("/sounds/build_house_hotel.mp3");
export const playSellBuilding   = makeClipPlayer("/sounds/build_sell.mp3");
export const playMortgage       = makeClipPlayer("/sounds/mortgaged.mp3");
export const playCardPull       = makeClipPlayer("/sounds/card-pull.mp3");
export const playGameStart      = makeClipPlayer("/sounds/gameStart.mp3");
export const playError          = makeClipPlayer("/sounds/error.mp3");

export const playTradePopup     = makeClipPlayer("/sounds/trade_offer.mp3");
export const playTradeAccepted  = makeClipPlayer("/sounds/trade_accepted.mp3");
export const playTradeDeclined  = makeClipPlayer("/sounds/trade_declined.mp3");
export const playBoughtTile     = makeClipPlayer("/sounds/money_lost.mp3");     // ponytail: old buy sound removed; reuse loss chime (purchase = cash out)

// D's Barricade payoff -- a player actually stopped short by the wall
// (barricadeSeq/lastBarricadeStop, see Room.js). Not gated by any log-string
// match like most of the sounds above -- see BoardClassic.jsx's dedicated
// barricadeSeq effect.
export const playBarricadeThud  = makeClipPlayer("/sounds/thud.mp3", 0.9);

// Y's Detonate payoff -- the explosion itself (detonateSeq/lastDetonate,
// see Room.js/wrecker.js). User's call to supply a recorded clip rather
// than synthesize this one -- a satisfying boom wants noise texture a
// simple oscillator can't cheaply fake, unlike Curse's tone-based drain.
export const playExplosion      = makeClipPlayer("/sounds/boom.mp3", 1);

// H's Hostile Takeover cast+payoff -- the seizure sting the instant a tile
// flips (hostileTakeoverSeq/lastHostileTakeover, see Room.js/kingpin.js).
// User's call to supply a recorded clip, same reasoning as Detonate's boom.
export const playHostileTakeover = makeClipPlayer("/sounds/takeover.mp3", 0.9);

// SD's Wrecking Tour departure -- the bus revving up during the pre-glide
// pause (wreckingTourSeq/lastWreckingTour, see BoardClassic.jsx's dedicated
// effect), replacing the plain move-swoosh every other move uses. Also
// closes out the "punchier departure sound" item from abilities.md's
// brainstorm table.
export const playMotor           = makeClipPlayer("/sounds/motor.mp3", 0.9);

// Y's Detonate cast -- the alarm-siren wail that opens the whole sequence,
// before the reticle/blast even start (user's idea, meant to make Detonate
// read as a real showpiece). siren.mp3 is a long air-raid-style loop
// (~15s) -- BoardClassic.jsx's detonateSeq effect only wants the first 8s
// of it (ALARM_MS there), not the whole clip, so this schedules an
// explicit stop (with a short fade-out to avoid an audible hard cut)
// instead of using makeClipPlayer's plain node.start()-and-let-it-finish.
// Registered into registeredClipSrcs directly (below) rather than via
// makeClipPlayer, since this needs its own custom stop/fade logic
// makeClipPlayer's returned closure doesn't support.
registeredClipSrcs.push("/sounds/siren.mp3");
export function playSirenAlarm(durationSec = 8) {
  const c = safeCtx();
  if (!c) return;
  loadClipBuffer(c, "/sounds/siren.mp3").then((buffer) => {
    const node = c.createBufferSource();
    node.buffer = buffer;
    const gain = c.createGain();
    const t0 = c.currentTime;
    gain.gain.setValueAtTime(0.7, t0);
    gain.gain.setValueAtTime(0.7, t0 + durationSec - 0.15);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + durationSec);
    node.connect(gain);
    gain.connect(c.destination);
    node.start(t0);
    node.stop(t0 + durationSec);
  }).catch(() => {});
}

// Z's Curse payoff -- a redirect actually firing (curseDrainSeq/
// lastCurseDrain, see Room.js's settleEarning). Synthesized rather than a
// clip (user's call) -- a hollow, descending two-tone "siphon" rather than
// playMoveSwoosh's single smooth sweep, so the two read as distinct events
// even though both are short pitch-descending tones.
export function playCurseDrain() {
  const c = safeCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(0.16, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  gain.connect(c.destination);

  // Two overlapping detuned oscillators (a plain sawtooth + a fifth below)
  // both sweeping downward -- reads as a "life being pulled out" siphon
  // rather than a single clean tone, without needing a recorded clip.
  [1, 0.667].forEach((ratio, i) => {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    const start = 380 * ratio;
    const end = 90 * ratio;
    osc.frequency.setValueAtTime(start, t0);
    osc.frequency.exponentialRampToValueAtTime(end, t0 + 0.4);
    const oscGain = c.createGain();
    oscGain.gain.value = i === 0 ? 1 : 0.5;
    osc.connect(oscGain);
    oscGain.connect(gain);
    osc.start(t0);
    osc.stop(t0 + 0.42);
  });
}

// Token movement swoosh (synthesized, per-step).
export function playMoveSwoosh() {
  const c = safeCtx();
  if (!c) return;
  const dur = 0.18 + Math.random() * 0.08;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(140, t0 + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
