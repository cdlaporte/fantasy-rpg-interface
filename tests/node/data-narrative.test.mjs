// Structural validation of the narrative/creature content: ids, references, vocabulary, looks, dialogue graphs,
// line lengths and balance. Pure data checks: no game instance needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import * as looksNs from '../../src/data/looks.js';
import {
  RIGS, BUILDS, HAIR_STYLES, FACIAL_STYLES, OUTFIT_STYLES, HAT_STYLES, HELD_STYLES, AURA_STYLES, EAR_STYLES,
  HUMANOID_HEROES, CREATURE_HEROES, CREATURE_FEATURES, PROJECTILE_MODELS, EFFECT_MODELS, AI_BRAINS, ABILITY_BLOCKS,
  FX_TYPES, SFX, MOODS, TOAST_STYLES, ANIMS, ICONS, SLASH_STYLES,
} from '../../src/contracts.js';

const MAX_LINE = 110;

// ---------------------------------------------------------------- vocabulary (CONTRACTS 11 + STORY)
const CONDS = new Set(['flag', 'not', 'level', 'class', 'spec', 'hasItem', 'gold', 'quest', 'rel', 'hour', 'hp']);
const ACTIONS = new Set(['flag.set', 'give', 'take', 'gold', 'xp', 'heal', 'quest.start', 'quest.advance', 'dialogue',
  'cutscene', 'shop', 'teleport', 'travel', 'spawn', 'despawn', 'setLook', 'rel', 'toast', 'fx', 'sfx', 'gate', 'chest',
  'lesson', 'classPicker', 'specPicker', 'lookPicker', 'companions', 'save']);
const STEPS = new Set([...ACTIONS, 'wait', 'waitFor', 'say', 'bubble', 'move', 'face', 'anim', 'camera', 'cameraReset',
  'parallel', 'lockInput', 'unlockInput', 'letterbox', 'control', 'escort', 'kill', 'tutorial']);
const GOALS = new Set(['reach', 'kill', 'collect', 'talk', 'interact', 'boss', 'flag']);
const ROUTINE_DO = new Set(['idle', 'wander', 'sit', 'shopkeep', 'sleep', 'patrol']);
const ON_ATTACKED = new Set(['flee', 'retaliate', 'guard']);
const ITEM_TYPES = new Set(['consumable', 'cosmetic', 'key', 'weapon']);
const ITEM_EFFECTS = new Set(['heal', 'heal_over_time', 'bomb', 'haste', 'shield', 'cure', 'smoke', 'xp', 'summon_pet', 'resource']);
const TELEGRAPHS = new Set(['circle', 'line', 'cone', null]);
const CLASSES = new Set(['warrior', 'mage', 'rogue']);

const range = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => p + (a + i));
const MARKERS = {
  intro: ['start', 'stick', 'rats_1', 'rats_2', 'big_rat', 'clearing', 'malgrim_spot', 'hex_1', 'hex_2', 'laporte_arrive',
    'exit_town', 'respawn', /* markers needed (docs/notes/narrative.md) */ 'walk_1', 'laporte_stand'],
  town: ['academy_door', 'gate_south', 'square', 'quest_board', 'potion_door', 'outfitter_door', 'general_door',
    'bakery_door', 'cafe_door', 'library_door', ...range('home_', 1, 8), 'park', ...range('bench_', 1, 4),
    ...range('cafe_seat_', 1, 4), ...range('stall_', 1, 3), ...range('guard_post_', 1, 3), 'gate_forest', 'gate_dunes',
    'gate_cove', 'gate_peaks', 'gate_aether'],
  academy: ['entrance', 'hall', 'hall_laporte', 'headmaster', 'infirmary', 'infirmary_bed', 'classroom_1', 'classroom_2',
    'teach_1', 'teach_2', 'library_nook', 'yard', ...range('dummy_', 1, 4), ...range('classmate_', 1, 3)],
  forest: ['entry_town', 'ranger_camp', 'glade', 'meadow', 'brook', 'hollow', 'goblin_camp', 'wisp_pond', 'grove_gate',
    'grove', 'boss_arena', ...range('chest_', 1, 4), 'respawn'],
};
// integration: the World package is merged, so every marker this content relies on must exist in the real zones,
// and the real zones' extra markers (boss_spawn, office_visitor, ...) are valid targets too.
const STORY_MARKERS = JSON.parse(JSON.stringify(MARKERS));
for (const z of Object.keys(MARKERS)) MARKERS[z] = [...new Set([...MARKERS[z], ...Object.keys((data.zones[z] && data.zones[z].markers) || {})])];
const CUTSCENE_ZONE = { intro_wake: 'intro', ambush: 'intro', rescue: 'intro', town_arrival: 'town', class_pick: 'academy',
  spec_ceremony: 'academy', forest_boss_intro: 'forest', forest_boss_outro: 'forest' };

