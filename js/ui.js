(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});
  const esc = CP.esc;
  const $ = (id) => document.getElementById(id);

  function stars(n, big, animate) {
    let h = '<span class="stars' + (big ? ' big' : '') + '">';
    for (let i = 0; i < 3; i++) h += '<i class="star' + (i < n ? ' on' : '') + '"' + (animate && i < n ? ' style="animation-delay:' + (0.25 + i * 0.3) + 's"' : big ? ' style="animation:none"' : '') + '></i>';
    return h + '</span>';
  }
  function threatsIn(m) {
    const seen = {}, out = [];
    for (const w of m.waves) for (const k in w.mix) if (CP.THREATS[k] && !seen[k]) { seen[k] = 1; out.push(k); }
    if (m.usesStale) out.push('wrongContext');
    if (m.modules.includes('replicas') && m.waves.some((w) => w.mix.actread)) out.push('staleAct');
    return out.filter((k, i) => out.indexOf(k) === i);
  }
  function paras(list) { return list.map((p) => '<p>' + p + '</p>').join(''); }
  function briefCols(b) {
    return '<div class="cols3">' +
      '<div class="pane glass"><h3>The concept</h3>' + paras(b.concept) + '</div>' +
      '<div class="pane glass agents"><h3>What agents change</h3>' + paras(b.agents) + '</div>' +
      '<div class="pane glass pg"><h3>In Postgres and Supabase</h3>' + paras(b.pg) + '</div></div>';
  }

  const T = {
    title() {
      const has = CP.store.hasProgress(), d = CP.store.data, r = CP.rankFor(d.xp);
      let wal = '';
      const recs = ['INSERT orders', 'COMMIT', 'UPDATE accounts', 'CHECKPOINT', 'INSERT events', 'COMMIT', 'ALTER TABLE users', 'INSERT embeddings', 'COMMIT', 'DELETE sessions'];
      for (let i = 0; i < 24; i++) wal += '0/' + (0x16b3740 + i * 0x1c8).toString(16).toUpperCase() + ' ' + recs[i % recs.length] + ' &nbsp;·&nbsp; ';
      return '<section class="title"><div class="logo">' +
        '<div class="kicker">A game about data systems in the agent era</div>' +
        '<h1>Control<br>Plane</h1>' +
        '<p>Agents now create most new databases. They write their own SQL, cannot be fully trusted, and work at machine speed. You are on call.</p>' +
        '<div class="wal"><span>' + wal + wal + '</span></div></div>' +
        '<div class="menu">' +
        '<button class="btn primary" data-act="play">' + (has ? 'Continue' : 'Start') + '</button>' +
        '<button class="btn" data-act="go" data-to="codex">Codex</button>' +
        '<button class="btn" data-act="go" data-to="settings">Settings</button>' +
        '<div class="meta">' + (has ? esc(r.name) + '<br>' + CP.store.totalStars() + ' of 33 stars · ' + d.xp + ' xp' : '11 missions · endless mode<br>Progress is saved in this browser') + '</div>' +
        '</div></section>';
    },

    map() {
      const s = CP.store, d = s.data, r = CP.rankFor(d.xp), free = s.freeStars();
      let marked = false, cards = '';
      CP.MISSIONS.forEach((m, i) => {
        const st = d.missions[m.id] || {}, open = s.unlocked(m.id), next = open && !st.wins && !marked;
        if (next) marked = true;
        cards += '<button class="mcard' + (open ? '' : ' locked') + (next ? ' next' : '') + '" data-act="mission" data-id="' + m.id + '">' +
          '<div class="lsn"><span>LSN 0/' + (0x16b3740 + i * 0x2a40).toString(16).toUpperCase() + '</span><span>§' + m.n + '</span></div>' +
          '<h3>' + esc(m.title) + '</h3><div class="sub">' + esc(m.sub) + '</div>' +
          '<div class="foot">' + (open ? stars(st.stars || 0) : '<span class="medal">LOCKED</span>') +
          '<span class="medal' + (st.medal ? ' on' : '') + '">' + (st.medal ? 'MEDAL' : 'NO MEDAL') + '</span></div></button>';
      });
      const eo = s.unlocked('endless');
      cards += '<button class="mcard endless' + (eo ? '' : ' locked') + '" data-act="mission" data-id="endless">' +
        '<div class="lsn"><span>LSN ∞</span><span>ENDLESS</span></div><h3>Production</h3>' +
        '<div class="sub">' + (eo ? 'Escalating waves with every threat. How long can you hold?' : 'Complete mission 6 to unlock.') + '</div>' +
        '<div class="foot"><span class="medal' + (d.endless.bestWave ? ' on' : '') + '">BEST: ' + d.endless.bestWave + ' WAVES</span></div></button>';
      return '<div class="wrap">' +
        '<div class="topnav"><h2>The write-ahead log</h2><button class="btn small" data-act="go" data-to="title">Title</button></div>' +
        '<div class="profile glass"><div><div class="kicker">Rank ' + (r.index + 1) + ' of ' + CP.RANKS.length + '</div><div class="rank">' + esc(r.name) + '</div>' +
        '<div class="xpbar"><i style="width:' + Math.round(r.frac * 100) + '%"></i></div>' +
        '<div class="dim mono" style="font-size:11px;margin-top:5px">' + d.xp + ' xp' + (r.next ? ' · next rank at ' + r.next.xp : ' · top rank') + '</div></div>' +
        '<div class="pstat"><b>' + s.totalStars() + '/33</b><span>Stars</span></div>' +
        '<div class="pstat"><b>' + s.medals() + '/11</b><span>Medals</span></div>' +
        '<div class="pstat"><b>' + Object.keys(d.ach).length + '/' + CP.ACHIEVEMENTS.length + '</b><span>Achievements</span></div></div>' +
        '<div class="navrow">' +
        '<button class="btn small" data-act="go" data-to="codex">Codex</button>' +
        '<button class="btn small" data-act="go" data-to="upgrades">Upgrades' + (free > 0 ? '<span class="pip">' + free + '</span>' : '') + '</button>' +
        '<button class="btn small" data-act="go" data-to="achievements">Achievements</button>' +
        '<button class="btn small" data-act="go" data-to="settings">Settings</button></div>' +
        '<div class="log">' + cards + '</div></div>';
    },

    brief(m) {
      const st = CP.store.data.missions[m.id] || {};
      const tools = m.modules.map((id) => '<span class="tag">' + esc(CP.MODS[id].name) + '</span>').join('') +
        (m.abilities || []).map((id) => '<span class="tag">' + esc(CP.ABILITIES[id].name) + '</span>').join('');
      let body;
      if (m.endless) {
        body = '<div class="pane glass" style="margin-bottom:16px"><h3>Endless mode</h3><p>Waves never stop and each one is heavier than the last. Every threat from the campaign can appear. The run ends when integrity or error budget reaches zero.</p><p>Your best run is saved.</p></div>';
      } else body = briefCols(m.brief);
      const threats = m.endless ? '' : threatsIn(m).map((k) => '<span class="tag threat">' + esc(CP.THREATS[k].name) + '</span>').join('');
      return '<div class="wrap">' +
        '<div class="brief-head"><div><div class="kicker">' + (m.endless ? 'Endless' : 'Mission ' + m.n + ' · section ' + m.n + ' of the guide') + '</div>' +
        '<h2>' + esc(m.title) + '</h2><div class="tagline">' + esc(m.endless ? m.tagline : m.sub + '. ' + m.tagline) + '</div></div>' +
        '<div>' + (m.endless ? '' : stars(st.stars || 0)) + '</div></div>' + body +
        '<div class="loadout"><div class="pane glass"><p class="label">Tools you can buy</p><div class="chips">' + tools + '</div>' +
        (threats ? '<p class="label" style="margin-top:14px">Threats to expect</p><div class="chips">' + threats + '</div>' : '') + '<p></p></div>' +
        '<div class="pane glass"><p class="label">Stars</p><p>1 star: finish every wave.<br>2 stars: integrity ' + m.stars.two.i + '+, error budget ' + m.stars.two.b + '+.<br>3 stars: integrity ' + m.stars.three.i + '+, error budget ' + m.stars.three.b + '+.</p>' +
        (m.challenge ? '<p class="label">Challenge medal</p><p>' + esc(m.challenge.text) + '.</p>' : '') + '</div></div>' +
        '<div class="actions"><button class="btn primary" data-act="deploy" data-id="' + m.id + '">Go on call</button>' +
        '<button class="btn" data-act="go" data-to="map">Back</button></div></div>';
    },

    debrief(res) {
      const m = res.mission, won = res.won;
      let head;
      if (m.endless) head = '<div class="kicker">Endless · run over</div><h2>' + res.waves + ' wave' + (res.waves === 1 ? '' : 's') + ' held</h2>';
      else if (won) head = '<div class="kicker">Mission ' + m.n + ' complete</div><h2>Shift handed over</h2>' + stars(res.stars, true, !res.shown);
      else head = '<div class="kicker">Mission ' + m.n + ' failed</div><h2>' + (res.why === 'integrity' ? 'Data lost' : 'Error budget spent') + '</h2>';
      const why = won && m.id === 'm11' ? 'Campaign complete. You have run a database platform for its majority user. Endless mode, medals, and three-star runs remain.' : won ? (res.stars === 3 ? 'Data intact and users served. Three stars.' : 'You finished every wave. Higher integrity and error budget earn more stars.')
        : res.why === 'integrity' ? 'Integrity reached zero: too many wrong changes landed in production. The table below shows which threats got through and what stops each one.'
        : 'Error budget reached zero: p99 stayed over target, legitimate requests were refused, or work sat stuck. Look for a tool that is costing more than it protects, or load a single machine cannot serve.';
      let rows = '';
      const keys = Object.keys(res.threats).sort((a, b) => res.threats[b].landed - res.threats[a].landed);
      for (const k of keys) {
        const t = CP.THREATS[k], s = res.threats[k];
        rows += '<tr><td><b>' + esc(t.name) + '</b><span class="sec">§' + t.sec + '</span>' + (s.landed ? '<small>' + esc(t.counter) + '</small>' : '') + '</td>' +
          '<td class="n good">' + s.blocked + '</td><td class="n ' + (s.landed ? 'bad' : '') + '">' + s.landed + '</td></tr>';
      }
      if (!rows) rows = '<tr><td colspan="3" class="dim">No threats in this mission. It was decided by load.</td></tr>';
      let quiz = '';
      if (won && m.quiz && m.quiz.length) {
        quiz = '<div class="pane glass quiz"><h3>Incident review</h3><p class="dim" style="font-size:12px">30 xp for each answer you get right the first time.</p>';
        m.quiz.forEach((q, qi) => {
          const ans = res.quizAns[qi];
          quiz += '<div class="q"><p>' + (qi + 1) + '. ' + esc(q.q) + '</p><div class="opts">';
          q.a.forEach((a, ai) => {
            let cls = 'opt';
            if (ans != null) { if (ai === q.correct) cls += ' right'; else if (ai === ans) cls += ' wrong'; }
            quiz += '<button class="' + cls + '" data-act="quiz" data-q="' + qi + '" data-a="' + ai + '"' + (ans != null ? ' disabled' : '') + '>' + esc(a) + '</button>';
          });
          quiz += '</div>' + (ans != null ? '<div class="why">' + esc(q.why) + '</div>' : '') + '</div>';
        });
        quiz += '</div>';
      }
      let xp = '';
      let total = 0;
      for (const l of res.xpLines) { xp += '<div><span>' + esc(l.label) + '</span><b>+' + l.xp + '</b></div>'; total += l.xp; }
      const r = CP.rankFor(CP.store.data.xp);
      const nextId = !m.endless && won ? (CP.MISSIONS[m.n] || {}).id : null;
      return '<div class="wrap">' +
        '<div class="result glass ' + (won ? 'won' : 'lost') + '">' + head + '<p>' + why + '</p></div>' +
        '<div class="grid2"><div>' +
        '<div class="kv" style="margin-bottom:14px">' +
        '<div><b>' + Math.round(res.integrity) + '</b><span>Integrity</span></div><div><b>' + Math.round(res.budget) + '</b><span>Error budget</span></div><div><b>' + Math.round(res.maxP99) + ' ms</b><span>Worst p99</span></div>' +
        '<div><b>' + res.served + '</b><span>Served</span></div><div><b>' + res.refused + '</b><span>Good requests refused</span></div><div><b>' + res.bestStreak + '</b><span>Best clean streak</span></div></div>' +
        '<div class="pane glass" style="margin-bottom:14px"><h3>What reached you</h3><table class="th"><tr><th>Threat</th><th style="text-align:right">Stopped</th><th style="text-align:right">Landed</th></tr>' + rows + '</table><p></p></div>' +
        (m.challenge && won ? '<div class="pane glass" style="margin-bottom:14px"><h3>Challenge medal</h3><p>' + esc(m.challenge.text) + ': <b style="color:' + (res.medal ? 'var(--cyan)' : 'var(--muted)') + '">' + (res.medal ? 'earned' : 'not this time') + '</b></p></div>' : '') +
        '</div><div>' + quiz +
        '<div class="pane glass" style="margin-top:' + (quiz ? '14px' : '0') + '"><h3>Experience</h3><div class="xplines">' + xp + '<div class="total"><span>Total</span><b>+' + total + ' xp</b></div></div>' +
        '<div style="margin:12px 0 4px" class="dim mono">' + esc(r.name) + '</div><div class="xpbar"><i style="width:' + Math.round(r.frac * 100) + '%"></i></div><p></p></div>' +
        '</div></div>' +
        '<div class="actions">' +
        (nextId ? '<button class="btn primary" data-act="mission" data-id="' + nextId + '">Next mission</button>' : '') +
        '<button class="btn' + (nextId ? '' : ' primary') + '" data-act="deploy" data-id="' + m.id + '">' + (won ? 'Play again' : 'Try again') + '</button>' +
        '<button class="btn" data-act="go" data-to="map">Mission log</button></div></div>';
    },

    codex(tab) {
      const s = CP.store, d = s.data;
      const tabs = [['chapters', 'Chapters'], ['threats', 'Threats'], ['tools', 'Tools'], ['principles', 'Principles'], ['cheat', 'Cheat sheet']];
      let body = '';
      if (tab === 'chapters') {
        for (const m of CP.MISSIONS) {
          if (!s.unlocked(m.id)) { body += '<div class="chapter glass" style="opacity:.45"><div class="kicker">Section ' + m.n + '</div><h3>Locked</h3><p class="dim">Complete mission ' + (m.n - 1) + ' to read this chapter.</p></div>'; continue; }
          body += '<div class="chapter glass"><div class="kicker">Section ' + m.n + '</div><h3>' + esc(m.sub) + '</h3><div class="dim">' + esc(m.tagline) + '</div>' + briefCols(m.brief).replace(/ glass/g, '') + '</div>';
        }
      } else if (tab === 'threats') {
        body = '<div class="entries">';
        for (const k in CP.THREATS) {
          const t = CP.THREATS[k];
          if (!d.seen.threats[k]) { body += '<div class="entry glass locked"><h3>Not yet encountered<span class="sec">§' + t.sec + '</span></h3><p>An incident you have not had.</p></div>'; continue; }
          body += '<div class="entry glass"><h3>' + esc(t.name) + '<span class="sec">§' + t.sec + '</span></h3><p>' + esc(t.what) + '</p><p>' + esc(t.lesson) + '</p><p class="counter">' + esc(t.counter) + '</p></div>';
        }
        body += '</div>';
      } else if (tab === 'tools') {
        body = '<div class="entries">';
        const shown = {};
        for (const m of CP.MISSIONS) {
          const open = s.unlocked(m.id);
          for (const id of m.modules) {
            if (shown[id]) continue; shown[id] = 1;
            const t = CP.MODS[id];
            if (!open) { body += '<div class="entry glass locked"><h3>Locked<span class="sec">§' + t.sec + '</span></h3><p>Reach mission ' + m.n + '.</p></div>'; continue; }
            body += '<div class="entry glass"><h3>' + esc(t.name) + '<span class="sec">§' + t.sec + '</span></h3><p>' + esc(t.desc) + '</p><p class="trade">' + esc(t.tradeoff) + '</p><p class="pgn">' + esc(t.pg) + '</p></div>';
          }
        }
        body += '</div>';
      } else if (tab === 'principles') {
        const open = s.unlocked('m11');
        body = '<p class="dim" style="max-width:52em">Six principles the book does not state, because its user was a developer.' + (open ? '' : ' Reach mission 11 to read them.') + '</p><div class="entries">';
        CP.PRINCIPLES.forEach((p, i) => {
          body += open ? '<div class="entry glass"><h3>' + (i + 1) + '. ' + esc(p.name) + '</h3><p>' + esc(p.text) + '</p></div>' : '<div class="entry glass locked"><h3>Principle ' + (i + 1) + '</h3><p>Locked.</p></div>';
        });
        body += '</div>';
      } else {
        body = '<div class="pane glass"><table class="th cheat"><tr><th>Concept</th><th>What the book teaches</th><th>How it evolves with agents</th><th>Postgres and Supabase</th></tr>';
        for (const c of CP.CHEATS) {
          const open = (d.missions[c.m] || {}).wins > 0;
          body += open ? '<tr><td><b>' + esc(c.concept) + '</b></td><td>' + esc(c.book) + '</td><td>' + esc(c.agents) + '</td><td>' + esc(c.pg) + '</td></tr>'
            : '<tr class="locked"><td><b>' + esc(c.concept) + '</b></td><td colspan="3">Complete mission ' + c.m.slice(1) + ' to fill in this row.</td></tr>';
        }
        body += '</table><p></p></div>';
      }
      return '<div class="wrap"><div class="topnav"><h2>Codex</h2><button class="btn small" data-act="back">Back</button></div>' +
        '<div class="tabs">' + tabs.map((t) => '<button class="tab' + (t[0] === tab ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' + body + '</div>';
    },

    upgrades() {
      const s = CP.store, free = s.freeStars();
      let body = '<div class="entries">';
      for (const u of CP.UPGRADES) {
        const lv = s.data.upgrades[u.id] || 0, max = u.cost.length, cost = u.cost[lv];
        body += '<div class="up glass' + (lv >= max ? ' owned' : '') + '"><h3>' + esc(u.name) + (max > 1 ? ' <span class="sec">' + lv + '/' + max + '</span>' : '') + '</h3><p>' + esc(u.desc) + '</p>' +
          (lv >= max ? '<span class="medal on">OWNED</span>' : '<button class="btn small' + (free >= cost ? ' primary' : '') + '" data-act="upgrade" data-id="' + u.id + '"' + (free >= cost ? '' : ' disabled') + '>Buy · ' + cost + ' star' + (cost > 1 ? 's' : '') + '</button>') + '</div>';
      }
      return '<div class="wrap"><div class="topnav"><h2>Upgrades</h2><span class="pstat"><b>' + free + '</b><span>Stars to spend</span></span><button class="btn small" data-act="back">Back</button></div>' +
        '<p class="dim" style="max-width:52em">Stars you earn in missions buy permanent upgrades. Spending a star does not remove it from your total.</p>' + body + '</div></div>';
    },

    achievements() {
      const d = CP.store.data;
      let body = '<div class="entries">';
      for (const a of CP.ACHIEVEMENTS) body += '<div class="ach glass' + (d.ach[a.id] ? ' on' : '') + '"><i class="badge"></i><div><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></div></div>';
      return '<div class="wrap"><div class="topnav"><h2>Achievements</h2><button class="btn small" data-act="back">Back</button></div>' + body + '</div></div>';
    },

    settings(msg) {
      const st = CP.store.data.settings;
      return '<div class="wrap" style="max-width:820px"><div class="topnav"><h2>Settings</h2><button class="btn small" data-act="back">Back</button></div>' +
        '<div class="pane glass">' +
        '<div class="setrow"><label for="set-sfx">Sound effects</label><input id="set-sfx" type="range" min="0" max="1" step="0.05" value="' + st.sfx + '" data-set="sfx"></div>' +
        '<div class="setrow"><label for="set-mus">Music</label><input id="set-mus" type="range" min="0" max="1" step="0.05" value="' + st.music + '" data-set="music"></div>' +
        '<div class="setrow"><label for="set-rm">Reduce motion (no screen shake, fewer particles)</label><input id="set-rm" type="checkbox" data-set="reduceMotion"' + (st.reduceMotion ? ' checked' : '') + '></div>' +
        '<div class="setrow"><label for="set-ip">Pause and explain the first time a new threat lands</label><input id="set-ip" type="checkbox" data-set="incidentPause"' + (st.incidentPause ? ' checked' : '') + '></div>' +
        '<div class="setrow" style="border:0;align-items:start"><div>Save data<div class="dim" style="font-size:12px">Stored in this browser only' + (CP.store.ok ? '.' : '. This browser is blocking storage, so progress will not be kept.') + '</div></div><div>' +
        '<div class="actions" style="margin:0 0 10px"><button class="btn small" data-act="exportSave">Export</button><button class="btn small" data-act="importSave">Import</button><button class="btn small danger" data-act="resetSave">Erase progress</button></div>' +
        '<textarea class="io" id="io" spellcheck="false" placeholder="Export writes your save here. To import, paste a save here and press Import."></textarea>' +
        '<div class="dim mono" id="io-msg" style="font-size:11px;margin-top:6px">' + esc(msg || '') + '</div></div></div>' +
        '</div><p class="dim mono" style="font-size:11px;margin-top:14px">Control Plane ' + CP.VERSION + '</p></div>';
    },
  };

  // ------------------------------------------------------------------ modals
  const M = {
    howto() {
      return '<div class="mbox"><div class="kicker">Before your first shift</div><h2>How this works</h2><ul>' +
        '<li>Agents send requests from the left, through the gateway, to your database. Good requests earn <b>credits</b>.</li>' +
        '<li>Red requests are <b>threats</b>. If one lands, you lose <b>integrity</b>.</li>' +
        '<li><b>Error budget</b> drains while p99 latency is over target, and each time you refuse a good request.</li>' +
        '<li>Buy and switch <b>tools</b> in the right-hand panel. Every tool has a cost. Read it.</li>' +
        '<li>The event log on the left explains what each tool stopped and what each incident was.</li>' +
        '<li><kbd>Space</kbd> starts a wave or pauses. You can buy tools and answer reviews while paused. <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> set speed.</li></ul>' +
        '<button class="btn primary" data-act="closeModal">Start</button></div>';
    },
    incident(k) {
      const t = CP.THREATS[k];
      return '<div class="mbox incident"><div class="kicker">First incident · section ' + t.sec + '</div><h2>' + esc(t.name) + '</h2>' +
        '<p><b>' + esc(t.what) + '</b></p><p>' + esc(t.lesson) + '</p>' +
        '<div class="counter"><b>What stops it</b>' + esc(t.counter) + '</div>' +
        '<button class="btn primary" data-act="closeModal">Back to the console</button> <span class="dim mono" style="font-size:11px;margin-left:10px">The game is paused. Added to the codex.</span></div>';
    },
    pause(m) {
      return '<div class="mbox"><div class="kicker">Paused</div><h2>' + esc(m.title) + '</h2><div class="stack">' +
        '<button class="btn primary" data-act="closeModal">Resume</button>' +
        (m.brief ? '<button class="btn" data-act="showBrief">Read the briefing</button>' : '') +
        '<button class="btn" data-act="restart">Restart mission</button>' +
        '<button class="btn" data-act="quit">Leave to mission log</button></div></div>';
    },
    brief(m) {
      return '<div class="mbox" style="width:min(1000px,100%)"><div class="kicker">Briefing · section ' + m.n + '</div><h2>' + esc(m.sub) + '</h2>' + briefCols(m.brief) +
        '<button class="btn primary" data-act="closeModal">Back to the console</button></div>';
    },
    confirmReset() {
      return '<div class="mbox incident"><div class="kicker">Erase progress</div><h2>Are you sure?</h2><p>This deletes your stars, experience, upgrades, and achievements from this browser. It cannot be undone.</p>' +
        '<div class="stack"><button class="btn danger" data-act="doReset">Erase everything</button><button class="btn primary" data-act="closeModal">Keep my progress</button></div></div>';
    },
  };

  // ------------------------------------------------------------------ HUD
  const hud = {
    tools: {}, abils: {}, cardEls: {}, last: {},
    build(sim) {
      const m = sim.m;
      this.tools = {}; this.abils = {}; this.cardEls = {}; this.last = {};
      $('h-n').textContent = m.endless ? 'ENDLESS' : 'M' + m.n;
      $('h-title').textContent = m.title;
      $('feed').innerHTML = ''; $('cards').innerHTML = '';
      let h = '';
      for (const id of m.modules) {
        const d = CP.MODS[id];
        h += '<button class="tool" data-act="tool" data-id="' + id + '" id="tool-' + id + '"><div class="t-head"><span class="t-name">' + esc(d.name) + '</span><span class="sec">§' + d.sec + '</span><span class="t-state"></span></div>' +
          '<div class="t-desc">' + esc(d.desc) + '</div><div class="t-trade">' + esc(d.tradeoff) + '</div></button>';
      }
      $('tools').innerHTML = h;
      for (const id of m.modules) this.tools[id] = { el: $('tool-' + id), state: $('tool-' + id).querySelector('.t-state'), key: '' };
      h = '';
      for (const id of m.abilities || []) {
        const a = CP.ABILITIES[id];
        h += '<button class="abil" data-act="abil" data-id="' + id + '" id="abil-' + id + '" title="' + esc(a.desc + ' ' + a.tradeoff) + '"><kbd>' + a.key + '</kbd><b>' + esc(a.name) + '</b><small></small><i class="cd"></i></button>';
      }
      $('abils').innerHTML = h; $('abils').hidden = !h;
      for (const id of m.abilities || []) { const el = $('abil-' + id); this.abils[id] = { el, note: el.querySelector('small'), cd: el.querySelector('.cd'), key: '' }; }
      // legend
      const kinds = {};
      for (const w of m.waves.length ? m.waves : [sim.wave(0)]) for (const k in w.mix) { const kind = CP.THREATS[k] ? null : (CP.ALIASES[k] ? CP.ALIASES[k].kind : k); if (kind) kinds[kind] = 1; }
      h = '';
      for (const k in kinds) h += '<span><i style="background:' + CP.KINDS[k].color + '"></i>' + esc(CP.KINDS[k].label) + '</span>';
      h += '<span><i style="background:#ff4d6d"></i>Threat</span>';
      $('legend').innerHTML = h;
    },
    setText(id, v) { if (this.last[id] !== v) { this.last[id] = v; $(id).textContent = v; } },
    meter(id, frac, text, cls) {
      const el = $(id), key = Math.round(frac * 200) + text + cls;
      if (this.last[id] === key) return;
      this.last[id] = key;
      el.querySelector('i').style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%';
      el.querySelector('.val').textContent = text;
      el.classList.toggle('warn', cls === 'warn'); el.classList.toggle('crit', cls === 'crit');
    },
    update(sim, app) {
      const m = sim.m, w = sim.waveIdx >= 0 ? sim.wave() : null;
      const total = m.endless ? '' : '/' + m.waves.length;
      this.setText('h-wave', sim.waveIdx < 0 ? 'Not started' : 'Wave ' + (sim.waveIdx + 1) + total + ' · ' + w.name);
      $('h-wavebar').style.width = (sim.phase === 'wave' && w ? Math.min(100, sim.wt / w.dur * 100) : sim.phase === 'build' && sim.waveIdx >= 0 ? 100 : 0) + '%';
      this.meter('m-int', sim.integrity / 100, Math.max(0, Math.round(sim.integrity)) + ' / 100', sim.integrity < 30 ? 'crit' : sim.integrity < 60 ? 'warn' : '');
      this.meter('m-bud', sim.budget / 100, Math.max(0, Math.round(sim.budget)) + ' / 100', sim.budget < 30 ? 'crit' : sim.budget < 60 ? 'warn' : '');
      this.meter('m-p99', sim.p99 / (m.slo * 2), Math.round(sim.p99) + ' ms · target ' + m.slo, sim.p99 > m.slo ? 'crit' : sim.p99 > m.slo * 0.8 ? 'warn' : '');
      const cr = Math.floor(sim.credits);
      if (this.last.cr !== cr) {
        if (this.last.cr != null && cr > this.last.cr + 4) { const e = $('m-cr'); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
        this.last.cr = cr; $('m-cr').querySelector('.val').textContent = cr;
      }
      const up = sim.upkeep ? '-' + sim.upkeep.toFixed(1) + '/s' : '';
      if (this.last.up !== up) { this.last.up = up; $('m-cr').querySelector('.sub').textContent = up; }
      if (this.last.streak !== sim.streak) { this.last.streak = sim.streak; $('m-streak').querySelector('.val').textContent = sim.streak; }

      // tools
      for (const id in this.tools) {
        const t = this.tools[id], s = sim.mods[id];
        let cls, label;
        if (!s.owned) { const c = sim.cost(id); cls = sim.credits >= c ? 'can' : 'cant'; label = c ? c + ' cr' : 'FREE'; }
        else if (s.on && !sim.isOn(id)) { cls = 'off muted'; label = 'OVERRIDDEN'; }
        else if (s.on) { cls = 'on'; label = 'ON'; }
        else { cls = 'off'; label = 'OFF'; }
        const key = cls + label;
        if (t.key !== key) { t.key = key; t.el.className = 'tool ' + cls; t.state.textContent = label; }
      }
      // abilities
      for (const id in this.abils) {
        const a = this.abils[id], st = sim.abil[id], can = sim.canUse(id);
        let note, cls = 'abil', cdw = 0;
        if (id === 'rewind') {
          const got = sim.recentDamage();
          if (st.cd > 0) { note = 'Ready in ' + Math.ceil(st.cd) + 's'; cdw = 100 - st.cd / CP.ABILITIES.rewind.cd * 100; }
          else if (!got) note = 'Nothing to undo in the last 20s';
          else if (sim.credits < 20) note = 'Needs 20 credits';
          else { note = 'Restore ' + got + ' integrity · costs 20 credits, 4 budget'; cls += ' ready'; }
        } else {
          const L = sim.nodes.leader;
          if (L && L.down) { if (can) { note = 'The leader is down. Promote now'; cls += ' urgent'; } else note = 'No follower to promote'; }
          else note = 'Only when the leader is down';
        }
        const key = cls + note;
        if (a.key !== key) { a.key = key; a.el.className = cls; a.note.textContent = note; a.el.disabled = !can; }
        a.cd.style.width = cdw + '%';
      }
      // cards
      const live = {};
      for (const c of sim.cards) {
        live[c.id] = 1;
        let e = this.cardEls[c.id];
        if (!e) { e = this.cardEls[c.id] = this.makeCard(c, sim); $('cards').insertBefore(e.el, $('cards').firstChild); }
        e.bar.style.width = Math.max(0, c.ttl / c.max * 100) + '%';
        if (c.stuck !== e.stuck) { e.stuck = c.stuck; e.el.classList.toggle('stuck', c.stuck); if (c.stuck) e.head.textContent = 'STUCK · burning error budget'; }
        if (c.scripted) for (const b of e.gated) b.btn.disabled = !sim.isOn(b.req);
      }
      for (const id in this.cardEls) if (!live[id]) { this.cardEls[id].el.remove(); delete this.cardEls[id]; }
      this.setText('cards-n', sim.pending.length ? '+' + sim.pending.length + ' waiting' : '');

      // wave call-to-action
      const cta = $('cta'), showCta = sim.phase === 'build' && !app.ended;
      if (showCta) {
        const key = 'w' + sim.waveIdx;
        if (this.last.cta !== key) { this.last.cta = key; cta.innerHTML = this.ctaHtml(sim); }
      } else this.last.cta = null;
      cta.hidden = !showCta;
      $('pausetag').hidden = !(app.paused && sim.phase === 'wave');
      const sp = app.paused ? 0 : app.speed;
      if (this.last.sp !== sp) { this.last.sp = sp; for (const b of $('speed').children) b.classList.toggle('on', +b.dataset.v === sp); }
    },
    ctaHtml(sim) {
      const m = sim.m, i = sim.waveIdx + 1, w = sim.wave(i);
      const th = Object.keys(w.mix).filter((k) => CP.THREATS[k]);
      let chips = th.map((k) => '<span class="tag threat">' + esc(CP.THREATS[k].name) + '</span>').join('');
      for (const e of w.events || []) {
        if (e.type === 'leaderDown') chips += '<span class="tag threat">Leader crash</span>';
        if (e.type === 'retryStorm') chips += '<span class="tag threat">Retry storm</span>';
      }
      return '<div class="kicker">' + (i === 0 ? 'Ready' : 'Wave ' + i + ' clear') + ' · next: wave ' + (i + 1) + (m.endless ? '' : ' of ' + m.waves.length) + '</div>' +
        '<h3>' + esc(w.name) + '</h3><p>' + esc(w.intro) + '</p>' +
        (chips ? '<div class="chips">' + chips + '</div>' : '') +
        '<div class="row"><button class="btn primary" data-act="startWave">Start wave</button><span>Space · buy tools first if you need them</span></div>';
    },
    makeCard(c, sim) {
      const el = document.createElement('div');
      el.className = 'card';
      let btns, gated = [];
      if (c.scripted) {
        btns = '<div class="c-btns col">' + c.options.map((o, i) => '<button data-act="card" data-id="' + c.id + '" data-c="' + i + '"' + (o.requires ? ' data-req="' + o.requires + '"' : '') + '>' + esc(o.label) +
          (o.requires ? '<small>needs ' + esc(CP.MODS[o.requires].name) + '</small>' : '') + '</button>').join('') + '</div>';
      } else {
        btns = '<div class="c-btns"><button data-act="card" data-id="' + c.id + '" data-c="yes">' + esc(c.yes) + '</button><button data-act="card" data-id="' + c.id + '" data-c="no">' + esc(c.no) + '</button></div>';
      }
      el.innerHTML = '<div class="c-top"><span class="c-head">' + esc(c.heading) + '</span><span>§' + c.sec + '</span></div><div class="c-timer"><i></i></div>' +
        '<code class="c-sql">' + esc(c.sql) + '</code><ul class="c-ctx">' + c.ctx.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' + btns;
      for (const b of el.querySelectorAll('[data-req]')) gated.push({ btn: b, req: b.dataset.req });
      return { el, bar: el.querySelector('.c-timer i'), head: el.querySelector('.c-head'), stuck: false, gated };
    },
    verdict(res) {
      const el = document.createElement('div');
      el.className = 'verdict' + (res.correct ? '' : ' bad');
      el.innerHTML = '<b>' + (res.timedOut ? 'Nobody answered' : res.correct ? 'Right call' : 'Wrong call') + '</b>' + esc(res.explain);
      const box = $('cards');
      box.appendChild(el);
      const olds = box.querySelectorAll('.verdict');
      if (olds.length > 2) olds[0].remove();
      setTimeout(() => el.remove(), 9000);
    },
    feedLine(l) {
      const f = $('feed'), el = document.createElement('div');
      const mm = Math.floor(l.t / 60), ss = Math.floor(l.t % 60);
      el.className = 'ln ' + l.cls;
      el.innerHTML = '<span class="ts">' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + '</span>' + esc(l.text) + (l.sec ? '<span class="sec">§' + l.sec + '</span>' : '');
      const stick = f.scrollTop + f.clientHeight >= f.scrollHeight - 30;
      f.appendChild(el);
      while (f.children.length > 90) f.firstChild.remove();
      if (stick) f.scrollTop = f.scrollHeight;
    },
    hit(id) { const e = $(id); e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); },
    flashTool(id) { const t = this.tools[id]; if (!t) return; t.el.classList.remove('flash'); void t.el.offsetWidth; t.el.classList.add('flash'); },
  };

  CP.ui = {
    T, M, hud, $,
    show(html) { const s = $('screen'); s.innerHTML = html; s.classList.remove('show'); void s.offsetWidth; s.classList.add('show'); s.scrollTop = 0; },
    rerender(html) { const s = $('screen'), y = s.scrollTop; s.innerHTML = html; s.scrollTop = y; },
    hide() { $('screen').classList.remove('show'); $('screen').innerHTML = ''; },
    modal(html) { const m = $('modal'); m.innerHTML = html; m.hidden = false; const b = m.querySelector('.btn.primary'); if (b) b.focus(); },
    closeModal() { $('modal').hidden = true; $('modal').innerHTML = ''; },
    toast(title, text, cls) {
      const el = document.createElement('div');
      el.className = 'toast' + (cls ? ' ' + cls : '');
      el.innerHTML = '<b>' + esc(title) + '</b>' + esc(text);
      const box = $('toasts');
      box.appendChild(el);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => el.remove(), 4800);
    },
  };
})();
