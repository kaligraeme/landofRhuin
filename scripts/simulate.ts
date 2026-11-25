/**
 * Runs a dungeon with four AI companions as fast as possible and prints how it went.
 * Usage: npm run simulate -- [seed] [count]
 */
import { Instance, formatTime, type Seat } from '../src/server/sim/instance.js';

const seed0 = Number(process.argv[2] ?? 1);
const count = Number(process.argv[3] ?? 1);
// Weapons can be picked with PARTY=tank,mage,ranger,melee weapon ids (default below).
const [tw, mw, rw, dw] = (process.env.PARTY ?? 'sword_shield,staff,bow,spear').split(',');
const seats: Seat[] = [
  { ownerId: null, name: 'Aldric', role: 'tank', weapon: tw ?? 'sword_shield' },
  { ownerId: null, name: 'Sera', role: 'mage', weapon: mw ?? 'staff' },
  { ownerId: null, name: 'Tamsin', role: 'ranger', weapon: rw ?? 'bow' },
  { ownerId: null, name: 'Corvin', role: 'melee', weapon: dw ?? 'spear' },
];

for (let n = 0; n < count; n++) {
  const seed = seed0 + n;
  const inst = new Instance(`sim-${seed}`, seats, { seed });
  const started = Date.now();
  const limit = 40 * 60 * 20;
  const log: string[] = [];
  // Aggro diagnostics: how often each hero pulls a monster off the tank, and what kills them.
  const pulls = new Map<string, number>();
  const killers = new Map<string, number>();
  const lastTarget = new Map<number, number | null>();
  const lastHit = new Map<number, string>();
  while (inst.phase !== 'complete' && inst.ticks < limit) {
    inst.tick();
    for (const m of inst.monsters.values()) {
      const before = lastTarget.get(m.id);
      const was = before != null ? inst.players.find((p) => p.id === before) : undefined;
      const now = m.targetId != null ? inst.players.find((p) => p.id === m.targetId) : undefined;
      if (was && now && was !== now && was.role === 'tank' && !was.dead) pulls.set(now.name, (pulls.get(now.name) ?? 0) + 1);
      lastTarget.set(m.id, m.targetId);
    }
    for (const ev of inst.drainEvents()) {
      if (ev.e === 'banner') log.push(`[${formatTime(inst.now)}] ${ev.text}${ev.sub ? ` - ${ev.sub}` : ''}`);
      if (ev.e === 'dmg' && ev.s !== ev.t) {
        const src = inst.actor(ev.s);
        if (src && src.team === 'enemy') lastHit.set(ev.t, `${(src as { kind: string }).kind === 'boss' ? 'boss' : 'mob'}:${ev.n ?? '?'}`);
      }
      if (ev.e === 'death') {
        const who = inst.players.find((p) => p.id === ev.i);
        if (who) killers.set(lastHit.get(who.id) ?? '?', (killers.get(lastHit.get(who.id) ?? '?') ?? 0) + 1);
      }
    }
  }
  const res = inst.results();
  console.log(`seed ${seed}: ${inst.plan.name} (${inst.plan.bossCount} bosses, ${inst.plan.rooms.length} rooms, map ${inst.map.w}x${inst.map.h})`);
  console.log(`  ${inst.phase === 'complete' ? 'COMPLETE' : 'DID NOT FINISH'} in ${formatTime(inst.now)} game time, ${inst.wipes} wipes, ${Date.now() - started} ms real time`);
  for (const r of res) console.log(`  ${r.name.padEnd(8)} ${r.role.padEnd(7)} dmg ${String(r.damage).padStart(8)}  heal ${String(r.healing).padStart(7)}  deaths ${r.deaths}  raises ${r.raises}`);
  console.log(`  pulled off the tank: ${[...pulls].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'} | deaths by: ${[...killers].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  if (process.env.VERBOSE) for (const l of log) console.log('   ', l);
}
