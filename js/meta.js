(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});

  CP.RANKS = [
    { xp: 0, name: 'Intern On Call' },
    { xp: 200, name: 'Junior Operator' },
    { xp: 500, name: 'Database Reliability Engineer' },
    { xp: 900, name: 'Senior Reliability Engineer' },
    { xp: 1400, name: 'Staff Engineer' },
    { xp: 2000, name: 'Principal Engineer' },
    { xp: 2700, name: 'Distinguished Engineer' },
    { xp: 3500, name: 'Keeper Of The Log' },
  ];
  CP.rankFor = function (xp) {
    let i = 0;
    while (i + 1 < CP.RANKS.length && xp >= CP.RANKS[i + 1].xp) i++;
    const cur = CP.RANKS[i], next = CP.RANKS[i + 1] || null;
    return { index: i, name: cur.name, next, frac: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
  };

  // Permanent upgrades, bought with stars.
  CP.UPGRADES = [
    { id: 'seed', name: 'Seed funding', cost: [2, 3], desc: '+40 starting credits per level.' },
    { id: 'restore', name: 'Faster restores', cost: [2], desc: 'Rewind cools down 30% faster.' },
    { id: 'calm', name: 'Calm reviewer', cost: [2], desc: 'Review cards wait 40% longer before they time out.' },
    { id: 'income', name: 'Usage pricing', cost: [3], desc: '+15% credits from served requests.' },
    { id: 'discount', name: 'Committed spend', cost: [3], desc: 'Tools cost 15% less.' },
    { id: 'regen', name: 'Error budget policy', cost: [3], desc: 'Error budget slowly refills while p99 is inside the target.' },
    { id: 'box', name: 'Bigger instance', cost: [4], desc: 'The leader serves one more request at a time.' },
    { id: 'repair', name: 'Repair jobs', cost: [4], desc: 'Integrity slowly recovers during a wave.' },
  ];

  CP.ACHIEVEMENTS = [
    { id: 'first', name: 'First shift', desc: 'Complete a mission.' },
    { id: 'blameless', name: 'Blameless', desc: 'Finish a mission with 100 integrity.' },
    { id: 'fivenines', name: 'Five nines', desc: 'Finish a mission with 95 or more error budget.' },
    { id: 'undo', name: 'Undo of last resort', desc: 'Restore 20 or more integrity with one Rewind.' },
    { id: 'streak100', name: 'Clean run', desc: 'Serve 100 requests in a row with no incident and no refusal.' },
    { id: 'reviewer', name: 'Careful reviewer', desc: 'Answer 10 review cards correctly in a row.' },
    { id: 'frugal', name: 'Frugal', desc: 'Earn 3 stars on any mission after the first while owning at most 2 tools.' },
    { id: 'notrap', name: 'No shortcuts', desc: 'Win missions 2, 3, and 7 without switching on their trap tool.' },
    { id: 'medal5', name: 'Challenger', desc: 'Earn 5 challenge medals.' },
    { id: 'scholar', name: 'Scholar', desc: 'Answer every incident-review question correctly.' },
    { id: 'halfway', name: 'Distributed', desc: 'Complete mission 6.' },
    { id: 'campaign', name: 'The majority user', desc: 'Complete the campaign.' },
    { id: 'stars20', name: 'Well architected', desc: 'Earn 20 stars.' },
    { id: 'perfect', name: 'Keeper of the log', desc: 'Earn all 33 stars.' },
    { id: 'endless5', name: 'In production', desc: 'Survive 5 waves of endless mode.' },
    { id: 'endless10', name: 'On call forever', desc: 'Survive 10 waves of endless mode.' },
  ];

  // The guide's cheat sheet. Each row unlocks with a mission.
  CP.CHEATS = [
    { m: 'm1', concept: 'Reliability', book: 'Tolerate faults from hardware, software, and people', agents: 'The agent is a fourth fault source; limit, sandbox, undo', pg: 'Read-only roles, one role per project, branches' },
    { m: 'm1', concept: 'Maintainability', book: 'Operable, simple, evolvable for people', agents: 'Schema must be legible to models too', pg: 'Names, comments, constraints as instructions' },
    { m: 'm2', concept: 'Data models', book: 'Relational, document, graph; pick by relationships', agents: 'SQL is what models write well; embeddings are a fourth shape', pg: 'Tables, jsonb, pgvector in one engine' },
    { m: 'm3', concept: 'Storage engines', book: 'Indexes trade write cost for read speed', agents: 'Approximate vector indexes; object storage; copy-on-write', pg: 'B-tree, write-ahead log, HNSW' },
    { m: 'm4', concept: 'Schema evolution', book: 'Old and new code must coexist', agents: 'Constant unreviewed migrations; tool definitions are schemas', pg: 'Migrations applied to a branch first' },
    { m: 'm5', concept: 'Replication', book: 'Copies for safety and reads; lag causes anomalies', agents: 'Stale reads become wrong actions; context is a stale replica', pg: 'Read replicas, logical replication, change feeds' },
    { m: 'm6', concept: 'Partitioning', book: 'Split by key; avoid until necessary', agents: 'Database per agent partitions by actor', pg: 'Native partitioning, Citus for sharding, per-agent databases' },
    { m: 'm6', concept: 'Scalability', book: 'Describe load, measure percentiles, plan growth', agents: 'Number of databases and start-up speed become load', pg: 'Scale-to-zero, serverless Postgres for many small databases' },
    { m: 'm7', concept: 'Transactions', book: 'ACID; know your isolation level', agents: 'Tasks outgrow transactions; branch is the new unit', pg: 'Serializable mode, branching, point-in-time recovery' },
    { m: 'm8', concept: 'Distributed faults', book: 'Timeouts are ambiguous; use idempotence and fencing', agents: 'Constant retries; agent as paused process; prompt injection', pg: 'ON CONFLICT, row-level security' },
    { m: 'm9', concept: 'Consensus', book: 'Agree on one order of events by majority', agents: 'Database as shared ground; ordered log as audit trail', pg: 'Row locks, advisory locks, failover' },
    { m: 'm10', concept: 'Derived data', book: 'One source of truth, many rebuildable views', agents: 'Embeddings, context, and memory are derived views', pg: 'Change capture from the log into pgvector' },
  ];

  CP.PRINCIPLES = [
    { name: 'Design for an untrusted majority user', text: 'The book\'s security model trusts the application and guards the perimeter. When most sessions belong to agents, enforcement has to sit inside the database, on every query.' },
    { name: 'Make undo larger than the transaction', text: 'Agents fail by succeeding at the wrong thing. The useful units of undo are the branch before commit and point-in-time recovery after.' },
    { name: 'Count databases, not just rows', text: 'Scalability now includes how many databases exist and how fast one starts from nothing. Scale-to-zero and instant creation are capacity features.' },
    { name: 'Treat legibility as correctness', text: 'A model acts on names, comments, error messages, and tool descriptions. Text the book would call documentation now changes system behavior.' },
    { name: 'Keep one deterministic source of truth', text: 'Models are non-deterministic and their outputs are derived data. Facts, decisions, and history live in the database as an ordered log.' },
    { name: 'Attribute every action', text: 'Who changed this, on whose behalf, and with what instruction must be answerable from the data. Identity for agents is a data model question.' },
  ];
})();
