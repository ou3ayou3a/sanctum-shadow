# Sanctum & Shadow

A browser-based D&D-inspired narrative RPG with deterministic offline story resolution and host-authoritative multiplayer for 2–8 players.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
npm start
```

Open `http://localhost:3000`.

## Verification

```sh
npm run check
```

This runs the rules, quest, migration, multiplayer, persistence, security, and UI preference tests plus syntax checks for the live server and critical browser modules.

## Configuration

- `PORT`: HTTP port. Defaults to `3000`.
- `ALLOWED_ORIGINS`: comma-separated public origins permitted to use Socket.IO. Localhost and private LAN addresses are allowed automatically.
- `ANTHROPIC_API_KEY`: optional online NPC narration. Deterministic offline narration remains available without it.
- `DEBUG_KEY`: enables the protected `/debug?key=...` endpoint.

`GET /health` returns a non-sensitive runtime health response suitable for container or platform health checks.

## Persistence

Multiplayer sessions are written to `sessions.json` using an atomic temporary-file replacement. Snapshots are versioned, legacy snapshots migrate on read, and inactive sessions expire after 24 hours.

For hosted deployments, attach persistent storage if campaigns must survive container replacement. Local saves remain in the browser.
