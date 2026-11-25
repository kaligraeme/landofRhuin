# Land of Rhuin

A four-player co-op hack-and-slash dungeon RPG that runs in the browser. Form a party of four (Warrior,
Mage, Ranger and Duelist) and carve through a dungeon generated fresh for every run. Every dungeon
belongs to one of three monster clans: **Orcs**, **Dragons and their cultists**, or the **Undead**.
Each run has waves of monsters, then 3 or 4 bosses whose attacks are marked on the ground before
they land. Players queue together or alone, and AI companions fill any role nobody is playing.

Combat is aimed and hands-on. Hold the mouse to swing your weapon's combo, fire skills toward the
cursor, and dodge-roll through danger. The dungeon structure takes its cues from big fantasy MMO
dungeons: a finder queue with a ready check, enmity and taunts, sealed boss arenas, and orange
telegraphs to step out of. All names, art, skills and bosses are original.

![Fighting Gnashtusk the War Boar in an Orc stronghold](docs/screenshots/orc-boss.jpg)

![The title screen with the four heroes](docs/screenshots/title.jpg)

## Quick start

You need Node.js 20.19 or later.

```sh
npm ci
npm run build
npm start            # http://127.0.0.1:8787
```

Open the address, pick a name, choose a role and weapon, set **AI companions fill empty roles**
to **Now**, and press **Join Queue**. Accept the ready check with **Commence**.

To play with friends on your network, start the server with `npm start -- --host 0.0.0.0` and
have them open `http://<your-ip>:8787`. One player shares their **party code**; the others type
it into **Party code** and press **Join**. The party leader then joins the queue.

| Server option | Effect |
| --- | --- |
| `--port 8787` | Port for the web page and the game socket. |
| `--host 127.0.0.1` | Interface to listen on. Use `0.0.0.0` for LAN play. |
| `--quick` | Monsters have a quarter of their health. Good for trying things out. |
| `--countdown 5` | Seconds before the entrance barrier drops. |
| `--clan orc` | Make every dungeon belong to one clan: `orc`, `dragon` or `undead`. |

For development, `npm run dev` runs the server with reload on port 8787 and the Vite client on
http://localhost:5173 (it forwards the game socket to the server).

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim. Your hero always faces the cursor. |
| Hold left mouse | Basic attack: your weapon's three-hit combo |
| Right mouse | Weapon special |
| Q, E, R | Weapon skills |
| F | Weapon ultimate |
| 1, 2 | Role skills |
| 3 | Elixir (restores 35% HP) |
| Space | Dodge roll: a short roll during which nothing can hurt you. Costs stamina. |
| T | Follow the Warrior, or the party member you selected |
| Tab, F1 – F4 | Select an enemy or a party member to see them in the target frame |
| Mouse wheel | Zoom |
| Enter | Chat |
| M | Music on or off (the ♪ button and slider by it set the volume) |

Every skill is aimed at the cursor:

- **Arcs and thrusts** hit everything in front of you.
- **Projectiles** fly until they hit something; some pierce or explode.
- **Ground skills** land where you point, some after a short delay, shown as a blue marker.
- **Dashes and leaps** carry you through or onto your enemies.

A few heavy skills have a short wind-up; moving or rolling cancels it.

## Roles and weapons

Each role has two heroes, a man and a woman, and each hero carries one weapon of their own:
choosing your hero chooses your weapon.

| Role | Strengths | His weapon | Her weapon |
| --- | --- | --- | --- |
| **Warrior** (tank) | The most health and stamina, crowd control and taunts. *Rallying Bulwark* gives the whole party 20% damage reduction and a barrier. | Greatsword, two-handed | Battleaxe, two-handed |
| **Mage** | Offensive and healing spells. | Branch staff, two-handed (the healer) | Mystic sword and a wand |
| **Ranger** | High damage from range. A glass cannon: low health, 15% more damage taken. | Crossbow | Longbow |
| **Duelist** (melee) | The highest damage in the party, and the easiest to fall: low health, 20% more damage taken. | Halberd, two-handed | Twin blades |

