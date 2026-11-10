// Headless balance check. Run: node test/balance.js [-v]
// For every mission: playing with no tools must not earn 3 stars, and the
// recommended tools must earn 3 stars, on several seeds.
'use strict';
const path = require('path');
for (const f of ['core', 'data', 'missions', 'sim']) require(path.join('..', 'js', f + '.js'));
const CP = globalThis.CP;
const verbose = process.argv.includes('-v');
const DT = 1 / 30;

function bestOption(sim, card) {
  const ok = (o) => !o.requires || sim.isOn(o.requires);
  let k = card.options.findIndex((o) => o.good && !o.neutral && ok(o));
  if (k < 0) k = card.options.findIndex((o) => o.good && ok(o));
  if (k < 0) k = card.options.findIndex(ok);
  return k;
}

function play(mission, policy, seed) {
  const sim = new CP.Sim(mission, { seed });
  const want = [];
  let guard = 0;
  while (sim.phase !== 'won' && sim.phase !== 'lost' && guard++ < 400000) {
    if (sim.phase === 'build') {
      const next = sim.waveIdx + 1;
      if (policy === 'rec') for (const id of (mission.rec || {})[next] || []) want.push(id);
      if (policy === 'all' && next === 0) for (const id of mission.modules) want.push(id);
      sim.startWave();
    }
    while (want.length && (sim.mods[want[0]].owned || sim.buy(want[0]))) want.shift();
    if (policy !== 'none') {
      for (const c of sim.cards.slice()) {
        if (c.max - c.ttl < 3 && !c.stuck) continue; // reading time
        if (c.scripted) sim.answer(c.id, bestOption(sim, c));
        else sim.answer(c.id, c.bad ? 'no' : 'yes');
      }
      if (sim.nodes.leader && sim.nodes.leader.down && sim.downT > 2 && sim.canUse('failover')) sim.use('failover');
      if (sim.abil.rewind && sim.recentDamage() >= 10 && sim.canUse('rewind')) sim.use('rewind');
    }
    sim.step(DT);
  }
  return sim;
}

function row(sim) {
  return [
    sim.phase === 'won' ? sim.stars() + '★' : 'LOST(' + sim.lostWhy + ' w' + (sim.waveIdx + 1) + ')',
    'int ' + sim.integrity.toFixed(0), 'bud ' + sim.budget.toFixed(0), 'cr ' + sim.credits.toFixed(0),
    'p99max ' + sim.maxP99.toFixed(0), 'served ' + sim.served, 'refused ' + sim.blockedLegit, 'landed ' + sim.landed,
    'cards ' + sim.cardsRight + '/' + sim.cardsWrong, 'earned ' + sim.earned.toFixed(0),
  ].join('  ');
}

let failures = 0;
const SEEDS = [1, 7, 42, 1234];
for (const m of CP.MISSIONS) {
  console.log('\n' + m.id + '  ' + m.title);
  for (const policy of ['none', 'rec', 'all']) {
    const runs = SEEDS.map((s) => play(m, policy, s));
    const stars = runs.map((s) => s.stars());
    let ok = true;
    if (policy === 'none') ok = stars.every((x) => x < 2);
    if (policy === 'rec') ok = stars.every((x) => x === 3);
    if (!ok) failures++;
    console.log('  ' + policy.padEnd(5) + (ok ? ' ok   ' : ' FAIL ') + (verbose ? '' : row(runs[0])));
    if (verbose) for (const s of runs) console.log('         ' + row(s));
    if (policy === 'rec') console.log('         challenge: ' + runs.map((s) => (m.challenge.test(s) ? 'yes' : 'no')).join(' '));
  }
}

// Endless must be survivable for a few waves with tools and must end without them.
{
  const m = CP.makeEndless(3);
  m.rec = { 0: ['constraints', 'rls', 'sandbox', 'idempotency', 'versionCheck', 'serializable', 'approval', 'replicas', 'ryw', 'syncRep', 'approvalTimeout'] };
  const sim = play(m, 'rec', 5);
  console.log('\nendless  rec reached wave ' + (sim.waveIdx + 1) + '  ' + row(sim));
  if (sim.waveIdx < 4) { failures++; console.log('  FAIL endless too hard'); }
}

console.log(failures ? '\n' + failures + ' balance check(s) failed' : '\nAll balance checks passed');
process.exit(failures ? 1 : 0);
