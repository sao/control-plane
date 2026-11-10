(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});
  const { clamp, lerp } = CP;

  const WORKERS = { leader: 2, replica: 2, branch: 2, shard: 3, fleet: 6, olap: 2, embed: 1 };
  const QUEUE_CAP = 28;
  const MAX_CARDS = 3;
  const CARD_TTL = 24;
  const READISH = { read: 1, scan: 1, vector: 1 };

  class Sim {
    constructor(mission, opts) {
      opts = opts || {};
      const m = (this.m = mission);
      this.up = opts.upgrades || {};
      this.rng = CP.rng(opts.seed == null ? 12345 : opts.seed);
      this.cb = [];
      this.t = 0; this.wt = 0; this.waveIdx = -1; this.phase = 'build'; this.lostWhy = null;
      this.integrity = 100; this.budget = 100;
      this.credits = m.credits + 40 * (this.up.seed || 0);
      this.earned = 0; this.served = 0; this.blockedLegit = 0; this.blockedThreat = 0; this.landed = 0;
      this.streak = 0; this.bestStreak = 0;
      this.cardsRight = 0; this.cardsWrong = 0; this.cardsBest = 0; this.cardRun = 0; this.bestCardRun = 0;
      this.stuckTime = 0; this.rewinds = 0; this.rewound = 0; this.maxP99 = 0;
      this.nodes = {};
      for (const n of m.nodes) {
        this.nodes[n.id] = { id: n.id, type: n.type, base: !!n.base, active: !!n.base, down: false, queue: [], busy: [], workers: WORKERS[n.type] || 2, flash: 0 };
      }
      for (const id in m.workers || {}) if (this.nodes[id]) this.nodes[id].workers = m.workers[id];
      if (this.up.box && this.nodes.leader) this.nodes.leader.workers += 1;
      this.mods = {}; this.used = {};
      for (const id of m.modules) this.mods[id] = { owned: false, on: false };
      for (const id of m.preowned || []) { this.mods[id] = { owned: true, on: true }; this.used[id] = true; }
      this.abil = {};
      for (const id of m.abilities || []) this.abil[id] = { cd: 0 };
      this.packets = []; this.cards = []; this.pending = []; this.feed = []; this.lat = []; this.p99 = 0;
      this.dmgLog = []; this.stats = {}; this.modStats = {}; this.flags = {};
      this.lag = 0; this.wps = 0; this.stale = 0; this.staleFloor = 0; this.batchT = 0;
      this.rebalance = 0; this.downT = 0; this.rr = 0; this.spawnAcc = 0; this.pid = 0; this.cid = 0; this.p99T = 0;
      this.temp = {}; this.fired = 0; this.feedGate = {}; this.bag = []; this.bagFrac = {}; this.bagSig = '';
      this.recalc();
    }

    on(fn) { this.cb.push(fn); }
    emit(type, data) { for (const f of this.cb) f(type, data, this); }

    log(cls, text, sec) {
      this.feed.push({ t: this.t, cls, text, sec });
      if (this.feed.length > 80) this.feed.shift();
      this.emit('feed', this.feed[this.feed.length - 1]);
    }
    // Rate-limited log for repetitive lines.
    logGated(key, gap, cls, text, sec) {
      const last = this.feedGate[key];
      if (last != null && this.t - last < gap) return;
      this.feedGate[key] = this.t;
      this.log(cls, text, sec);
    }

    isOn(id) { return !!this.activeSet[id]; }
    wave(i) {
      const m = this.m;
      if (i == null) i = this.waveIdx;
      if (!m.waves[i] && m.waveGen) m.waves[i] = m.waveGen(i);
      return m.waves[i];
    }
    isLastWave() { return !this.m.endless && this.waveIdx >= this.m.waves.length - 1; }
    cost(id) { return Math.round(CP.MODS[id].cost * (this.up.discount ? 0.85 : 1)); }

    recalc() {
      const MODS = CP.MODS;
      const on = {};
      for (const id in this.mods) if (this.mods[id].on) on[id] = true;
      for (const id in this.mods) {
        if (this.mods[id].on && MODS[id].disables) for (const d of MODS[id].disables) delete on[d];
      }
      this.activeSet = on;
      this.activeList = this.m.modules.filter((id) => on[id]);
      for (const id in this.nodes) this.nodes[id].active = this.nodes[id].base;
      for (const id of this.activeList) for (const n of MODS[id].activates || []) if (this.nodes[n]) this.nodes[n].active = true;
      for (const id of this.activeList) for (const n of MODS[id].deactivates || []) if (this.nodes[n]) this.nodes[n].active = false;
      // Move work off nodes that just went away.
      for (const id in this.nodes) {
        const n = this.nodes[id];
        if (n.active || (!n.queue.length && !n.busy.length)) continue;
        const moving = n.queue.concat(n.busy);
        n.queue = []; n.busy = [];
        for (const p of moving) {
          const dest = this.nodes[this.route(p)];
          p.to = dest.id; p.state = 'queued'; dest.queue.push(p);
        }
      }
    }

    buy(id) {
      const s = this.mods[id];
      if (!s || s.owned || this.phase === 'won' || this.phase === 'lost') return false;
      const c = this.cost(id);
      if (this.credits < c) return false;
      this.credits -= c;
      s.owned = true;
      this.setOn(id, true);
      this.emit('buy', id);
      return true;
    }
    toggle(id) {
      const s = this.mods[id];
      if (!s || !s.owned) return false;
      this.setOn(id, !s.on);
      this.emit('toggle', id);
      return true;
    }
    setOn(id, v) {
      const d = CP.MODS[id], s = this.mods[id];
      const hadPart = this.isOn && this.activeSet && (this.activeSet.partRange || this.activeSet.partHash);
      s.on = v;
      if (v) {
        this.used[id] = true;
        for (const x of d.excl || []) if (this.mods[x]) this.mods[x].on = false;
      }
      this.recalc();
      if (id === 'partRange' || id === 'partHash') {
        this.rebalance = hadPart || !v ? 6 : 3;
        this.log('warn', 'Rebalancing: data is moving between machines. Everything on the shards is slower for a few seconds.', 6);
      }
      this.log('info', (v ? 'ON  ' : 'OFF ') + d.name, d.sec);
    }

    startWave() {
      if (this.phase !== 'build') return false;
      this.waveIdx++; this.wt = 0; this.spawnAcc = 0; this.fired = 0; this.temp = {};
      this.phase = 'wave';
      this.emit('waveStart', this.waveIdx);
      this.log('info', '— Wave ' + (this.waveIdx + 1) + ': ' + this.wave().name + ' —');
      return true;
    }

    // ------------------------------------------------------------ spawning
    spawn(key) {
      const TH = CP.THREATS[key], AL = CP.ALIASES[key], rng = this.rng;
      const p = { id: ++this.pid, threat: null };
      let kind = key;
      if (TH) { p.threat = key; kind = TH.kind; if (TH.flags) Object.assign(p, TH.flags); }
      else if (AL) { kind = AL.kind; Object.assign(p, AL.flags); }
      p.kind = kind;
      if (kind === 'migration' && !p.threat) p.additive = rng() < 0.7;
      if (kind === 'action' && !p.threat) p.lowRisk = rng() < 0.75;
      if (kind === 'task') p.flagged = p.threat ? true : rng() < 0.12;
      p.key = (rng() * 999) | 0;
      p.agent = 'agent-' + ((rng() * 4096) | 0).toString(16).padStart(3, '0');
      p.sql = CP.pick(rng, TH ? TH.sqls : CP.KINDS[kind].sqls);
      p.state = 'toGw'; p.from = 'src'; p.to = 'gw'; p.prog = 0; p.dur = 0.65 + rng() * 0.3; p.lane = rng() * 2 - 1;
      this.packets.push(p);
      if (p.threat) this.stat(p.threat).spawned++;
      this.emit('spawn', p);
      return p;
    }
    stat(th) { return this.stats[th] || (this.stats[th] = { spawned: 0, blocked: 0, landed: 0 }); }

    // Draws from a shuffled bag so each wave gets close to its intended share of
    // every request type. Pure random picks made some runs three times harder.
    pickMix(w) {
      const MODS = CP.MODS;
      let total = 0, sig = '';
      const keys = [], ws = [];
      for (const k in w.mix) {
        let v = w.mix[k];
        for (const id of this.activeList) { const sm = MODS[id].spawnMult; if (sm && sm[k] != null) v *= sm[k]; }
        if (this.temp.mult && this.temp.mult[k]) v *= this.temp.mult[k];
        if (k === 'rogue' && this.flags.rogueRevoked) v = 0;
        if (v <= 0) continue;
        keys.push(k); ws.push(v); total += v; sig += k + v + ',';
      }
      if (sig !== this.bagSig) { this.bagSig = sig; this.bag = []; this.bagFrac = {}; }
      while (!this.bag.length) {
        for (let i = 0; i < keys.length; i++) {
          const f = (this.bagFrac[keys[i]] || 0) + (ws[i] / total) * 30, n = Math.floor(f);
          this.bagFrac[keys[i]] = f - n;
          for (let j = 0; j < n; j++) this.bag.push(keys[i]);
        }
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = (this.rng() * (i + 1)) | 0, t = this.bag[i];
          this.bag[i] = this.bag[j]; this.bag[j] = t;
        }
      }
      return this.bag.pop();
    }

    // ------------------------------------------------------------ routing
    shared(p) {
      if (this.isOn('partRange')) return p.hot ? 's1' : ['s1', 's2', 's3'][p.key % 3];
      if (this.isOn('partHash')) return ['s1', 's2', 's3'][(p.key * 7 + p.id) % 3];
      return 'leader';
    }
    route(p) {
      if (p.kind === 'migration' && this.isOn('sandbox')) return 'branch';
      if (p.kind === 'task' && this.isOn('branchTasks')) return 'branch';
      if (p.scratch && this.isOn('perAgent')) return 'fleet';
      if (p.kind === 'xquery') return this.isOn('perAgent') ? 'fleet' : this.shared(p);
      if (p.kind === 'scan' && this.isOn('olap')) return 'olap';
      if (READISH[p.kind] && this.isOn('replicas') && !(p.acts && this.isOn('ryw')) && this.nodes.r1) {
        this.rr ^= 1;
        return this.rr ? 'r1' : 'r2';
      }
      return this.shared(p);
    }

    needsCard(p) {
      if (p.kind === 'migration' && this.isOn('migrationReview') && !this.isOn('sandbox')) {
        if (this.isOn('compatLint') && p.additive && !p.threat) return null;
        return 'migration';
      }
      if (p.kind === 'action' && this.isOn('approval')) {
        if (this.isOn('riskTiers') && p.lowRisk) return null;
        return 'action';
      }
      return null;
    }

    gate(p) {
      const MODS = CP.MODS;
      for (const id of this.activeList) {
        const d = MODS[id];
        if (d.at !== 'gw') continue;
        if (d.blockKinds && d.blockKinds.includes(p.kind)) return this.reject(p, id);
        if (p.threat && d.blocks && d.blocks.includes(p.threat)) return this.reject(p, id);
      }
      const pool = this.needsCard(p);
      if (pool) return this.hold(p, pool, false);
      this.dispatch(p);
    }
    dispatch(p) {
      const dest = this.route(p), n = this.nodes[dest];
      if (n.down) return this.fail(p, 'down');
      p.state = 'toNode'; p.from = 'gw'; p.to = dest; p.prog = 0; p.dur = 0.45;
    }
    arrive(p) {
      let n = this.nodes[p.to];
      if (!n.active) { p.to = this.route(p); n = this.nodes[p.to]; }
      if (n.down) return this.fail(p, 'down');
      if (n.queue.length >= QUEUE_CAP) return this.fail(p, 'timeout');
      p.state = 'queued'; p.arr = this.t;
      n.queue.push(p);
    }

    svcTime(p, n) {
      const MODS = CP.MODS, m = this.m;
      let s = (m.svcOverride && m.svcOverride[p.kind]) || CP.KINDS[p.kind].svc;
      s *= 0.8 + this.rng() * 0.4;
      for (const id of this.activeList) {
        const d = MODS[id];
        if (!d.svc || d.svc[p.kind] == null) continue;
        if (d.svcNode && !d.svcNode.includes(n.type)) continue;
        s *= d.svc[p.kind];
      }
      if (n.type === 'branch') s *= 1.5;
      if (n.type === 'olap') s *= 0.2;
      if (n.type === 'shard') {
        if (p.kind === 'scan' && this.isOn('partHash')) s *= 2;
        if (this.rebalance > 0) s *= 2;
      }
      if (n.type === 'fleet') {
        if (p.kind === 'xquery') s *= 2.5;
        if (this.isOn('scaleToZero')) s *= 1.3;
      }
      return s;
    }

    // ------------------------------------------------------------ outcomes
    remove(p) { p.dead = true; }

    reject(p, modId) {
      const d = CP.MODS[modId];
      this.remove(p);
      if (p.threat) {
        this.blockedThreat++; this.stat(p.threat).blocked++;
        this.modStats[modId] = (this.modStats[modId] || 0) + 1;
        this.credits += 0.3;
        this.emit('block', { p, modId });
        this.log('ok', 'BLOCKED  ' + p.sql + '  ← ' + d.name, d.sec);
        if (d.retry) this.spawnRetry(p);
      } else {
        this.blockedLegit++; this.streak = 0;
        this.budget -= 0.5;
        this.emit('refuse', { p, modId });
        this.logGated('refuse:' + modId, 2.5, 'warn', 'REFUSED  ' + p.sql + '  ← ' + d.name + ' turned away a legitimate request', d.sec);
      }
    }
    spawnRetry(p) {
      const q = this.spawn(p.kind === 'job' ? 'job' : 'write');
      q.retryOf = p.id;
    }
    caught(p, how) {
      this.remove(p);
      this.blockedThreat++; this.stat(p.threat).blocked++;
      this.credits += 1;
      this.emit('block', { p, modId: how });
      const where = how === 'branch' ? 'Caught on the branch, never reached production' : how === 'fleet' ? 'Contained inside one agent\'s own database' : 'Caught in review';
      this.log('ok', 'CONTAINED  ' + p.sql + '  ← ' + where, CP.THREATS[p.threat].sec);
    }
    fail(p, why) {
      this.remove(p);
      if (p.threat) return;
      this.blockedLegit++; this.streak = 0;
      this.budget -= 0.5;
      this.emit('refuse', { p, modId: why });
      const text = why === 'down' ? 'FAILED  the leader is down, writes have nowhere to go'
        : why === 'timeout' ? 'TIMEOUT  the queue is full, requests are being dropped'
        : why === 'unsupported' ? 'FAILED  ' + p.sql + '  ← this database cannot store embeddings yet'
        : 'DENIED  ' + p.sql + '  ← good work turned away';
      this.logGated('fail:' + why, 2.5, 'warn', text, why === 'unsupported' ? 2 : null);
    }
    serve(p, n) {
      this.remove(p);
      const k = CP.KINDS[p.kind];
      let r = k.reward * (this.m.income || 1) * (this.up.income ? 1.15 : 1);
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      if (this.streak % 25 === 0) { r += 2; this.emit('streak', this.streak); }
      this.credits += r; this.earned += r; this.served++;
      // The latency target covers interactive requests. Scans, tasks, and migrations are expected to be slow.
      if (!p.noLat && p.arr != null && !k.slow) this.lat.push({ t: this.t, ms: (this.t - p.arr) * 1000 });
      this.emit('serve', { p, node: n ? n.id : null, r });
      if (this.served % 9 === 0) this.log('dim', 'ok  ' + p.sql);
    }
    land(p) {
      this.remove(p);
      const th = CP.THREATS[p.threat];
      this.stat(p.threat).landed++;
      this.damage(th.dmg, th.budgetDmg || 0);
      this.emit('damage', { p, threat: p.threat, dmg: th.dmg });
      let line = 'INCIDENT  ' + p.sql + '  ← ' + th.name + ' (-' + th.dmg + ' integrity)';
      if (p.threat === 'badTask' && this.isOn('longTxn')) line += '. The transaction committed cleanly: nothing errored, so nothing rolled back';
      this.log('bad', line, th.sec);
      if (p.threat === 'rogue') this.flags.rogueSeen = (this.flags.rogueSeen || 0) + 1;
    }
    direct(threatId) {
      const th = CP.THREATS[threatId];
      const st = this.stat(threatId); st.spawned++; st.landed++;
      this.damage(th.dmg, 0);
      this.emit('damage', { p: null, threat: threatId, dmg: th.dmg });
      this.logGated('direct:' + threatId, 1.5, 'bad', 'INCIDENT  ' + th.sqls[0] + '  ← ' + th.name + ' (-' + th.dmg + ' integrity)', th.sec);
    }
    damage(dmg, budgetDmg) {
      this.integrity -= dmg; this.budget -= budgetDmg; this.landed++; this.streak = 0;
      this.dmgLog.push({ t: this.t, dmg });
    }
    // Used by scripted cards.
    hurt(dmg, text, sec) { this.damage(dmg, 0); this.emit('damage', { p: null, threat: null, dmg }); this.log('bad', 'INCIDENT  ' + text + ' (-' + dmg + ' integrity)', sec); }
    hurtBudget(amt, text) { this.budget -= amt; this.streak = 0; this.emit('refuse', { p: null }); this.log('bad', 'OUTAGE  ' + text + ' (-' + amt + ' error budget)', 4); }
    gain(c) { this.credits += c; this.earned += c; }

    complete(p, n) {
      const MODS = CP.MODS;
      if (p.kind === 'vector' && this.m.needsVector && !this.isOn('pgvector')) return this.fail(p, 'unsupported');
      // Branch-per-task: clean diffs merge, suspicious ones go to review.
      if (p.kind === 'task' && n.type === 'branch') {
        if (p.flagged) return this.hold(p, 'task', true);
        return this.serve(p, n);
      }
      if (p.threat) {
        const th = CP.THREATS[p.threat];
        if (th.contained && th.contained.includes(n.type)) return this.caught(p, n.type);
        if (!p.approved || p.threat !== 'hijack') {
          for (const id of this.activeList) {
            const d = MODS[id];
            if (d.at === 'db' && d.blocks && d.blocks.includes(p.threat)) return this.reject(p, id);
          }
        }
        n.flash = 1;
        return this.land(p);
      }
      if (p.kind === 'write' || p.kind === 'task') {
        if (n.type === 'leader' || n.type === 'shard') this.wps += 1 / 3;
        if (this.m.usesStale) this.stale += this.m.staleGain;
      }
      if (p.kind === 'read' && p.acts && n.type === 'replica') {
        const prob = clamp(this.lag * (this.m.staleK || 0.045), 0, 0.5) * (this.isOn('changeFeed') ? 0.2 : 1);
        if (this.rng() < prob) {
          this.spawn('staleAct');
          this.logGated('stale', 3, 'warn', 'STALE READ  an agent read a follower ' + this.lag.toFixed(1) + 's behind and is about to act on it', 5);
        }
      }
      if (p.kind === 'vector') {
        if (this.m.usesStale && this.rng() < this.stale * 0.13) { this.remove(p); n.flash = 1; return this.direct('wrongContext'); }
        if (this.isOn('hnsw') && this.rng() < MODS.hnsw.recallMiss) {
          this.spawn('vector');
          this.logGated('recall', 4, 'dim', 'approximate index missed a relevant result, the agent searches again', 3);
        }
      }
      this.serve(p, n);
    }

    // ------------------------------------------------------------ cards
    hold(p, poolId, post) {
      p.state = 'held'; p.noLat = true;
      const c = CP.drawCard(poolId, p, this.rng);
      const ttl = CARD_TTL * (this.up.calm ? 1.4 : 1);
      Object.assign(c, { id: ++this.cid, p, post, ttl, max: ttl, stuck: false });
      this.pushCard(c);
    }
    scripted(cardId) {
      const def = CP.SCRIPTED[cardId];
      const ttl = 30 * (this.up.calm ? 1.4 : 1);
      this.pushCard({ id: ++this.cid, scripted: cardId, heading: def.heading, sec: def.sec, sql: def.sql, ctx: def.ctx, options: def.options, ttl, max: ttl, stuck: false });
    }
    pushCard(c) {
      if (this.cards.length < MAX_CARDS) { this.cards.push(c); this.emit('card', c); }
      else this.pending.push(c);
    }
    answer(id, choice, timedOut) {
      const i = this.cards.findIndex((c) => c.id === id);
      if (i < 0) return null;
      const c = this.cards[i];
      let correct, explain, best = false;
      if (c.scripted) {
        const o = c.options[choice];
        if (!o || (o.requires && !this.isOn(o.requires))) return null;
        this.cards.splice(i, 1);
        o.effect(this);
        correct = !!o.good; explain = o.explain; best = correct && !o.neutral;
      } else {
        this.cards.splice(i, 1);
        const approve = choice === 'yes', p = c.p;
        correct = approve !== c.bad; explain = c.explain;
        if (approve) {
          p.approved = true;
          if (c.post) { if (c.bad) this.land(p); else this.serve(p, null); }
          else this.dispatch(p);
        } else if (c.bad) this.caught(p, 'review');
        else this.fail(p, 'denied');
      }
      if (!timedOut) {
        if (correct) { this.cardsRight++; this.cardRun++; if (best) this.cardsBest++; if (this.cardRun > this.bestCardRun) this.bestCardRun = this.cardRun; }
        else { this.cardsWrong++; this.cardRun = 0; }
      }
      if (this.pending.length) { const n = this.pending.shift(); this.cards.push(n); this.emit('card', n); }
      const res = { card: c, correct, explain, timedOut: !!timedOut };
      this.emit('answer', res);
      return res;
    }
    tickCards(dt) {
      const auto = this.isOn('approvalTimeout');
      for (const c of this.cards.slice()) {
        if (c.stuck) { this.budget -= 0.3 * dt; this.stuckTime += dt; continue; }
        c.ttl -= dt;
        if (c.ttl > 0) continue;
        if (c.scripted) {
          // Nobody decided: the worst non-gated option happens by default.
          let k = c.options.findIndex((o) => !o.good);
          if (k < 0) k = c.options.length - 1;
          this.answer(c.id, k, true);
        } else if (auto) {
          this.log('info', 'TIMEOUT  ' + c.sql + '  ← nobody answered, denied by default', 9);
          this.answer(c.id, 'no', true);
        } else {
          c.stuck = true;
          this.log('warn', 'STUCK  ' + c.sql + '  ← nobody answered. The work is waiting and burning error budget', 9);
          this.emit('stuck', c);
        }
      }
      if (this.pending.length) {
        this.budget -= 0.1 * dt * this.pending.length; this.stuckTime += dt;
        if (auto) {
          for (const c of this.pending.slice()) {
            c.ttl -= dt;
            if (c.ttl <= 0 && !c.scripted) {
              this.pending.splice(this.pending.indexOf(c), 1);
              if (c.bad) this.caught(c.p, 'review'); else this.fail(c.p, 'denied');
            }
          }
        }
      }
    }

    // ------------------------------------------------------------ abilities
    canUse(id) {
      const a = this.abil[id];
      if (!a || this.phase === 'won' || this.phase === 'lost') return false;
      if (id === 'rewind') return a.cd <= 0 && this.credits >= 20 && this.recentDamage() > 0;
      if (id === 'failover') return !!(this.nodes.leader && this.nodes.leader.down && this.isOn('replicas'));
      return false;
    }
    recentDamage() { let s = 0; for (const d of this.dmgLog) if (this.t - d.t <= 20) s += d.dmg; return s; }
    use(id) {
      if (!this.canUse(id)) return false;
      if (id === 'rewind') {
        const got = this.recentDamage();
        this.dmgLog = this.dmgLog.filter((d) => this.t - d.t > 20);
        this.integrity = Math.min(100, this.integrity + got);
        this.credits -= 20; this.budget -= 4;
        this.abil.rewind.cd = CP.ABILITIES.rewind.cd * (this.up.restore ? 0.7 : 1);
        this.rewinds++; this.rewound += got;
        this.log('ok', 'REWIND  replayed the write-ahead log to before the damage (+' + got + ' integrity). Good writes in that window are gone too', 7);
        this.emit('rewind', got);
      } else if (id === 'failover') this.failover(false);
      return true;
    }
    failover(auto) {
      const L = this.nodes.leader;
      if (!L.down) return;
      L.down = false; this.downT = 0;
      if (!this.isOn('syncRep') && this.lag > 0.25) {
        this.flags.failoverClean = false;
        this.damage(8, 0);
        this.emit('damage', { p: null, threat: null, dmg: 8 });
        this.log('bad', 'FAILOVER  promoted a follower that was ' + this.lag.toFixed(1) + 's behind. Writes it had not received are lost (-8 integrity)', 5);
      } else {
        if (this.flags.failoverClean == null) this.flags.failoverClean = true;
        this.log('ok', 'FAILOVER  ' + (auto ? 'followers voted and promoted a new leader. ' : 'follower promoted. ') + 'Nothing was lost: every write had been confirmed by a follower', auto ? 9 : 5);
      }
      this.emit('failover', auto);
    }

    fire(ev) {
      if (ev.type === 'card') this.scripted(ev.card);
      else if (ev.type === 'retryStorm') {
        this.temp.mult = { dup: 4 }; this.temp.until = this.wt + ev.dur;
        this.log('warn', 'RETRY STORM  the model provider is timing out. Agents are resending everything', 8);
        this.emit('event', ev);
      } else if (ev.type === 'leaderDown' && this.nodes.leader && this.nodes.leader.active) {
        const L = this.nodes.leader;
        L.down = true; this.downT = 0;
        for (const p of L.queue.concat(L.busy)) this.fail(p, 'down');
        L.queue = []; L.busy = [];
        this.log('bad', 'LEADER DOWN  the leader has crashed. Writes are failing' + (this.isOn('replicas') ? '. Promote a follower' : ''), 5);
        this.emit('event', ev);
      }
    }

    // ------------------------------------------------------------ step
    step(dt) {
      if (this.phase !== 'wave') return;
      const w = this.wave();
      this.t += dt; this.wt += dt;

      // spawn
      if (this.wt < w.dur) {
        const rate = lerp(w.rate[0], w.rate[1], this.wt / w.dur);
        this.spawnAcc += rate * dt;
        while (this.spawnAcc >= 1) { this.spawnAcc -= 0.7 + this.rng() * 0.6; this.spawn(this.pickMix(w)); }
      }
      // events
      const evs = w.events || [];
      while (this.fired < evs.length && this.wt >= evs[this.fired].at) this.fire(evs[this.fired++]);
      if (this.temp.until && this.wt >= this.temp.until) this.temp = {};

      // move
      for (const p of this.packets) {
        if (p.dead) continue;
        if (p.state === 'toGw' || p.state === 'toNode') {
          p.prog += dt / p.dur;
          if (p.prog >= 1) { if (p.state === 'toGw') this.gate(p); else this.arrive(p); }
        }
      }
      // serve
      for (const id in this.nodes) {
        const n = this.nodes[id];
        if (n.flash > 0) n.flash = Math.max(0, n.flash - dt * 2.5);
        if (!n.active || n.down) continue;
        for (let i = n.busy.length - 1; i >= 0; i--) {
          const p = n.busy[i];
          if (p.done <= this.t) { n.busy.splice(i, 1); this.complete(p, n); }
        }
        while (n.busy.length < n.workers && n.queue.length) {
          const p = n.queue.shift();
          p.state = 'service'; p.done = this.t + this.svcTime(p, n);
          n.busy.push(p);
        }
      }
      if (this.packets.length > 40 || this.packets.some((p) => p.dead)) this.packets = this.packets.filter((p) => !p.dead);

      this.tickCards(dt);

      // leader outage
      const L = this.nodes.leader;
      if (L && L.down) {
        this.downT += dt;
        if (this.isOn('autoFailover') && this.isOn('replicas')) { if (this.downT >= 1.5) this.failover(true); }
        else if (!this.isOn('replicas') && this.downT >= 10) {
          L.down = false; this.flags.failoverClean = false;
          this.log('warn', 'RESTART  the leader came back after 10 seconds. With no follower there was nothing to promote', 5);
        } else if (this.downT >= 16) this.failover(true);
      }

      // the audit log can name the agent once there is a pattern to see
      if ((this.flags.rogueSeen || 0) >= 2 && !this.flags.rogueCard && !this.flags.rogueRevoked && this.isOn('auditLog')) {
        this.flags.rogueCard = true;
        this.scripted('revoke');
      }

      // replication lag
      this.wps *= Math.exp(-dt / 3);
      const lagTarget = this.isOn('replicas') && !this.isOn('syncRep') ? 0.15 + 0.28 * this.wps : 0;
      this.lag += (lagTarget - this.lag) * Math.min(1, dt * 1.5);

      // derived-data staleness
      if (this.m.usesStale) {
        if (this.isOn('cdcEmbed')) this.stale -= 0.6 * dt;
        if (this.isOn('nightlyBatch')) {
          this.batchT += dt;
          if (this.batchT >= 15) { this.batchT = 0; this.stale = this.staleFloor; this.log('info', 'BATCH  re-embedded every changed row', 10); this.emit('batch'); }
        }
        this.stale = clamp(this.stale, this.staleFloor, 1);
      }
      if (this.rebalance > 0) this.rebalance -= dt;

      // upkeep
      let upkeep = 0;
      for (const id of this.activeList) {
        let u = CP.MODS[id].upkeep || 0;
        if (id === 'perAgent' && this.isOn('scaleToZero')) u *= 0.1;
        upkeep += u;
      }
      this.upkeep = upkeep;
      this.credits = Math.max(0, this.credits - upkeep * dt);

      // latency
      this.p99T -= dt;
      if (this.p99T <= 0) { this.p99T = 0.2; this.calcP99(); }
      if (this.p99 > this.m.slo) this.budget -= clamp((this.p99 / this.m.slo - 1) * 2.5, 0.4, 4) * dt;
      else if (this.up.regen) this.budget = Math.min(100, this.budget + 0.4 * dt);
      if (this.up.repair) this.integrity = Math.min(100, this.integrity + 0.12 * dt);

      for (const id in this.abil) if (this.abil[id].cd > 0) this.abil[id].cd -= dt;
      while (this.dmgLog.length && this.t - this.dmgLog[0].t > 30) this.dmgLog.shift();

      // end conditions
      if (this.integrity <= 0) { this.integrity = 0; return this.lose('integrity'); }
      if (this.budget <= 0) { this.budget = 0; return this.lose('budget'); }
      if (this.wt >= w.dur) {
        if (this.wt >= w.dur + 45) { // nothing may hang a wave forever
          for (const c of this.cards.slice()) this.answer(c.id, c.scripted ? c.options.length - 1 : 'no', true);
          this.packets = []; this.pending = [];
          for (const id in this.nodes) { this.nodes[id].queue = []; this.nodes[id].busy = []; }
        }
        if (!this.packets.length && !this.cards.length && !this.pending.length) this.endWave();
      }
    }

    calcP99() {
      const cut = this.t - 8;
      while (this.lat.length && this.lat[0].t < cut) this.lat.shift();
      const xs = this.lat.map((s) => s.ms);
      // Requests still waiting count too, or a jammed queue would look healthy.
      for (const id in this.nodes) {
        const q = this.nodes[id].queue;
        for (const p of q) if (!p.threat && !CP.KINDS[p.kind].slow) { xs.push((this.t - p.arr) * 1000); break; }
      }
      if (!xs.length) { this.p99 *= 0.8; return; }
      xs.sort((a, b) => a - b);
      const v = xs[Math.floor(0.99 * (xs.length - 1))];
      this.p99 += (v - this.p99) * 0.5;
      if (this.p99 > this.maxP99) this.maxP99 = this.p99;
    }

    endWave() {
      const bonus = 15 + 5 * this.waveIdx;
      this.credits += bonus;
      this.emit('waveEnd', { idx: this.waveIdx, bonus });
      if (this.isLastWave()) { this.phase = 'won'; this.emit('won'); }
      else { this.phase = 'build'; this.log('info', 'Wave clear. +' + bonus + ' credits'); }
    }
    lose(why) { this.phase = 'lost'; this.lostWhy = why; this.emit('lost', why); }

    stars() {
      if (this.phase !== 'won') return 0;
      const s = this.m.stars;
      if (this.integrity >= s.three.i && this.budget >= s.three.b) return 3;
      if (this.integrity >= s.two.i && this.budget >= s.two.b) return 2;
      return 1;
    }
  }

  CP.Sim = Sim;
})();
