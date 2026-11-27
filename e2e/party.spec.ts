import { expect, test, type Page } from '@playwright/test';
import { HERO_ORDER } from '../src/shared/content/classes.js';

async function enter(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Hero name').fill(name);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.locator('.lobby')).toBeVisible();
}

const world = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as { rhuin: { game: { world: { duty: { phase: string; rooms: { status: string }[] }; partyMembers(): unknown[]; meEntity(): { x: number; y: number } | undefined } } | null } }).rhuin.game;
    if (!g) return null;
    const me = g.world.meEntity();
    return { phase: g.world.duty.phase, cleared: g.world.duty.rooms.filter((r) => r.status === 'cleared').length, members: g.world.partyMembers().length, me: me ? { x: me.x, y: me.y } : null };
  });

test('two players form a party, queue with AI fill and clear the first room together', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  for (const p of [alice, bob]) p.on('pageerror', (e) => errors.push(e.message));

  await enter(alice, 'Alice');
  await enter(bob, 'Bob');

  // Alice plays the Ranger's second hero, the Bowmaster, who carries the Longbow; Bob joins her party
  // by code and plays a Duelist.
  await alice.locator('.role-card[data-role="ranger"]').click();
  await expect(alice.locator('.hero-card')).toHaveText([/^Arbalest · Crossbow/, /^Bowmaster · Longbow/]);
  await expect(alice.locator('.hero-card.selected')).toContainText('Arbalest · Crossbow');
  const bowmaster = alice.locator('.hero-card[data-hero="bowmaster"]');
  await bowmaster.click();
  await expect(bowmaster).toHaveAttribute('aria-pressed', 'true');
  await expect(alice.locator('.hero-card.selected')).toContainText('Bowmaster · Longbow');
  await expect(alice.locator('.party-slot .pmeta').first()).toHaveText('Ranger · Bowmaster');
  const code = (await alice.locator('.code-box .code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  await bob.locator('.role-card[data-role="melee"]').click();
  await bob.getByLabel('Party code').fill(code);
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(alice.locator('.party-slot:not(.empty)')).toHaveCount(2);
  await expect(bob.locator('.party-slot:not(.empty)')).toHaveCount(2);

  // Party chat reaches both members.
  await bob.getByLabel('Party chat').fill('ready when you are');
  await bob.getByLabel('Party chat').press('Enter');
  await expect(alice.locator('.chat-lines')).toContainText('ready when you are');

  // Only the leader can queue.
  await expect(bob.getByRole('button', { name: 'Join Queue' })).toBeDisabled();
  await alice.locator('.fill-options button', { hasText: 'Now' }).click();
  await alice.getByRole('button', { name: 'Join Queue' }).click();

  // The ready check lists both players and two AI companions, including a Staff healer.
  for (const p of [alice, bob]) {
    await expect(p.locator('.modal .ready-slot')).toHaveCount(4);
    await expect(p.locator('.modal .ai-badge')).toHaveCount(2);
  }
  await expect(alice.locator('.modal .ready-slot').nth(1)).toContainText('Staff');
  await alice.getByRole('button', { name: 'Commence' }).click();
  await bob.getByRole('button', { name: 'Commence' }).click();

  for (const p of [alice, bob]) {
    await expect(p.locator('canvas.world')).toBeVisible();
    await expect(p.locator('.pl-member')).toHaveCount(4);
    await expect(p.locator('.hotbar .slot')).toHaveCount(10);
  }
  // The HUD names each player's hero as the lobby did.
  await expect(alice.locator('.who-am-i')).toHaveText('Ranger · Bowmaster');
  await expect(bob.locator('.who-am-i')).toHaveText('Duelist · Dragoon');
  await expect.poll(async () => (await world(alice))?.phase, { timeout: 10_000 }).toBe('running');

  const aliceHero = await bob.evaluate(() => {
    const { game } = (window as unknown as { rhuin: { game: { world: { ents: Map<number, { spawn: { name: string; hero?: string } }> } } } }).rhuin;
    return [...game.world.ents.values()].find(({ spawn }) => spawn.name === 'Alice')?.spawn.hero;
  });
  expect(aliceHero).toBe('bowmaster');

  // Bob walks, and Alice sees him move.
  const before = await bob.evaluate(() => {
    const g = (window as unknown as { rhuin: { game: { world: { meEntity(): { x: number; y: number } } } } }).rhuin.game;
    return { ...g.world.meEntity() };
  });
  await bob.keyboard.down('d');
  await bob.waitForTimeout(700);
  await bob.keyboard.up('d');
  await bob.keyboard.down('s');
  await bob.waitForTimeout(500);
  await bob.keyboard.up('s');
  const bobId = await bob.evaluate(() => (window as unknown as { rhuin: { game: { world: { meId: number } } } }).rhuin.game.world.meId);
  await expect
    .poll(
      async () =>
        alice.evaluate((id) => {
          const e = (window as unknown as { rhuin: { game: { world: { ents: Map<number, { x: number; y: number }> } } } }).rhuin.game.world.ents.get(id);
          return e ? { x: e.x, y: e.y } : null;
        }, bobId),
      { timeout: 5_000 },
    )
    .not.toEqual(before);

  // The AI tank leads the way. Both players follow it (T), hold the attack button and use skills
  // until the first room falls.
  for (const p of [alice, bob]) {
    await p.keyboard.press('Escape');
    await p.keyboard.press('t');
    await expect(p.locator('.skill-error')).toContainText('Following');
    await p.mouse.move(720, 300);
    await p.mouse.down();
  }
  const deadline = Date.now() + 120_000;
  let cleared = 0;
  while (Date.now() < deadline && cleared < 2) {
    for (const p of [alice, bob]) for (const k of ['q', 'e', 'r']) await p.keyboard.press(k);
    await alice.waitForTimeout(400);
    cleared = (await world(alice))?.cleared ?? 0;
  }
  expect(cleared).toBeGreaterThanOrEqual(2);
  await expect(alice.locator('.duty-obj .obj.done').first()).toBeVisible();
  expect(errors).toEqual([]);
  // Close both games, so they do not run on behind the next test.
  for (const p of [alice, bob]) await p.context().close();
});

test('a party with an AI Flame Warden clears the first room', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page, 'Cara');

  // The Duelist offers three heroes; the Flame Warden's skills include the Firebeast and its claws.
  await page.locator('.role-card[data-role="melee"]').click();
  await expect(page.locator('.hero-card')).toHaveText([/^Dragoon · Lance/, /^Blademaster · Twin Blades/, /^Flame Warden · Ember Blade/]);
  await page.locator('.hero-card[data-hero="flameWarden"]').click();
  await expect(page.locator('.hero-card.selected')).toContainText('Flame Warden · Ember Blade');
  await expect(page.locator('.skill-list .sname')).toContainText(['Ember Slash chain', 'Blazing Crescent', 'Flashfire', 'Inferno Burst', 'Kindle', 'Firebeast', 'Firebeast Claw chain', 'Bloodrush', 'Second Wind']);
  await expect(page.locator('.hero-card[data-hero="flameWarden"] img')).toHaveAttribute('src', /^data:image\/png/);

  // Cara plays the Ranger; the server sends the AI Duelist as the Flame Warden.
  await page.locator('.role-card[data-role="ranger"]').click();
  await page.locator('.fill-options button', { hasText: 'Now' }).click();
  await page.getByRole('button', { name: 'Join Queue' }).click();
  await expect(page.locator('.modal .ready-slot')).toHaveCount(4);
  await expect(page.locator('.modal .ready-slot').nth(3)).toContainText('Flame Warden · Ember Blade');
  await page.getByRole('button', { name: 'Commence' }).click();
  await expect(page.locator('canvas.world')).toBeVisible();
  await expect.poll(async () => (await world(page))?.phase, { timeout: 10_000 }).toBe('running');

  const wardenId = await page.evaluate(() => {
    const { game } = (window as unknown as { rhuin: { game: { world: { ents: Map<number, { id: number; spawn: { hero?: string; bot?: boolean } }> } } } }).rhuin;
    return [...game.world.ents.values()].find(({ spawn }) => spawn.hero === 'flameWarden' && spawn.bot)?.id ?? null;
  });
  expect(wardenId).not.toBeNull();

  // Follow the AI tank in, hold the attack button and use skills until the first room falls.
  await page.keyboard.press('t');
  await page.mouse.move(720, 300);
  await page.mouse.down();
  const seen = () =>
    page.evaluate((id) => {
      const { game } = (window as unknown as { rhuin: { game: { world: { forms: Map<number, unknown> }; renderer: { chibiShown: Map<number, unknown> } } } }).rhuin;
      return { drawn: game.renderer.chibiShown.has(id), transformed: game.world.forms.has(id) };
    }, wardenId as number);
  const deadline = Date.now() + 120_000;
  let cleared = 0;
  let transformed = false;
  while (Date.now() < deadline && cleared < 2) {
    for (const k of ['q', 'e', 'r']) await page.keyboard.press(k);
    await page.waitForTimeout(300);
    cleared = (await world(page))?.cleared ?? 0;
    transformed ||= (await seen()).transformed;
  }
  expect(cleared).toBeGreaterThanOrEqual(2);
  // He is drawn as his own chibi once its side view is painted.
  await expect.poll(async () => (await seen()).drawn, { timeout: 30_000 }).toBe(true);
  test.info().annotations.push({ type: 'firebeast', description: transformed ? 'The AI Flame Warden took the Firebeast form.' : 'The first room fell before the Firebeast was worth it.' });
  expect(errors).toEqual([]);
  await page.context().close();
});

