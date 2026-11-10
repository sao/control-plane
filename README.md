# Control Plane

A browser game that teaches how to design data-intensive applications when most of your database users are AI agents.

You are the on-call engineer for a database platform. Agents send requests through a gateway to your databases. Good requests earn credits. Wrong ones damage your data. You buy and configure tools to stop them, and every tool has the cost the theory says it has.

The game follows the guide *Designing Data-Intensive Applications, Evolved for the Agent Era*, which is based on Martin Kleppmann's book *Designing Data-Intensive Applications*. Each of the 11 missions covers one section: the book's concept, what agents change, and how it looks in Postgres and Supabase.

## Play

No install and no build step.

**Option 1: open the file.** Download or clone this repository and open `index.html` in a browser.

**Option 2: run a local server.** From the repository folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

**Option 3: GitHub Pages.** In the repository settings, under Pages, deploy from the `main` branch root. The game runs from the published address.

The game needs a window at least 1,000 pixels wide and a recent version of Chrome, Edge, Firefox, or Safari.

## How it plays

- **Integrity** is how correct your data is. Threats that land reduce it. At zero the mission ends.
- **Error budget** drains while p99 latency is over target and each time you refuse a legitimate request. At zero the mission ends.
- **Credits** come from served requests and buy tools.
- **Tools** sit on the gateway, the database, or the infrastructure. Each one states its cost. Buying everything loses.
- **Review cards** ask you to judge a migration, a branch diff, or a consequential action.
- **The event log** explains what each tool stopped and what each incident was, with the section of the guide it comes from.

| Key | Action |
|---|---|
| Space | Start the next wave, or pause |
| 1, 2, 3 | Game speed |
| R | Rewind (point-in-time recovery) |
| F | Promote a follower when the leader is down |
| Esc | Menu |

You can buy tools and answer review cards while paused.

## Campaign

| Mission | Section of the guide | What you learn to handle |
|---|---|---|
| 1. First Night On Call | Reliability, scalability, maintainability | The agent as a fourth source of faults: limit, sandbox, undo |
| 2. The Schema Is A Prompt | Data models and query languages | Constraints, legible schemas, embeddings |
| 3. Pay On Write, Gain On Read | Storage and retrieval | Index trade-offs, approximate vector indexes, columnar copies |
| 4. Old Code, New Data | Encoding and schema evolution | Compatibility, migration review at machine speed, branch-first |
| 5. Time Moves Backward | Replication | Lag, stale reads that become wrong actions, failover |
| 6. A Database For Everyone | Partitioning | Range and hash partitioning, hot spots, database-per-agent |
| 7. Succeeding At The Wrong Thing | Transactions | Branches as agent-sized transactions, write skew |
| 8. Did It Work? | The trouble with distributed systems | Idempotency, paused agents, prompt injection |
| 9. Who Decides | Consistency and consensus | Locks, expiring authority, approval timeouts, audit logs |
| 10. Everything Is Derived | Derived data | Stale embeddings, change data capture, event-sourced memory |
| 11. The Majority User | What the book could not anticipate | All of it, on a budget |

Endless mode unlocks after mission 6.

## Progression

- Up to 3 stars and a challenge medal per mission.
- A three-question incident review after each win.
- Experience points and 8 ranks.
- Permanent upgrades bought with stars.
- 16 achievements.
- A codex that fills in as you play: chapters, threats, tools, the six principles, and the guide's cheat sheet.

## Your progress

Progress is saved in your browser's local storage. Nothing is sent anywhere. Settings has export, import, and erase. Progress is tied to the address you play from, so a save made from `index.html` opened as a file is separate from one made on `localhost`.

## Development

There are no dependencies. The code is plain JavaScript loaded with script tags, so it also works when opened as a file.

| Path | Purpose |
|---|---|
| `js/core.js` | Namespace, seeded random numbers, helpers |
| `js/data.js` | Request kinds, threats, tools, abilities, review cards |
| `js/missions.js` | The 11 missions and the endless-mode generator |
| `js/meta.js` | Ranks, upgrades, achievements, cheat sheet |
| `js/sim.js` | The simulation. No DOM, deterministic for a given seed |
| `js/save.js` | Local storage, export, import |
| `js/audio.js` | Synthesised sound effects and music |
| `js/render.js` | Canvas renderer |
| `js/ui.js` | Screens and heads-up display |
| `js/main.js` | Game loop, input, rewards |
| `test/balance.js` | Headless balance check |
| `docs/spec.md` | Design spec |

The balance check plays every mission headlessly on several seeds. With no tools a mission must not earn more than 1 star, and with the recommended tools it must earn 3. It needs Node 18 or later:

```bash
node test/balance.js
```

To change difficulty, edit the wave definitions in `js/missions.js` and the tool numbers in `js/data.js`, then run the check.

## Credits

Concepts follow *Designing Data-Intensive Applications* by Martin Kleppmann (first edition 2017, second edition with Chris Riccomini 2026). This project is not affiliated with the authors, the publisher, Postgres, or Supabase. All graphics and sound are generated in code.

## Licence

MIT. See `LICENSE`.
