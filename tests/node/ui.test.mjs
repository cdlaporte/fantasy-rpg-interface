// UI pure helpers: name filter, saves list, typewriter, list navigation, normalizers, portraits for every look value,
// the closed icon set, the minimap layer, overlay text helpers, and audio recipes for every sfx id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeName, finalName, listSaves, roman, frac, fmtNum, typewriterCount, stepIndex, firstIndex, keyLabel, howTo,
  wrapWords, normalizeAbilities, normalizeBasic, normalizeItems, normalizeCosmetics, mixHex, shade,
} from '../../src/ui/format.js';
import { buildPortrait, portraitKey } from '../../src/ui/portraits.js';
import { buildLaporteFace } from '../../src/ui/laportePortrait.js';
import { buildIcon, hasIcon, ICON_NAMES } from '../../src/ui/icons.js';
import { buildLayerPixels, tileColor } from '../../src/ui/minimap.js';
import { floatText, headHeight } from '../../src/ui/worldOverlay.js';
import { RECIPES, createAudio } from '../../src/platform/audio.js';
import { BACKDROP_NAMES, backdropFn } from '../../src/ui/backdrops.js';
import {
  SFX, ICONS, MOODS, HAIR_STYLES, FACIAL_STYLES, OUTFIT_STYLES, HAT_STYLES, CREATURE_RIGS, CREATURE_FEATURES,
} from '../../src/contracts.js';
import { PLAYER_LOOKS, CLOAKED, LAPORTE_LOOK } from '../../src/data/looks.js';
import { createMemoryStorage } from '../../src/platform/storage.js';
import tiles from '../../src/data/tiles.js';

const HEX = /^#[0-9a-f]{6}$/i;
function assertGrid(g, n, label) {
  assert.equal(g.length, n, label + ' rows');
  for (const r of g) {
    assert.equal(r.length, n, label + ' cols');
    for (const c of r) assert.ok(c === null || HEX.test(c), `${label}: bad color ${c}`);
  }
}

test('name filter: letters, numbers, single spaces, max 12', () => {
  assert.equal(sanitizeName('Ro$wan!!  the Great'), 'Rowan the Gr');
  assert.equal(sanitizeName('   Pip'), 'Pip');
  assert.equal(sanitizeName('Émile<script>'), 'milescript');
  assert.equal(sanitizeName('a'.repeat(20)).length, 12);
  assert.equal(finalName('Bram '), 'Bram');
  assert.equal(finalName('!!!'), '');
});

test('listSaves reads flinkerton.v1.<name> keys from storage', () => {
  const s = createMemoryStorage();
  s.setJSON('flinkerton.v1.Zed', { v: 1, name: 'Zed', zone: 'town', systems: { progression: { level: 4 } } });
  s.setJSON('flinkerton.v1.Amy', { v: 1, name: 'Amy', zone: 'forest' });
  s.set('flinkerton.v1.Broken', '{not json');
  s.set('other.key', '1');
  const list = listSaves(s);
  assert.deepEqual(list.map((x) => [x.name, x.level, x.zone]), [['Amy', null, 'forest'], ['Zed', 4, 'town']]);
  assert.equal(list[1].save.name, 'Zed');
  assert.deepEqual(listSaves(null), []);
});

test('small formatters', () => {
  assert.equal(roman(1), 'I'); assert.equal(roman(4), 'IV'); assert.equal(roman(12), '12');
  assert.equal(frac(5, 10), 0.5); assert.equal(frac(5, 0), 0); assert.equal(frac(20, 10), 1);
  assert.equal(fmtNum(1234), '1,234'); assert.equal(fmtNum(12500), '12.5k');
  assert.equal(keyLabel('KeyQ'), 'Q'); assert.equal(keyLabel('Digit3'), '3'); assert.equal(keyLabel('Space'), 'Space');
  assert.equal(keyLabel('ArrowUp'), '↑');
  assert.equal(howTo({ key: 'F', desc: 'Call down a meteor. It is big.' }), 'Press F: Call down a meteor.');
  assert.equal(howTo({ key: 'Q' }), 'Press Q to use it.');
  assert.deepEqual(wrapWords('one two three four', 9), ['one two', 'three', 'four']);
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(shade('#ffffff', 1), '#000000');
});

