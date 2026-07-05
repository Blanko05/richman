# Sounds Added

Sound effects wired up in `client/src/sfx.js` (files served from
`client/public/sounds/`). Every one of these is gated by the existing sound
on/off toggle (Lobby's mute button) and plays through the shared
`AudioContext`, so it's audible to every player in the room at the same time
-- not just whoever triggered the action.

| File | Plays when | Triggered from |
| --- | --- | --- |
| `dice_throw.mp3` | The dice are rolled | `rollSeq` change, watched in `client/src/components/Dice.jsx` |
| `doubleDice.mp3` | A player rolls doubles | Game log line ("rolled doubles"), watched in `client/src/App.jsx` |
| `thirdDouble.mp3` | A player rolls doubles a third time in a row | Game log line ("three doubles"), watched in `client/src/App.jsx` |
| `when_player_goes_to_priosn.mp3` | A player is sent to the Holding Pen | Game log line ("went to" + "Holding Pen"), watched in `client/src/App.jsx` |
| `money_gained.mp3` | Any player's balance goes up | Balance diff across state updates, watched in `client/src/App.jsx` |
| `money_lost.mp3` | Any player's balance goes down (also reused for buying a tile -- see below) | Balance diff across state updates, watched in `client/src/App.jsx` |
| `auction_start.mp3` | An auction starts | Game log line ("auction"), watched in `client/src/App.jsx` |
| `win.mp3` | The game ends with a winner | `state.winnerId` transitioning from unset to set, watched in `client/src/App.jsx` |
| `build_house_hotel.mp3` | A house/hotel is built | Game log line ("built"), watched in `client/src/App.jsx` |
| `build_sell.mp3` | A house/hotel is sold | Game log line ("sold"), watched in `client/src/App.jsx` |
| `mortgaged.mp3` | A tile is mortgaged or unmortgaged | Game log line ("mortgaged" / "unmortgaged"), watched in `client/src/App.jsx` |
| `card-pull.mp3` | A Surprise/Treasure card is drawn | Game log line ("drew a" / "draws a"), watched in `client/src/App.jsx` |
| `gameStart.mp3` | The game starts | `state.started` transitioning from false to true, watched in `client/src/App.jsx` |
| `error.mp3` | An action fails for insufficient funds | Game log line ("not enough"), watched in `client/src/App.jsx` |
| `trade_offer.mp3` | A new trade offer is proposed | `state.trades` diff, watched in `client/src/App.jsx` |
| `trade_accepted.mp3` | A trade is accepted | Game log line ("completed a trade."), watched in `client/src/App.jsx` |
| `trade_declined.mp3` | A trade is declined | Game log line ("declined ...trade offer."), watched in `client/src/App.jsx` |
| *(synthesized, no file)* | A token takes a movement step | `playMoveSwoosh()` in `sfx.js`, called per-move from `client/src/components/BoardClassic.jsx` |

Notes:
- The log-line sounds in `App.jsx` are an if/else-if chain checked against the
  newest `state.log` entry, so only one of them fires per new log line (e.g. a
  "bought" line can't also fire the auction sound).
- `playBoughtTile` (fired on a " bought " log line) doesn't have its own file
  -- it currently reuses `money_lost.mp3`, since buying a tile is a cash
  outflow like any other loss.
- Balance-gain/loss sounds and the log-line sounds are independent checks, not
  mutually exclusive with each other -- both can fire off the same state
  update.
- Removed: the old file-per-sound set (`whoosh.mp3`, `Tradin2.mp3`,
  `TradeAccepted.mp3`, `DeclineTrade.mp3`, `Bought_tile.mp3`) and the
  synthesized dice-roll "rattle" this doc used to describe -- all superseded
  by the set above.