test('a Flame Warden player becomes the Firebeast: the hotbar greys, only the claws answer, no monster hurts it and Immune shows', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page, 'Dana');
  await page.locator('.role-card[data-role="melee"]').click();
  await page.locator('.hero-card[data-hero="flameWarden"]').click();
  await expect(page.locator('.hero-card.selected')).toContainText('Flame Warden · Ember Blade');
  await page.locator('.fill-options button', { hasText: 'Now' }).click();
  await page.getByRole('button', { name: 'Join Queue' }).click();
  await page.getByRole('button', { name: 'Commence' }).click();
  await expect(page.locator('canvas.world')).toBeVisible();
  await expect.poll(async () => (await world(page))?.phase, { timeout: 10_000 }).toBe('running');

  type Game = {
    world: { meId: number; formOf(id: number): string | null; meEntity(): { x: number; y: number; snap: { d?: number; hp: number } } | undefined; enemies(): { x: number; y: number; spawn: { kind: string }; snap: { a?: number } }[] };
    roll: unknown;
    fx: { texts: { text: string }[] };
    hud: { error(text: string): void };
    onEvent(ev: unknown): void;
  };
  // Keep every message the hotbar shows, since a later one soon replaces it, and count every blow
  // the server reports landing on Dana's Firebeast (Immune, as it arrives over the wire).
  await page.evaluate(() => {
    const w = window as unknown as { rhuin: { game: Game }; said: string[]; immune: number };
    const g = w.rhuin.game;
    const said: string[] = (w.said = []);
    const show = g.hud.error.bind(g.hud);
    g.hud.error = (text: string) => {
      said.push(text);
      show(text);
    };
    w.immune = 0;
    const handle = g.onEvent.bind(g);
    g.onEvent = (ev: unknown) => {
      const e = ev as { e: string; k?: string; t?: number };
      if (e.e === 'fx' && e.k === 'immune' && e.t === g.world.meId) w.immune++;
      handle(ev);
    };
  });
  const state = () =>
    page.evaluate(() => {
      const w = window as unknown as { rhuin: { game: Game }; immune: number };
      const g = w.rhuin.game;
      const me = g.world.meEntity();
      const near = me ? g.world.enemies().filter((e) => Math.hypot(e.x - me.x, e.y - me.y) < 3.5) : [];
      return {
        form: g.world.formOf(g.world.meId),
        down: !!me?.snap.d,
        rolling: g.roll !== null,
        onMe: near.some((e) => e.snap.a === g.world.meId),
        boss: near.some((e) => e.spawn.kind === 'boss' && e.snap.a !== undefined),
        hp: me?.snap.hp ?? 0,
        immune: w.immune,
        shown: g.fx.texts.some((t) => t.text === 'Immune'),
      };
    });

  // Follow the AI tank in and fight, skills and all, until something will strike the Firebeast: a
  // monster within reach that has turned on Dana, or the first boss in a fight beside her (its
  // marked blasts land on everyone, and the claws pull it off the tank, who leaves it be while the
  // form lasts). Never while she is knocked out (a boss can floor her; the Sage raises her).
  await page.keyboard.press('t');
  await page.mouse.move(720, 300);
  await page.mouse.down();
  const deadline = Date.now() + 120_000;
  let why: 'onMe' | 'boss';
  for (let tick = 0; ; tick++) {
    const s = await state();
    if (!s.down && (s.onMe || s.boss)) {
      why = s.onMe ? 'onMe' : 'boss';
      break;
    }
    expect(Date.now(), 'no monster turned on Dana and no boss came near').toBeLessThan(deadline);
    if (tick % 10 === 0) for (const k of ['q', 'e', 'r']) await page.keyboard.press(k);
    await page.waitForTimeout(50);
  }

  // F, then Space at once: the server has not answered yet, but the roll is refused on the spot
  // rather than predicted and snapped back.
  await page.keyboard.press('f');
  await page.keyboard.press(' ');
  expect((await state()).rolling).toBe(false);
  await expect.poll(async () => (await state()).form, { timeout: 3_000 }).toBe('firebeast');
  expect(await page.evaluate(() => (window as unknown as { said: string[] }).said)).toContain('The Firebeast only has its claws');

  // The hotbar: every slot but the attack is greyed, the attack shows the claw, and a bar counts the
  // form down.
  await expect(page.locator('.form-bar.show')).toContainText('Firebeast');
  await expect(page.locator('.hotbar .slot.form-locked')).toHaveCount(9);
  await expect(page.locator('.hotbar .slot.form-basic img')).toHaveAttribute('alt', 'Firebeast Claw I');

  // While the form lasts no monster hurts Dana, and every blow the server reports on the Firebeast
  // shows as Immune. Against a monster that is after her the claws rest, so it lives to strike; a
  // boss they pull onto her.
  if (why === 'onMe') await page.mouse.up();
  const hp = await page.evaluate(() => (window as unknown as { rhuin: { game: Game } }).rhuin.game.world.meEntity()?.snap.hp ?? 0);
  let lowest = hp;
  let shown = false;
  for (;;) {
    const s = await state();
    if (!s.form) break;
    lowest = Math.min(lowest, s.hp);
    shown ||= s.immune > 0 && s.shown;
    await page.waitForTimeout(40);
  }
  await page.mouse.down();
  expect(lowest, 'no monster hurt the Firebeast').toBeGreaterThanOrEqual(hp);
  const struck = (await state()).immune;
  if (struck) expect(shown || (await state()).shown, 'the client showed the server’s Immune').toBe(true);
  else {
    // No blow happened to land in its 5 seconds (the AI tank soon takes monsters back, and the
    // form cannot be taken again for 90): the client is handed the event the server sends for one
    // (test/lobby.test.ts checks the server sends it), through the same handler, and must show it.
    shown = await page.evaluate(() => {
      const g = (window as unknown as { rhuin: { game: Game } }).rhuin.game;
      g.onEvent({ e: 'fx', k: 'immune', t: g.world.meId });
      return g.fx.texts.some((t) => t.text === 'Immune');
    });
    expect(shown).toBe(true);
  }
  test.info().annotations.push({ type: 'immune', description: `${why === 'onMe' ? 'Taken with a monster after Dana' : 'Taken beside a boss'}: ${struck ? `${struck} blows reached the client as Immune` : 'no blow landed, so the event was handed to the client'}.` });

  // The form ends: the bar goes, the hotbar answers again, and the room still falls.
  await expect(page.locator('.form-bar.show')).toHaveCount(0);
  await expect(page.locator('.hotbar .slot.form-locked')).toHaveCount(0);
  let cleared = 0;
  while (Date.now() < deadline && cleared < 2) {
    for (const k of ['q', 'e', 'r']) await page.keyboard.press(k);
    await page.waitForTimeout(300);
    cleared = (await world(page))?.cleared ?? 0;
  }
  expect(cleared).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('the title shows every hero, however narrow the window', async ({ browser }) => {
  for (const [width, height] of [[1440, 900], [1024, 768], [800, 700], [480, 800]] as const) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto('/');
    // Every hero's portrait, painted.
    await expect(page.locator('.hero-line img')).toHaveCount(HERO_ORDER.length);
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.hero-line img')].every((i) => i.src.startsWith('data:image/png') && i.complete), null, { timeout: 30_000 });
    const m = await page.evaluate(() => ({
      vw: innerWidth,
      vh: innerHeight,
      scroll: document.documentElement.scrollWidth,
      imgs: [...document.querySelectorAll<HTMLImageElement>('.hero-line img')].map((i) => {
        const r = i.getBoundingClientRect();
        return { alt: i.alt, left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
      }),
    }));
    // Each stands whole inside the window, big enough to read, and the page does not scroll sideways.
    expect(m.scroll, `${width}px`).toBeLessThanOrEqual(m.vw);
    for (const i of m.imgs) {
      expect(i.left, `${i.alt} at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(i.right, `${i.alt} at ${width}px`).toBeLessThanOrEqual(m.vw);
      expect(i.top, `${i.alt} at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(i.bottom, `${i.alt} at ${width}px`).toBeLessThanOrEqual(m.vh);
      expect(i.height, `${i.alt} at ${width}px`).toBeGreaterThanOrEqual(60);
    }
    await context.close();
  }
});
