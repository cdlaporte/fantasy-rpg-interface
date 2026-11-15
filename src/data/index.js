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
  enemies: merge(enemiesIntro, enemiesForest, enemiesBosses),
  npcs: merge(npcsTown, npcsAcademy, npcsForest),
  dialogues: merge(dlgStory, dlgTown, dlgAcademy, dlgForest),
  quests: merge(questsMain, questsTown, questsForest),
  cutscenes: merge(csIntro, csAmbush, csRescue, csAcademy, csForest),
  zones: merge(zoneTest, zoneIntro, zoneTown, zoneAcademy, zoneForest),
  items, shops, loot, lessons, classes, boons,
  specs: merge(specWarrior, specMage, specRogue),
};

export default data;
