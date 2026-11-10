(function () {
  'use strict';
  const CP = globalThis.CP, ui = CP.ui, store = CP.store, audio = CP.audio, $ = ui.$;
  const STEP = 1 / 30;

  const app = (CP.app = {
    screen: 'title', prev: 'title', sim: null, mission: null, paused: false, speed: 1, acc: 0,
    modal: null, modalQueue: [], ended: false, tab: 'chapters', res: null, briefId: null, lastRefuse: 0,
  });
  let renderer, last = 0;

  // ------------------------------------------------------------------ navigation
  function go(name, arg) {
    if (name !== app.screen && ['title', 'map', 'brief', 'game', 'debrief'].includes(app.screen)) app.prev = app.screen === 'brief' || app.screen === 'game' || app.screen === 'debrief' ? 'map' : app.screen;
    app.screen = name;
    $('hud').hidden = name !== 'game';
    if (name !== 'game') { app.sim = null; audio.intensity = 0; renderer.parts = []; renderer.rings = []; renderer.texts = []; renderer.vig = 0; }
    if (name === 'title') ui.show(ui.T.title());
    else if (name === 'map') ui.show(ui.T.map());
    else if (name === 'brief') { app.briefId = arg; ui.show(ui.T.brief(mission(arg))); }
    else if (name === 'debrief') ui.show(ui.T.debrief(app.res));
    else if (name === 'codex') ui.show(ui.T.codex(app.tab));
    else if (name === 'upgrades') ui.show(ui.T.upgrades());
    else if (name === 'achievements') ui.show(ui.T.achievements());
    else if (name === 'settings') ui.show(ui.T.settings());
    else if (name === 'game') ui.hide();
    layout();
  }
  function mission(id) { return id === 'endless' ? CP.makeEndless(((Math.random() * 1e6) | 0) + 1) : CP.missionById(id); }

  function layout() {
    renderer.resize();
    if (app.screen !== 'game') return;
    const r = $('field').getBoundingClientRect();
    renderer.setField({ x: r.left + 30, y: r.top + 74, w: r.width - 60, h: r.height - 74 - 112 });
  }

  // ------------------------------------------------------------------ modals
  function openModal(name, html) {
    app.modal = name;
    ui.modal(html);
  }
  function closeModal() {
    ui.closeModal();
    app.modal = null;
    if (app.modalQueue.length) { const n = app.modalQueue.shift(); openModal(n.name, n.html); }
  }
  function queueModal(name, html) {
    if (app.modal) app.modalQueue.push({ name, html }); else openModal(name, html);
  }

  // ------------------------------------------------------------------ progression
  function awardXp(v) {
    if (v <= 0) return;
    const before = CP.rankFor(store.data.xp).index;
    store.data.xp += v;
    const after = CP.rankFor(store.data.xp);
    if (after.index > before) { ui.toast('Promoted', after.name, 'gold'); audio.sfx('rank'); }
  }
  function grant(id) {
    if (store.data.ach[id]) return;
    const a = CP.ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    store.data.ach[id] = Date.now();
    ui.toast('Achievement', a.name, 'gold');
    store.save();
  }
  function checkAchievements(sim, won) {
    const d = store.data, m = sim.m;
    if (sim.bestStreak >= 100) grant('streak100');
    if (sim.bestCardRun >= 10) grant('reviewer');
    if (m.endless) { if (sim.waveIdx >= 5) grant('endless5'); if (sim.waveIdx >= 10) grant('endless10'); return; }
    if (!won) return;
    grant('first');
    if (sim.integrity >= 100) grant('blameless');
    if (sim.budget >= 95) grant('fivenines');
    if (m.n > 1 && sim.stars() === 3 && Object.keys(sim.mods).filter((k) => sim.mods[k].owned).length <= 2) grant('frugal');
    if (m.id === 'm6') grant('halfway');
    if (m.id === 'm11') grant('campaign');
    const clean = (id) => (d.missions[id] || {}).noTrap;
    if (clean('m2') && clean('m3') && clean('m7')) grant('notrap');
    if (store.medals() >= 5) grant('medal5');
    if (store.totalStars() >= 20) grant('stars20');
    if (store.totalStars() >= 33) grant('perfect');
  }
  function checkScholar() {
    for (const m of CP.MISSIONS) { const q = (store.data.missions[m.id] || {}).quiz || []; for (let i = 0; i < m.quiz.length; i++) if (!q[i]) return; }
    grant('scholar');
  }

  // ------------------------------------------------------------------ mission lifecycle
  function startMission(id) {
    const m = mission(id);
    const sim = new CP.Sim(m, { seed: (Math.random() * 1e9) | 0, upgrades: store.data.upgrades });
    app.sim = sim; app.mission = m; app.paused = false; app.speed = 1; app.acc = 0; app.ended = false; app.modalQueue = [];
    go('game');
    renderer.attach(sim);
    ui.hud.build(sim);
    sim.on(onSim);
    store.mission(m.id).plays++;
    store.save();
    audio.init(); audio.startMusic(); audio.intensity = 0;
    sim.log('info', 'On call for ' + m.title + '. Read the wave warning, buy what you need, then start.');
    if (!store.data.seen.howto) { store.data.seen.howto = true; store.save(); queueModal('howto', ui.M.howto()); }
  }

  function onSim(type, d, sim) {
    if (sim !== app.sim) return;
    switch (type) {
      case 'feed': ui.hud.feedLine(d); break;
      case 'serve': audio.sfx('serve', sim.streak); break;
      case 'block': audio.sfx('block'); if (CP.MODS[d.modId]) ui.hud.flashTool(d.modId); break;
      case 'refuse': if (sim.t - app.lastRefuse > 0.15) { app.lastRefuse = sim.t; audio.sfx('refuse'); } ui.hud.hit('m-bud'); break;
      case 'damage': {
        audio.sfx('damage'); ui.hud.hit('m-int');
        const k = d.threat;
        if (k && !store.data.seen.threats[k]) {
          store.data.seen.threats[k] = true; store.save();
          if (store.data.settings.incidentPause) queueModal('incident', ui.M.incident(k));
        }
        break;
      }
      case 'card': audio.sfx('card'); break;
      case 'stuck': audio.sfx('deny'); break;
      case 'answer':
        ui.hud.verdict(d);
        if (!d.timedOut) { audio.sfx(d.correct ? 'right' : 'wrong'); if (d.correct) store.data.stats.cardsRight++; }
        break;
      case 'buy': audio.sfx('buy'); break;
      case 'toggle': audio.sfx(sim.mods[d].on ? 'on' : 'off'); break;
      case 'streak': audio.sfx('streak'); if (d >= 100) grant('streak100'); break;
      case 'rewind': audio.sfx('rewind'); if (d >= 20) grant('undo'); break;
      case 'event': audio.sfx('alarm'); break;
      case 'waveStart': audio.sfx('wave'); audio.intensity = 1; break;
      case 'waveEnd': audio.sfx('clear'); audio.intensity = 0; if (sim.m.endless && d.idx + 1 > store.data.endless.bestWave) { store.data.endless.bestWave = d.idx + 1; store.save(); } break;
      case 'won': app.ended = true; audio.sfx('win'); setTimeout(() => finish(sim), 1500); break;
      case 'lost': app.ended = true; audio.sfx('lose'); renderer.vig = 1; setTimeout(() => finish(sim), 1700); break;
    }
  }

  function finish(sim) {
    if (sim !== app.sim) return;
    const m = sim.m, won = sim.phase === 'won', rec = store.mission(m.id);
    const lines = [];
    const add = (label, xp) => { if (xp > 0) lines.push({ label, xp }); };
    let stars = 0, medal = false;
    const prevRank = CP.rankFor(store.data.xp).index;
    if (m.endless) {
      add('Waves held × 15', sim.waveIdx * 15);
      if (sim.waveIdx > store.data.endless.bestWave) store.data.endless.bestWave = sim.waveIdx;
    } else if (won) {
      stars = sim.stars(); medal = !!m.challenge.test(sim);
      add(rec.wins ? 'Mission complete again' : 'Mission complete', rec.wins ? 20 : 150);
      if (stars > (rec.stars || 0)) add('New stars × 60', (stars - (rec.stars || 0)) * 60);
      if (medal && !rec.medal) add('Challenge medal', 80);
      rec.wins = (rec.wins || 0) + 1;
      rec.stars = Math.max(rec.stars || 0, stars);
      rec.medal = rec.medal || medal;
      const trap = m.modules.find((id) => CP.MODS[id].trap);
      if (trap && !sim.used[trap]) rec.noTrap = true;
      if (!rec.best || sim.integrity + sim.budget > rec.best.integrity + rec.best.budget) rec.best = { integrity: Math.round(sim.integrity), budget: Math.round(sim.budget) };
    } else add('Shift worked', 10);
    for (const k in sim.stats) if (sim.stats[k].landed || sim.stats[k].blocked) store.data.seen.threats[k] = true;
    store.data.stats.served += sim.served; store.data.stats.blocked += sim.blockedThreat;
    for (const l of lines) store.data.xp += l.xp;
    const rank = CP.rankFor(store.data.xp);
    if (rank.index > prevRank) { ui.toast('Promoted', rank.name, 'gold'); setTimeout(() => audio.sfx('rank'), 900); }
    checkAchievements(sim, won);
    store.save();
    app.res = {
      mission: m, won, stars, medal, why: sim.lostWhy, waves: sim.waveIdx, integrity: sim.integrity, budget: sim.budget, maxP99: sim.maxP99,
      served: sim.served, refused: sim.blockedLegit, bestStreak: sim.bestStreak, threats: sim.stats, xpLines: lines, quizAns: {}, shown: false,
    };
    audio.intensity = 0;
    go('debrief');
    if (won && !m.endless) for (let i = 0; i < stars; i++) setTimeout(() => audio.sfx('star', i), 400 + i * 300);
    app.res.shown = true;
  }

  // ------------------------------------------------------------------ actions
  function togglePause(v) { app.paused = v == null ? !app.paused : v; }
  const acts = {
    play() { audio.init(); audio.startMusic(); go('map'); },
    go(d) { go(d.to); },
    back() { go(app.prev || 'title'); },
    mission(d) { if (store.unlocked(d.id)) go('brief', d.id); else audio.sfx('deny'); },
    deploy(d) { startMission(d.id); },
    startWave() { if (app.sim && app.sim.startWave()) { app.paused = false; } },
    tool(d) {
      const sim = app.sim; if (!sim || app.ended) return;
      const s = sim.mods[d.id];
      if (!s.owned) { if (!sim.buy(d.id)) audio.sfx('deny'); }
      else sim.toggle(d.id);
    },
    abil(d) { if (app.sim && !app.sim.use(d.id)) audio.sfx('deny'); },
    card(d) { if (app.sim) app.sim.answer(+d.id, d.c === 'yes' || d.c === 'no' ? d.c : +d.c); },
    speed(d) { const v = +d.v; if (v === 0) togglePause(); else { app.speed = v; app.paused = false; } },
    pause() { if (app.sim && !app.modal) openModal('pause', ui.M.pause(app.mission)); },
    closeModal() { closeModal(); },
    showBrief() { openModal('brief', ui.M.brief(app.mission)); },
    restart() { closeModal(); app.modalQueue = []; startMission(app.mission.id); },
    quit() { closeModal(); app.modalQueue = []; audio.intensity = 0; go('map'); },
    quiz(d) {
      const res = app.res, q = +d.q, a = +d.a;
      if (!res || res.quizAns[q] != null) return;
      res.quizAns[q] = a;
      const m = res.mission, rec = store.mission(m.id);
      if (a === m.quiz[q].correct) {
        audio.sfx('right');
        if (!rec.quiz[q]) { rec.quiz[q] = true; res.xpLines.push({ label: 'Incident review, question ' + (q + 1), xp: 30 }); awardXp(30); checkScholar(); }
      } else audio.sfx('wrong');
      store.save();
      ui.rerender(ui.T.debrief(res));
    },
    tab(d) { app.tab = d.tab; ui.rerender(ui.T.codex(app.tab)); },
    upgrade(d) {
      const u = CP.UPGRADES.find((x) => x.id === d.id), lv = store.data.upgrades[u.id] || 0;
      if (lv >= u.cost.length || store.freeStars() < u.cost[lv]) return audio.sfx('deny');
      store.data.upgrades[u.id] = lv + 1; store.save(); audio.sfx('buy');
      ui.rerender(ui.T.upgrades());
    },
    exportSave() { const io = $('io'); io.value = store.exportText(); io.select(); $('io-msg').textContent = 'Copy this text and keep it somewhere safe.'; },
    importSave() {
      try { store.importText($('io').value); applySettings(); ui.rerender(ui.T.settings('Save imported.')); }
      catch (e) { $('io-msg').textContent = 'Could not import: ' + e.message; audio.sfx('deny'); }
    },
    resetSave() { openModal('reset', ui.M.confirmReset()); },
    doReset() { store.reset(); applySettings(); closeModal(); ui.rerender(ui.T.settings('Progress erased.')); },
  };

  function applySettings() {
    const st = store.data.settings;
    audio.setVolumes(st.sfx, st.music);
    renderer.reduce = !!st.reduceMotion;
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    audio.init();
    const fn = acts[el.dataset.act];
    if (!fn) return;
    if (!['tool', 'abil', 'card', 'quiz', 'startWave', 'upgrade', 'mission'].includes(el.dataset.act)) audio.sfx('click');
    fn(el.dataset);
  });
  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.set;
    if (!k) return;
    const st = store.data.settings;
    st[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
    applySettings(); store.save();
    if (k === 'sfx') audio.sfx('click');
    if (k === 'music') { audio.init(); audio.startMusic(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (app.modal) {
      if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && app.modal !== 'reset' && app.modal !== 'pause')) { e.preventDefault(); closeModal(); }
      return;
    }
    if (app.screen !== 'game' || !app.sim) {
      if (e.key === 'Escape' && !['title', 'map'].includes(app.screen)) acts.back();
      return;
    }
    const sim = app.sim;
    if (e.key === ' ') { e.preventDefault(); if (sim.phase === 'build') acts.startWave(); else togglePause(); }
    else if (e.key === 'Escape') acts.pause();
    else if (e.key === '1' || e.key === '2' || e.key === '3') { app.speed = +e.key; app.paused = false; }
    else if (e.key === 'r' || e.key === 'R') acts.abil({ id: 'rewind' });
    else if (e.key === 'f' || e.key === 'F') acts.abil({ id: 'failover' });
  });
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.sim && app.sim.phase === 'wave') app.paused = true; });

  // ------------------------------------------------------------------ loop
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    const sim = app.sim;
    if (sim && app.screen === 'game') {
      if (!app.paused && !app.modal && !app.ended) {
        app.acc += dt * app.speed;
        let n = 0;
        while (app.acc >= STEP && n < 10) { sim.step(STEP); app.acc -= STEP; n++; }
        if (n === 10) app.acc = 0;
      }
      ui.hud.update(sim, app);
      renderer.draw(sim, dt);
    } else renderer.draw(null, dt);
    requestAnimationFrame(frame);
  }

  function boot() {
    store.load();
    renderer = new CP.Renderer($('stage'));
    CP.renderer = renderer;
    applySettings();
    go('title');
    requestAnimationFrame(frame);
  }
  boot();
})();
