// Frozen. Imports every planned data file and assembles the `data` object (CONTRACTS 13a).
import tileList from './tiles.js';
import props from './props.js';
import * as palettesNs from './palettes.js';
import * as looksNs from './looks.js';
import items from './items.js';
import shops from './shops.js';
import loot from './loot.js';
import lessons from './lessons.js';
import classes from './classes.js';
import boons from './boons.js';
import specWarrior from './specs/warrior.js';
import specMage from './specs/mage.js';
import specRogue from './specs/rogue.js';
import enemiesIntro from './enemies/intro.js';
import enemiesForest from './enemies/forest.js';
import enemiesBosses from './enemies/bosses.js';
import npcsTown from './npcs/town.js';
import npcsAcademy from './npcs/academy.js';
import npcsForest from './npcs/forest.js';
import dlgStory from './dialogues/story.js';
import dlgTown from './dialogues/town.js';
import dlgAcademy from './dialogues/academy.js';
import dlgForest from './dialogues/forest.js';
import questsMain from './quests/main.js';
import questsTown from './quests/town.js';
import questsForest from './quests/forest.js';
import csIntro from './cutscenes/intro.js';
import csAmbush from './cutscenes/ambush.js';
import csRescue from './cutscenes/rescue.js';
import csAcademy from './cutscenes/academy.js';
import csForest from './cutscenes/forest.js';
import zoneTest from './zones/test.js';
import zoneIntro from './zones/intro.js';
import zoneTown from './zones/town.js';
import zoneAcademy from './zones/academy.js';
import zoneForest from './zones/forest.js';
// round 3: one folder per biome (docs/BIOMES.md)
import dunes_zone from './biomes/dunes/zone.js';
import dunes_enemies from './biomes/dunes/enemies.js';
import dunes_npcs from './biomes/dunes/npcs.js';
import dunes_dialogues from './biomes/dunes/dialogues.js';
import dunes_quests from './biomes/dunes/quests.js';
import dunes_cutscenes from './biomes/dunes/cutscenes.js';
import dunes_loot from './biomes/dunes/loot.js';
import dunes_items from './biomes/dunes/items.js';
import cove_zone from './biomes/cove/zone.js';
import cove_enemies from './biomes/cove/enemies.js';
import cove_npcs from './biomes/cove/npcs.js';
import cove_dialogues from './biomes/cove/dialogues.js';
import cove_quests from './biomes/cove/quests.js';
import cove_cutscenes from './biomes/cove/cutscenes.js';
import cove_loot from './biomes/cove/loot.js';
import cove_items from './biomes/cove/items.js';
import peaks_zone from './biomes/peaks/zone.js';
import peaks_enemies from './biomes/peaks/enemies.js';
import peaks_npcs from './biomes/peaks/npcs.js';
import peaks_dialogues from './biomes/peaks/dialogues.js';
import peaks_quests from './biomes/peaks/quests.js';
import peaks_cutscenes from './biomes/peaks/cutscenes.js';
import peaks_loot from './biomes/peaks/loot.js';
import peaks_items from './biomes/peaks/items.js';
import aether_zone from './biomes/aether/zone.js';
import aether_enemies from './biomes/aether/enemies.js';
import aether_npcs from './biomes/aether/npcs.js';
import aether_dialogues from './biomes/aether/dialogues.js';
import aether_quests from './biomes/aether/quests.js';
import aether_cutscenes from './biomes/aether/cutscenes.js';
import aether_loot from './biomes/aether/loot.js';
import aether_items from './biomes/aether/items.js';

/** Merge several id-keyed objects; later files win on duplicate ids. */
function merge(...parts) { return Object.assign({}, ...parts); }

const byId = {};
const index = {};
tileList.forEach((t, i) => { byId[t.id] = t; index[t.id] = i; });

export const data = {
  tiles: { list: tileList, byId, index },
  props,
  palettes: { ...palettesNs },
  looks: { ...looksNs },
  enemies: merge(enemiesIntro, enemiesForest, enemiesBosses, dunes_enemies, cove_enemies, peaks_enemies, aether_enemies),
  npcs: merge(npcsTown, npcsAcademy, npcsForest, dunes_npcs, cove_npcs, peaks_npcs, aether_npcs),
  dialogues: merge(dlgStory, dlgTown, dlgAcademy, dlgForest, dunes_dialogues, cove_dialogues, peaks_dialogues, aether_dialogues),
  quests: merge(questsMain, questsTown, questsForest, dunes_quests, cove_quests, peaks_quests, aether_quests),
  cutscenes: merge(csIntro, csAmbush, csRescue, csAcademy, csForest, dunes_cutscenes, cove_cutscenes, peaks_cutscenes, aether_cutscenes),
  zones: merge(zoneTest, zoneIntro, zoneTown, zoneAcademy, zoneForest, dunes_zone, cove_zone, peaks_zone, aether_zone),
  items: merge(items, dunes_items, cove_items, peaks_items, aether_items), shops, loot: merge(loot, dunes_loot, cove_loot, peaks_loot, aether_loot), lessons, classes, boons,
  specs: merge(specWarrior, specMage, specRogue),
};

export default data;
