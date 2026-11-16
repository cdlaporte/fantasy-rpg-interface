// Frozen shared vocabulary and shapes (docs/CONTRACTS.md). Changed only by the integrator.
// Pure module: safe under Node (no DOM, no three).

/** Fixed sim step, seconds. */
export const DT = 1 / 60;

export const DIR = Object.freeze({ UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 });
export const DIR_VEC = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]].map((v) => Object.freeze(v)));
export const DIR_NAMES = Object.freeze(['up', 'right', 'down', 'left']);

export const ANIM = Object.freeze({
  IDLE: 'idle', WALK: 'walk', ATTACK: 'attack', CAST: 'cast', HURT: 'hurt', KO: 'ko',
  SLEEP: 'sleep', SIT: 'sit', CHARGE: 'charge', BLOCK: 'block', SPIN: 'spin', DASH: 'dash',
});
export const ANIMS = Object.freeze(Object.values(ANIM));

/** View constants (section 1 / 9). */
export const VIEW = Object.freeze({
  TILE_PX: 48,          // CSS px per tile at zoom 1
  ART_PX: 16,           // art pixels per tile
  PIXEL_SCALE: 3,       // CSS px per art pixel
  PANEL_W: 280,         // left panel width, CSS px
  CULL_MARGIN: 3,       // tiles added around renderer.viewRect() when culling entities
  CAMERA_PITCH_DEG: 55, // 3D
  CAMERA_FOV_DEG: 32,   // 3D
});

export const ENT_TYPES = Object.freeze(['player', 'enemy', 'npc', 'companion', 'summon', 'projectile', 'effect', 'pickup']);
export const TEAMS = Object.freeze(['player', 'enemy', 'town', 'neutral']);
export const FREEZE_REASONS = Object.freeze(['modal', 'question', 'pause', 'transition']);

// ---- FX (section 7) ----
export const FX_TYPES = Object.freeze(['hit', 'slash', 'burst', 'ring', 'shockwave', 'beam', 'bolt', 'trail',
  'afterimage', 'pillar', 'meteor', 'sparkle', 'heal', 'levelup', 'poof', 'smoke', 'screenFlash', 'text']);
export const SLASH_STYLES = Object.freeze(['sword', 'axe', 'dagger', 'claw', 'fist', 'stick', 'crescent', 'spin']);
export const TEXT_STYLES = Object.freeze(['dmg', 'crit', 'heal', 'xp', 'gold', 'miss', 'info', 'bubble']);
export const FX_TAGS = Object.freeze(['burn', 'frost', 'stun', 'shield', 'stealth', 'mark', 'frenzy', 'charge', 'haste',
  'rune_fire', 'rune_frost', 'rune_storm', 'ki', 'shadow', 'summoned', 'wanted', 'sleep', 'levelup_ready', 'venom']);

// ---- UI vocab (section 9) ----
export const ICONS = Object.freeze(['sword', 'axe', 'shield', 'dash', 'roar', 'bolt', 'blink', 'nova', 'fire', 'frost',
  'storm', 'meteor', 'summon', 'fist', 'kick', 'orb', 'bow', 'rain', 'dagger', 'knives', 'roll', 'smoke', 'shadow',
  'shuriken', 'coin', 'potion', 'bread', 'bomb', 'tonic', 'charm', 'star', 'heart', 'book', 'hat', 'cloak', 'key',
  'rune', 'lock', 'up']);