const REQUIRED = {
  enemies: ['rat', 'giant_rat', 'hexguard', 'malgrim', 'training_dummy', 'slime', 'sporecap', 'thornling', 'bat', 'boar',
    'goblin_scout', 'wisp', 'treant_sapling', 'old_mossback'],
  items: ['potion_small', 'potion_big', 'bread', 'bomb', 'speed_tonic', 'shield_charm', 'smoke_pellet', 'focus_scroll'],
  shops: ['potions', 'outfitter', 'general', 'bakery'],
  quests: ['main_enroll', 'main_first_steps', 'forest_mushroom_mischief', 'forest_goblin_trouble', 'forest_sealed_grove'],
  lessons: ['lesson_1', 'lesson_2'],
  cutscenes: Object.keys(CUTSCENE_ZONE),
  loot: ['forest_small', 'forest_rune', 'boss_mossback'],
  npcs: ['laporte', 'bram', 'elowen', 'pip', 'ranger_tam'],
  dialogues: ['quest_board', 'cafe_door', 'library_door'],
};
const SHOP_NAMES = { potions: 'The Bubbling Cauldron', outfitter: 'Stitch & Sparkle', general: 'Odds & Ends', bakery: 'Rise & Shine' };

// Balance sheet (CLASSES.md): main roster level L -> hp 6 L^1.4, hit 2 + 1.5 L, xp 5 + 3 L; elite x2.5 hp x3 xp; boss x25 x20.
const ROSTER = { rat: 1, giant_rat: 2, slime: 3, sporecap: 4, thornling: 5, bat: 5, boar: 6, goblin_scout: 7, wisp: 8,
  treant_sapling: 9, old_mossback: 10 };

// ---------------------------------------------------------------- helpers
const err = [];
const fail = (where, msg) => err.push(`${where}: ${msg}`);
const flush = (name) => { const e = err.splice(0); assert.deepEqual(e, [], `${name}:\n  ${e.join('\n  ')}`); };

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
function checkColor(where, c, nullable = false) {
  if (nullable && (c === null || c === undefined)) return;
  if (!isHex(c)) fail(where, `bad color ${JSON.stringify(c)}`);
}
function inSet(where, set, v, what) {
  const ok = Array.isArray(set) ? set.includes(v) : set.has(v);
  if (!ok) fail(where, `unknown ${what} ${JSON.stringify(v)}`);
}

/** Validate a look. partial: a patch (fields optional). */
function checkLook(where, look, partial = false) {
  if (!look || typeof look !== 'object') return fail(where, 'missing look');
  const rig = look.rig || (partial ? 'humanoid' : undefined);
  inSet(where, RIGS, rig, 'rig');
  const has = (k) => look[k] !== undefined;
  if (rig === 'humanoid') {
    const need = ['build', 'size', 'skin', 'hair', 'facial', 'outfit', 'hood', 'hat', 'cape', 'held', 'aura', 'ears', 'hero'];
    if (!partial) for (const k of need) if (!has(k)) fail(where, `humanoid look missing ${k}`);
    const known = new Set(['rig', ...need]);
    for (const k of Object.keys(look)) if (!known.has(k)) fail(where, `unknown humanoid field ${k}`);
    if (has('build')) inSet(where, BUILDS, look.build, 'build');
    if (has('skin')) checkColor(where + '.skin', look.skin);
    if (has('size') && !(look.size > 0.4 && look.size < 3)) fail(where, 'size out of range');
    if (has('hair')) { inSet(where, HAIR_STYLES, look.hair.style, 'hair'); checkColor(where + '.hair', look.hair.color); }
    if (has('facial')) inSet(where, FACIAL_STYLES, look.facial, 'facial');
    if (has('outfit')) {
      if (has('rig') || look.outfit.style !== undefined) inSet(where, OUTFIT_STYLES, look.outfit.style, 'outfit');
      for (const k of ['primary', 'secondary', 'accent']) {
        if (look.outfit[k] !== undefined || !partial) checkColor(`${where}.outfit.${k}`, look.outfit[k]);
      }
    }
    if (has('hood') && typeof look.hood !== 'boolean') fail(where, 'hood must be boolean');
    if (look.hat) { inSet(where, HAT_STYLES, look.hat.style, 'hat'); checkColor(where + '.hat', look.hat.color); }
    if (look.cape) checkColor(where + '.cape', look.cape.color);
    if (look.held) {
      inSet(where, HELD_STYLES, look.held.style, 'held');
      checkColor(where + '.held', look.held.color);
      checkColor(where + '.held.glow', look.held.glow, true);
    }
    if (look.aura) { inSet(where, AURA_STYLES, look.aura.style, 'aura'); checkColor(where + '.aura', look.aura.color); }
    if (has('ears')) inSet(where, EAR_STYLES, look.ears, 'ears');
    if (look.hero) inSet(where, HUMANOID_HEROES, look.hero, 'hero');
  } else if (CREATURE_FEATURES[rig]) {
    for (const k of ['body', 'belly', 'accent', 'eye']) checkColor(`${where}.colors.${k}`, look.colors && look.colors[k]);
    if (!Array.isArray(look.features)) fail(where, 'features must be an array');
    for (const f of look.features || []) inSet(where, CREATURE_FEATURES[rig], f, `${rig} feature`);
    if (look.hero) inSet(where, CREATURE_HEROES, look.hero, 'hero');
  } else if (rig === 'projectile') {
    inSet(where, PROJECTILE_MODELS, look.model, 'projectile model');
    checkColor(where + '.color', look.color);
    checkColor(where + '.glow', look.glow, true);
  } else if (rig === 'effect') {
    inSet(where, EFFECT_MODELS, look.model, 'effect model');
    checkColor(where + '.color', look.color, true);
  }
}

