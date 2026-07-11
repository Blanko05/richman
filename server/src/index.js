import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { Room, generateRoomCode } from "./game/Room.js";
import { ICON_IDS, ICON_COLORS } from "./game/icons.js";
import { loadSnapshots, saveSnapshots } from "./persistence.js";

// The 6-character sandbox roster (characters.md) -- one seat per character,
// in a fixed order so the identities array returned to the client always
// lines up with characterId the same way.
const SANDBOX_ROSTER = [
  { characterId: "D", label: "The Don" },
  { characterId: "Z", label: "The Enforcer" },
  { characterId: "Y", label: "The Wrecker" },
  { characterId: "H", label: "The Kingpin" },
  { characterId: "SD", label: "The Conductor" },
  { characterId: "SE", label: "The Fixer" },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));

// If the client has been built (npm run build in client/), serve it directly so
// the whole game is reachable on this one port/origin -- no separate client dev
// server or CORS setup needed, and only one URL to tunnel/share for playtesting.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/health).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  console.log(`Serving built client from ${clientDist}`);
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

/** @type {Map<string, Room>} */
const rooms = new Map();
const socketToRoom = new Map();
const socketToPlayer = new Map();
// playerId -> the socket.id currently representing them. Lets a socket's
// disconnect handler tell whether it's still the player's active connection
// or a stale one already superseded by a rejoin (see the disconnect handler).
const playerToSocket = new Map();

// Restore any rooms that were active when the server last shut down. A bad/missing
// file just means an empty object -- nothing to restore, normal cold start.
for (const snapshot of Object.values(loadSnapshots())) {
  try {
    const room = Room.fromSnapshot(snapshot);
    room.notify = () => broadcastState(room.code);
    rooms.set(room.code, room);
  } catch (err) {
    console.error(`Failed to restore room ${snapshot?.code}:`, err.message);
  }
}
if (rooms.size > 0) {
  console.log(`Restored ${rooms.size} room(s) from disk.`);
}

function persistRooms() {
  const snapshots = {};
  for (const [code, room] of rooms) snapshots[code] = room.toSnapshot();
  saveSnapshots(snapshots);
}

function broadcastState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit("state", room.toState());
  persistRooms();
}

