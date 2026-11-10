(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});
  const { clamp, lerp } = CP;

  const C = {
    ink: '#070b14', grid: 'rgba(120,150,220,0.055)', mint: '#5ef2c2', amber: '#ffb547', coral: '#ff4d6d',
    violet: '#9d7bff', cyan: '#58c7ff', text: '#dbe6ff', muted: '#7d8bb0', line: '#22304f', panel: '#0d1422',
  };
  const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
  const SIZE = { leader: 40, replica: 31, shard: 31, branch: 31, olap: 31, embed: 31, fleet: 31, gw: 30, src: 30 };

  class Renderer {
    constructor(canvas) {
      this.cv = canvas; this.g = canvas.getContext('2d');
      this.time = 0; this.shake = 0; this.vig = 0; this.reduce = false;
      this.parts = []; this.rings = []; this.texts = []; this.sprites = {};
      this.field = { x: 0, y: 0, w: 800, h: 600 };
      this.dots = [];
      const r = CP.rng(99);
      for (let i = 0; i < 150; i++) this.dots.push({ x: r(), y: r(), p: r() * 6.28, s: 0.4 + r() * 1.4, v: 0.3 + r() });
      this.streaks = [];
      for (let i = 0; i < 9; i++) this.streaks.push({ y: r(), x: r(), v: 0.02 + r() * 0.05, len: 0.05 + r() * 0.12 });
      this.textGate = {};
      this.resize();
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.dpr = dpr; this.W = window.innerWidth; this.H = window.innerHeight;
      this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
      this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    }
    setField(r) { this.field = r; }
    np(n) { return { x: this.field.x + n.x * this.field.w, y: this.field.y + n.y * this.field.h }; }

    attach(sim) {
      this.sim = sim; this.pos = {};
      this.parts = []; this.rings = []; this.texts = [];
      sim.on((type, d) => this.onEvent(type, d, sim));
    }
    where(p, fallback) {
      if (p && p.rx != null) return { x: p.rx, y: p.ry };
      const n = this.pos[fallback] || this.pos.leader || this.pos.s2 || this.pos.gw;
      return n ? { x: n.x, y: n.y } : { x: this.W / 2, y: this.H / 2 };
    }
    onEvent(type, d, sim) {
      const MODS = CP.MODS;
      if (type === 'block') {
        const at = this.where(d.p, 'gw');
        this.ring(at.x, at.y, C.mint, 26, 0.45);
        this.burst(at.x, at.y, C.mint, 7, 70);
        const label = MODS[d.modId] ? MODS[d.modId].short : d.modId === 'review' ? 'CAUGHT' : 'CONTAINED';
        this.floatText(at.x, at.y - 14, label, C.mint, 'b' + label, 0.35);
      } else if (type === 'refuse') {
        const at = this.where(d.p, 'gw');
        this.ring(at.x, at.y, C.amber, 16, 0.3);
        this.burst(at.x, at.y, C.amber, 3, 40);
      } else if (type === 'damage') {
        const at = this.where(d.p, 'leader');
        this.ring(at.x, at.y, C.coral, 90, 0.7); this.ring(at.x, at.y, C.coral, 50, 0.5);
        this.burst(at.x, at.y, C.coral, 26, 190);
        this.floatText(at.x, at.y - 30, '-' + d.dmg + ' INTEGRITY', C.coral, null, 0, 15);
        this.shake = Math.max(this.shake, 9); this.vig = 1;
      } else if (type === 'serve') {
        if (d.node && this.pos[d.node] && Math.random() < 0.3) this.burst(this.pos[d.node].x, this.pos[d.node].y, CP.KINDS[d.p.kind].color, 1, 30);
      } else if (type === 'streak') {
        const n = this.pos.leader || this.pos.s2;
        if (n) this.floatText(n.x, n.y - 62, 'CLEAN ×' + d, C.mint, 'streak', 0.5, 13);
      } else if (type === 'rewind') {
        const n = this.pos.leader; if (!n) return;
        for (let i = 0; i < 3; i++) this.ring(n.x, n.y, C.cyan, 150 - i * 40, 0.9, true);
        this.floatText(n.x, n.y - 54, '+' + d + ' INTEGRITY', C.cyan, null, 0, 15);
      } else if (type === 'failover') {
        const n = this.pos.r1; if (!n) return;
        this.ring(n.x, n.y, C.mint, 80, 0.8); this.floatText(n.x, n.y - 48, 'PROMOTED', C.mint, null, 0, 13);
      } else if (type === 'buy' || type === 'toggle') {
        const n = this.chipNode(d, sim); if (!n) return;
        this.ring(n.x, n.y, C.cyan, 60, 0.5); this.burst(n.x, n.y, C.cyan, 10, 90);
      } else if (type === 'event') {
        if (d.type === 'leaderDown') { this.shake = 14; this.vig = 1; }
      } else if (type === 'batch') {
        const n = this.pos.embed; if (n) this.ring(n.x, n.y, C.violet, 60, 0.6);
      }
    }
    ring(x, y, color, r, life, inward) { this.rings.push({ x, y, color, r, life, max: life, inward }); }
    burst(x, y, color, n, speed) {
      if (this.reduce) n = Math.ceil(n / 4);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.7);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4, max: 0.75, color, s: 1 + Math.random() * 2 });
      }
      if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    }
    floatText(x, y, text, color, gateKey, gap, size) {
      if (gateKey) { const last = this.textGate[gateKey]; if (last != null && this.time - last < gap) return; this.textGate[gateKey] = this.time; }
      this.texts.push({ x, y, text, color, life: 1.1, max: 1.1, size: size || 10 });
    }
    sprite(color) {
      if (this.sprites[color]) return this.sprites[color];
      const s = document.createElement('canvas'); s.width = s.height = 48;
      const g = s.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      gr.addColorStop(0, color); gr.addColorStop(0.25, color + 'aa'); gr.addColorStop(1, color + '00');
      g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
      return (this.sprites[color] = s);
    }
    // Which node a tool's chip sits under.
    chipHost(id, sim) {
      const d = CP.MODS[id], N = sim.nodes;
      if (d.host && N[d.host]) return d.host;
      if (d.at === 'gw') return 'gw';
      if (d.at === 'infra' && d.activates) { for (const n of d.activates) if (N[n]) return n; }
      if (N.leader && N.leader.active) return 'leader';
      return N.s2 ? 's2' : 'leader';
    }
    chipNode(id, sim) { return this.pos[this.chipHost(id, sim)]; }

    // ------------------------------------------------------------------ frame
    draw(sim, dt) {
      const g = this.g, W = this.W, H = this.H;
      this.time += dt;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.background(g, W, H, !!sim);
      if (sim) {
        g.save();
        if (this.shake > 0.2 && !this.reduce) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        this.shake *= Math.pow(0.0015, dt);
        this.pos = {};
        for (const n of sim.m.nodes) this.pos[n.id] = Object.assign(this.np(n), { def: n });
        this.edges(g, sim);
        for (const n of sim.m.nodes) this.node(g, n, sim);
        this.packets(g, sim, dt);
        this.effects(g, dt);
        g.restore();
        if (this.vig > 0.01) {
          const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
          gr.addColorStop(0, 'rgba(255,77,109,0)'); gr.addColorStop(1, 'rgba(255,77,109,' + (0.34 * this.vig).toFixed(3) + ')');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          this.vig *= Math.pow(0.02, dt);
        }
      } else this.effects(g, dt);
    }

    background(g, W, H, inGame) {
      g.fillStyle = C.ink; g.fillRect(0, 0, W, H);
      let gr = g.createRadialGradient(W * 0.3, H * 0.35, 0, W * 0.3, H * 0.35, W * 0.7);
      gr.addColorStop(0, 'rgba(40,70,140,0.22)'); gr.addColorStop(1, 'rgba(7,11,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      gr = g.createRadialGradient(W * 0.85, H * 0.9, 0, W * 0.85, H * 0.9, W * 0.5);
      gr.addColorStop(0, 'rgba(94,242,194,0.07)'); gr.addColorStop(1, 'rgba(7,11,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // grid
      g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath();
      const step = 46, off = this.reduce ? 0 : (this.time * 4) % step;
      for (let x = -off; x < W; x += step) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (let y = 0; y < H; y += step) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      // a fleet of idle databases, twinkling
      for (const d of this.dots) {
        const a = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * d.v + d.p));
        g.fillStyle = 'rgba(150,180,255,' + a.toFixed(3) + ')';
        g.fillRect(d.x * W, d.y * H, d.s, d.s);
      }
      if (!inGame) {
        // write-ahead log streaks on menu screens
        for (const s of this.streaks) {
          s.x += s.v * 0.016; if (s.x > 1.2) s.x = -0.2;
          const x = s.x * W, y = s.y * H, len = s.len * W;
          const lg = g.createLinearGradient(x - len, y, x, y);
          lg.addColorStop(0, 'rgba(94,242,194,0)'); lg.addColorStop(1, 'rgba(94,242,194,0.35)');
          g.strokeStyle = lg; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - len, y); g.lineTo(x, y); g.stroke();
          g.fillStyle = 'rgba(94,242,194,0.8)'; g.fillRect(x - 1, y - 1.5, 3, 3);
        }
      }
    }

    curve(g, a, b, bend) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + (bend || 0);
      g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(mx, my, b.x, b.y);
    }
    edges(g, sim) {
      const P = this.pos, N = sim.nodes;
      const link = (a, b, color, alpha, dashed, speed) => {
        if (!P[a] || !P[b]) return;
        g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = dashed ? 1.2 : 2;
        g.setLineDash(dashed ? [3, 7] : [1, 9]); g.lineCap = 'round';
        g.lineDashOffset = -this.time * (speed || 26);
        this.curve(g, P[a], P[b], 0); g.stroke();
        g.setLineDash([]); g.globalAlpha = alpha * 0.25; g.lineWidth = 1;
        this.curve(g, P[a], P[b], 0); g.stroke();
        g.globalAlpha = 1;
      };
      link('src', 'gw', C.cyan, 0.55, false, 34);
      for (const id in N) {
        const n = N[id];
        if (n.type === 'src' || n.type === 'gw' || n.type === 'embed') continue;
        link('gw', id, n.active ? C.cyan : C.line, n.active ? 0.45 : 0.25, !n.active, 30);
      }
      if (N.leader && N.leader.active) {
        for (const id of ['r1', 'r2']) if (N[id] && N[id].active) link('leader', id, sim.lag > 0.6 ? C.amber : C.mint, 0.6, true, 18);
        if (N.olap && N.olap.active) link('leader', 'olap', C.violet, 0.5, true, 14);
        if (N.embed) link('leader', 'embed', N.embed.active ? C.violet : C.line, N.embed.active ? 0.6 : 0.25, true, 18);
      }
    }

    rr(g, x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    cylinder(g, x, y, w, h, color, fillA) {
      const ry = h * 0.16;
      g.fillStyle = 'rgba(13,20,34,' + fillA + ')'; g.strokeStyle = color; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(x, y - h / 2 + ry, w / 2, ry, 0, Math.PI, 0); g.lineTo(x + w / 2, y + h / 2 - ry);
      g.ellipse(x, y + h / 2 - ry, w / 2, ry, 0, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(x, y - h / 2 + ry, w / 2, ry, 0, 0, Math.PI); g.stroke();
      g.globalAlpha *= 0.45;
      g.beginPath(); g.ellipse(x, y - h * 0.08, w / 2, ry, 0, 0, Math.PI); g.stroke();
      g.beginPath(); g.ellipse(x, y + h * 0.18, w / 2, ry, 0, 0, Math.PI); g.stroke();
      g.globalAlpha /= 0.45;
    }

    node(g, def, sim) {
      const n = sim.nodes[def.id], p = this.pos[def.id], S = SIZE[def.type] || 30, t = this.time;
      const active = n.active, down = n.down;
      let color = def.type === 'gw' ? C.cyan : def.type === 'src' ? C.muted : C.mint;
      if (def.type === 'branch') color = C.violet;
      if (def.type === 'olap' || def.type === 'embed') color = C.violet;
      if (def.type === 'fleet') color = C.amber;
      if (down) color = C.coral;
      if (!active) color = '#3a4868';
      g.save();
      g.globalAlpha = active ? 1 : 0.5;

      // glow
      if (active && def.type !== 'src') {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.16 + n.flash * 0.5;
        const sp = this.sprite(n.flash > 0.05 ? C.coral : color);
        g.drawImage(sp, p.x - S * 2.4, p.y - S * 2.4, S * 4.8, S * 4.8);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }

      if (def.type === 'src') {
        // a small crowd of agents
        for (let i = 0; i < 7; i++) {
          const ax = p.x - 14 + (i % 2) * 26 + Math.sin(t * 0.9 + i) * 3, ay = p.y - 66 + i * 22 + Math.cos(t * 1.1 + i * 2) * 3;
          g.strokeStyle = C.cyan; g.fillStyle = 'rgba(88,199,255,0.12)'; g.lineWidth = 1.3;
          g.beginPath();
          for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(ax + Math.cos(a) * 9, ay + Math.sin(a) * 9); }
          g.closePath(); g.fill(); g.stroke();
          g.fillStyle = C.cyan; g.fillRect(ax - 3.5, ay - 1.5, 2.2, 2.2); g.fillRect(ax + 1.3, ay - 1.5, 2.2, 2.2);
        }
      } else if (def.type === 'gw') {
        const w = 40, h = 124;
        g.fillStyle = 'rgba(13,20,34,0.92)'; g.strokeStyle = color; g.lineWidth = 1.8;
        this.rr(g, p.x - w / 2, p.y - h / 2, w, h, 12); g.fill(); g.stroke();
        g.strokeStyle = color; g.globalAlpha = 0.5; g.lineWidth = 1;
        for (let i = 0; i < 5; i++) { const yy = p.y - 40 + i * 20; g.beginPath(); g.moveTo(p.x - 11, yy); g.lineTo(p.x + 11, yy); g.stroke(); }
        g.globalAlpha = 1;
        const scan = p.y - h / 2 + 6 + ((t * 40) % (h - 12));
        g.fillStyle = color; g.globalAlpha = 0.7; g.fillRect(p.x - w / 2 + 4, scan, w - 8, 1.5); g.globalAlpha = 1;
      } else if (def.type === 'fleet') {
        const cols = 9, rows = 4, cs = 9, gx = p.x - (cols * cs) / 2, gy = p.y - (rows * cs) / 2;
        g.fillStyle = 'rgba(13,20,34,0.9)'; g.strokeStyle = color; g.lineWidth = 1.4;
        this.rr(g, gx - 8, gy - 8, cols * cs + 14, rows * cs + 14, 8); g.fill(); g.stroke();
        const busy = n.busy.length + n.queue.length;
        for (let i = 0; i < cols * rows; i++) {
          const awake = active && (i * 7 + Math.floor(t * 2)) % 36 < busy * 3 + (sim.isOn('scaleToZero') ? 1 : 12);
          g.fillStyle = awake ? color : 'rgba(255,181,71,0.16)';
          g.fillRect(gx + (i % cols) * cs, gy + Math.floor(i / cols) * cs, cs - 3, cs - 3);
        }
      } else if (def.type === 'embed') {
        g.fillStyle = 'rgba(13,20,34,0.92)'; g.strokeStyle = color; g.lineWidth = 1.6;
        g.beginPath(); g.arc(p.x, p.y, S, 0, 6.283); g.fill(); g.stroke();
        g.save(); g.translate(p.x, p.y); g.rotate(active ? t * 0.8 : 0); g.strokeStyle = color; g.lineWidth = 2;
        for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(11, 0); g.lineTo(19, 0); g.stroke(); }
        g.beginPath(); g.arc(0, 0, 9, 0, 6.283); g.stroke(); g.restore();
      } else {
        const w = S * 1.7, h = S * 1.9;
        this.cylinder(g, p.x, p.y, w, h, color, 0.92);
        if (def.type === 'leader') {
          g.fillStyle = color; g.beginPath();
          g.moveTo(p.x - 10, p.y - h / 2 - 8); g.lineTo(p.x - 6, p.y - h / 2 - 16); g.lineTo(p.x, p.y - h / 2 - 10);
          g.lineTo(p.x + 6, p.y - h / 2 - 16); g.lineTo(p.x + 10, p.y - h / 2 - 8); g.closePath(); g.fill();
        }
        if (def.type === 'branch') {
          g.strokeStyle = color; g.lineWidth = 1.6; g.beginPath();
          g.moveTo(p.x - 6, p.y + 12); g.lineTo(p.x - 6, p.y - 8); g.moveTo(p.x - 6, p.y + 2); g.quadraticCurveTo(p.x + 6, p.y + 2, p.x + 6, p.y - 8); g.stroke();
          for (const q of [[-6, -10], [6, -10], [-6, 14]]) { g.beginPath(); g.arc(p.x + q[0], p.y + q[1], 2.6, 0, 6.283); g.fillStyle = color; g.fill(); }
        }
        if (def.type === 'olap') {
          g.fillStyle = color; g.globalAlpha = 0.7;
          for (let i = 0; i < 4; i++) g.fillRect(p.x - 13 + i * 7.5, p.y + 14 - (6 + ((i * 5) % 14)), 4.5, 6 + ((i * 5) % 14));
          g.globalAlpha = 1;
        }
      }

      // load arc
      if (active && def.type !== 'src' && def.type !== 'embed') {
        const cap = n.workers * 4, load = clamp((n.queue.length + n.busy.length) / cap, 0, 1);
        const R = def.type === 'gw' ? 0 : S * 1.32;
        if (R && load > 0.02) {
          g.strokeStyle = load > 0.75 ? C.coral : load > 0.45 ? C.amber : C.mint; g.lineWidth = 3; g.lineCap = 'round';
          g.beginPath(); g.arc(p.x, p.y, R, -Math.PI / 2, -Math.PI / 2 + load * 6.283); g.stroke();
        }
      }
      if (down) {
        g.strokeStyle = C.coral; g.lineWidth = 3; g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 12);
        g.beginPath(); g.moveTo(p.x - 18, p.y - 18); g.lineTo(p.x + 18, p.y + 18); g.moveTo(p.x + 18, p.y - 18); g.lineTo(p.x - 18, p.y + 18); g.stroke();
        g.globalAlpha = 1;
      }

      // label and status line
      const below = def.type === 'gw' ? 76 : def.type === 'src' ? 96 : def.type === 'fleet' ? 40 : S * 1.9 / 2 + 18;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '600 11px ' + MONO; g.fillStyle = active ? C.text : C.muted;
      g.fillText(def.label.toUpperCase(), p.x, p.y + below);
      let status = null, sc = C.muted;
      if (!active) status = def.type === 'leader' ? 'data moved to shards' : 'not built';
      else if (down) { status = 'DOWN'; sc = C.coral; }
      else if (def.type === 'replica') { status = 'lag ' + sim.lag.toFixed(1) + 's'; sc = sim.lag > 0.6 ? C.amber : C.mint; }
      else if (def.type === 'embed') { status = 'stale ' + Math.round(sim.stale * 100) + '%'; sc = sim.stale > 0.3 ? C.coral : sim.stale > 0.12 ? C.amber : C.mint; }
      else if (def.type === 'shard' && sim.rebalance > 0) { status = 'rebalancing'; sc = C.amber; }
      else if (def.type === 'fleet') { status = sim.isOn('scaleToZero') ? 'idle ones paused' : 'all running'; sc = sim.isOn('scaleToZero') ? C.mint : C.amber; }
      let cy = p.y + below + 14;
      if (status) { g.font = '10px ' + MONO; g.fillStyle = sc; g.fillText(status, p.x, cy); cy += 14; }
      if (def.type === 'embed' && active) {
        g.strokeStyle = sc; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, S + 6, -Math.PI / 2, -Math.PI / 2 + clamp(sim.stale, 0, 1) * 6.283); g.stroke();
      }

      // tool chips
      const chips = sim.activeList.filter((id) => this.chipHost(id, sim) === def.id);
      if (chips.length) {
        g.font = '600 9px ' + MONO;
        let row = [], rw = 0; const rows = [];
        for (const id of chips) {
          const w = g.measureText(CP.MODS[id].short).width + 12;
          if (row.length && (rw + w > 150 || row.length >= 2)) { rows.push({ row, rw }); row = []; rw = 0; }
          row.push({ id, w }); rw += w + 4;
        }
        rows.push({ row, rw });
        for (const r of rows) {
          let x = p.x - (r.rw - 4) / 2;
          for (const c of r.row) {
            const col = def.type === 'gw' ? C.cyan : C.mint;
            g.fillStyle = 'rgba(7,11,20,0.85)'; g.strokeStyle = col; g.lineWidth = 1;
            this.rr(g, x, cy - 7, c.w, 14, 7); g.fill(); g.stroke();
            g.fillStyle = col; g.textAlign = 'center'; g.fillText(CP.MODS[c.id].short, x + c.w / 2, cy + 0.5);
            x += c.w + 4;
          }
          cy += 17;
        }
      }
      g.restore();
    }

    target(p, sim) {
      const P = this.pos;
      if (p.state === 'toGw') {
        const a = { x: P.src.x + 22, y: P.src.y + p.lane * 62 }, b = { x: P.gw.x - 20, y: P.gw.y + p.lane * 44 };
        const t = p.prog, e = t * t * (3 - 2 * t);
        const my = (a.y + b.y) / 2 + p.lane * 26;
        const mx = (a.x + b.x) / 2;
        return { x: (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * mx + e * e * b.x, y: (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * my + e * e * b.y };
      }
      if (p.state === 'toNode') {
        const a = { x: P.gw.x + 20, y: P.gw.y + p.lane * 44 }, n = P[p.to], S = SIZE[n.def.type] || 30;
        const b = { x: n.x - S * 1.5, y: n.y + p.lane * 10 };
        const e = p.prog * p.prog * (3 - 2 * p.prog);
        return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) };
      }
      if (p.state === 'held') {
        const host = p.to && p.to !== 'gw' && P[p.to] ? P[p.to] : P.gw;
        const a = this.time * 1.6 + p.id * 1.7, r = p.to === 'gw' || !P[p.to] ? 44 : 62;
        return { x: host.x + Math.cos(a) * r * 0.75, y: host.y + Math.sin(a) * r };
      }
      return p.slot || P[p.to] || P.gw;
    }

    packets(g, sim, dt) {
      const P = this.pos;
      // queue and service slots
      for (const id in sim.nodes) {
        const n = sim.nodes[id], c = P[id]; if (!c) continue;
        const S = SIZE[c.def.type] || 30;
        n.queue.forEach((p, i) => { p.slot = { x: c.x - S * 1.5 - (i % 9) * 8, y: c.y - 8 + Math.floor(i / 9) * 8 }; });
        n.busy.forEach((p, i) => { p.slot = { x: c.x - (n.busy.length - 1) * 6 + i * 12, y: c.y + 4 }; });
      }
      const k = 1 - Math.pow(0.0001, dt);
      for (const p of sim.packets) {
        if (p.dead) continue;
        const tg = this.target(p, sim);
        if (p.rx == null || p.state === 'toGw' || p.state === 'toNode') { p.px = p.rx == null ? tg.x - 8 : p.rx; p.py = p.ry == null ? tg.y : p.ry; p.rx = tg.x; p.ry = tg.y; }
        else { p.px = p.rx; p.py = p.ry; p.rx += (tg.x - p.rx) * k; p.ry += (tg.y - p.ry) * k; }
        // Covert threats look like ordinary work: the player has to judge them, or learn from the damage.
        const hot = p.threat && !CP.THREATS[p.threat].covert;
        const K = CP.KINDS[p.kind], col = hot ? C.coral : K.color;
        const moving = p.state === 'toGw' || p.state === 'toNode';
        // trail
        if (moving) {
          const dx = p.rx - p.px, dy = p.ry - p.py, len = Math.hypot(dx, dy) || 1, tl = 16;
          const lg = g.createLinearGradient(p.rx - dx / len * tl, p.ry - dy / len * tl, p.rx, p.ry);
          lg.addColorStop(0, col + '00'); lg.addColorStop(1, col + 'aa');
          g.strokeStyle = lg; g.lineWidth = 2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.rx - dx / len * tl, p.ry - dy / len * tl); g.lineTo(p.rx, p.ry); g.stroke();
        }
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = hot ? 0.5 + 0.25 * Math.sin(this.time * 9 + p.id) : 0.42;
        const gs = hot ? 30 : 22;
        g.drawImage(this.sprite(col), p.rx - gs / 2, p.ry - gs / 2, gs, gs);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        this.shape(g, K.shape, p.rx, p.ry, hot ? 4.6 : 3.8, col, p.state === 'service');
        if (hot && (moving || p.state === 'held')) {
          g.font = '700 8px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
          const tag = CP.THREATS[p.threat].tag, w = g.measureText(tag).width + 8;
          g.fillStyle = 'rgba(7,11,20,0.82)'; this.rr(g, p.rx - w / 2, p.ry - 18, w, 11, 3); g.fill();
          g.fillStyle = C.coral; g.fillText(tag, p.rx, p.ry - 12);
        }
        if (p.state === 'held') {
          g.strokeStyle = C.amber; g.lineWidth = 1; g.setLineDash([2, 3]);
          g.beginPath(); g.arc(p.rx, p.ry, 9, 0, 6.283); g.stroke(); g.setLineDash([]);
        }
      }
    }
    shape(g, shape, x, y, s, col, hollow) {
      g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1.4;
      g.beginPath();
      if (shape === 'diamond') { g.moveTo(x, y - s * 1.3); g.lineTo(x + s * 1.3, y); g.lineTo(x, y + s * 1.3); g.lineTo(x - s * 1.3, y); g.closePath(); }
      else if (shape === 'square') g.rect(x - s, y - s, s * 2, s * 2);
      else if (shape === 'bar') g.rect(x - s * 2, y - s * 0.7, s * 4, s * 1.4);
      else if (shape === 'tri') { g.moveTo(x, y - s * 1.3); g.lineTo(x + s * 1.2, y + s); g.lineTo(x - s * 1.2, y + s); g.closePath(); }
      else if (shape === 'hex') { for (let i = 0; i < 6; i++) g.lineTo(x + Math.cos(i * Math.PI / 3) * s * 1.3, y + Math.sin(i * Math.PI / 3) * s * 1.3); g.closePath(); }
      else if (shape === 'star') { for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.55 : s * 1.5; g.lineTo(x + Math.cos(i * Math.PI / 4) * r, y + Math.sin(i * Math.PI / 4) * r); } g.closePath(); }
      else g.arc(x, y, s, 0, 6.283);
      if (hollow) { g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1; g.stroke(); } else g.fill();
    }

    effects(g, dt) {
      g.globalCompositeOperation = 'lighter';
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
        g.globalAlpha = clamp(p.life / p.max, 0, 1); g.fillStyle = p.color;
        g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life -= dt; if (r.life <= 0) { this.rings.splice(i, 1); continue; }
        const f = 1 - r.life / r.max, rad = r.inward ? r.r * (1 - f) + 6 : r.r * (0.25 + 0.75 * f);
        g.globalAlpha = (1 - f) * 0.8; g.strokeStyle = r.color; g.lineWidth = 2.5 * (1 - f) + 0.5;
        g.beginPath(); g.arc(r.x, r.y, rad, 0, 6.283); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt; if (t.life <= 0) { this.texts.splice(i, 1); continue; }
        t.y -= 26 * dt;
        g.globalAlpha = clamp(t.life / t.max * 1.6, 0, 1);
        g.font = '700 ' + t.size + 'px ' + MONO;
        g.lineWidth = 3; g.strokeStyle = 'rgba(7,11,20,0.9)'; g.strokeText(t.text, t.x, t.y);
        g.fillStyle = t.color; g.fillText(t.text, t.x, t.y);
      }
      g.globalAlpha = 1;
    }
  }

  CP.Renderer = Renderer;
  CP.COLORS = C;
})();