| Weapon | Style | Special (RMB) · Q · E · R · Ultimate (F) |
| --- | --- | --- |
| Greatsword (Warrior) | Warden | Parry · Upheaval (line stun) · Gravity Sweep (pulls enemies in) · Earthsplitter · Titan's Verdict (leap and stun) |
| Battleaxe | Berserker | Iron Hide (damage heals you) · Cleaving Spin · Hurl Axe (stun) · War Stomp · Bloodstorm |
| Staff | Sage (healer) | Mending Light (heal circle) · Arcane Orb · Sanctuary (healing ground) · Meteor · Resurrection |
| Mystic Sword & Wand | Spellblade | Runic Ward (barriers) · Spellblade Rush · Arc Lightning · Lifebinding Sigil (damage and heal) · Astral Cleave |
| Crossbow | Arbalist | Piercing Bolt · Explosive Bolt · Tumble Shot · Scattershot · Siege Barrage |
| Longbow | Marksman | Charged Shot · Volley · Snare Trap · Fan of Arrows · Rain of Ruin |
| Halberd | Halberdier | Sweeping Strike · Piercing Thrust · Vault Strike · Whirling Halberd · Skewer |
| Twin Blades | Reaver | Rising Slash · Whirlwind · Reaver's Lunge · Executioner · Cataclysm Blades |

Role skills: the Warrior has **Challenge** (taunt everything nearby) and **Rallying Bulwark**. The
Mage has **Arcane Blink** and **Mana Font**. The Ranger has **Vault** and **Field Dressing**. The
Duelist has **Bloodrush** (more damage dealt, more taken) and **Second Wind**.

The Staff is the party's healer. An AI companion filling the Mage slot is always the Staff-carrying
Mage. A party
without a Staff gets the *Ward of Rhuin*: 15% less damage taken and a slow heal in combat.

In AI-only test runs, Duelists deal about 1,500 damage per second, Rangers about 1,150, Mages
about 750 to 800 and Warriors about 500.

## Heroes and clans

Every role has a man and a woman to choose from in the lobby, each with their own weapon. The
Warriors wear steel plate and crimson capes, the Mages embroidered robes, the Rangers green
cloaks and quivers, and the Duelists light leathers and red scarves. Weapons are part of each
hero's animation, held the way they are meant to be held: two-handed greatswords, axes, staves
and halberds, the Mage's sword and wand, the Ranger's crossbow and longbow, and the Duelist's
twin blades.

![Every hero in their battle stance](docs/screenshots/hero-appearances.jpg)

### Animation

Every hero, monster and boss is animated through five clips:

| Clip | When it plays | Heroes |
| --- | --- | --- |
| **Idle** | Out of combat | Relaxed, breathing: the greatsword rests on a shoulder, the staff is leaned on, the halberd planted |
| **Battle** | While a fight is on nearby | A low, wide fighting stance, weapon raised and ready, bouncing on the balls of the feet |
| **Move** | Running | A full sprint: long strides, a hard forward lean, capes, scarves and hair streaming, dust kicked up |
| **Action** | Basic attacks | A big wind-up, then the weapon's own blow with a motion smear: an overhead cleave, a two-handed chop, a thrust of the staff, a rising slash, a crossbow shot, a drawn and loosed arrow, a lunging sweep, a crossing double cut |
| **Skill** | Skills and spells | Gathering a glow in the role's colour, then the weapon's signature move: a leaping slam that cracks the ground, a whirlwind of axe strokes, a magic circle and a blast of light, a three-bolt volley, arrows loosed at the sky, a spinning halberd, a storm of blades |

Monsters and bosses walk, stand ready, lunge and gather their clan's glow the same way. Dodging
plays as a dash with after-images.

![The cast cycling through idle, battle, move, action and skill](docs/screenshots/cast-animation.webp)

The server tells every client when anyone attacks or uses a skill, and how long they wind up, so
everyone sees the same animation in time with the telegraphs. Characters still flash when hit and
fall when knocked out.

Each dungeon is the lair of one clan, with its own monsters, bosses, rooms, colours and floor:

| Clan | Dungeon | Monsters | Bosses |
| --- | --- | --- | --- |
| **Orcs** | The Bloodtusk Stronghold: torchlit earth, bones, blood and stakes | Orc Brute, Goblin Cutthroat, Orc Archer, Orc Shaman, Orc Ravager, War Totem | Grukk the Skullsplitter, Mother Zhura the Bone Seer, Gnashtusk the War Boar, Old Ironjaw the Ogre, and Warlord Krognar |
| **Dragons** | The Cinder Sanctum: obsidian, glowing lava cracks and drifting embers | Drakonid Warrior, Wyrmling, Cult Crossbowman, Flamecaller Cultist, Fire Drake, Dragon Idol | Scalebreaker Vorth, High Priestess Seraphine, Ashwing the Wyvern, the Obsidian Guardian, and Ignaroth the Elder Flame |
| **Undead** | The Barrow of Sorrows: cold stone, graves, cobwebs and green mist | Skeleton Warrior, Ghoul, Skeleton Archer, Necromancer, Bone Abomination, Cursed Obelisk | Sir Morgrave the Death Knight, Lich Vessanthe, Grimmaw the Bone Hound, the Wailing Warden, and Mortheus the Dread King |