test('typewriter: punctuation pauses, monotonic, completes', () => {
  const text = 'Hi. Phone away, please.';
  let prev = 0;
  for (let t = 0; t < 3; t += 0.05) {
    const n = typewriterCount(text, t, 40);
    assert.ok(n >= prev);
    prev = n;
  }
  assert.equal(prev, text.length);
  assert.equal(typewriterCount(text, 0, 40), 0);
  assert.ok(typewriterCount('abc.def', 0.1, 40) <= 4);
});

test('list navigation wraps and skips disabled entries', () => {
  const dis = (i) => i === 1;
  assert.equal(stepIndex(0, 1, 3, dis), 2);
  assert.equal(stepIndex(2, 1, 3, dis), 0);
  assert.equal(stepIndex(0, -1, 3, dis), 2);
  assert.equal(stepIndex(0, 1, 3, () => true), 0);
  assert.equal(firstIndex(3, (i) => i === 0), 1);
  assert.equal(stepIndex(0, 1, 0), -1);
});

test('payload normalizers accept the shapes other packages may send', () => {
  assert.deepEqual(normalizeAbilities({ space: { name: 'Blink', icon: 'blink', unlock: 3 } })[0],
    { slot: 'space', key: 'Space', name: 'Blink', icon: 'blink', desc: '', unlock: 3 });
  assert.equal(normalizeAbilities([{ slot: 'q', name: 'Nova', unlockLevel: 5 }])[0].unlock, 5);
  assert.equal(normalizeBasic('Sword Arc').name, 'Sword Arc');
  assert.equal(normalizeBasic({ ranks: [{ name: 'Arcane Bolt' }], icon: 'bolt' }).name, 'Arcane Bolt');
  const defs = { potion_small: { name: 'Small Potion', icon: 'potion', type: 'consumable' } };
  assert.deepEqual(normalizeItems({ potion_small: 2, gone: 0 }, defs).map((i) => [i.id, i.count, i.name]), [['potion_small', 2, 'Small Potion']]);
  assert.equal(normalizeItems([{ id: 'bread', n: 3 }])[0].count, 3);
  const cos = normalizeCosmetics(['hat_a', { id: 'cape_b', name: 'Cape' }], { hat_a: { name: 'Hat A', look: { hat: {} } } }, { hat: 'hat_a' });
  assert.deepEqual(cos.map((c) => [c.id, c.name, c.slot, c.equipped]), [['hat_a', 'Hat A', 'hat', true], ['cape_b', 'Cape', '', false]]);
});

test('portraits: every humanoid look value and mood renders a valid 32x32 grid', () => {
  const base = JSON.parse(JSON.stringify(PLAYER_LOOKS[0]));
  const variants = [];
  for (const style of HAIR_STYLES) variants.push({ hair: { style, color: '#553311' } });
  for (const facial of FACIAL_STYLES) variants.push({ facial });
  for (const style of OUTFIT_STYLES) variants.push({ outfit: { style, primary: '#336699', secondary: '#eeeeee', accent: '#ffcc00' } });
  for (const style of HAT_STYLES) variants.push({ hat: { style, color: '#884422' } });
  variants.push(CLOAKED, { build: 'b' }, { ears: 'pointed' }, { cape: { color: '#aa2233' } }, { aura: { style: 'glow', color: '#ffd23f' } });
  const seen = new Set();
  for (const v of variants) {
    for (const mood of MOODS) {
      const g = buildPortrait(Object.assign({}, base, v), { mood, t: 1 });
      assertGrid(g, 32, JSON.stringify(v) + mood);
      seen.add(JSON.stringify(g));
    }
  }
  assert.ok(seen.size > variants.length * 3, 'variants look different: ' + seen.size);
  // hood shadows the face: no bright skin pixels in the face center
  const hooded = buildPortrait(Object.assign({}, base, CLOAKED), { t: 1 });
  assert.notEqual(hooded[16][13], base.skin);
  assert.deepEqual(buildPortrait(LAPORTE_LOOK, { t: 1 }), buildLaporteFace({ t: 1 }), 'hero laporte uses the bespoke portrait');
  assert.equal(buildPortrait(null).length, 32);
});

