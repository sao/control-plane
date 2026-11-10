# Control Plane: design spec

A browser game that teaches *Designing Data-Intensive Applications, Evolved for the Agent Era* by having the player operate a database platform under agent traffic.

## Goals

- Teach each of the guide's 11 sections by doing: the book's concept, what agents change, and the Postgres/Supabase practice.
- Make the player reason about trade-offs. Every defence has the cost the guide describes.
- Short, medium, and long reward loops. Progress saved locally.
- No build step and no dependencies. Runs by opening `index.html`, and from GitHub Pages.

## Core loop

The player is the on-call engineer. Agents send requests from the left, through a gateway, to database nodes. Legitimate requests earn credits. Threats damage data.

Three meters:

- **Integrity**: data correctness. Zero ends the mission.
- **Error budget**: drains while p99 latency is over target, and when legitimate requests are refused. Zero ends the mission.
- **Credits**: earned per served request, spent on tools.

Player verbs:

- Buy and toggle tools on the gateway, the database, or the infrastructure.
- Fire abilities with cooldowns: rewind (point-in-time recovery), failover.
- Answer review cards: migrations, branch diffs, consequential actions.

The game runs in real time with pause. A feed explains each block and each incident and names the section it comes from. The first time a new threat lands, the game pauses and explains it.

## Campaign

| Mission | Section | Threats | Tools |
|---|---|---|---|
| 1 | Reliability, scalability, maintainability | Destructive changes, out-of-scope access | Read-only mode, project scoping, branch, rewind |
| 2 | Data models | Malformed writes, misread schema | Constraints, legible schema, pgvector; trap: loose jsonb intake |
| 3 | Storage | Load only | Hot index, HNSW, columnar copy; trap: index everything |
| 4 | Schema evolution | Breaking migrations | Human review, compatibility lint, branch-first |
| 5 | Replication | Stale reads, leader loss | Replicas, sync replication, read-your-writes, Realtime, failover |
| 6 | Partitioning | Overload, hot keys, scratch mistakes | Range, hash, database-per-agent, scale-to-zero |
| 7 | Transactions | Bad tasks, write skew | Task branches, serializable, constraints, rewind; trap: long transactions |
| 8 | Distributed faults | Duplicates, stale writes, injection | Idempotency keys, version check, row-level security, approval |
| 9 | Consensus | Double claims, zombie commits, rogue agent | Row locks, expiring authority, approval timeout, risk tiers, audit log, auto-failover |
| 10 | Derived data | Stale embeddings | Batch re-embed, change data capture, event-sourced memory, immutable source |
| 11 | The six principles | Everything | Everything, on a tight budget |

An endless mode unlocks after mission 6.

## Rewards

- Per request: clean-serve streak, sound, visual feedback.
- Per mission: up to 3 stars, experience points, a challenge medal, a three-question incident review, codex entries.
- Long term: ranks, permanent upgrades bought with stars, achievements, endless-mode best.

## Architecture

| File | Purpose |
|---|---|
| `js/core.js` | Namespace, seeded random numbers, helpers |
| `js/data.js` | Request kinds, threats, tools, abilities, review cards |
| `js/missions.js` | The 11 missions and the endless generator |
| `js/meta.js` | Ranks, upgrades, achievements, principles, cheat sheet |
| `js/sim.js` | Simulation. No DOM, deterministic for a given seed |
| `js/save.js` | Local storage, export, import, reset |
| `js/audio.js` | Synthesised sound effects and ambient music |
| `js/render.js` | Canvas renderer |
| `js/ui.js` | Screens and heads-up display |
| `js/main.js` | Game loop and wiring |
| `test/balance.js` | Headless balance checks run with Node |

The simulation is separate from rendering so balance can be checked headlessly: with no tools a mission must not earn more than 1 star, and the recommended tools must earn 3.
