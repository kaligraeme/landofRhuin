import { describe, expect, it } from 'vitest';
import { Lobby, type Conn } from '../src/server/lobby.js';
import { HEROES, type HeroId } from '../src/shared/content/classes.js';
import type { ServerMsg } from '../src/shared/protocol.js';

function client(lobby: Lobby, name: string) {
  const inbox: ServerMsg[] = [];
  const conn: Conn = { send: (m) => inbox.push(m) };
  const id = lobby.connect(conn, name, undefined, 0);
  const last = <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  return { id, inbox, last, lobby: () => last('lobby')!.state };
}

describe('lobby', () => {
  it('forms a party by code, queues, fills with AI, runs a ready check and launches a dungeon', () => {
    const lobby = new Lobby({ instance: { enemyHp: 0.2 } });
    const a = client(lobby, 'Alice');
    const b = client(lobby, 'Bob');
    lobby.handle(a.id, { t: 'loadout', role: 'tank' }, 0);
    lobby.handle(a.id, { t: 'hero', hero: 'guardian' }, 0);
    lobby.handle(b.id, { t: 'party.join', code: a.lobby().party.code }, 0);
    expect(a.lobby().party.members.map((m) => m.name)).toEqual(['Alice', 'Bob']);

    // Same role twice cannot queue.
    lobby.handle(a.id, { t: 'queue.join', aiFill: 10 }, 0);
    expect(a.last('error')?.message).toMatch(/different role/);
    lobby.handle(b.id, { t: 'loadout', role: 'melee' }, 0);
    // Only the leader can queue.
    lobby.handle(b.id, { t: 'queue.join', aiFill: 10 }, 0);
    expect(b.last('error')?.message).toMatch(/leader/);

    lobby.handle(a.id, { t: 'queue.join', aiFill: 10 }, 1000);
    expect(a.lobby().queue?.filledRoles.sort()).toEqual(['melee', 'tank']);
    lobby.tick(5000);
    expect(a.lobby().readyCheck).toBeNull();
    for (let i = 0; i < 20; i++) lobby.tick(11_500);
    const rc = a.lobby().readyCheck!;
    expect(rc).not.toBeNull();
    expect(rc.slots.map((s) => s.role)).toEqual(['tank', 'mage', 'ranger', 'melee']);
    expect(rc.slots.filter((s) => s.bot).map((s) => s.role)).toEqual(['mage', 'ranger']);
    expect(rc.slots.find((s) => s.role === 'mage')).toMatchObject({ hero: 'sage', weapon: 'staff' });
    expect(rc.slots.find((s) => s.name === 'Alice')).toMatchObject({ hero: 'guardian', weapon: 'sword_shield' });

    lobby.handle(a.id, { t: 'ready', accept: true }, 12_000);
    expect(a.last('instance.start')).toBeUndefined();
    lobby.handle(b.id, { t: 'ready', accept: true }, 12_000);
    const start = a.last('instance.start')!.start;
    const heroes = start.entities.filter((e) => e.kind === 'player');
    expect(heroes).toHaveLength(4);
    // Each player enters as the hero they play, every one a hero of their role.
    expect(heroes.find((e) => e.name === 'Alice')).toMatchObject({ role: 'tank', hero: 'guardian', weapon: 'sword_shield' });
    for (const e of heroes) expect(HEROES[e.hero!], e.name).toMatchObject({ role: e.role, weapon: e.weapon });
    expect(b.last('instance.start')).toBeDefined();
    expect(lobby.instances.size).toBe(1);

    // The simulation streams snapshots with the player's own cooldown state.
    for (let i = 0; i < 4; i++) lobby.tick(12_100);
    const snap = a.last('snap')!;
    expect(snap.ents.length).toBeGreaterThanOrEqual(4);
    expect(snap.me?.id).toBe(start.you);

    // Leaving hands the character to an AI companion.
    lobby.handle(b.id, { t: 'instance.leave' }, 13_000);
    expect(b.lobby().instanceId).toBeNull();
    const run = [...lobby.instances.values()][0]!;
    expect(run.inst.players.filter((p) => p.botControlled)).toHaveLength(3);
  });

  it('declining a ready check puts the others back in the queue', () => {
    const lobby = new Lobby();
    const a = client(lobby, 'Alice');
    const b = client(lobby, 'Bob');
    lobby.handle(a.id, { t: 'loadout', role: 'tank' }, 0);
    lobby.handle(b.id, { t: 'loadout', role: 'mage' }, 0);
    lobby.handle(b.id, { t: 'hero', hero: 'spellblade' }, 0);
    lobby.handle(a.id, { t: 'queue.join', aiFill: null }, 0);
    lobby.handle(b.id, { t: 'queue.join', aiFill: 0 }, 100);
    // Bob's AI fill pulls Alice in only if she accepts AI; she does not, so Bob goes alone.
    expect(b.lobby().readyCheck?.slots.filter((s) => !s.bot).map((s) => s.name)).toEqual(['Bob']);
    expect(a.lobby().readyCheck).toBeNull();
    lobby.handle(b.id, { t: 'ready', accept: false }, 200);
    expect(b.lobby().readyCheck).toBeNull();
    expect(b.lobby().queue).toBeNull();
    expect(a.lobby().queue).not.toBeNull();
  });

  it('reconnecting with the token resumes control in the dungeon', () => {
    const lobby = new Lobby();
    const a = client(lobby, 'Alice');
    lobby.handle(a.id, { t: 'queue.join', aiFill: 0 }, 0);
    lobby.handle(a.id, { t: 'ready', accept: true }, 0);
    const token = a.last('welcome')!.token;
    lobby.disconnect(a.id, 1000);
    const run = [...lobby.instances.values()][0]!;
    expect(run.inst.playerByOwner(a.id)?.botControlled).toBe(true);
    const inbox: ServerMsg[] = [];
    const again = lobby.connect({ send: (m) => inbox.push(m) }, 'Alice', token, 2000);
    expect(again).toBe(a.id);
    expect(run.inst.playerByOwner(a.id)?.botControlled).toBe(false);
    expect(inbox.some((m) => m.t === 'instance.start')).toBe(true);
  });

  it('a late close from an old socket does not disconnect the new one', () => {
    const lobby = new Lobby();
    const oldConn: Conn = { send: () => {} };
    const id = lobby.connect(oldConn, 'Alice', undefined, 0);
    const token = lobby.players.get(id)!.token;
    const newConn: Conn = { send: () => {} };
    lobby.connect(newConn, 'Alice', token, 10);
    lobby.disconnect(id, 20, oldConn);
    expect(lobby.players.get(id)!.conn).toBe(newConn);
    lobby.disconnect(id, 30, newConn);
    expect(lobby.players.get(id)!.conn).toBeNull();
  });

  it('gives each hero their own weapon: picking the hero picks it', () => {
    const lobby = new Lobby();
    const a = client(lobby, 'Alice');
    lobby.handle(a.id, { t: 'loadout', role: 'tank' }, 0);
    expect(a.lobby().you).toMatchObject({ role: 'tank', hero: 'darkKnight', weapon: 'tank_greatsword' });
    lobby.handle(a.id, { t: 'hero', hero: 'guardian' }, 0);
    expect(a.lobby().you).toMatchObject({ hero: 'guardian', weapon: 'sword_shield' });
    expect(a.lobby().party.members[0]).toMatchObject({ role: 'tank', hero: 'guardian', weapon: 'sword_shield' });
    // A new role starts on its default hero, the first it lists, with that hero's weapon.
    lobby.handle(a.id, { t: 'loadout', role: 'melee' }, 0);
    expect(a.lobby().you).toMatchObject({ role: 'melee', hero: 'dragoon', weapon: 'spear' });
    lobby.handle(a.id, { t: 'hero', hero: 'blademaster' }, 0);
    expect(a.lobby().you).toMatchObject({ hero: 'blademaster', weapon: 'twin_blades' });
    lobby.handle(a.id, { t: 'loadout', role: 'mage' }, 0);
    expect(a.lobby().you).toMatchObject({ hero: 'sage', weapon: 'staff' });
    lobby.handle(a.id, { t: 'loadout', role: 'ranger' }, 0);
    expect(a.lobby().you).toMatchObject({ hero: 'arbalest', weapon: 'crossbow' });
  });

  it('rejects a hero from another role, and one that does not exist', () => {
    const lobby = new Lobby();
    const a = client(lobby, 'Alice');
    lobby.handle(a.id, { t: 'loadout', role: 'tank' }, 0);
    lobby.handle(a.id, { t: 'hero', hero: 'guardian' }, 0);
    lobby.handle(a.id, { t: 'hero', hero: 'blademaster' }, 0);
    expect(a.last('error')?.message).toBe('The Blademaster is not a Tank hero.');
    expect(a.lobby().you).toMatchObject({ role: 'tank', hero: 'guardian', weapon: 'sword_shield' });
    for (const hero of ['female', 'tank', '', undefined, 3]) {
      const seen = a.inbox.length;
      lobby.handle(a.id, { t: 'hero', hero: hero as HeroId }, 0);
      expect(a.inbox.slice(seen), String(hero)).toEqual([{ t: 'error', message: 'Choose a valid hero.' }]);
    }
    expect(a.lobby().you).toMatchObject({ role: 'tank', hero: 'guardian', weapon: 'sword_shield' });
  });

  it('fills empty roles with AI companions playing heroes of those roles, the Mage always the healer', () => {
    const seen = new Set<HeroId>();
    for (let run = 0; run < 30; run++) {
      const lobby = new Lobby();
      const a = client(lobby, 'Alice');
      lobby.handle(a.id, { t: 'loadout', role: 'melee' }, 0);
      lobby.handle(a.id, { t: 'queue.join', aiFill: 0 }, 0);
      const bots = a.lobby().readyCheck!.slots.filter((s) => s.bot);
      expect(bots.map((s) => s.role)).toEqual(['tank', 'mage', 'ranger']);
      for (const s of bots) {
        expect(HEROES[s.hero]).toMatchObject({ role: s.role, weapon: s.weapon });
        seen.add(s.hero);
      }
      expect(bots[1]!.hero).toBe('sage');
    }
    // Over 30 runs, the Tank and the Ranger come as either of their heroes.
    expect([...seen].sort()).toEqual(['arbalest', 'bowmaster', 'darkKnight', 'guardian', 'sage']);
  });

  it('sends an AI Duelist as any of the three, or as the heroes the server asks for', () => {
    const duelists = new Set<HeroId>();
    for (let run = 0; run < 40; run++) {
      const lobby = new Lobby();
      const a = client(lobby, 'Alice');
      lobby.handle(a.id, { t: 'queue.join', aiFill: 0 }, 0);
      duelists.add(a.lobby().readyCheck!.slots.find((s) => s.role === 'melee')!.hero);
    }
    expect([...duelists].sort()).toEqual(['blademaster', 'dragoon', 'flameWarden']);

    for (let run = 0; run < 5; run++) {
      const lobby = new Lobby({ companions: ['flameWarden', 'bowmaster'] });
      const a = client(lobby, 'Alice');
      lobby.handle(a.id, { t: 'queue.join', aiFill: 0 }, 0);
      const slots = a.lobby().readyCheck!.slots;
      expect(slots.find((s) => s.role === 'melee')).toMatchObject({ bot: true, hero: 'flameWarden', weapon: 'flame_sword' });
      expect(slots.find((s) => s.role === 'ranger')).toMatchObject({ bot: true, hero: 'bowmaster', weapon: 'bow' });
      // A role with none of the heroes asked for keeps its own rules: the Mage is still the healer.
      expect(slots.find((s) => s.role === 'mage')).toMatchObject({ hero: 'sage' });
    }
    // A Mage asked for comes even when it is not the healer.
    const lobby = new Lobby({ companions: ['spellblade'] });
    const a = client(lobby, 'Alice');
    lobby.handle(a.id, { t: 'queue.join', aiFill: 0 }, 0);
    expect(a.lobby().readyCheck!.slots.find((s) => s.role === 'mage')).toMatchObject({ bot: true, hero: 'spellblade', weapon: 'mystic_sword' });
  });
});