test('portraits: every creature rig and feature renders', () => {
  for (const rig of CREATURE_RIGS) {
    const g = buildPortrait({ rig, size: 1, colors: { body: '#88aa66', belly: '#eeddcc', accent: '#cc3344', eye: '#111111' }, features: CREATURE_FEATURES[rig] }, { mood: 'shocked', t: 2 });
    assertGrid(g, 32, rig);
    assertGrid(buildPortrait({ rig }, {}), 32, rig + ' bare');
  }
  assertGrid(buildPortrait({ rig: 'golem', hero: 'mossback' }), 32, 'mossback');
  assert.notEqual(portraitKey(PLAYER_LOOKS[0], 'calm', 0), portraitKey(PLAYER_LOOKS[0], 'calm', 1), 'blink changes the key');
  for (const b of BACKDROP_NAMES) assert.ok(HEX.test(backdropFn(b)(5, 5)), b);
  assert.equal(backdropFn('none')(1, 1), null);
});

test('icons: the closed set is complete, 16x16, distinct, outlined', () => {
  assert.deepEqual(ICON_NAMES, ICONS);
  const sigs = new Set();
  for (const name of ICONS) {
    assert.ok(hasIcon(name), 'icon drawn: ' + name);
    const g = buildIcon(name);
    assertGrid(g, 16, name);
    const filled = g.flat().filter(Boolean).length;
    assert.ok(filled > 40, `${name} has pixels (${filled})`);
    assert.ok(g.flat().includes('#1e1a22'), name + ' outlined');
    sigs.add(JSON.stringify(g));
  }
  assert.equal(sigs.size, ICONS.length, 'every icon is distinct');
  assert.ok(!hasIcon('nope'));
  assertGrid(buildIcon('nope'), 16, 'fallback');
});

test('minimap layer: one pixel per tile, palette overrides, solid props', () => {
  const zv = {
    id: 'z', w: 3, h: 2, tiles: new Uint8Array([0, 9, 14, 0, 0, 0]), variant: new Uint8Array(6).fill(3), tileDefs: tiles,
    props: [{ kind: 'house', def: { solid: true, footprint: [1, 1], model: 'house' }, look: { roof: '#ff0000' }, x: 2, y: 1, w: 1, h: 1 }],
    palette: { patterns: { grass: { a: '#010203' } } },
  };
  const px = buildLayerPixels(zv);
  assert.equal(px.length, 3 * 2 * 4);
  assert.deepEqual([...px.slice(0, 4)], [1, 2, 3, 255], 'palette override on grass');
  assert.deepEqual([...px.slice(20, 24)], [255, 0, 0, 255], 'building roof');
  assert.equal(tileColor(tiles[9], {}), '#3fa9e8');
  assert.notEqual(tileColor(tiles[14], {}), tiles[14].colors.a, 'blocks are darker');
});

test('overlay helpers', () => {
  assert.equal(floatText('heal', 8), '+8');
  assert.equal(floatText('xp', '25'), '+25 XP');
  assert.equal(floatText('gold', 7), '+7g');
  assert.equal(floatText('crit', 37), '37!');
  assert.equal(floatText('dmg', 12), '12');
  assert.equal(floatText('miss', 'miss'), 'miss');
  assert.ok(headHeight({ look: { rig: 'humanoid', size: 1 }, scale: 1, z: 0 }) > headHeight({ look: { rig: 'blob', size: 1 }, scale: 1, z: 0 }));
  assert.ok(headHeight({ look: null, scale: 1, z: 1 }) > 1);
});

test('audio: a recipe for every sfx id; safe under Node without WebAudio', () => {
  for (const id of SFX) assert.ok(Array.isArray(RECIPES[id]) && RECIPES[id].length, 'recipe ' + id);
  const a = createAudio();
  const offs = [];
  const bus = { on: (e, f) => { offs.push(e); return () => {}; } };
  a.attach({ bus });
  assert.ok(offs.includes('sfx') && offs.includes('levelup') && offs.includes('hit'));
  a.play('hit');
  assert.equal(typeof a.toggleMute(), 'boolean');
  a.toggleMute();
  a.dispose();
});