/** Collect all display lines and validate ops/conds recursively. ctx = {where, zone, cutscene} */
const lines = [];
function line(where, text) {
  if (typeof text !== 'string' || !text.length) return fail(where, 'empty text');
  lines.push([where, text]);
}

function checkCond(where, c) {
  if (!Array.isArray(c)) return fail(where, `condition is not an array: ${JSON.stringify(c)}`);
  inSet(where, CONDS, c[0], 'condition');
  switch (c[0]) {
    case 'not': checkCond(where, c[1]); break;
    case 'level': case 'gold': if (!['>=', '<=', '>', '<', '=='].includes(c[1]) || typeof c[2] !== 'number') fail(where, 'bad cmp'); break;
    case 'class': inSet(where, CLASSES, c[1], 'class'); break;
    case 'hasItem': if (!data.items[c[1]]) fail(where, `unknown item ${c[1]}`); break;
    case 'quest':
      if (!data.quests[c[1]]) fail(where, `unknown quest ${c[1]}`);
      if (!['none', 'active', 'done', 'step'].includes(c[2])) fail(where, `bad quest state ${c[2]}`);
      if (c[2] === 'step' && !(c[3] >= 0 && c[3] < data.quests[c[1]].steps.length)) fail(where, `bad step ${c[3]}`);
      break;
    case 'rel': if (!data.npcs[c[1]]) fail(where, `unknown npc ${c[1]}`); break;
    case 'hour': if (c[1] !== 'between' || !(c[2] >= 0 && c[3] <= 24)) fail(where, 'bad hour'); break;
    case 'hp': if (c[1] !== 'player') fail(where, 'hp cond expects player'); break;
    default:
  }
}
const conds = (where, list) => { for (const c of list || []) checkCond(where, c); };

const isWho = (who) => who === 'player' || who === 'narrator' || (typeof who === 'string' && who[0] === '@') ||
  !!data.npcs[who] || !!data.enemies[who];
function checkTarget(where, t, zone) {
  if (Array.isArray(t)) return;
  if (zone && MARKERS[zone].includes(t)) return;
  if (isWho(t)) return;
  fail(where, `unknown marker/target ${JSON.stringify(t)} in zone ${zone}`);
}
function checkFx(where, fx, zone) {
  inSet(where, FX_TYPES, fx.type, 'fx type');
  if (fx.at !== undefined) checkTarget(where, fx.at, zone);
  if (fx.color) checkColor(where, fx.color);
  if (fx.style && fx.type === 'slash') inSet(where, SLASH_STYLES, fx.style, 'slash style');
}

