(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});
  const KEY = 'controlplane.save.v1';

  function fresh() {
    return {
      v: 1, xp: 0,
      missions: {},            // id -> { stars, plays, wins, medal, quiz: [bool], best: {integrity, budget} }
      upgrades: {},            // id -> level
      ach: {},                 // id -> timestamp
      seen: { threats: {}, howto: false, tutorial: false },
      endless: { bestWave: 0 },
      stats: { served: 0, blocked: 0, cardsRight: 0 },
      settings: { sfx: 0.7, music: 0.45, reduceMotion: false, incidentPause: true },
    };
  }

  function merge(base, data) {
    for (const k in data) {
      if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) && base[k] && typeof base[k] === 'object') merge(base[k], data[k]);
      else base[k] = data[k];
    }
    return base;
  }

  const store = {
    data: fresh(),
    ok: true,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) this.data = merge(fresh(), JSON.parse(raw));
      } catch (e) { this.ok = false; }
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.ok = true; } catch (e) { this.ok = false; }
    },
    reset() { this.data = fresh(); this.save(); },
    exportText() { return JSON.stringify(this.data, null, 2); },
    importText(text) {
      const d = JSON.parse(text);
      if (!d || d.v !== 1 || typeof d.xp !== 'number') throw new Error('Not a Control Plane save file');
      this.data = merge(fresh(), d);
      this.save();
    },
    hasProgress() { return this.data.xp > 0 || Object.keys(this.data.missions).length > 0; },

    mission(id) { return this.data.missions[id] || (this.data.missions[id] = { stars: 0, plays: 0, wins: 0, medal: false, quiz: [], best: null }); },
    totalStars() { let n = 0; for (const id in this.data.missions) n += this.data.missions[id].stars || 0; return n; },
    spentStars() {
      let n = 0;
      for (const u of CP.UPGRADES) { const lv = this.data.upgrades[u.id] || 0; for (let i = 0; i < lv; i++) n += u.cost[i]; }
      return n;
    },
    freeStars() { return this.totalStars() - this.spentStars(); },
    medals() { let n = 0; for (const id in this.data.missions) if (this.data.missions[id].medal) n++; return n; },
    unlocked(id) {
      if (id === 'endless') return (this.data.missions.m6 || {}).wins > 0;
      const i = CP.MISSIONS.findIndex((m) => m.id === id);
      if (i <= 0) return true;
      return (this.data.missions[CP.MISSIONS[i - 1].id] || {}).wins > 0;
    },
  };

  CP.store = store;
})();
