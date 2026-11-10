(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});
  const esc = CP.esc;
  const $ = (id) => document.getElementById(id);

  // Where the mission is: -1 before wave 1, 0 during wave 1, 1 after it, 2 during wave 2, and so on.
  const ord = (sim) => sim.waveIdx * 2 + (sim.phase === 'wave' ? 0 : 1);
  const name = (id) => CP.MODS[id].name;

  // The guided first mission. A step shows while the mission is at `at`, and is passed over once the mission has moved on.
  //   next: label for a button that advances.   done: advances by itself when true.
  //   when: stay hidden until true.             skip: pass over if true.       hold: freeze the simulation while shown.
  const STEPS = [
    {
      at: -1, target: '#cta', place: 'right', next: 'Next',
      title: 'A mission comes in waves',
      text: () => 'This panel tells you what the next wave brings. Wave 1 is quiet: no threats.',
    },
    {
      at: -1, target: '#tools', place: 'left', next: 'Next',
      title: 'Tools defend your data',
      text: () => 'You buy a tool once, with credits. It then <b>stays on for the rest of the mission</b>. You do not need to switch tools on and off.',
    },
    {
      at: -1, target: '#cta .btn.primary', place: 'bottom',
      title: 'Start the wave',
      text: () => 'There is nothing to buy yet. Click <b>Start wave</b>, or press Space.',
      wait: 'Waiting for you to start the wave',
    },
    {
      at: 0, target: '#m-cr', place: 'bottom', next: 'Continue', hold: true, when: (sim) => sim.wt > 4,
      title: 'Served requests earn credits',
      text: () => 'Each request that reaches the database and is served adds to your credits. Credits buy tools. Nothing can hurt you in this wave.',
    },
    {
      at: 1, target: '#cta', place: 'right', next: 'Next',
      title: 'Read the warning',
      text: () => 'Wave 2 brings <b>' + esc(CP.THREATS.destructive.name) + '</b>: an agent drops or rewrites something that mattered. Each one that lands costs you integrity.',
    },
    {
      at: 1, target: '#tool-sandbox', place: 'left', done: (sim) => sim.mods.sandbox.owned,
      next: (sim) => (sim.credits < sim.cost('sandbox') ? 'Next' : null),
      title: 'Buy the tool that stops it',
      text: (sim) => '<b>' + esc(name('sandbox')) + '</b> runs agent changes on a copy first, so a bad one never reaches production. ' +
        (sim.credits >= sim.cost('sandbox')
          ? 'Click the card to buy it for ' + sim.cost('sandbox') + ' credits.'
          : 'It costs ' + sim.cost('sandbox') + ' credits and you have ' + Math.floor(sim.credits) + '. You can buy it during the wave, as soon as you have enough.'),
      wait: 'Waiting for you to buy it',
    },
    {
      at: 1, target: '#tool-sandbox', place: 'left', next: 'Next', skip: (sim) => !sim.mods.sandbox.owned,
      title: 'It is on, and it stays on',
      text: () => 'The label now reads <b>ON</b>. The line under the name is its cost: schema changes take longer to land. Every tool has a cost like this, which is why buying everything loses.',
    },
    {
      at: 1, target: '#tool-readOnly', place: 'left', next: 'Next',
      title: 'The emergency brake',
      text: () => '<b>' + esc(name('readOnly')) + '</b> is free because it is blunt. It refuses every write, good ones included, and each refusal drains your error budget. Leave it alone unless integrity is collapsing. It is the one tool you would switch off again: click it a second time.',
    },
    {
      at: 1, target: '#cta .btn.primary', place: 'bottom',
      title: 'Start wave 2',
      text: (sim) => (sim.mods.sandbox.owned ? 'Your branch is ready. ' : '') + 'Start the wave.',
      wait: 'Waiting for you to start the wave',
    },
    {
      at: 2, target: '#feed', place: 'right', next: 'Continue', hold: true, when: (sim, f) => f.contained,
      title: 'Your tool just worked',
      text: () => 'The event log shows the destructive change your branch contained. Look here to see what a tool stopped, or what got through.',
    },
    {
      at: 3, target: '#cta', place: 'right', next: 'Next',
      title: 'Now you choose',
      text: () => 'Wave 3 brings <b>' + esc(CP.THREATS.crossProject.name) + '</b>. One of your tools stops it. Read the cards and buy the one that fits. That is the whole game: read the warning, buy what counters it, watch the meters.',
    },
    {
      at: 3, target: '#abil-rewind', place: 'left', next: 'Finish',
      title: 'If something gets through',
      text: () => '<b>Rewind</b> (the R key) undoes the damage of the last 20 seconds. It costs 20 credits and 4 error budget, then needs time to recharge.',
    },
  ];

  const coach = {
    active: false, hold: false, visible: false, idx: 0, flags: {}, key: '', sim: null, onEnd: null,

    start(sim, onEnd) {
      this.active = true; this.sim = sim; this.idx = 0; this.flags = {}; this.key = ''; this.hold = false; this.onEnd = onEnd || null;
    },
    stop() {
      this.active = false; this.hold = false; this.sim = null;
      this.show(false);
    },
    end(finished) {
      const cb = this.onEnd;
      this.stop();
      if (cb) cb(finished);
    },
    next() { if (this.active && this.visible) { this.idx++; this.key = ''; } },
    hasNext() { return this.active && this.visible && !!this.label; },
    onSim(type, d, sim) {
      if (!this.active || sim !== this.sim) return;
      if (type === 'block' && d.p && d.p.threat === 'destructive') this.flags.contained = true;
    },

    show(v) {
      if (this.visible === v) return;
      this.visible = v;
      const el = $('coach');
      if (el) el.hidden = !v;
      if (!v) this.hold = false;
    },

    // Called every frame while a mission is on screen.
    tick(sim, app) {
      if (!this.active || sim !== this.sim) return;
      if (sim.phase === 'won' || sim.phase === 'lost') return this.stop();
      const o = ord(sim);
      let s;
      for (;;) {
        s = STEPS[this.idx];
        if (!s) return this.end(true);
        if (o > s.at || (o === s.at && ((s.skip && s.skip(sim)) || (s.done && s.done(sim))))) { this.idx++; this.key = ''; continue; }
        break;
      }
      const el = o === s.at && !app.modal && (!s.when || s.when(sim, this.flags)) ? document.querySelector(s.target) : null;
      if (!el || !el.offsetParent) return this.show(false);
      // Appear in place; slide only when moving between two steps that are both on screen.
      $('coach').classList.toggle('snap', !this.visible);
      this.show(true);
      this.hold = !!s.hold;

      this.label = typeof s.next === 'function' ? s.next(sim) : s.next;
      const text = s.text(sim), key = this.idx + '|' + text + '|' + (this.label || '');
      const box = $('coach-box');
      if (key !== this.key) {
        this.key = key;
        box.innerHTML = '<div class="kicker">Tutorial · ' + (this.idx + 1) + ' of ' + STEPS.length + '</div><h3>' + esc(s.title) + '</h3><p>' + text + '</p>' +
          '<div class="row">' + (this.label ? '<button class="btn primary small" data-act="coachNext">' + esc(this.label) + '</button>' : '<span class="wait">' + esc(s.wait || '') + '</span>') +
          '<button class="skip" data-act="coachSkip">Skip tutorial</button></div>';
      }
      this.place(el.getBoundingClientRect(), box, s.place);
    },

    place(r, box, side) {
      const pad = 6, gap = 16, m = 12, vw = innerWidth, vh = innerHeight;
      const hole = $('coach-hole').style;
      hole.left = r.left - pad + 'px'; hole.top = r.top - pad + 'px';
      hole.width = r.width + pad * 2 + 'px'; hole.height = r.height + pad * 2 + 'px';
      const bw = box.offsetWidth, bh = box.offsetHeight;
      const fits = {
        right: r.right + gap + bw + m <= vw, left: r.left - gap - bw - m >= 0,
        bottom: r.bottom + gap + bh + m <= vh, top: r.top - gap - bh - m >= 0,
      };
      const flip = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' };
      if (!fits[side] && fits[flip[side]]) side = flip[side];
      let x, y;
      if (side === 'right') { x = r.right + gap; y = r.top; }
      else if (side === 'left') { x = r.left - gap - bw; y = r.top; }
      else if (side === 'bottom') { x = r.left; y = r.bottom + gap; }
      else { x = r.left; y = r.top - gap - bh; }
      box.style.left = Math.round(CP.clamp(x, m, Math.max(m, vw - bw - m))) + 'px';
      box.style.top = Math.round(CP.clamp(y, m, Math.max(m, vh - bh - m))) + 'px';
    },
  };

  CP.coach = coach;
})();