export const ABILITY_SLOTS = Object.freeze(['space', 'q', 'f', 'shift']);
export const ABILITY_KEYS = Object.freeze({ space: 'Space', q: 'Q', f: 'F', shift: 'Shift' });
export const INPUT_KEYS = Object.freeze(['interact', 'space', 'q', 'f', 'shift',
  'item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'pause', 'map', 'boon']);
export const MODAL_TYPES = Object.freeze(['dialogue', 'shop', 'lookPicker', 'classPicker', 'specPicker', 'boonPicker',
  'question', 'pause', 'inventory', 'lesson']);
export const MOODS = Object.freeze(['calm', 'happy', 'shocked', 'annoyed', 'worried', 'proud']);
export const TOAST_STYLES = Object.freeze(['info', 'good', 'bad', 'loot', 'quest']);
export const BLIP_TYPES = Object.freeze(['enemy', 'npc', 'quest', 'exit', 'companion', 'shop', 'boss', 'chest']);
export const DAYPARTS = Object.freeze(['morning', 'day', 'evening']);
export const SFX = Object.freeze(['swing', 'hit', 'hurt', 'poof', 'pickup', 'coin', 'levelup', 'spell', 'blink', 'dash',
  'door', 'ui_move', 'ui_ok', 'ui_bad', 'boss', 'laporte']);
export const QUESTION_CONTEXTS = Object.freeze(['levelup', 'boon', 'spec', 'gate', 'chest', 'boss_shield', 'focus',
  'lesson', 'quest_turnin', 'haggle', 'revive']);
export const AI_BRAINS = Object.freeze(['wander', 'chaser', 'skirmisher', 'charger', 'turret', 'swarmer', 'summoner',
  'ambusher', 'flee', 'guard', 'boss']);
export const ABILITY_BLOCKS = Object.freeze(['melee_arc', 'projectile', 'multishot', 'beam', 'dash', 'aoe_ring',
  'ground_target', 'summon', 'buff_self', 'guard', 'heal', 'zone', 'stealth', 'chain', 'leap', 'blink']);

// ---- World vocab (section 5) ----
export const TILE_SHAPES = Object.freeze(['flat', 'block', 'water', 'pit']);
export const TILE_PATTERNS = Object.freeze(['grass', 'flowers', 'tallgrass', 'dirt', 'path', 'cobble', 'sand', 'wet_sand',
  'shallows', 'water', 'planks', 'stone', 'carpet', 'brick', 'hedge', 'trees', 'cliff', 'crystal', 'cloud', 'starfloor']);
export const PROP_MODELS = Object.freeze(['tree', 'pine', 'bush', 'rock', 'stump', 'log', 'flowerbed', 'mushroom_big',
  'crystal', 'fence', 'hedge_arch', 'lamp', 'sign', 'bench', 'well', 'fountain', 'statue', 'barrel', 'crate', 'stall',
  'cart', 'campfire', 'tent', 'house', 'shop', 'tower', 'academy', 'gate_arch', 'rune_gate', 'bridge', 'banner',
  'bookshelf', 'desk', 'table', 'chair', 'bed', 'cauldron', 'chalkboard', 'rug', 'chest',
  // round 3: biome props (docs/BIOMES.md)
  'palm', 'cactus', 'ruin_pillar', 'obelisk', 'pottery', 'dune', 'shell', 'coral', 'boat', 'tidepool', 'lighthouse', 'snowman', 'igloo', 'snow_pine', 'ice_spire', 'cloud_puff', 'floating_rock', 'star_lamp', 'orrery', 'moon_flower']);
export const BUILDING_MODELS = Object.freeze(['house', 'shop', 'tower', 'academy']);
export const SHOP_SIGNS = Object.freeze(['potion', 'hat', 'bag', 'bread', 'cup', 'book', 'sword', 'none']);

// ---- Look vocab (section 6) ----
export const RIGS = Object.freeze(['humanoid', 'quadruped', 'blob', 'flyer', 'plant', 'golem', 'projectile', 'effect']);
export const CREATURE_RIGS = Object.freeze(['quadruped', 'blob', 'flyer', 'plant', 'golem']);
export const BUILDS = Object.freeze(['a', 'b']);
export const HAIR_STYLES = Object.freeze(['short', 'long', 'bun', 'ponytail', 'curly', 'spiky', 'bald', 'braids', 'm_hairline']);
export const FACIAL_STYLES = Object.freeze(['none', 'goatee', 'beard', 'mustache']);
export const OUTFIT_STYLES = Object.freeze(['tunic', 'robe', 'cloak', 'plate', 'leather', 'gi', 'quarterzip', 'dress',
  'apron', 'uniform', 'vest']);
export const HAT_STYLES = Object.freeze(['wizard', 'cap', 'crown', 'bandana', 'helm', 'straw', 'chef', 'feather', 'horned', 'circlet']);
export const HELD_STYLES = Object.freeze(['stick', 'sword', 'sword_shield', 'axes', 'runeblade', 'staff', 'orb', 'wand',
  'fists', 'daggers', 'bow', 'shuriken', 'spear', 'book', 'broom', 'lantern']);
export const AURA_STYLES = Object.freeze(['glow', 'flame', 'sparkle', 'shadow', 'frost', 'storm']);
export const EAR_STYLES = Object.freeze(['round', 'pointed']);
export const HUMANOID_HEROES = Object.freeze(['laporte', 'malgrim']);
export const CREATURE_HEROES = Object.freeze(['mossback', 'sphinx', 'crab_king', 'yeti']);   // round 3: biome bosses
export const CREATURE_FEATURES = Object.freeze({
  quadruped: Object.freeze(['tail_thin', 'tail_bushy', 'tusks', 'ears_round', 'ears_pointy', 'spikes', 'mane',
    'claws', 'stinger', 'shell_back', 'long_ears', 'horns']),
  blob: Object.freeze(['crown', 'drips', 'core_glow', 'spots', 'tentacles', 'bubbles']),
  flyer: Object.freeze(['wings_bat', 'wings_bird', 'wings_fairy', 'orb', 'glow', 'wings_insect']),
  plant: Object.freeze(['cap_mushroom', 'thorns', 'leaves', 'flower', 'bark_face', 'vines', 'cactus', 'seaweed']),
  golem: Object.freeze(['mossy', 'rocky', 'wood', 'crystal', 'antlers', 'sandy', 'icy', 'coral', 'starry']),
});
export const PROJECTILE_MODELS = Object.freeze(['bolt', 'arrow', 'orb', 'fireball', 'shuriken', 'knife', 'wave', 'crescent',
  'rock', 'spore', 'spark', 'ice', 'kunai', 'axe', 'coin']);
export const EFFECT_MODELS = Object.freeze(['barrier', 'telegraph_circle', 'telegraph_line', 'telegraph_cone', 'ground_fire',
  'ground_frost', 'zone_ring', 'rune_seal', 'shield_bubble', 'caltrops', 'smoke', 'portal', 'meteor', 'chest', 'chest_open',
  'rune_chest', 'gold', 'heart', 'item', 'xp_orb', 'stick', 'totem', 'decoy_puff']);

// ---- Typedefs ----

/**
 * @typedef {Object} InputState
 * @property {number} moveX -1..1 (normalized with moveY)
 * @property {number} moveY -1..1
 * @property {number} attackDir -1 or DIR held
 * @property {number} attackPressed -1 or DIR pressed this step
 * @property {number} attackReleased -1 or DIR released this step
 * @property {number} attackHeldT seconds the current attack key has been held
 * @property {Object<string, boolean>} pressed INPUT_KEYS true on the step pressed
 * @property {Object<string, boolean>} held INPUT_KEYS true while down
 * @property {Object<string, boolean>} released INPUT_KEYS true on the step released
 */

/**
 * @typedef {Object} Entity  Section 4. Plain object in game.ents.
 * @property {number} id
 * @property {string} kind
 * @property {string} type
 * @property {string} team
 * @property {Object|null} def
 * @property {string} name
 * @property {number} x @property {number} y @property {number} px @property {number} py @property {number} z
 * @property {number} vx @property {number} vy @property {number} kx @property {number} ky
 * @property {number} radius @property {boolean} solid @property {boolean} pushable
 * @property {number} dir @property {number} angle
 * @property {Object} look @property {number} lookRev
 * @property {string} anim @property {number} animT @property {number} scale @property {number} alpha
 * @property {number} flash @property {string|null} tint @property {string|null} glow
 * @property {string[]} fxTags
 * @property {number} hp @property {number} hpMax @property {boolean} alive
 * @property {Object} stats @property {Object} status @property {Object} statusPower
 * @property {string[]} tags @property {Object|null} ai @property {Object|null} interact
 * @property {number|null} owner @property {number} ttl @property {number} level
 * @property {boolean} asleep @property {Object} data
 */

/**
 * @typedef {Object} EntityView  Section 7 (plus added fields name, team, radius).
 * @property {number} id @property {string} kind @property {string} type @property {Object} look @property {number} lookRev
 * @property {number} x @property {number} y @property {number} px @property {number} py @property {number} z
 * @property {number} dir @property {number} angle @property {string} anim @property {number} animT
 * @property {number} scale @property {number} alpha @property {number} flash
 * @property {string|null} tint @property {string|null} glow @property {string[]} fxTags
 * @property {number} hpFrac @property {boolean} moving
 * @property {string} name  added: display name ('' if none)
 * @property {string} team  added
 * @property {number} radius added: collision radius in tiles
 */

/**
 * @typedef {Object} FxEvent  Section 7. Unset numbers are 0; x2/y2 are null when not given;
 * strings and `ent` (an entity id) are null when not given.
 * @property {string} type
 * @property {number} x @property {number} y @property {number} z
 * @property {number|null} x2 @property {number|null} y2
 * @property {number} angle @property {number} arc @property {number} r @property {number} len @property {number} w
 * @property {string|null} color @property {string|null} color2 @property {number} n @property {number} dur
 * @property {string|null} style @property {number|null} ent @property {string|null} text
 */

/**
 * @typedef {Object} FrameState
 * @property {number} t @property {number} alpha
 * @property {{x:number, y:number, zoom:number, shake:number}} camera
 * @property {{daypart:string, tint:string, tintAmount:number}} ambience
 * @property {EntityView[]} ents  reused; only the first entCount are valid
 * @property {number} entCount
 * @property {FxEvent[]} fx  reused; only the first fxCount are valid
 * @property {number} fxCount
 */

/**
 * @typedef {Object} ZoneView
 * @property {string} id @property {number} w @property {number} h
 * @property {Uint8Array} tiles @property {Uint8Array} variant
 * @property {Object[]} tileDefs data.tiles.list
 * @property {Object[]} props [{id, kind, def, look, x, y, w, h}]
 * @property {Object} palette resolved palette {id, bg, sky, patterns: {pattern: {a, b, side}}}
 */

/**
 * @typedef {Object} HudState  Section 9. Built by makeHudState(); filled by system `hud` hooks.
 */

/**
 * @typedef {Object} Renderer
 * @property {string} id
 * @property {(hostEl: HTMLElement, opts: {quality:number}) => Promise<void>} init
 * @property {(zv: ZoneView) => void} loadZone
 * @property {() => void} unloadZone
 * @property {(tx:number, ty:number) => void} tileChanged
 * @property {(frame: FrameState) => void} render
 * @property {(wx:number, wy:number, wz:number, out:{x:number,y:number,on:boolean}) => {x:number,y:number,on:boolean}} project
 * @property {(out:{x0:number,y0:number,x1:number,y1:number}) => {x0:number,y0:number,x1:number,y1:number}} viewRect
 * @property {(w:number, h:number) => void} resize
 * @property {(q:number) => void} setQuality
 * @property {() => {ms:number, draws:number, tris:number, unknown:string[]}} stats
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} Kit  Section 8.
 * @property {string} id @property {string|null} parent
 * @property {Object|null} [resource]
 * @property {Function} [onEquip] @property {Function} [onUnequip] @property {Function} [update] @property {Function} [basic]
 * @property {Object<string, Object>} abilities
 * @property {Object<string, Function>} hooks
 * @property {Function} [hud]
 */

/**
 * @typedef {Object} System  Section 2.
 * @property {string} id
 * @property {(game:Object) => Object} init
 * @property {(game:Object, dt:number) => void} [update]
 * @property {boolean} [always]
 * @property {Function} [onZoneLoad] @property {Function} [onZoneUnload]
 * @property {Function} [save] @property {Function} [load] @property {Function} [hud]
 */

// ---- Factories (allocate once, reuse) ----

/** @returns {InputState} */
export function makeInputState() {
  const keys = () => {
    const o = {};
    for (const k of INPUT_KEYS) o[k] = false;
    return o;
  };
  return {
    moveX: 0, moveY: 0, attackDir: -1, attackPressed: -1, attackReleased: -1, attackHeldT: 0,
    attackAngle: NaN,        // round 2: radians of the held attack keys combined (8 ways), NaN when none
    pressed: keys(), held: keys(), released: keys(),
  };
}

/** Reset an InputState to neutral in place. */
export function clearInputState(s) {
  s.moveX = 0; s.moveY = 0; s.attackDir = -1; s.attackPressed = -1; s.attackReleased = -1; s.attackHeldT = 0; s.attackAngle = NaN;
  for (const k of INPUT_KEYS) { s.pressed[k] = false; s.held[k] = false; s.released[k] = false; }
  return s;
}

/** @returns {EntityView} */
export function makeEntityView() {
  return {
    id: 0, kind: '', type: '', look: null, lookRev: 0,
    x: 0, y: 0, px: 0, py: 0, z: 0, dir: DIR.DOWN, angle: Math.PI / 2,
    anim: ANIM.IDLE, animT: 0, scale: 1, alpha: 1, flash: 0, tint: null, glow: null,
    fxTags: [], hpFrac: 1, moving: false,
    name: '', team: 'neutral', radius: 0.3,
  };
}

/** @returns {FxEvent} */
export function makeFxEvent() {
  return {
    type: 'burst', x: 0, y: 0, z: 0, x2: null, y2: null, angle: 0, arc: 0, r: 0, len: 0, w: 0,
    color: null, color2: null, n: 0, dur: 0, style: null, ent: null, text: null,
  };
}

export const FX_FIELDS = Object.freeze(Object.keys(makeFxEvent()));

/** Reset an FxEvent in place and copy fields from `src` (ent objects are reduced to their id). */
export function assignFxEvent(dst, src) {
  dst.type = 'burst'; dst.x = 0; dst.y = 0; dst.z = 0; dst.x2 = null; dst.y2 = null; dst.angle = 0; dst.arc = 0;
  dst.r = 0; dst.len = 0; dst.w = 0; dst.color = null; dst.color2 = null; dst.n = 0; dst.dur = 0; dst.style = null;
  dst.ent = null; dst.text = null;
  if (!src) return dst;
  for (let i = 0; i < FX_FIELDS.length; i++) {
    const k = FX_FIELDS[i];
    const v = src[k];
    if (v !== undefined) dst[k] = v;
  }
  if (dst.ent !== null && typeof dst.ent === 'object') dst.ent = dst.ent.id;
  return dst;
}

/** @returns {FrameState} */
export function makeFrameState() {
  return {
    t: 0, alpha: 1,
    camera: { x: 0, y: 0, zoom: 1, shake: 0 },
    ambience: { daypart: 'morning', tint: '#ffffff', tintAmount: 0 },
    ents: [], entCount: 0,
    fx: [], fxCount: 0,
  };
}

/** @returns {HudState} */
export function makeHudState() {
  const abilities = ABILITY_SLOTS.map((slot) => ({
    slot, key: ABILITY_KEYS[slot], id: null, name: '', icon: 'lock', desc: '',
    unlocked: false, unlockLevel: 0, cdFrac: 0, ready: false, active: false, cost: 0,
  }));
  return {
    zoneName: '', hour: 8, daypart: 'morning',
    player: {
      name: '', level: 1, xp: 0, xpNext: 20, hp: 0, hpMax: 0, gold: 0,
      classId: null, className: '', specId: null, specName: '',
      look: null, cloaked: false, power: 0, defense: 0, speed: 0, wanted: false,
      resource: null,
    },
    basic: { name: '', rank: 1, icon: 'sword' },
    abilities,
    items: [null, null, null, null, null, null],
    quest: null,
    companions: [],
    boss: null,
    prompt: null,
    tutorial: null,
    pendingBoons: 0, pendingSpec: false,
    kitHud: null,
    minimap: { px: 0, py: 0, blips: [], blipCount: 0 },
  };
}