function checkAction(where, a, ctx) {
  if (!Array.isArray(a)) return fail(where, `action is not an array: ${JSON.stringify(a)}`);
  const name = a[0];
  const vocab = ctx.cutscene ? STEPS : ACTIONS;
  inSet(where, vocab, name, ctx.cutscene ? 'step' : 'action');
  const w = `${where} ${name}`;
  switch (name) {
    case 'give': case 'take': if (!data.items[a[1]]) fail(w, `unknown item ${a[1]}`); break;
    case 'quest.start': case 'quest.advance': if (!data.quests[a[1]]) fail(w, `unknown quest ${a[1]}`); break;
    case 'dialogue': if (!data.dialogues[a[1]]) fail(w, `unknown dialogue ${a[1]}`); break;
    case 'cutscene': if (!data.cutscenes[a[1]]) fail(w, `unknown cutscene ${a[1]}`); break;
    case 'shop': if (!data.shops[a[1]]) fail(w, `unknown shop ${a[1]}`); break;
    case 'lesson': if (!data.lessons[a[1]]) fail(w, `unknown lesson ${a[1]}`); break;
    case 'chest': if (!data.loot[a[1]]) fail(w, `unknown loot ${a[1]}`); break;
    case 'rel': if (!data.npcs[a[1]] || typeof a[2] !== 'number') fail(w, `bad rel ${a[1]}`); break;
    case 'toast': line(w, a[1]); inSet(w, TOAST_STYLES, a[2], 'toast style'); break;
    case 'sfx': inSet(w, SFX, a[1], 'sfx'); break;
    case 'fx': checkFx(w, a[1], ctx.zone); break;
    case 'companions': for (const c of a[1]) inSet(w, CLASSES, c, 'class'); if (a[1].length !== 2) fail(w, 'two companions'); break;
    case 'travel': case 'teleport':
      if (!MARKERS[a[1]] || !MARKERS[a[1]].includes(a[2])) fail(w, `unknown destination ${a[1]}:${a[2]}`);
      ctx.zone = a[1];
      break;
    case 'spawn':
      if (!data.enemies[a[1]] && !data.npcs[a[1]]) fail(w, `unknown kind ${a[1]}`);
      checkTarget(w, a[2], ctx.zone);
      if (!a[3] || typeof a[3].tag !== 'string') fail(w, 'spawn needs {tag}');
      break;
    case 'setLook': if (a[1] !== 'player' && !isWho(a[1])) fail(w, 'bad who'); break;
    case 'despawn': if (typeof a[1] !== 'string') fail(w, 'despawn tagOrId'); break;
    // cutscene-only steps
    case 'wait': if (!(a[1] >= 0)) fail(w, 'bad wait'); break;
    case 'waitFor': checkCond(w, a[1]); break;
    case 'control': checkCond(w, a[1] && a[1].until); break;
    case 'say':
      if (!isWho(a[1])) fail(w, `unknown speaker ${a[1]}`);
      line(w, a[2]);
      if (a[3] && a[3].mood) inSet(w, MOODS, a[3].mood, 'mood');
      break;
    case 'bubble': if (!isWho(a[1])) fail(w, `unknown speaker ${a[1]}`); line(w, a[2]); break;
    case 'move': if (!isWho(a[1])) fail(w, `bad who ${a[1]}`); checkTarget(w, a[2], ctx.zone); break;
    case 'face': if (!isWho(a[1]) || ![0, 1, 2, 3].includes(a[2])) fail(w, 'bad face'); break;
    case 'anim': if (!isWho(a[1])) fail(w, `bad who ${a[1]}`); inSet(w, ANIMS, a[2], 'anim'); break;
    case 'camera': if (a[1].to !== undefined) checkTarget(w, a[1].to, ctx.zone); break;
    case 'parallel': for (const s of a[1]) checkAction(w, s, ctx); break;
    case 'escort': if (!isWho(a[1])) fail(w, 'bad who'); checkTarget(w, a[2].to, ctx.zone); break;
    case 'kill': if (!a[1] || typeof a[1].tag !== 'string') fail(w, 'kill needs {tag}'); break;
    case 'tutorial': if (a[1] !== null) { line(w, a[1]); if (!Array.isArray(a[2])) fail(w, 'tutorial keys'); } break;
    default:
  }
}
const actions = (where, list, ctx) => { for (const a of list || []) checkAction(where, a, ctx); };

// ---------------------------------------------------------------- tests
test('required STORY ids exist', () => {
  for (const [kind, ids] of Object.entries(REQUIRED)) {
    for (const id of ids) if (!data[kind][id]) fail(kind, `missing ${id}`);
  }
  for (const [id, name] of Object.entries(SHOP_NAMES)) if (data.shops[id].name !== name) fail('shops', `${id} name`);
  const town = Object.values(data.npcs).filter((n) => n.zone === 'town' && n.routine && n.routine.length);
  if (town.length < 12 || town.length > 15) fail('npcs', `town folk count ${town.length}`);
  const guards = Object.values(data.npcs).filter((n) => (n.tags || []).includes('guard'));
  if (guards.length !== 3 || guards.some((g) => g.onAttacked !== 'guard')) fail('npcs', 'three guards with onAttacked guard');
  const sideQuests = Object.keys(data.quests).filter((q) => q.startsWith('town_'));
  if (sideQuests.length < 2) fail('quests', 'need 2-3 town side quests');
  const cosmetics = Object.values(data.items).filter((i) => i.type === 'cosmetic');
  if (cosmetics.length < 10) fail('items', 'need 10+ cosmetics');
  const forestFolk = Object.values(data.npcs).filter((n) => n.zone === 'forest' && n.routine && n.routine.length);
  if (forestFolk.length < 3) fail('npcs', 'need 3-4 forest folk');
  for (const id of Object.keys(data.lessons)) if (!data.npcs[data.lessons[id].teacher]) fail('lessons', `${id} teacher`);
  if (!data.npcs.marigold || data.npcs.marigold.routine[1].at !== 'infirmary') fail('npcs', 'nurse in infirmary');
  flush('required ids');
});

