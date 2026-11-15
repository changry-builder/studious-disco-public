# ADR-005: Multiplayer without a backend

Status: accepted

## Decision

v1 has two multiplayer modes and no server:

1. **Shared case codes.** A 9-character code rebuilds the identical case on any phone. Players solve separately and compare result cards, optionally by typing each other's result codes into a Compare screen.
2. **Pass-and-play party mode.** One phone, a deck of clue cards dealt round by round, private votes, a scoreboard across cases.

All game logic is pure reducers over lists of plain-JSON actions. The store publishes each action to a `SessionTransport`. v1 ships a transport that does nothing.

## Why

- No accounts, no paid services, works offline: all required by the brief.
- Determinism (ADR-004) makes shared codes free. Phones never exchange case data.
- An action log is the natural unit to sync. Adding live sync later means writing a transport and a lobby screen, not changing rules. See `architecture.md` Section 6.

## What we accept

- No live view of other players' progress in v1.
- Result comparison across phones is manual (look, or type a short code).
- A code only works between phones on the same `GEN_VERSION`. The decoder says so clearly when it does not match.

## Party scoring rule

Points depend on the first round from which a player voted for the killer and never changed away. This rewards early, steady conviction and gives nothing for cycling through names. Formula in `game-design.md` Section 9.2.
