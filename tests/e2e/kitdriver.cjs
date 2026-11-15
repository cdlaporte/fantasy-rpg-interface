// Shared by matrix.cjs, showcase.cjs: the class/spec matrix and a driver that casts the basic attack and every unlocked
// ability inside the `class_demo` debug scenario (CommonJS, runs Playwright-side; stepping happens in the page).
const KITS = [
  { id: 'warrior', classId: 'warrior', specId: null }, { id: 'mage', classId: 'mage', specId: null }, { id: 'rogue', classId: 'rogue', specId: null },
  ...['knight', 'berserker', 'battlemage', 'conjurer', 'sorcerer', 'monk', 'archer', 'thief', 'ninja'].map((s) => ({ id: s, classId: null, specId: s })),
];
const SPEC_CLASS = { knight: 'warrior', berserker: 'warrior', battlemage: 'warrior', conjurer: 'mage', sorcerer: 'mage', monk: 'mage', archer: 'rogue', thief: 'rogue', ninja: 'rogue' };
const LEVELS = [3, 8, 12];
for (const k of KITS) if (!k.classId) k.classId = SPEC_CLASS[k.specId];
// frames after the cast at which the effect is most visible (60 Hz steps); default 6
const PEAK = { meteor: 50, cataclysm: 60, arrow_rain: 30, summon_familiar: 16, shadow_clones: 12, grand_conjuration: 20, runestorm: 18, aegis: 10, thousand_palms: 10, whirlwind: 10, skyfall_leap: 26, flying_kick: 10 };

/** Reset into class_demo for a kit/level (full resources, everything unlocked for the level). Returns {abilities, basic}. */
async function setup(page, kit, level) {
  return page.evaluate(({ classId, specId, level }) => {
    const r = window.__game.scenario('class_demo', { classId, specId, level });
    if (!r.ok) return { ok: false, r };
    const g = window.__game.game;
    g.kits.gain(g.player, 999);
    const h = g.hudState();
    const L = g.kits.active(g.player);
    const holds = (s) => { const ab = L && L.abilities && L.abilities[s]; return !!(ab && (ab.hold || ab.release)); };
    return { ok: true, abilities: h.abilities.filter((a) => a.unlocked && a.id).map((a) => ({ slot: a.slot, id: a.id, name: a.name, hold: holds(a.slot) })),
      basic: h.basic && h.basic.name, basicHold: !!(L && L.basicMode && L.basicMode !== 'auto') };
  }, { classId: kit.classId, specId: kit.specId, level });
}

/** Run `frames` single steps (each one renders a frame) with the given sticky input. */
function stepFrames(page, frames, input) {
  return page.evaluate(({ frames, input }) => { const G = window.__game; if (input) G.input(input); for (let i = 0; i < frames; i++) G.step(1); }, { frames, input });
}

/** Begin a cast: basic = hold attackDir 1; slot = hold that key. Resolves after `frames` steps while still held. */
async function castStart(page, what, frames) {
  if (what === 'basic') return stepFrames(page, frames, { attackDir: 1 });
  return stepFrames(page, frames, { held: { [what]: true } });
}
async function castEnd(page, what, frames = 8) {
  const rel = what === 'basic' ? { attackDir: -1 } : { held: { [what]: false } };
  await stepFrames(page, frames, rel);
  await page.evaluate(() => window.__game.input({ attackDir: -1, held: { space: false, q: false, f: false, shift: false } }));
}

/** Entity census (for sanity checks): number of non-player entities by kind. */
function census(page) {
  return page.evaluate(() => { const o = {}; for (const e of window.__game.game.ents.all) if (e.type !== 'enemy' && e.type !== 'player') o[e.kind + ':' + e.type] = (o[e.kind + ':' + e.type] || 0) + 1; return o; });
}

module.exports = { KITS, LEVELS, PEAK, setup, castStart, castEnd, stepFrames, census };
