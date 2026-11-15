// Frozen. Every system module, in UPDATE order (section 2).
// `ops` comes first: it has no update but must be initialized before others register ops.
// INIT_FIRST systems are initialized before the rest (in that order), so later inits can use them.
import ops from './ops.js';
import clock from './clock.js';
import world from './world.js';
import npc from './npc.js';
import ai from './ai.js';
import companions from './companions.js';
import player from './player.js';
import kits from './kits/index.js';
import abilities from './abilities.js';
import physics from './physics.js';
import combat from './combat.js';
import ents from './ents.js';
import quests from './quests.js';
import cutscene from './cutscene.js';
import dialogue from './dialogue.js';
import progression from './progression.js';
import inventory from './inventory.js';
import gates from './gates.js';
import save from './save.js';
import debug from './debug.js';

export const SYSTEMS = [
  ops, clock, world, npc, ai, companions, player, kits, abilities, physics,
  combat, ents, quests, cutscene, dialogue, progression, inventory, gates, save, debug,
];

export const INIT_FIRST = ['ops', 'ents', 'world'];

export default SYSTEMS;