![Every hero, monster and boss](docs/screenshots/bestiary.jpg)

| Orcs | Dragons | Undead |
| --- | --- | --- |
| ![An orc stronghold fight](docs/screenshots/orc-fight.jpg) | ![A fight in the Cinder Sanctum](docs/screenshots/dragon-fight.jpg) | ![A fight in the Barrow of Sorrows](docs/screenshots/undead-fight.jpg) |
| ![An orc boss](docs/screenshots/orc-boss.jpg) | ![A dragon clan boss](docs/screenshots/dragon-boss.jpg) | ![An undead boss](docs/screenshots/undead-boss.jpg) |

The art lives in `src/client/art/`. Monsters and bosses are transparent pixel sprites in
`creatures/`, each with a ground anchor and a display height. Their frames are built as they load
(`animation.ts`): each gets a rig (`rigs.ts`) of two legs, a robe, four legs, a hovering form, or a
rigid object such as a totem, and the rig is posed frame by frame, bending the original artwork.

The heroes are painted frame by frame (`heroes/`): a skeleton is posed for every frame
(`moves.ts` holds the choreography), knees and elbows are solved to reach the feet and hands, and
the body, robes, capes, hair and weapon are drawn on it as outlined, cel-shaded pixel shapes. Each
hero's face and hair are cut from their artwork in `creatures/`.

## Music

The score is original and generated live in the browser with the Web Audio API: no audio files.
It is written in a dark folk style, modal and medieval, for a mournful reed lead, lute and harp,
a hurdy-gurdy drone, a wordless choir, strings, bells and frame drums.

| Track | When it plays | Mode and meter |
| --- | --- | --- |
| Ballad of Rhuin | Title screen and lobby | D Dorian, a slow 3/4 |
| The Bloodtusk Stronghold | Orc dungeons | E Phrygian, 4/4 |
| The Cinder Sanctum | Dragon dungeons | A Phrygian dominant, 4/4 |
| The Barrow of Sorrows | Undead dungeons | B minor, 3/4 |
| The Last Sovereign | While a boss fights you | D minor, a driving 6/8 |
| Victory | A dungeon cleared | |
| Lament | The party falls | |

Each clan's theme has a combat layer of drums, bass and a pulsing figure. It fades in when a fight
breaks out near you and out a few seconds after it ends. A boss crossfades to the boss theme.
Music starts on your first click or key press, as browsers require. The ♪ button and slider on
every screen, or M in a dungeon, set it, and the browser remembers your choice.

`src/client/audio/` holds it: `notation.ts` (a small note language), `score.ts` (the tracks),
`synth.ts` (the instruments, a hall reverb and a compressor) and `music.ts` (the director, which
schedules notes ahead on the audio clock, crossfades and fades the layers).

## How a run works

1. **Lobby.** Choose a role, then one of its two heroes: each carries their own weapon. Hover a skill
   to read what it does.

   ![The lobby: role and weapon, party, and the expedition finder](docs/screenshots/lobby.jpg)

2. **Party.** Everyone starts in their own party with a 5-letter code. Up to four players can
   join one party, and each member needs a different role to queue.
3. **Queue.** The leader picks when AI companions fill empty roles: now, after 15, 30 or 60
   seconds, or never. The matchmaker merges parties whose roles do not overlap. A full party of
   four starts at once.
4. **Ready check.** Everyone in the group has 30 seconds to press **Commence**. If someone
   withdraws, the others go back to the queue at their original place.

   ![The ready check: one player and three AI companions](docs/screenshots/ready-check.jpg)

5. **The dungeon.** A chain of rooms joined by corridors. In front of each boss are one or two
   rooms you clear in 2 or 3 waves; barrier gates open as you clear them. When the Warrior is an AI
   companion, it leads the party between fights and waits for the players. A boss arena seals six
   seconds after the fight starts, and the last boss always has three phases.
6. **Stagger.** Stuns, knockbacks, pulls and heavy blows fill a boss's stagger bar. When it is
   full the boss is staggered: helpless for 4 seconds and taking 25% more damage.
