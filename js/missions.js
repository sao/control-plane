(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});

  // Node positions are fractions of the play field.
  const N = {
    src: { id: 'src', type: 'src', x: 0.07, y: 0.5, label: 'Agents', base: true },
    gw: { id: 'gw', type: 'gw', x: 0.3, y: 0.5, label: 'Gateway', base: true },
    leader: { id: 'leader', type: 'leader', x: 0.6, y: 0.44, label: 'Leader', base: true },
    branch: { id: 'branch', type: 'branch', x: 0.6, y: 0.84, label: 'Branch' },
    r1: { id: 'r1', type: 'replica', x: 0.88, y: 0.22, label: 'Follower 1' },
    r2: { id: 'r2', type: 'replica', x: 0.88, y: 0.66, label: 'Follower 2' },
    olap: { id: 'olap', type: 'olap', x: 0.88, y: 0.2, label: 'Columnar copy' },
    s1: { id: 's1', type: 'shard', x: 0.86, y: 0.16, label: 'Shard A' },
    s2: { id: 's2', type: 'shard', x: 0.86, y: 0.44, label: 'Shard B' },
    s3: { id: 's3', type: 'shard', x: 0.86, y: 0.72, label: 'Shard C' },
    fleet: { id: 'fleet', type: 'fleet', x: 0.6, y: 0.86, label: 'Agent databases' },
    embed: { id: 'embed', type: 'embed', x: 0.88, y: 0.44, label: 'Embedding pipeline' },
  };
  const nodes = (...ids) => ids.map((id) => Object.assign({}, N[id]));

  const STARS = { two: { i: 60, b: 50 }, three: { i: 85, b: 75 } };

  CP.MISSIONS = [
    // ------------------------------------------------------------------ 1
    {
      id: 'm1', n: 1, income: 0.5, title: 'First Night On Call', sub: 'Reliability, scalability, maintainability',
      tagline: 'The agent is a fourth source of faults.',
      nodes: nodes('src', 'gw', 'leader', 'branch'), slo: 500, credits: 70, stars: STARS,
      modules: ['readOnly', 'scoping', 'sandbox'], abilities: ['rewind'],
      brief: {
        concept: [
          '<b>Reliability</b> means the system keeps working correctly when things go wrong. A <i>fault</i> is one part misbehaving. A <i>failure</i> is the whole system letting users down. You cannot prevent faults, so you design to tolerate them.',
          '<b>Scalability</b> means describing load with numbers and measuring response time in percentiles. The 99th percentile (p99) shows what your slowest users experience.',
          '<b>Maintainability</b> means people can keep working on the system for years: easy to operate, simple to understand, easy to change.',
        ],
        agents: [
          'Reliability gains a fourth fault source. The agent produces plausible but wrong actions: a migration that drops a column, an update with no filter.',
          'The remedy is the one the book gives for human error: limit what can be done, make mistakes cheap to undo, and provide a sandbox away from production.',
        ],
        pg: [
          'In Postgres the same remedy is a read-only role, one role and connection per project, and a copy-on-write branch for trying changes away from production.',
          'Point-in-time recovery replays the write-ahead log to restore the database to a past moment.',
        ],
      },
      waves: [
        { name: 'Quiet shift', dur: 26, rate: [2, 3.5], mix: { read: 6, write: 3, migration: 0.6 },
          intro: 'Agents come online and nothing is wrong yet. Watch the three meters. Integrity is your data. Error budget is your users\' patience. p99 is your slowest request.' },
        { name: 'Confident mistakes', dur: 36, rate: [3, 4.5], mix: { read: 6, write: 3, migration: 1, destructive: 0.5 },
          intro: 'Builder agents start changing the schema. Some of their changes will succeed and be wrong. Read-only mode is free, and it refuses good writes too.' },
        { name: 'Wrong project', dur: 38, rate: [4, 5.5], mix: { read: 6, write: 3, migration: 1, destructive: 0.7, crossProject: 0.8 },
          intro: 'Some agents are connected to projects they were never meant to touch.' },
        { name: 'Machine speed', dur: 40, rate: [5, 7.5], mix: { read: 6, write: 3, migration: 1.2, destructive: 1.1, crossProject: 1.1 },
          intro: 'More agents, working faster than any team. Whatever you left open, they will find.' },
      ],
      rec: { 1: ['sandbox'], 2: ['scoping'] },
      challenge: { text: 'Refuse fewer than 5 legitimate requests', test: (s) => s.blockedLegit < 5 },
      quiz: [
        { q: 'What do agents add to the book\'s three sources of faults (hardware, software, human error)?', a: ['Network partitions', 'A fourth source: plausible but wrong actions', 'Slower disks', 'Nothing new'], correct: 1, why: 'The agent itself produces plausible but wrong actions, such as a migration that drops a column.' },
        { q: 'Why does the book insist on percentiles over averages?', a: ['Averages are harder to compute', 'Percentiles are always lower', 'The 99th percentile shows what your slowest users experience', 'Percentiles ignore outliers'], correct: 2, why: 'An average hides the slow tail. The slowest requests often belong to your most valuable users.' },
        { q: 'Which set matches the book\'s remedy for human error, reused for agents?', a: ['Encrypt, compress, replicate', 'Limit what can be done, make undo cheap, provide a sandbox', 'Add servers, add indexes, add caches', 'Review every statement by hand'], correct: 1, why: 'Read-only mode and scoping limit, branches are the sandbox, and point-in-time recovery is the undo.' },
      ],
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'm2', n: 2, income: 0.4, title: 'The Schema Is A Prompt', sub: 'Data models and query languages',
      tagline: 'Constraints are the last line of defence.',
      nodes: nodes('src', 'gw', 'leader'), slo: 500, credits: 90, stars: STARS,
      modules: ['constraints', 'legible', 'schemaOnRead', 'pgvector'], abilities: [], needsVector: true,
      brief: {
        concept: [
          'The book compares three models. <b>Relational</b> tables are good at joins and many-to-many relationships. <b>Document</b> records are good at self-contained trees. <b>Graphs</b> are good at highly connected data.',
          '<b>Schema-on-write</b> checks structure when data is written and catches errors early. <b>Schema-on-read</b> accepts anything and leaves interpretation to the reader. It moves faster and pushes the risk to later.',
          'SQL is <b>declarative</b>: you state what you want and the database decides how to get it.',
        ],
        agents: [
          'Declarative queries are what models write well. A model produces intent, and SQL is intent with a formal grammar.',
          'Schema-on-write becomes a safety mechanism. A foreign key or a check constraint rejects a wrong write before it lands.',
          'The schema becomes a prompt. An agent inspects tables, columns, and comments, then decides what to do. Ambiguous names cause wrong queries.',
          'A fourth data shape arrived: embeddings, lists of numbers that place text by meaning.',
        ],
        pg: [
          'Postgres covers all four shapes in one system: tables, <code>jsonb</code> for documents, recursive queries for graphs, and pgvector for embeddings.',
          'One engine with one permission model is easier for an agent to reason about than four separate stores.',
        ],
      },
      waves: [
        { name: 'Shapes of data', dur: 28, rate: [3, 4.5], mix: { read: 5, write: 4, malformed: 0.8 },
          intro: 'Agents are writing rows that do not fit: orphan references, negative balances, missing values. Without schema-on-write checks, the database stores them.' },
        { name: 'Ambiguous names', dur: 36, rate: [4, 5.5], mix: { read: 5, write: 4, malformed: 0.9, misread: 1.1 },
          intro: 'Tables called t1 and columns called val2. Agents guess what they mean. A well-formed wrong answer passes every constraint.' },
        { name: 'A fourth shape', dur: 38, rate: [5, 6.5], mix: { read: 5, write: 4, vector: 2.2, malformed: 0.9, misread: 1.1 },
          intro: 'Agents start searching by meaning. Semantic searches fail until the database can store embeddings.' },
        { name: 'Write surge', dur: 40, rate: [8, 12], mix: { read: 3, write: 8, vector: 1, malformed: 1.4, misread: 1.4 },
          intro: 'A burst of writes pushes latency up. Loose jsonb intake would make writes faster. Think about what it turns off.' },
      ],
      rec: { 0: ['constraints'], 1: ['legible'], 2: ['pgvector'] },
      challenge: { text: 'Never switch on loose jsonb intake', test: (s) => !s.used.schemaOnRead },
      quiz: [
        { q: 'When the writer is an agent, why does schema-on-write matter more?', a: ['It makes writes faster', 'Constraints reject a wrong write before it lands', 'It removes the need for indexes', 'Agents cannot read jsonb'], correct: 1, why: 'Schema-on-read would store the mistake silently. Constraints are the last line of defence.' },
        { q: 'What does "the schema becomes a prompt" mean?', a: ['Schemas are written in English', 'Agents inspect names and comments, then decide what to do', 'Prompts are stored in tables', 'Agents generate schemas at random'], correct: 1, why: 'Ambiguous names cause wrong queries. The data model is now part of the interface.' },
        { q: 'Why does text-to-SQL work at all?', a: ['SQL is declarative: intent with a formal grammar, planned by the database', 'SQL is imperative and easy to step through', 'Models were trained only on SQL', 'Databases correct wrong queries'], correct: 0, why: 'A model produces intent, and the database turns it into an efficient plan.' },
      ],
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'm3', n: 3, income: 0.28, title: 'Pay On Write, Gain On Read', sub: 'Storage and retrieval',
      tagline: 'Every index speeds up reads and slows down writes.',
      nodes: nodes('src', 'gw', 'leader', 'olap'), slo: 450, credits: 90, stars: STARS,
      modules: ['indexHot', 'indexAll', 'hnsw', 'olap'], abilities: [],
      brief: {
        concept: [
          'The simplest database appends every write to a <b>log</b>. Writing is fast. Reading is slow, because finding a record means scanning.',
          'An <b>index</b> speeds up reads and slows down writes, because it must be updated each time. This is the central storage trade-off.',
          '<b>B-trees</b> update fixed-size pages in place and give predictable reads. <b>LSM-trees</b> buffer writes and merge sorted files for very high write rates.',
          'Transaction processing (OLTP) touches a few rows for a waiting user. Analytics (OLAP) scans millions of rows, so analytics engines store data by column.',
        ],
        agents: [
          'Vector indexes join B-trees. HNSW returns approximately the closest matches: speed is bought with accuracy.',
          'Storage moves to object stores, so compute can pause when idle. Copy-on-write makes a full copy of a database take moments.',
          'The OLTP and OLAP line blurs. An agent asks whatever the task needs, mixing single-row lookups and large scans against the same database.',
        ],
        pg: [
          'Postgres uses B-trees by default and records every change in a write-ahead log before applying it. That log drives replication, recovery, and change streams.',
          'pgvector adds HNSW indexes for embeddings.',
        ],
      },
      waves: [
        { name: 'Lookups', dur: 28, rate: [12, 22], mix: { read: 10, write: 1.2 },
          intro: 'A flood of single-row lookups. With no index, every one is a scan of the table. There are no attackers in this mission, only load.' },
        { name: 'Bulk load', dur: 32, rate: [8, 11.5], mix: { read: 1.5, write: 10 },
          intro: 'The workload flips to writes. Every index you own must be updated on each one. You can switch a tool off for free.' },
        { name: 'Whatever the task needs', dur: 38, rate: [6, 9], mix: { read: 6, write: 3, scan: 0.7, vector: 2 },
          intro: 'Agents mix lookups, large scans, and vector searches against the same database. One long scan can hold up a hundred lookups.' },
        { name: 'Agents at scale', dur: 40, rate: [9, 13], mix: { read: 6, write: 3.5, scan: 0.8, vector: 2.2 },
          intro: 'The same mix, heavier. Nobody tuned this database for a workload that changes with every task.' },
      ],
      rec: { 0: ['indexHot'], 2: ['olap', 'hnsw'] },
      challenge: { text: 'Finish with the "index every column" tool switched off', test: (s) => !s.isOn('indexAll') && s.budget >= 60 },
      quiz: [
        { q: 'What is the central storage trade-off?', a: ['Disk versus memory', 'An index speeds up reads and slows down writes', 'Rows versus tables', 'SQL versus NoSQL'], correct: 1, why: 'Every index must be updated on each write. You pay on writes for what you gain on reads.' },
        { q: 'What new kind of trade-off does a vector index such as HNSW bring to a database?', a: ['Speed is bought with accuracy', 'Writes become impossible', 'It needs a GPU', 'It only works on sorted data'], correct: 0, why: 'It returns approximately the closest matches, so a query may miss a relevant result.' },
        { q: 'Why does the OLTP and OLAP line blur with agents?', a: ['Agents only run analytics', 'Agents never read data', 'An agent asks whatever the task needs, mixing lookups and scans', 'Column stores were removed'], correct: 2, why: 'Applications ask predictable questions that engineers tune for. Agents do not.' },
      ],
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'm4', n: 4, income: 0.5, title: 'Old Code, New Data', sub: 'Encoding and schema evolution',
      tagline: 'Nobody reviews each step any more.',
      nodes: nodes('src', 'gw', 'leader', 'branch'), slo: 500, credits: 30, stars: STARS,
      modules: ['migrationReview', 'compatLint', 'sandbox'], abilities: [],
      brief: {
        concept: [
          'Data outlives the code that wrote it. During any change, old and new code run side by side, because you cannot update everything at the same instant.',
          '<b>Backward compatible</b>: new code can read data written by old code. <b>Forward compatible</b>: old code can read data written by new code.',
          'Adding an optional field is safe both ways. Removing or renaming a field that something still reads is not.',
        ],
        agents: [
          'Schema change becomes routine. A team runs a few reviewed migrations a week. An agent changes the schema many times in one session.',
          'The risky direction flips to a confident destructive change. The agent sees only the part of the system in its context.',
          'Tool definitions are a new encoding contract. Renaming a tool breaks every agent that learned the old name.',
          'Descriptions are part of the schema. Changing a comment can change what the agent does.',
        ],
        pg: [
          'Migrations are files of SQL applied in order, each recorded so it runs once.',
          'With copy-on-write branching, an agent applies a migration to a branch first and merges it only if it passes.',
        ],
      },
      waves: [
        { name: 'A few migrations a week', dur: 34, rate: [2.5, 3.5], mix: { read: 6, write: 3, migration: 0.3, breaking: 0.2 },
          intro: 'Human review of migrations is free, and it is you. Switch it on and read each change: what still reads the thing being removed?' },
        { name: 'Many per session', dur: 40, rate: [3, 4.5], mix: { read: 6, write: 3, migration: 0.75, breaking: 0.3 },
          events: [{ at: 14, type: 'card', card: 'toolRename' }],
          intro: 'Agents now change the schema many times a session. Most changes are additive and safe. You cannot read them all.' },
        { name: 'No one checks each step', dur: 44, rate: [4, 6], mix: { read: 6, write: 3, migration: 1.4, breaking: 0.55 },
          events: [{ at: 12, type: 'card', card: 'commentEdit' }],
          intro: 'Migration safety has to become a property of the platform. A branch can test every change before it reaches production.' },
      ],
      rec: { 0: ['migrationReview'], 1: ['compatLint'], 2: ['sandbox'] },
      challenge: { text: 'Answer every review card correctly', test: (s) => s.cardsWrong === 0 && s.cardsRight >= 6 },
      quiz: [
        { q: 'Which change is safe in both directions?', a: ['Renaming a column', 'Dropping a column a service still reads', 'Adding an optional field', 'Changing a column\'s type'], correct: 2, why: 'Old code ignores the new field, and new code tolerates its absence.' },
        { q: 'Why is a renamed MCP tool a compatibility problem?', a: ['Tools cannot be renamed', 'Tool definitions are schemas: the rename breaks every agent that learned the old name', 'It slows the database', 'Agents ignore tool names'], correct: 1, why: 'Each tool has a name, a description, and typed parameters, with the same compatibility rules as any schema.' },
        { q: 'With agents, where does migration safety have to live?', a: ['In a weekly review meeting', 'In the agent\'s prompt', 'In the platform, since no person checks each step', 'In the application code'], correct: 2, why: 'An agent changes the schema many times in one session without a review.' },
      ],
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'm5', n: 5, income: 0.26, title: 'Time Moves Backward', sub: 'Replication',
      tagline: 'A stale read becomes a wrong action.',
      nodes: nodes('src', 'gw', 'leader', 'r1', 'r2'), slo: 500, credits: 110, stars: STARS,
      modules: ['replicas', 'syncRep', 'ryw', 'changeFeed'], abilities: ['failover'], staleK: 0.045,
      brief: {
        concept: [
          'You replicate to survive a machine failing, to serve more reads, and to place data near users.',
          'All writes go to one <b>leader</b>, which passes each change to <b>followers</b> that serve reads. If the leader fails, a follower is promoted: <b>failover</b>.',
          'A <b>synchronous</b> follower confirms each write first: nothing is lost, and writes wait. An <b>asynchronous</b> follower lags, and recent writes can be lost.',
          'Lag causes anomalies. <i>Read-your-writes</i>: you save a change, read a lagging follower, and your change appears to be gone.',
        ],
        agents: [
          'Stale reads become wrong actions. A person refreshes the page. An agent takes what it read as fact and acts on it.',
          'The agent\'s context is itself a lagging replica. Whatever it read ten steps ago never updates.',
          'Read replicas become the safe place for agents: heavy or mistaken queries stop slowing the leader.',
        ],
        pg: [
          'Postgres replicates by shipping its write-ahead log to followers. Logical replication sends row-level changes that other systems can consume.',
          'A change feed built on logical replication pushes changes to clients. An agent is told the data changed instead of trusting an old read.',
        ],
      },
      waves: [
        { name: 'Read pressure', dur: 28, rate: [10, 19], mix: { read: 12, write: 2, scan: 0.2 },
          intro: 'Reads are outgrowing the leader. Followers can serve them. This first wave is only about load.' },
        { name: 'Lag', dur: 38, rate: [11, 15], mix: { read: 8, actread: 4, write: 4 },
          intro: 'Followers lag behind the leader, more so when writes are heavy. Agents that read and then act will act on old data.' },
        { name: 'Leader down', dur: 42, rate: [11, 15], mix: { read: 8, actread: 4, write: 4 }, events: [{ at: 18, type: 'leaderDown' }],
          intro: 'The leader is going to crash this wave. When it does, promote a follower. An asynchronous follower will be missing recent writes.' },
        { name: 'Exploratory agents', dur: 40, rate: [12, 16], mix: { read: 8, actread: 4, write: 4, scan: 1 },
          intro: 'Agents start running large exploratory scans. Followers keep them away from the leader.' },
      ],
      rec: { 0: ['replicas'], 1: ['ryw'], 2: ['syncRep'] },
      challenge: { text: 'Lose no writes when the leader fails', test: (s) => s.flags.failoverClean === true },
      quiz: [
        { q: 'Why is a stale read more dangerous for an agent than for a person?', a: ['Agents read more slowly', 'An agent takes what it read as fact and acts on it', 'Agents cannot use followers', 'People never see stale data'], correct: 1, why: 'A person refreshes the page. An agent may retry a write that already succeeded.' },
        { q: 'What does a synchronous follower cost, and what does it buy?', a: ['Costs storage, buys speed', 'Costs nothing, buys safety', 'Writes wait, and nothing is lost on failover', 'Reads wait, and writes get faster'], correct: 2, why: 'The leader waits for confirmation before reporting success.' },
        { q: 'In what sense is an agent\'s context a lagging replica?', a: ['It is stored on a follower', 'It is a copy of the data from the moment it was read, and it never updates', 'It replicates to other agents', 'It is always synchronous'], correct: 1, why: 'A long-running agent works from a stale follower it carries in its own memory.' },
      ],
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'm6', n: 6, income: 0.17, title: 'A Database For Everyone', sub: 'Partitioning',
      tagline: 'Draw the partition line around the actor.',
      nodes: nodes('src', 'gw', 'leader', 's1', 's2', 's3', 'fleet'), slo: 550, credits: 110, stars: STARS,
      modules: ['partRange', 'partHash', 'perAgent', 'scaleToZero'], abilities: [],
      brief: {
        concept: [
          'Partitioning, also called sharding, assigns each record to one partition on one machine, so storage and load spread out.',
          '<b>By key range</b>: sorted like volumes of an encyclopedia. Range queries are efficient. Some ranges get far more traffic.',
          '<b>By hash of the key</b>: scattered evenly. Load is balanced. Range queries must ask every partition.',
          'A <b>hot spot</b> is a partition with disproportionate load. Moving data when you add machines, <b>rebalancing</b>, is risky. Avoid partitioning until one machine cannot cope.',
        ],
        agents: [
          'Database-per-agent is partitioning by actor. Every query stays inside one partition by construction.',
          'The benefit is containment. Mistakes stay inside one database that can be inspected, restored, or deleted. Attribution is free.',
          'The cost moves to the edges: a question across all agents needs a fan-out query. Shared records still need one shared database.',
          'The new hot spot is fleet management: starting, pausing, upgrading, and billing millions of tiny databases.',
        ],
        pg: [
          'Postgres partitions a table natively on one machine. Extensions such as Citus spread the partitions across machines.',
          'Serverless Postgres covers the other extreme: very large numbers of small, mostly idle databases that start in seconds and pause when unused.',
        ],
      },
      waves: [
        { name: 'Outgrowing one machine', dur: 28, rate: [11, 20], mix: { read: 8, write: 5, scan: 0.25 },
          intro: 'Load is climbing past what one leader can serve. The book\'s advice was to avoid partitioning until one machine truly cannot cope. That moment is now.' },
        { name: 'Celebrity account', dur: 38, rate: [26, 32], mix: { read: 3, write: 2, hotread: 10, hotwrite: 5, scan: 0.25 },
          intro: 'One account now receives three quarters of all traffic. Under key-range partitioning, its range lives on one shard. Switching scheme forces a rebalance.' },
        { name: 'Scratch work', dur: 40, rate: [20, 24], mix: { read: 6, write: 4, hotread: 3, hotwrite: 1.5, scratch: 5, scratchMistake: 0.3, scan: 0.35 },
          intro: 'Agents keep task memory and prototypes in the shared database, and sometimes wreck each other\'s tables. This work does not need to be shared.' },
        { name: 'Questions across the fleet', dur: 40, rate: [20, 25], mix: { read: 6, write: 4, hotread: 3, hotwrite: 1.5, scratch: 5, scratchMistake: 0.35, scan: 0.4, xquery: 0.4 },
          intro: 'Someone asks a question across every agent\'s database. Watch what the fleet costs to run while idle.' },
      ],
      rec: { 0: ['partHash'], 2: ['perAgent', 'scaleToZero'] },
      challenge: { text: 'Finish with at least 250 credits', test: (s) => s.credits >= 250 },
      quiz: [
        { q: 'What is database-per-agent, in the book\'s terms?', a: ['Replication', 'Partitioning by actor', 'A cache', 'Two-phase commit'], correct: 1, why: 'The partition line is drawn around the actor instead of around a key.' },
        { q: 'Where does the cost of database-per-agent show up?', a: ['Inside each database', 'At the edges: questions across all agents need a fan-out or a copy', 'Nowhere', 'Only in storage'], correct: 1, why: 'That is the cross-partition problem again, in a new place.' },
        { q: 'What does hash partitioning give up?', a: ['Balanced load', 'Efficient range queries', 'Durability', 'Writes'], correct: 1, why: 'A hash scatters adjacent keys, so a range query must ask every partition.' },
      ],
    },
    // ------------------------------------------------------------------ 7
    {
      id: 'm7', n: 7, income: 0.45, title: 'Succeeding At The Wrong Thing', sub: 'Transactions',
      tagline: 'Rollback covers the wrong failure.',
      nodes: nodes('src', 'gw', 'leader', 'branch'), slo: 550, credits: 120, stars: STARS,
      modules: ['longTxn', 'branchTasks', 'serializable', 'constraints'], abilities: ['rewind'],
      brief: {
        concept: [
          'A transaction groups operations so they succeed or fail as one. <b>ACID</b>: atomicity (all or nothing), consistency (your rules stay true), isolation (no interference), durability (committed means saved).',
          'Perfect isolation is expensive, so databases offer weaker levels. <b>Snapshot isolation</b> still permits <i>write skew</i>: two transactions each check a rule, each make a change that is fine alone, and together break it.',
          '<b>Serializable</b> is the only level with no anomalies, and the slowest. Most databases default to a weaker level.',
        ],
        agents: [
          'The unit of work outgrows the transaction. An agent\'s task runs for minutes across many statements, with model calls in between.',
          'Rollback covers the wrong failure. An agent\'s failure is a statement that succeeds and was a bad idea.',
          'Branches are the agent-sized transaction: work freely on a copy, merge if good, discard if not.',
          'Write skew is the multi-agent bug. Consistency needs to live in the database, in constraints enforced on every writer.',
        ],
        pg: [
          'Postgres defaults to read committed and supports true serializable isolation.',
          'Branching and point-in-time recovery together form the larger undo: try on a branch, and rewind if a bad change still reaches production.',
        ],
      },
      waves: [
        { name: 'Minutes, not milliseconds', dur: 32, rate: [3, 4], mix: { read: 5, write: 4, task: 0.35, badTask: 0.14 },
          intro: 'Agents run multi-step tasks and commit each step. Some tasks finish cleanly and are wrong. A long transaction would only undo a task that errors.' },
        { name: 'Right alone, wrong together', dur: 38, rate: [4, 5], mix: { read: 5, write: 4, task: 0.35, badTask: 0.13, skew: 0.75 },
          intro: 'Two agents each check a rule, each make a valid change, and together break the rule. Neither one did anything wrong by itself.' },
        { name: 'Guardians of invariants', dur: 40, rate: [5, 6.5], mix: { read: 5, write: 4, task: 0.35, badTask: 0.12, skew: 0.75, malformed: 0.8 },
          intro: 'Agents are poor guardians of your rules. Balances go negative. The rules belong in the database.' },
        { name: 'Everything at once', dur: 42, rate: [6, 8], mix: { read: 5, write: 4, task: 0.35, badTask: 0.12, skew: 0.9, malformed: 0.9 },
          intro: 'All three at machine speed. Rewind is the undo of last resort.' },
      ],
      rec: { 0: ['branchTasks'], 1: ['serializable'], 2: ['constraints'] },
      challenge: { text: 'Never switch on "one transaction per task"', test: (s) => !s.used.longTxn },
      quiz: [
        { q: 'Why does rollback "cover the wrong failure" for agents?', a: ['Rollback is too slow', 'A transaction undoes work that errors. An agent fails by succeeding at the wrong thing', 'Agents cannot use transactions', 'Rollback deletes the database'], correct: 1, why: 'After commit, the transaction offers no way back.' },
        { q: 'What is the agent-sized transaction?', a: ['A savepoint', 'A longer timeout', 'A branch: work on a copy, then merge or discard', 'A stored procedure'], correct: 2, why: 'It gives atomicity and isolation at the scale of a task, with a review step before commit.' },
        { q: 'What is write skew?', a: ['A slow write', 'Two transactions each make a change that is fine alone and together break a rule', 'A lost connection', 'A write to the wrong shard'], correct: 1, why: 'Snapshot isolation permits it. Serializable isolation or explicit locks prevent it.' },
      ],
    },
    // ------------------------------------------------------------------ 8
    {
      id: 'm8', n: 8, income: 0.5, title: 'Did It Work?', sub: 'The trouble with distributed systems',
      tagline: 'A timeout cannot tell you which case occurred.',
      nodes: nodes('src', 'gw', 'leader'), slo: 500, credits: 110, stars: STARS,
      modules: ['idempotency', 'versionCheck', 'rls', 'approval'], abilities: [],
      brief: {
        concept: [
          'A distributed system can be half broken. You send a request and get no reply. It may have been lost, the other side may have crashed, or the work was done and only the reply was lost. A timeout cannot tell you which.',
          'A process can freeze at any moment and resume unaware that time passed.',
          'The defences: <b>idempotence</b> (doing it twice equals doing it once), <b>fencing tokens</b> (storage rejects a write carrying an older number), and <b>quorums</b> (truth is what a majority agrees on).',
        ],
        agents: [
          'Model calls are the slowest, least reliable link, and they sit in the middle of every step.',
          'Retries are constant, so idempotence is mandatory. Every tool should accept a unique request key and ignore repeats.',
          'An agent is a paused process. It reads state, thinks for thirty seconds, and acts on what it read.',
          'Prompt injection makes the agent a participant that may act against you while behaving normally. Do not trust it: verify at the boundary, grant least access, require a second party for consequential actions.',
        ],
        pg: [
          'Idempotent writes use a unique constraint plus <code>INSERT ... ON CONFLICT</code>.',
          'Row-level security enforces access inside the database for every query, whatever the agent was told.',
        ],
      },
      waves: [
        { name: 'Timeouts', dur: 30, rate: [4, 5], mix: { read: 5, write: 4, dup: 1 },
          intro: 'Model calls time out. The agent cannot tell whether its write landed, so it sends it again.' },
        { name: 'Thirty seconds of thought', dur: 38, rate: [4.5, 5.5], mix: { read: 5, write: 4, dup: 1, staleWrite: 0.8 }, events: [{ at: 14, type: 'retryStorm', dur: 10 }],
          intro: 'Agents read, think, and write. By the time they write, the data has moved on. A model provider outage will also cause a retry storm.' },
        { name: 'Hidden instructions', dur: 40, rate: [5, 6.5], mix: { read: 5, write: 4, dup: 1, staleWrite: 0.8, injected: 0.7, action: 0.2, hijack: 0.13 },
          intro: 'Some agents have read untrusted text with instructions hidden in it. They look normal. Some will attempt actions with real consequences.' },
        { name: 'All of it, retried', dur: 42, rate: [6, 8], mix: { read: 5, write: 4, dup: 1.2, staleWrite: 0.9, injected: 0.8, action: 0.2, hijack: 0.13 }, events: [{ at: 16, type: 'retryStorm', dur: 10 }],
          intro: 'Everything from this mission, with another retry storm on the way.' },
      ],
      rec: { 0: ['idempotency'], 1: ['versionCheck'], 2: ['rls', 'approval'] },
      challenge: { text: 'Let no duplicate land', test: (s) => !(s.stats.dup && s.stats.dup.landed) },
      quiz: [
        { q: 'Why is idempotence mandatory for agent tools?', a: ['It makes tools faster', 'Agents retry constantly, and a retry must not send the email twice', 'It encrypts requests', 'It replaces transactions'], correct: 1, why: 'Agents retry on errors, on timeouts, and when unsure whether something worked.' },
        { q: 'An agent reads state, thinks for thirty seconds, and writes. Which hazard from the book is this?', a: ['Clock drift', 'Network partition', 'Process pause', 'Hot spot'], correct: 2, why: 'The defence is the same: the write carries a version, and the database rejects it if the data has moved on.' },
        { q: 'Which fault class does prompt injection bring back?', a: ['Participants that may act against you: Byzantine faults', 'Disk failure', 'Replication lag', 'Deadlock'], correct: 0, why: 'The book sets aside lying nodes as rare inside one organisation. A steered agent is one.' },
      ],
    },
    // ------------------------------------------------------------------ 9
    {
      id: 'm9', n: 9, income: 0.55, title: 'Who Decides', sub: 'Consistency and consensus',
      tagline: 'Authority needs fencing.',
      nodes: nodes('src', 'gw', 'leader', 'r1', 'r2'), slo: 500, credits: 110, stars: STARS,
      modules: ['approval', 'replicas', 'syncRep', 'rowLocks', 'expiringAuth', 'riskTiers', 'approvalTimeout', 'auditLog', 'autoFailover'],
      preowned: ['approval', 'replicas', 'syncRep'], abilities: ['failover'],
      brief: {
        concept: [
          '<b>Linearizability</b>: the system behaves as if there were one copy of the data. It is what you need for a lock, a unique username, or a single leader.',
          'Many problems reduce to agreeing on the <b>order</b> of events. If every node processes the same operations in the same order, they reach the same state.',
          '<b>Consensus</b> algorithms such as Raft and Paxos let nodes agree by majority vote, with numbered terms so a stale leader is ignored.',
          '<b>Two-phase commit</b>: a coordinator asks participants to prepare, then to commit. If the coordinator fails in between, participants are stuck.',
        ],
        agents: [
          'The database becomes the shared ground. Agents should coordinate through shared, ordered state. Messages between agents are unreliable.',
          'Ordering becomes the audit trail: a total order of events, each attributed to an actor.',
          'Approval is two-phase commit with a person as coordinator. If the approver never responds, the work is stuck. Approval flows need timeouts and a clear default.',
          'Authority needs fencing. Permission should expire and be checked at the moment of the write.',
        ],
        pg: [
          'A single Postgres leader is linearizable for writes, which is why uniqueness constraints and row locks are trustworthy.',
          'Advisory locks and <code>SELECT ... FOR UPDATE</code> give agents a correct way to claim a job. Failover is where consensus is needed.',
        ],
      },
      waves: [
        { name: 'Claiming work', dur: 30, rate: [4, 5], mix: { read: 4, write: 3, job: 4, doubleClaim: 1 },
          intro: 'Agents take jobs from a queue by telling each other which one they picked. Two agents keep taking the same job.' },
        { name: 'Cancelled, still committing', dur: 38, rate: [4.5, 6], mix: { read: 4, write: 3, job: 4, doubleClaim: 1, zombie: 0.8, action: 0.2, hijack: 0.08 },
          intro: 'Tasks get cancelled. Their agents, paused mid-thought, wake up and commit anyway. Approval is already on: you are the coordinator.' },
        { name: 'Approval flood', dur: 40, rate: [5, 6.5], mix: { read: 4, write: 3, job: 4, doubleClaim: 1, zombie: 0.8, action: 1.5, hijack: 0.12 },
          intro: 'Approval requests arrive faster than you can read them. An unanswered approval leaves work stuck. What needs a person, and what happens when nobody answers?' },
        { name: 'Who did this?', dur: 42, rate: [6, 7.5], mix: { read: 4, write: 3, job: 4, doubleClaim: 1, zombie: 0.8, action: 0.6, hijack: 0.12, rogue: 0.6 }, events: [{ at: 22, type: 'leaderDown' }],
          intro: 'Invoices are disappearing and every delete looks ordinary. The leader is also going to crash.' },
      ],
      rec: { 0: ['rowLocks'], 1: ['expiringAuth'], 2: ['riskTiers', 'approvalTimeout'], 3: ['auditLog', 'autoFailover'] },
      challenge: { text: 'Let no approval get stuck', test: (s) => s.stuckTime < 1 },
      quiz: [
        { q: 'Approval by a person resembles which protocol, and shares which weakness?', a: ['Raft: split votes', 'Two-phase commit: if the coordinator never responds, the work is stuck', 'Gossip: slow convergence', 'Quorum reads: stale values'], correct: 1, why: 'Approval flows need timeouts and a clear default.' },
        { q: 'How should several agents coordinate?', a: ['By messaging each other directly', 'Through shared, ordered state in the database', 'By taking turns on a timer', 'They should not'], correct: 1, why: 'Messages passed between agents are unreliable in every way the book lists.' },
        { q: 'Why should an agent\'s permission expire and be checked at write time?', a: ['To save storage', 'So an agent whose task was cancelled cannot still commit', 'To speed up reads', 'To avoid indexes'], correct: 1, why: 'Otherwise it is the paused former leader acting on authority it lost.' },
      ],
    },
    // ------------------------------------------------------------------ 10
    {
      id: 'm10', n: 10, income: 0.3, title: 'Everything Is Derived', sub: 'Derived data: batch, streams, and the future',
      tagline: 'Know which copy is the source.',
      nodes: nodes('src', 'gw', 'leader', 'embed'), slo: 550, credits: 110, stars: STARS,
      modules: ['nightlyBatch', 'cdcEmbed', 'eventMemory', 'immutableSource'], abilities: [], usesStale: true, staleGain: 0.011, svcOverride: { vector: 0.08 },
      brief: {
        concept: [
          'A <b>system of record</b> holds the authoritative version of a fact. <b>Derived data</b> is anything computed from it: an index, a cache, a report. It can always be rebuilt. Problems begin when nobody knows which copy is the source.',
          '<b>Batch processing</b> never modifies its input. If the output is wrong, fix the code and run it again. <b>Stream processing</b> does the same on input that never ends.',
          '<b>Change data capture</b> turns every change in a database into a stream of events. <b>Event sourcing</b> stores the events themselves as the source of truth.',
        ],
        agents: [
          'Embeddings are derived data. When the text changes, the embedding is stale until recomputed.',
          'An agent\'s context is a materialized view: it can be stale, it can be incomplete, and it should be rebuildable from the source.',
          'Agent memory should be event-sourced. A summary that overwrites its source cannot be corrected later.',
          'Reprocessing gains a new reason: a new embedding model means re-deriving every vector.',
        ],
        pg: [
          'The write-ahead log is the central log, and logical replication is its change data capture.',
          'A common pattern: a row changes, a trigger or queue schedules work, a function computes a new embedding, and pgvector stores it next to the source row.',
        ],
      },
      waves: [
        { name: 'Stale vectors', dur: 32, rate: [5, 7], mix: { read: 3, write: 4, vector: 5 },
          intro: 'Agents retrieve their context by vector search. Each write to a source row leaves its embedding out of date. Watch the staleness gauge on the pipeline.' },
        { name: 'Lossy memory', dur: 38, rate: [6, 8], mix: { read: 3, write: 4, vector: 5 }, events: [{ at: 15, type: 'card', card: 'summaryBug' }],
          intro: 'Agent memory is stored as summaries. A summary that overwrote its source cannot be rebuilt. Something is about to go wrong with them.' },
        { name: 'A better model', dur: 40, rate: [6.5, 8.5], mix: { read: 3, write: 4.5, vector: 5 }, events: [{ at: 12, type: 'card', card: 'newModel' }],
          intro: 'A new embedding model is about to be released. Whether you can re-derive everything depends on what you kept.' },
        { name: 'Derived at scale', dur: 42, rate: [8, 11], mix: { read: 3, write: 5, vector: 6 },
          intro: 'More writes, more retrieval. Any staleness now turns into wrong actions quickly.' },
      ],
      rec: { 0: ['cdcEmbed'], 1: ['eventMemory'], 2: ['immutableSource'] },
      challenge: { text: 'Take the best option on both decisions', test: (s) => s.cardsWrong === 0 && s.cardsBest >= 2 },
      quiz: [
        { q: 'A row\'s text changes. What is true of its embedding?', a: ['It updates by itself', 'It is stale until recomputed: derived data', 'It becomes the source of truth', 'It must be deleted'], correct: 1, why: 'This is the cache-invalidation problem, and change data capture is the fix.' },
        { q: 'Why should agent memory be event-sourced?', a: ['Events are smaller', 'A log can always be re-summarised. A summary that overwrote its source cannot be corrected', 'Summaries are illegal', 'It avoids vectors'], correct: 1, why: 'Summaries are derived from the append-only log, and a better model can re-derive them.' },
        { q: 'What new reason to reprocess do agents bring?', a: ['Disk failures', 'The model changes', 'Daylight saving time', 'Schema-on-read'], correct: 1, why: 'A new embedding model means re-deriving every vector. Immutable source data makes that routine.' },
      ],
    },
    // ------------------------------------------------------------------ 11
    {
      id: 'm11', n: 11, income: 0.45, title: 'The Majority User', sub: 'What the book could not anticipate',
      tagline: 'Six principles, one tight budget.',
      nodes: nodes('src', 'gw', 'leader', 'branch', 'r1', 'r2'), slo: 700, credits: 300, stars: STARS, staleK: 0.04,
      modules: ['sandbox', 'constraints', 'rls', 'idempotency', 'replicas', 'ryw', 'syncRep', 'versionCheck', 'serializable', 'approval', 'approvalTimeout', 'readOnly'],
      workers: { leader: 3 },
      abilities: ['rewind', 'failover'],
      brief: {
        concept: [
          'The book teaches one skill: reasoning about trade-offs in systems that store and move data. Its concepts still hold. What changed is who uses the database.',
          'The majority user of a new Postgres database is now a program that writes its own SQL, cannot be fully trusted, and works at machine speed.',
        ],
        agents: [
          '<b>1. Design for an untrusted majority user.</b> Enforcement sits inside the database, on every query.',
          '<b>2. Make undo larger than the transaction.</b> The branch before commit, point-in-time recovery after.',
          '<b>3. Count databases, not just rows.</b> Scale-to-zero and instant creation are capacity features.',
          '<b>4. Treat legibility as correctness.</b> Names, comments, and error messages change behaviour.',
          '<b>5. Keep one deterministic source of truth.</b> Model outputs are derived data.',
          '<b>6. Attribute every action.</b> Who changed this, on whose behalf, with what instruction.',
        ],
        pg: [
          'Row-level security, constraints, and scoped credentials are the main interface for this user.',
          'Open questions remain: merging data branches, review at machine speed, and safe access to production.',
        ],
      },
      waves: [
        { name: 'Untrusted majority', dur: 32, rate: [5, 7], mix: { read: 6, actread: 2, write: 4, malformed: 0.8, injected: 0.6 },
          intro: 'Everything you have learned, and you cannot afford all of it at once. Read each wave\'s warning and buy for what is coming.' },
        { name: 'Larger undo', dur: 36, rate: [6, 8], mix: { read: 6, actread: 2, write: 4, malformed: 0.8, injected: 0.6, migration: 0.6, destructive: 0.5 },
          intro: 'Builder agents arrive with schema changes. Some will succeed at the wrong thing.' },
        { name: 'Machine speed', dur: 38, rate: [11, 17], mix: { read: 10, actread: 4, write: 4, malformed: 0.7, injected: 0.5, migration: 0.5, destructive: 0.4, dup: 0.9 },
          intro: 'Read load triples and agents begin retrying. One leader will not hold. Followers lag.' },
        { name: 'One source of truth', dur: 40, rate: [11, 15], mix: { read: 10, actread: 4, write: 4, malformed: 0.7, injected: 0.5, migration: 0.5, destructive: 0.4, dup: 0.9, staleWrite: 0.7, skew: 0.6 }, events: [{ at: 20, type: 'leaderDown' }],
          intro: 'Paused agents write from old reads, pairs of agents break rules together, and the leader is going to crash.' },
        { name: 'Attribute every action', dur: 44, rate: [12, 17], mix: { read: 10, actread: 4, write: 4, malformed: 0.8, injected: 0.6, migration: 0.5, destructive: 0.5, dup: 1, staleWrite: 0.8, skew: 0.7, action: 0.15, hijack: 0.12 },
          intro: 'The last wave adds hijacked consequential actions to everything else.' },
      ],
      rec: { 0: ['constraints', 'rls'], 1: ['sandbox'], 2: ['replicas', 'ryw', 'idempotency'], 3: ['syncRep', 'versionCheck', 'serializable'], 4: ['approval'] },
      challenge: { text: 'Finish without using Rewind', test: (s) => s.rewinds === 0 && s.integrity >= 70 },
      quiz: [
        { q: 'Where does enforcement have to sit when most sessions belong to agents?', a: ['At the network perimeter', 'In the application code', 'Inside the database, on every query', 'In the agent\'s prompt'], correct: 2, why: 'The book\'s security model trusts the application and guards the perimeter. That no longer holds.' },
        { q: 'What are the two useful units of undo for agent work?', a: ['Savepoint and rollback', 'The branch before commit, and point-in-time recovery after', 'Backup and restore from tape', 'Retry and timeout'], correct: 1, why: 'Agents fail by succeeding at the wrong thing. A platform\'s safety is measured by how cheap those two are.' },
        { q: 'Which is still an open question?', a: ['Branching a database', 'Merging two data branches that both changed', 'Storing embeddings', 'Shipping a write-ahead log'], correct: 1, why: 'Code has merge tools. Data mostly does not.' },
      ],
    },
  ];

  CP.missionById = (id) => CP.MISSIONS.find((m) => m.id === id) || (id === 'endless' ? CP.makeEndless(1) : null);

  // ---------------------------------------------------------------- endless mode
  const ENDLESS_THREATS = ['malformed', 'injected', 'destructive', 'dup', 'staleWrite', 'skew', 'hijack'];
  CP.makeEndless = function (seed) {
    const rng = CP.rng(seed || 1);
    const m = {
      id: 'endless', n: 0, endless: true, title: 'Production', sub: 'Endless mode', tagline: 'It never stops.',
      nodes: nodes('src', 'gw', 'leader', 'branch', 'r1', 'r2'), slo: 700, credits: 300, income: 0.5, stars: STARS, staleK: 0.04,
      modules: ['sandbox', 'constraints', 'rls', 'idempotency', 'replicas', 'ryw', 'syncRep', 'versionCheck', 'serializable', 'approval', 'approvalTimeout', 'readOnly'],
      workers: { leader: 3 },
      abilities: ['rewind', 'failover'], waves: [], brief: null, quiz: [],
      waveGen(i) {
        const n = Math.min(ENDLESS_THREATS.length, 2 + Math.floor(i / 2));
        const pool = ENDLESS_THREATS.slice();
        const mix = { read: 8, actread: 3, write: 4, migration: 0.4 };
        const names = [];
        for (let k = 0; k < n; k++) {
          const t = pool.splice((rng() * pool.length) | 0, 1)[0];
          mix[t] = t === 'hijack' ? 0.12 : 0.55 + i * 0.05;
          if (t === 'hijack') mix.action = 0.15;
          names.push(CP.THREATS[t].name.toLowerCase());
        }
        const base = 5 + i * 1.1;
        const w = { name: 'Wave ' + (i + 1), dur: 34, rate: [base, base * 1.4], mix, intro: 'Incoming: ' + names.join(', ') + '.' };
        if (i >= 3 && i % 3 === 0) w.events = [{ at: 16, type: 'leaderDown' }];
        return w;
      },
    };
    return m;
  };
})();