test('looks use only section 6 vocabulary', () => {
  const L = looksNs;
  // round 2: 8 looks = 2 builds x 4 skin tones; index 0 and 1 stay the original looks (old saves store the index)
  assert.equal(L.PLAYER_LOOKS.length, 8);
  assert.deepEqual(L.PLAYER_LOOKS.slice(0, 2).map((l) => l.build), ['a', 'b']);
  assert.equal(L.PLAYER_LOOKS.filter((l) => l.build === 'a').length, 4);
  assert.equal(L.PLAYER_LOOKS.filter((l) => l.build === 'b').length, 4);
  assert.equal(new Set(L.PLAYER_LOOKS.map((l) => l.skin)).size, 8, 'every look has its own skin color');
  assert.deepEqual(L.CLASS_OUTFITS, {});
  assert.equal(L.LAPORTE_LOOK.hero, 'laporte');
  assert.ok(L.LAPORTE_LOOK.cape && L.LAPORTE_LOOK.held && L.LAPORTE_LOOK.held.style === 'staff');
  assert.equal(L.LAPORTE_LOOK.hair.style, 'm_hairline');
  assert.equal(L.LAPORTE_LOOK.outfit.style, 'quarterzip');
  assert.equal(L.LAPORTE_LOOK.hat && L.LAPORTE_LOOK.hat.style, 'wizard', 'round 2: wizard attire');
  assert.equal(L.CLOAKED.hood, true);
  assert.equal(L.CLOAKED.outfit.style, 'cloak');
  L.PLAYER_LOOKS.forEach((l, i) => checkLook(`PLAYER_LOOKS[${i}]`, l));
  checkLook('CLOAKED', L.CLOAKED, true);
  checkLook('LAPORTE_LOOK', L.LAPORTE_LOOK);
  checkLook('MALGRIM_LOOK', L.MALGRIM_LOOK);
  for (const [k, v] of Object.entries(L.NPC_LOOKS)) checkLook(`NPC_LOOKS.${k}`, v);
  for (const n of Object.values(data.npcs)) checkLook(`npc ${n.id}`, n.look);
  for (const e of Object.values(data.enemies)) {
    checkLook(`enemy ${e.id}`, e.look);
    for (const a of e.attacks) {
      if (a.look) checkLook(`enemy ${e.id}.${a.id}`, a.look);
      if (a.zone && a.zone.look) checkLook(`enemy ${e.id}.${a.id}.zone`, a.zone.look);
    }
  }
  for (const n of Object.values(data.npcs)) for (const a of n.attacks || []) if (a.look) checkLook(`npc ${n.id}.${a.id}`, a.look);
  for (const it of Object.values(data.items)) if (it.type === 'cosmetic') checkLook(`item ${it.id}`, it.look, true);
  // the cast is visually diverse
  const humans = Object.values(data.npcs).filter((n) => n.look.rig === 'humanoid').map((n) => n.look);
  assert.ok(new Set(humans.map((l) => l.skin)).size >= 12, 'skin tones');
  assert.ok(new Set(humans.map((l) => l.hair.style)).size >= 8, 'hair styles');
  assert.ok(new Set(humans.map((l) => l.outfit.style)).size >= 7, 'outfits');
  assert.ok(new Set(humans.filter((l) => l.hat).map((l) => l.hat.style)).size >= 7, 'hats');
  flush('looks');
});

