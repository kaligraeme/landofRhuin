/**
 * A form the player has just asked for (the Flame Warden's Firebeast) and the server has not yet
 * confirmed. Its status event comes back a round trip after the skill is sent; until then the
 * client must not predict a roll the server is about to refuse, so it treats the form as already
 * taken. The wait ends when the event arrives, when the server refuses the skill, or after a
 * second, whichever comes first.
 */
import { SKILLS } from '../../shared/content/classes.js';
import { STATUSES } from '../../shared/content/statuses.js';

/** Seconds to wait for the server to confirm a form before forgetting it. */
export const FORM_CONFIRM_WAIT = 1;

/** The form (its status id) a skill turns its user into, if any. */
export function formSkill(id: string): string | null {
  for (const e of SKILLS[id]?.effects ?? []) if (e.kind === 'status' && e.to === 'self' && STATUSES[e.status]?.form) return e.status;
  return null;
}

export class PendingForm {
  private wait: { form: string; skill: string; until: number } | null = null;

  /** The player sent a skill (client seconds): note the form it starts, if it starts one. */
  sent(skill: string, now: number): void {
    const form = formSkill(skill);
    if (form) this.wait = { form, skill, until: now + FORM_CONFIRM_WAIT };
  }

  /** The server refused a skill: if it was the one that starts the form, the form is not coming. */
  refused(skill: string): void {
    if (this.wait?.skill === skill) this.wait = null;
  }

  /** A form began or ended on the player: the world knows, so the wait is over. */
  settled(): void {
    this.wait = null;
  }

  /** The form the player is about to take (client seconds), if one is on its way. */
  form(now: number): string | null {
    return this.wait && now < this.wait.until ? this.wait.form : null;
  }
}
