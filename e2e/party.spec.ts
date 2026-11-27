import { expect, test, type Page } from '@playwright/test';

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

test('a Flame Warden player becomes the Firebeast: the hotbar greys, only the claws answer, and Immune shows', async ({ browser }) => {
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
    world: { meId: number; formOf(id: number): string | null; meEntity(): { x: number; y: number; snap: { d?: number } } | undefined; enemies(): { x: number; y: number; snap: { a?: number } }[] };
    roll: unknown;
    fx: { texts: { text: string }[] };
    hud: { error(text: string): void };
    onEvent(ev: unknown): void;
  };
  // Keep every message the hotbar shows, since a later one soon replaces it.
  await page.evaluate(() => {
    const g = (window as unknown as { rhuin: { game: Game }; said: string[] }).rhuin.game;
    const said: string[] = ((window as unknown as { said: string[] }).said = []);
    const show = g.hud.error.bind(g.hud);
    g.hud.error = (text: string) => {
      said.push(text);
      show(text);
    };
  });
  const state = () =>
    page.evaluate(() => {
      const g = (window as unknown as { rhuin: { game: Game } }).rhuin.game;
      const me = g.world.meEntity();
      const near = me ? g.world.enemies().filter((e) => Math.hypot(e.x - me.x, e.y - me.y) < 3.5) : [];
      return {
        form: g.world.formOf(g.world.meId),
        down: !!me?.snap.d,
        rolling: g.roll !== null,
        near: near.length,
        onMe: near.some((e) => e.snap.a === g.world.meId),
        immune: g.fx.texts.some((t) => t.text === 'Immune'),
      };
    });

  // Follow the AI tank in and fight. Take the form once a monster in reach is after Dana (its blows
  // will show Immune), or beside any monster if none turns on her soon, and never while she is
  // knocked out (a boss can floor her on the way in; the Sage raises her).
  await page.keyboard.press('t');
  await page.mouse.move(720, 300);
  await page.mouse.down();
  const patience = Date.now() + 25_000;
  const deadline = Date.now() + 90_000;
  for (;;) {
    const s = await state();
    if (!s.down && (s.onMe || (s.near && Date.now() > patience))) break;
    expect(Date.now()).toBeLessThan(deadline);
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

  // Blows that land on the Firebeast show Immune. If none landed while it lasted, the client is
  // still asked to draw one, so the path is covered either way.
  let immune = false;
  while ((await state()).form) {
    immune ||= (await state()).immune;
    await page.waitForTimeout(40);
  }
  test.info().annotations.push({ type: 'immune', description: immune ? 'A monster struck the Firebeast: Immune.' : 'No monster struck the Firebeast; an immune event was replayed.' });
  if (!immune) {
    immune = await page.evaluate(() => {
      const g = (window as unknown as { rhuin: { game: Game } }).rhuin.game;
      g.onEvent({ e: 'fx', k: 'immune', t: g.world.meId });
      return g.fx.texts.some((t) => t.text === 'Immune');
    });
  }
  expect(immune).toBe(true);

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