test('enemies: schema, references, balance', () => {
  for (const e of Object.values(data.enemies)) {
    const w = `enemy ${e.id}`;
    for (const k of ['hp', 'power', 'defense', 'speed', 'radius', 'xp']) if (typeof e.stats[k] !== 'number') fail(w, `stats.${k}`);
    inSet(w, AI_BRAINS, e.ai.brain, 'brain');
    if (e.ai.summon && !data.enemies[e.ai.summon.kind]) fail(w, 'summon kind');
    const ids = new Set();
    for (const a of e.attacks) {
      const aw = `${w}.${a.id}`;
      if (!a.id || ids.has(a.id)) fail(aw, 'attack id missing/duplicate');
      ids.add(a.id);
      inSet(aw, ABILITY_BLOCKS, a.use, 'ability block');
      if (!TELEGRAPHS.has(a.telegraph === undefined ? null : a.telegraph)) fail(aw, 'telegraph');
      if (!(a.windup >= 0.3)) fail(aw, 'windup >= 0.3');
      if (!(a.cd > 0) || !(a.weight > 0)) fail(aw, 'cd/weight');
      if (['melee_arc', 'projectile', 'multishot', 'ground_target', 'dash', 'aoe_ring', 'beam'].includes(a.use) &&
        !(a.dmg > 0 && a.dmg <= 3)) fail(aw, `dmg coefficient ${a.dmg}`);
      if (a.use === 'summon' && !data.enemies[a.kind]) fail(aw, 'summon kind');
    }
    if (e.onDeath && e.onDeath.spawn && !data.enemies[e.onDeath.spawn]) fail(w, 'onDeath.spawn');
    if (e.onDeath && e.onDeath.do) actions(w, e.onDeath.do, { zone: 'forest' });
    for (const d of e.drops.items) if (!data.items[d.id] || !(d.p > 0 && d.p <= 1)) fail(w, `drop ${d.id}`);
    if (e.boss) {
      for (const ph of e.boss.phases) for (const p of ph.pattern) if (!ids.has(p)) fail(w, `phase pattern ${p}`);
      if (e.tags.indexOf('boss') < 0) fail(w, 'boss tag');
    }
  }
  const within = (w, what, v, target) => { if (Math.abs(v - target) / target > 0.25) fail(w, `${what} ${v} vs sheet ${target.toFixed(1)}`); };
  for (const [id, L] of Object.entries(ROSTER)) {
    const e = data.enemies[id];
    const w = `enemy ${id}`;
    if (e.level !== L) fail(w, `level ${e.level} != ${L}`);
    const elite = e.tags.includes('elite');
    const boss = !!e.boss;
    within(w, 'hp', e.stats.hp, 6 * L ** 1.4 * (boss ? 25 : elite ? 2.5 : 1));
    within(w, 'power', e.stats.power, 2 + 1.5 * L);
    within(w, 'xp', e.stats.xp, (5 + 3 * L) * (boss ? 20 : elite ? 3 : 1));
    if (!boss && e.drops.gold[1] > (2 + L) * (elite ? 2 : 1) * 1.25) fail(w, 'gold');
  }
  // distinct behavior: brain + first attack differ across the forest roster
  const sig = new Set();
  for (const id of ['slime', 'sporecap', 'thornling', 'bat', 'boar', 'goblin_scout', 'wisp', 'treant_sapling']) {
    const e = data.enemies[id];
    const s = e.ai.brain + ':' + e.attacks.map((a) => a.use).join(',');
    if (sig.has(s)) fail(id, 'behavior duplicates another forest enemy');
    sig.add(s);
  }
  const mb = data.enemies.old_mossback;
  assert.deepEqual(mb.boss.shieldAt, [0.66, 0.33]);
  assert.equal(mb.boss.phases.length, 3);
  for (const u of ['ground_target', 'summon', 'beam', 'dash']) assert.ok(mb.attacks.some((a) => a.use === u), `mossback ${u}`);
  // the tutorial reaches level 3: 7 rats + the giant rat
  const xp = 7 * data.enemies.rat.stats.xp + data.enemies.giant_rat.stats.xp;
  assert.ok(xp >= 20 + 61, `tutorial xp ${xp}`);
  flush('enemies');
});

test('items, shops, loot, lessons', () => {
  for (const it of Object.values(data.items)) {
    const w = `item ${it.id}`;
    inSet(w, ITEM_TYPES, it.type, 'type');
    inSet(w, ICONS, it.icon, 'icon');
    line(w, it.desc);
    if (it.type === 'consumable') inSet(w, ITEM_EFFECTS, it.use && it.use.effect, 'effect');
    if (it.type === 'cosmetic' && !['hat', 'cape', 'outfitColor'].includes(it.slot)) fail(w, 'slot');
    if (it.use && it.use.effect === 'summon_pet' && !data.npcs[it.use.kind]) fail(w, 'pet kind');
  }
  for (const s of Object.values(data.shops)) {
    if (!data.npcs[s.keeper] || data.npcs[s.keeper].shop !== s.id) fail(`shop ${s.id}`, 'keeper');
    for (const st of s.stock) { if (!data.items[st.item]) fail(`shop ${s.id}`, `item ${st.item}`); conds(`shop ${s.id}`, st.req); }
  }
  for (const l of Object.values(data.loot)) {
    for (const t of [l, l.runeBonus || { items: [] }]) for (const i of t.items) if (!data.items[i.id]) fail(`loot ${l.id}`, i.id);
  }
  for (const l of Object.values(data.lessons)) {
    if (!data.npcs[l.teacher] || !MARKERS.academy.includes(l.room)) fail(`lesson ${l.id}`, 'teacher/room');
    if (l.questions !== 3 || !(l.reward.xpEach > 0)) fail(`lesson ${l.id}`, 'shape');
  }
  // consumables have distinct uses
  const uses = Object.values(data.items).filter((i) => REQUIRED.items.includes(i.id)).map((i) => i.use.effect);
  assert.ok(new Set(uses).size >= 7, 'distinct hotbar effects');
  flush('items');
});