function bindSocket(socket, roomCode, playerId) {
  socket.join(roomCode);
  socketToRoom.set(socket.id, roomCode);
  socketToPlayer.set(socket.id, playerId);
  playerToSocket.set(playerId, socket.id);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, color, rules, mode } = {}, cb) => {
    const playerId = nanoid();
    const token = nanoid();
    const code = generateRoomCode();
    const room = new Room(code, playerId, mode === "characters" ? "characters" : "normal");
    room.notify = () => broadcastState(code);
    room.addPlayer(playerId, token, name, color);
    if (rules) room.updateSettings(playerId, { rules });
    rooms.set(code, room);
    bindSocket(socket, code, playerId);
    cb?.({ ok: true, code, playerId, token });
    broadcastState(code);
  });

  socket.on("joinRoom", ({ code, name, color }, cb) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room) return cb?.({ error: "Room not found" });
    if (room.started) return cb?.({ error: "Game already started" });
    if (room.players.length >= 6) return cb?.({ error: "Room full" });
    const playerId = nanoid();
    const token = nanoid();
    room.addPlayer(playerId, token, name, color);
    bindSocket(socket, room.code, playerId);
    cb?.({ ok: true, code: room.code, playerId, token });
    broadcastState(room.code);
  });

  socket.on("rejoinRoom", ({ code, playerId, token }, cb) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room) return cb?.({ error: "Room not found" });
    if (!room.verifyToken(playerId, token)) return cb?.({ error: "Invalid session" });
    const player = room.playerById(playerId);
    if (player.left || player.bankrupt) return cb?.({ error: "You were removed from this game" });
    bindSocket(socket, room.code, playerId);
    room.cancelGracePeriod(playerId);
    cb?.({ ok: true, code: room.code, playerId, token });
    broadcastState(room.code);
  });

  // Sandbox mode (characters.md/decisions.md): a testing harness, not a real
  // multiplayer flow -- builds a fully-populated, already-started 6-player
  // room (one seat per character) in one shot, bypassing the normal per-
  // player icon/character lobby entirely, and hands the caller every seat's
  // {playerId, token} back so a single browser tab can hop between all 6 via
  // sandboxBecome below. Icons are cycled through the 5 real ids (deliberate
  // one-pair overlap -- there are 6 seats and only 5 icons, and icon has no
  // gameplay effect) rather than adding new content for a test-only tool.
  socket.on("createSandboxRoom", (_payload, cb) => {
    const code = generateRoomCode();
    const hostId = nanoid();
    const room = new Room(code, hostId, "characters");
    room.isSandbox = true;
    room.notify = () => broadcastState(code);
    const identities = SANDBOX_ROSTER.map(({ characterId, label }, i) => {
      const playerId = i === 0 ? hostId : nanoid();
      const token = nanoid();
      room.addPlayer(playerId, token, label);
      const player = room.playerById(playerId);
      const iconId = ICON_IDS[i % ICON_IDS.length];
      player.icon = iconId;
      player.color = ICON_COLORS[iconId];
      room.selectCharacter(playerId, characterId);
      return { playerId, token, characterId };
    });
    room.start(); // bypasses playerStartGame's icon/character completeness gate on purpose
    rooms.set(code, room);
    bindSocket(socket, code, identities[0].playerId);
    cb?.({ ok: true, code, identities });
    broadcastState(code);
  });

  // Rebinds THIS socket to a different seat in the same sandbox room --
  // deliberately not rejoinRoom (which also cancels a grace period and logs
  // "X reconnected", neither of which applies here since every sandbox seat
  // is always "connected").
  socket.on("sandboxBecome", ({ code, playerId, token } = {}, cb) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room) return cb?.({ error: "Room not found" });
    if (!room.verifyToken(playerId, token)) return cb?.({ error: "Invalid session" });
    bindSocket(socket, room.code, playerId);
    cb?.({ ok: true, playerId });
  });

  socket.on("leaveRoom", () => {
    const room = getRoom(socket);
    const playerId = getPlayerId(socket);
    if (!room || !playerId) return;
    if (room.started) {
      room.kickPlayer(playerId, "left the game");
    } else {
      room.removePlayer(playerId);
    }
    socket.leave(room.code);
    socketToRoom.delete(socket.id);
    socketToPlayer.delete(socket.id);
    playerToSocket.delete(playerId);
    cleanupIfDone(room);
  });

  socket.on("startGame", (cb) => {
    const room = getRoom(socket);
    const playerId = getPlayerId(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.playerStartGame(playerId);
    if (result.error) return cb?.(result);
    cb?.({ ok: true });
    broadcastState(room.code);
  });

  socket.on("updateRoomSettings", (payload, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.updateSettings(getPlayerId(socket), payload || {});
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("setColor", ({ color }, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.setPlayerColor(getPlayerId(socket), color);
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("setIcon", ({ iconId }, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.setPlayerIcon(getPlayerId(socket), iconId);
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("selectCharacter", ({ characterId } = {}, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.selectCharacter(getPlayerId(socket), characterId);
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("useAbility", (payload, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.useAbility(getPlayerId(socket), payload || {});
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("rollDice", () => {
    const room = getRoom(socket);
    if (!room) return;
    room.rollDice(getPlayerId(socket));
    broadcastState(room.code);
  });

  // Dev-only: teleports every active player onto one randomly chosen tile so
  // the same-tile token-stacking UI can be checked without playing a real
  // game up to the point where players naturally collide.
  socket.on("debugStackOnRandomTile", (_, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.debugStackOnRandomTile();
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("payToLeaveHolding", () => {
    const room = getRoom(socket);
    if (!room) return;
    room.payToLeaveHolding(getPlayerId(socket));
    broadcastState(room.code);
  });

  socket.on("useHoldingFreeCard", () => {
    const room = getRoom(socket);
    if (!room) return;
    room.useHoldingFreeCard(getPlayerId(socket));
    broadcastState(room.code);
  });

  socket.on("confirmCardMove", () => {
    const room = getRoom(socket);
    if (!room) return;
    room.confirmCardMove(getPlayerId(socket));
    broadcastState(room.code);
  });

  socket.on("buyProperty", () => {
    const room = getRoom(socket);
    if (!room) return;
    room.buyProperty(getPlayerId(socket));
    broadcastState(room.code);
  });

  socket.on("declineBuy", () => {
    const room = getRoom(socket);
    if (!room) return;
    room.declineBuy(getPlayerId(socket));
    broadcastState(room.code);
  });

  // Dev/test only -- see Room.debugGrantGroup. The client only exposes this
  // behind import.meta.env.DEV, but nothing here re-checks that server-side
  // since it's a debug-time build flag, not a security boundary.
  socket.on("debugGrantGroup", ({ group } = {}, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.debugGrantGroup(getPlayerId(socket), group);
    if (result.error) return cb?.(result);
    cb?.({ ok: true });
    broadcastState(room.code);
  });

  // Dev/test only -- see Room.debugDrawCard.
  socket.on("debugDrawCard", ({ deck } = {}, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.debugDrawCard(getPlayerId(socket), deck);
    if (result.error) return cb?.(result);
    cb?.({ ok: true });
    broadcastState(room.code);
  });

  // Dev/test only -- see Room.debugGrantJailCard.
  socket.on("debugGrantJailCard", (cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.debugGrantJailCard(getPlayerId(socket));
    if (result.error) return cb?.(result);
    cb?.({ ok: true });
    broadcastState(room.code);
  });

  socket.on("buyHouse", ({ tileId }, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.buyHouse(getPlayerId(socket), tileId);
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("sellHouse", ({ tileId }, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.sellHouse(getPlayerId(socket), tileId);
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("mortgageProperty", ({ tileId }, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.mortgageProperty(getPlayerId(socket), tileId);
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("unmortgageProperty", ({ tileId }, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.unmortgageProperty(getPlayerId(socket), tileId);
    if (result.ok) broadcastState(room.code);
    cb?.(result);
  });

  socket.on("placeBid", ({ auctionId, amount }) => {
    const room = getRoom(socket);
    if (!room) return;
    room.placeBid(getPlayerId(socket), auctionId, amount);
    broadcastState(room.code);
  });

  socket.on("passAuction", ({ auctionId }) => {
    const room = getRoom(socket);
    if (!room) return;
    room.passAuction(getPlayerId(socket), auctionId);
    broadcastState(room.code);
  });

  socket.on("proposeTrade", (payload, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.proposeTrade(getPlayerId(socket), payload || {});
    broadcastState(room.code);
    cb?.(result);
  });

  socket.on("respondTrade", ({ tradeId, accept }) => {
    const room = getRoom(socket);
    if (!room) return;
    room.respondTrade(getPlayerId(socket), tradeId, !!accept);
    broadcastState(room.code);
  });

  socket.on("counterTrade", ({ tradeId, ...payload }, cb) => {
    const room = getRoom(socket);
    if (!room) return cb?.({ error: "Room not found" });
    const result = room.counterTrade(getPlayerId(socket), tradeId, payload || {});
    broadcastState(room.code);
    cb?.(result);
  });

  socket.on("cancelTrade", ({ tradeId }) => {
    const room = getRoom(socket);
    if (!room) return;
    room.cancelTrade(getPlayerId(socket), tradeId);
    broadcastState(room.code);
  });

  socket.on("endTurn", () => {
    const room = getRoom(socket);
    if (!room) return;
    room.playerEndTurn(getPlayerId(socket));
    broadcastState(room.code);
  });

  socket.on("disconnect", () => {
    const code = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    socketToRoom.delete(socket.id);
    socketToPlayer.delete(socket.id);
    if (!code) return;
    // A silent network drop can leave the server unaware of the old socket's
    // death until socket.io's ping-timeout lapses -- long enough for a page
    // refresh to already land a brand-new socket and rejoin first. If that
    // happened, this "disconnect" belongs to a socket the player has since
    // moved on from, so it must not forfeit the seat they're actively using.
    if (playerToSocket.get(playerId) !== socket.id) return;
    playerToSocket.delete(playerId);
    const room = rooms.get(code);
    if (!room) return;
    if (room.started) {
      // A 20s grace window to reconnect before the seat is forfeited -- see Room.startGracePeriod.
      room.startGracePeriod(playerId);
    } else {
      room.removePlayer(playerId);
    }
    cleanupIfDone(room);
  });
});

function getRoom(socket) {
  const code = socketToRoom.get(socket.id);
  return code ? rooms.get(code) : null;
}

function getPlayerId(socket) {
  return socketToPlayer.get(socket.id);
}

// Drops the room from memory once nobody is left to play (lobby emptied out,
// or every player has been kicked/left/gone bankrupt mid-game).
function cleanupIfDone(room) {
  const allDone = room.players.length === 0 || room.players.every((p) => p.bankrupt || p.left);
  if (allDone) {
    room.clearTurnTimer();
    room.clearAllAuctionTimers();
    rooms.delete(room.code);
    persistRooms();
  } else {
    broadcastState(room.code);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Arab Monopoly server listening on port ${PORT}`);
});

// Every state-changing event already persists synchronously via broadcastState,
// so there's no real "unsaved changes" window -- this is just an explicit final
// flush before exiting on a clean shutdown (e.g. a deploy restart).
function shutdown() {
  persistRooms();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