7. **Wipes.** If the whole party falls, everyone returns to the last checkpoint and the encounter
   resets. Each wipe adds a stack of *Echo of Rhuin* (up to 3): 10% more damage dealt and 10%
   less damage taken per stack.
8. **Results.** When the final boss falls you get the clear time and each hero's damage,
   healing and knockouts.

Monsters wind up their attacks too. Brutes flash a short red arc before they swing, and archers
and casters draw an aim line before they shoot. Step aside or roll through.

## Reading boss mechanics

| Marker | Meaning |
| --- | --- |
| Orange area filling up | Damage lands when it fills. Get out, or roll through at the last moment. |
| Faint red arc or line | A monster's routine swing or shot. Dodge it if you can. |
| Gold circle with arrows pointing in | **Stack**: the damage is shared by everyone inside. Stand together. |
| Purple circle on each player | **Spread**: each circle also hits anyone else inside it. Spread out. |
| Red circle and diamond over a head | **Tank buster**: a heavy hit on the target. Warrior: block or parry. Everyone else: stay clear. |
| Blue arrows around the boss | **Knockback**: everyone is thrown away from the boss. |
| Red screen edges | **Raid-wide** damage is about to hit everyone. |
| Blue dashed circle | Your party's own delayed blast (Meteor, Volley, Rain of Ruin). |

Getting hit by an avoidable attack adds *Vulnerability Up*: 25% more damage taken per stack for
10 seconds.

## How it is built

```
src/shared/      Rules both sides use: constants, geometry, the tile map with collision, line of
                 sight and A* pathfinding, the network protocol, and the content (roles, weapons,
                 skills, statuses, monsters, bosses, clans).
src/server/      Node.js server.
  dungeonGen.ts  Seeded dungeon generator.
  sim/           The dungeon simulation: instance (rooms, waves, gates, wipes), combat (aimed
                 skills, damage, healing, statuses, stagger), projectiles, mechanics (telegraphs
                 and bosses), monster AI.
  ai/botAI.ts    AI companions: targeting, positioning, dodging and rolling, stack and spread,
                 healing, raising, taunting, staggering, leading the party.
  matchmaker.ts  Role-unique queue with AI fill.
  lobby.ts       Players, parties, queue, ready checks, instances, reconnects.
  main.ts        HTTP server for the client and the WebSocket at /ws.
src/client/      Browser client (TypeScript and canvas, no framework).
  ui/            Title screen and lobby.
  art/           Sprite art: the pixel kit and pixel heroes and weapons, the SVG kit and the
                 clans' monsters and bosses.
  game/          World state, renderer, HUD, effects, input and prediction.
  audio/         The music: a note language, the score, synthesized instruments, the director.
test/            Unit tests and full dungeon runs.
e2e/             Browser test with two players.
```

- **Server-authoritative.** The server simulates every dungeon at 20 ticks per second and sends
  each player a snapshot 10 times a second. It decides every hit, heal, cooldown, projectile and
  AI action.
- **Responsive movement.** Your own character moves and rolls immediately on your screen, using
  the same collision code as the server, which checks every move against your speed. When the
  server moves you itself (dashes, leaps, knockbacks), the client eases you to the new position.
  Everyone else is drawn slightly in the past and interpolated between snapshots, and projectiles
  are extrapolated along their flight.
- **Reproducible dungeons.** A dungeon is generated from a seed, so the same seed gives the same
  layout, rooms, waves and bosses.
- **Reconnects.** The browser keeps a token. If you drop out of a dungeon, an AI companion plays
  your character until you reconnect, then hands it back.

## Tests

```sh
npm test            # unit tests, plus complete dungeon runs by AI-only parties
npm run typecheck
npm run e2e         # builds, then drives two browsers through a party, queue and first room
npm run simulate -- 42 5   # play 5 dungeons (seeds 42-46) with AI parties and print results
```

The simulation tests have four AI parties with different weapons clear entire dungeons. That
checks the generator, the combat rules, every boss and the AI together, and keeps the balance
honest: AI parties clear a dungeon in about 8 to 11 minutes.

## Ideas for what is next

- Gear and rewards from bosses, and character progression between runs.
- Accounts and saved characters (players are currently kept in memory by the server).
- Sound and music, and frame-by-frame animation for the sprites.
- Gamepad support.
- More clans, bosses and mechanics (towers to soak, tethers, line stacks, gaze attacks).
- A harder difficulty and a timed leaderboard.
- Rate limiting and stricter validation before running a public server.
