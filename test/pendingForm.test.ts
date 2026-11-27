/**
 * The client treats a form it has just asked for (the Firebeast) as taken until the server answers,
 * so a roll pressed in the meantime is refused on the spot rather than predicted and snapped back.
 */
import { describe, expect, it } from 'vitest';
import { FORM_CONFIRM_WAIT, formSkill, PendingForm } from '../src/client/game/pendingForm.js';

describe('a form on its way', () => {
  it('knows which skills start a form: only the Firebeast', () => {
    expect(formSkill('firebeast')).toBe('firebeast');
    for (const id of ['kindle', 'bloodrush', 'flashfire', 'elixir', 'dodge', 'flame_sword.basic1', 'nonsense']) expect(formSkill(id), id).toBeNull();
  });

  it('counts as taken from the moment the skill is sent until the server answers', () => {
    const pending = new PendingForm();
    pending.sent('kindle', 10);
    expect(pending.form(10)).toBeNull();
    pending.sent('firebeast', 10);
    // F, then Space a moment later: the roll must wait.
    expect(pending.form(10.05)).toBe('firebeast');
    // The status event arrives: the world knows of the form now.
    pending.settled();
    expect(pending.form(10.1)).toBeNull();
  });

  it('is forgotten when the server refuses the skill, and only that skill', () => {
    const pending = new PendingForm();
    pending.sent('firebeast', 0);
    pending.refused('kindle');
    expect(pending.form(0.1)).toBe('firebeast');
    pending.refused('firebeast');
    expect(pending.form(0.1)).toBeNull();
  });

  it('is forgotten if no answer comes in time', () => {
    const pending = new PendingForm();
    pending.sent('firebeast', 5);
    expect(pending.form(5 + FORM_CONFIRM_WAIT - 0.01)).toBe('firebeast');
    expect(pending.form(5 + FORM_CONFIRM_WAIT)).toBeNull();
  });
});