test('npcs: routines, dialogues, shops', () => {
  for (const n of Object.values(data.npcs)) {
    const w = `npc ${n.id}`;
    if (n.type && n.type !== 'npc') {
      if (n.interact) actions(w, n.interact.do, { zone: n.zone || 'intro' });
      continue;
    }
    if (!data.dialogues[n.dialogue]) fail(w, `dialogue ${n.dialogue}`);
    if (n.shop && !data.shops[n.shop]) fail(w, 'shop');
    inSet(w, ON_ATTACKED, n.onAttacked, 'onAttacked');
    conds(w, n.hideIf);
    for (const b of n.barks || []) { line(w, b); if (b.length > 60) fail(w, `bark too long: ${b}`); }
    let covered = 0;
    for (const r of n.routine) {
      const zone = r.zone || n.zone;
      if (!MARKERS[zone] || !MARKERS[zone].includes(r.at)) fail(w, `routine marker ${zone}:${r.at}`);
      inSet(w, ROUTINE_DO, r.do, 'routine do');
      if (!(r.from >= 0 && r.to <= 24 && r.from < r.to)) fail(w, `routine hours ${r.from}-${r.to}`);
      covered += r.to - r.from;
    }
    if (n.routine.length && covered !== 24) fail(w, `routine covers ${covered}h`);
    if (n.zone === 'town' && n.routine.length && !n.routine.some((r) => r.do === 'sleep')) fail(w, 'home at night');
  }
  flush('npcs');
});

test('quests: goals and rewards resolve', () => {
  for (const q of Object.values(data.quests)) {
    const w = `quest ${q.id}`;
    if (q.giver && !data.npcs[q.giver]) fail(w, 'giver');
    conds(w, q.req);
    for (const [i, s] of q.steps.entries()) {
      const sw = `${w}[${i}]`;
      line(sw, s.text);
      const g = s.goal;
      inSet(sw, GOALS, g.type, 'goal');
      if (g.type === 'reach' && (!MARKERS[g.zone] || !MARKERS[g.zone].includes(g.marker))) fail(sw, 'reach marker');
      if ((g.type === 'kill' || g.type === 'boss') && g.kind && !data.enemies[g.kind]) fail(sw, 'kind');
      if (g.type === 'kill' && !(g.n >= 1)) fail(sw, 'n');
      if (g.type === 'collect' && !data.items[g.item]) fail(sw, 'item');
      if (g.type === 'talk' && !data.npcs[g.npc]) fail(sw, 'npc');
      if (g.type === 'flag' && typeof g.key !== 'string') fail(sw, 'flag');
    }
    for (const it of q.rewards.items || []) if (!data.items[it.id]) fail(w, `reward ${it.id}`);
    if (!(q.rewards.xp >= 0) || !(q.rewards.gold >= 0)) fail(w, 'rewards');
    actions(w, q.onDone, { zone: null });
  }
  flush('quests');
});

test('dialogues: ops, gotos, termination', () => {
  const started = new Set();
  for (const [id, d] of Object.entries(data.dialogues)) {
    const w = `dialogue ${id}`;
    if (!d.nodes[d.start]) { fail(w, 'start node'); continue; }
    const ends = new Set();
    const edges = {};
    for (const [nid, n] of Object.entries(d.nodes)) {
      const nw = `${w}.${nid}`;
      edges[nid] = [];
      for (const s of n.say || []) {
        if (!isWho(s.who)) fail(nw, `speaker ${s.who}`);
        inSet(nw, MOODS, s.mood, 'mood');
        line(nw, s.text);
      }
      actions(nw, n.do, { zone: null });
      if (n.goto) { if (!d.nodes[n.goto]) fail(nw, `goto ${n.goto}`); edges[nid].push(n.goto); }
      if (n.goto && n.options) fail(nw, 'node has both goto and options');
      if (!n.goto && !(n.options && n.options.length)) ends.add(nid);
      for (const o of n.options || []) {
        line(nw, o.text);
        if (o.text.length > 80) fail(nw, `option too long: ${o.text}`);
        conds(nw, o.if);
        actions(nw, o.do, { zone: null });
        for (const a of o.do || []) if (a[0] === 'quest.start') started.add(a[1]);
        if (o.end) ends.add(nid);
        else if (!o.goto) fail(nw, `option "${o.text}" has neither goto nor end`);
        else if (!d.nodes[o.goto]) fail(nw, `goto ${o.goto}`);
        else edges[nid].push(o.goto);
      }
    }
    // every reachable node can reach an end
    const reach = new Set([d.start]);
    const stack = [d.start];
    while (stack.length) for (const t of edges[stack.pop()] || []) if (!reach.has(t)) { reach.add(t); stack.push(t); }
    const canEnd = new Set(ends);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [nid, ts] of Object.entries(edges)) if (!canEnd.has(nid) && ts.some((t) => canEnd.has(t))) { canEnd.add(nid); grew = true; }
    }
    for (const nid of reach) if (!canEnd.has(nid)) fail(w, `node ${nid} cannot terminate`);
    for (const nid of Object.keys(d.nodes)) if (!reach.has(nid)) fail(w, `node ${nid} unreachable`);
  }
  // every non-main quest can be started from some dialogue; every npc and lesson has a way in
  for (const q of Object.keys(data.quests)) if (!q.startsWith('main_') && !started.has(q)) fail('quests', `${q} never started`);
  flush('dialogues');
});

