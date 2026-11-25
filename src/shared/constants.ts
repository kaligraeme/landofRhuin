/** Simulation and gameplay constants shared by the server and the browser client. */

export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;
/** The server sends a world snapshot every this many ticks (10 per second). */
export const SNAPSHOT_EVERY = 2;

/** World units are tiles. One tile is roughly one stride. */
export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 6;
export const SPRINT_BONUS = 0.35;

/** After using a skill the user cannot start another (or a basic attack) for this long. */
export const SKILL_LOCK = 0.25;
/** Moving during the last moments of a wind-up does not cancel it. */
export const SLIDECAST_WINDOW = 0.15;
/** The basic attack chain restarts after this long without attacking. */
export const CHAIN_RESET = 1.2;
/** Dodge roll: distance, duration, and stamina cost. */
export const ROLL_DISTANCE = 4.5;
export const ROLL_TIME = 0.3;
export const ROLL_STAMINA = 30;
/** Damage and heal over time effects tick on this interval. */
export const DOT_TICK = 3;
export const CRIT_CHANCE = 0.1;
export const CRIT_MULT = 1.5;

/**
 * To pull a monster off the hero it is on, you need this much more aggro than they have: 10%
 * more, or 30% more if they are the tank. The client draws the threat meter against these.
 */
export const AGGRO_STICK = 1.1;
export const AGGRO_TANK_STICK = 1.3;

/** Radius of "party" effects such as songs and area heals. */
export const PARTY_EFFECT_RADIUS = 20;

/** How long players have to accept a ready check. */
export const READY_CHECK_SECONDS = 30;
export const PARTY_SIZE = 4;

/** Seconds without combat before out-of-combat regeneration starts. */
export const OUT_OF_COMBAT_DELAY = 4;