test('cutscenes follow the STORY sequence with valid steps', () => {
  for (const [id, cs] of Object.entries(data.cutscenes)) {
    const ctx = { zone: CUTSCENE_ZONE[id], cutscene: true };
    if (cs.id !== id || !Array.isArray(cs.steps) || typeof cs.skippable !== 'boolean') fail(id, 'shape');
    actions(`cutscene ${id}`, cs.steps, ctx);
    if (cs.onSkip) actions(`cutscene ${id} onSkip`, cs.onSkip, { zone: CUTSCENE_ZONE[id] });
  }
  const names = (id) => data.cutscenes[id].steps.map((s) => s[0]);
  const has = (id, pred, msg) => assert.ok(data.cutscenes[id].steps.some(pred), `${id}: ${msg}`);
  has('intro_wake', (s) => s[0] === 'tutorial' && s[2] && s[2].includes('W'), 'WASD prompt');
  has('intro_wake', (s) => s[0] === 'control' && s[1].until[0] === 'flag' && s[1].until[1] === 'has_stick', 'stick wait');
  has('intro_wake', (s) => s[0] === 'spawn' && s[1] === 'giant_rat' && s[2] === 'big_rat', 'giant rat');
  has('intro_wake', (s) => s[0] === 'flag.set' && s[1] === 'tutorial_done', 'tutorial_done');
  assert.equal(data.cutscenes.intro_wake.steps.filter((s) => s[0] === 'spawn' && s[1] === 'rat').length, 7);
  has('ambush', (s) => s[0] === 'control' && s[1].minHp === 1 && s[1].until[0] === 'hp', 'unwinnable fight');
  has('ambush', (s) => s[0] === 'spawn' && s[1] === 'ambush_barrier', 'barrier');
  assert.equal(data.cutscenes.ambush.steps.filter((s) => s[0] === 'spawn' && s[1] === 'hexguard').length, 2);
  const rescue = names('rescue');
  for (const n of ['lookPicker', 'setLook', 'escort', 'travel', 'kill', 'give']) assert.ok(rescue.includes(n), `rescue ${n}`);
  assert.ok(rescue.indexOf('give') < rescue.indexOf('lookPicker') && rescue.indexOf('lookPicker') < rescue.indexOf('escort'));
  for (const t of ['screenFlash', 'bolt', 'pillar', 'shockwave']) has('rescue', (s) => s[0] === 'fx' && s[1].type === t, t);
  has('rescue', (s) => s[0] === 'fx' && s[1].type === 'shockwave' && s[1].r === 8, 'shockwave r 8');
  has('rescue', (s) => s[0] === 'say' && s[2] === 'Remind me who you are again?', 'the line');
  has('rescue', (s) => s[0] === 'setLook' && s[2] === '$chosen', '$chosen');
  has('rescue', (s) => s[0] === 'flag.set' && s[1] === 'intro_done', 'intro_done');
  has('rescue', (s) => s[0] === 'travel' && s[1] === 'town' && s[2] === 'gate_south', 'to town');
  has('town_arrival', (s) => s[0] === 'travel' && s[1] === 'academy' && s[2] === 'entrance', 'to academy');
  const cp = names('class_pick');
  assert.ok(cp.includes('classPicker') && cp.includes('dialogue') && cp.includes('quest.start'));
  has('class_pick', (s) => s[0] === 'flag.set' && s[1] === 'forest_open', 'forest_open');
  has('spec_ceremony', (s) => s[0] === 'specPicker', 'specPicker');
  has('spec_ceremony', (s) => s[0] === 'flag.set' && s[1] === 'spec_ceremony_done', 'flag');
  has('forest_boss_intro', (s) => s[0] === 'spawn' && s[1] === 'old_mossback', 'boss spawn');
  has('forest_boss_outro', (s) => s[0] === 'flag.set' && s[1] === 'mossback_defeated', 'flag');
  // laporte never monologues: at most 3 consecutive laporte lines anywhere
  for (const [id, cs] of Object.entries(data.cutscenes)) {
    const passive = new Set(['wait', 'fx', 'sfx', 'anim', 'face', 'camera', 'cameraReset', 'letterbox']);
    let run = 0;
    for (const s of cs.steps) {
      if (s[0] === 'say') run = s[1] === 'laporte' ? run + 1 : 0;
      else if (!passive.has(s[0])) run = 0;
      if (run > 3) { fail(id, `Laporte monologue at "${s[2]}"`); run = 0; }
    }
  }
  flush('cutscenes');
});

test('every line fits (<= 110 chars)', () => {
  assert.ok(lines.length > 300, `collected ${lines.length} lines`);
  for (const [w, t] of lines) if (t.length > MAX_LINE) fail(w, `${t.length} chars: ${t}`);
  flush('lines');
});

test('integration: every marker the content needs exists in World\'s zones', () => {
  const missing = [];
  for (const [z, list] of Object.entries(STORY_MARKERS)) {
    const zm = (data.zones[z] && data.zones[z].markers) || {};
    for (const m of list) if (!zm[m]) missing.push(z + '.' + m);
  }
  assert.deepEqual(missing, []);
});
