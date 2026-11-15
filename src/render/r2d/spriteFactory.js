// Sprite cache: one bank of frames per distinct look content (so 20 rats share one bank, and a look edited in
// place is picked up through lookRev). Hit path allocates nothing: WeakMap(look) -> entry {rev, bank}, then
// bank[index] by (anim, dir, frame). Flash (white) and tint variants are cached on the sprite record.
import { makeCanvas } from './pix.js';
import { paintHumanoid, humanoidUnknown, animFrame, ANIM_FRAMES, HAX, HAY } from './humanoid.js';
import { paintCreature, creatureUnknown, creatureFrame, creatureFrames } from './creatures.js';
import { paintProjectile, paintEffectSprite, PROJECTILES, EFFECTS, SPRITE_EFFECTS, effectFrames } from './models.js';

const ANIM_IDS = { idle: 0, walk: 1, attack: 2, cast: 3, hurt: 4, ko: 5, sleep: 6, sit: 7, charge: 8, block: 9, spin: 10, dash: 11 };
const RIGS = ['humanoid', 'quadruped', 'blob', 'flyer', 'plant', 'golem', 'projectile', 'effect'];

export function createSpriteFactory(unknownSet) {
  const entries = new WeakMap();   // look object -> {rev, key, bank, rig}
  const banks = new Map();         // content key -> sprite array
  let built = 0, buildsThisFrame = 0;

  function report(look) {
    const out = [];
    const rig = look && look.rig;
    if (!RIGS.includes(rig)) out.push('rig:' + rig);
    else if (rig === 'humanoid') humanoidUnknown(look, out);
    else if (rig === 'projectile') { if (!PROJECTILES.includes(look.model)) out.push('projectile.model:' + look.model); }
    else if (rig === 'effect') { if (!EFFECTS.includes(look.model)) out.push('effect.model:' + look.model); }
    else creatureUnknown(look, out);
    for (const u of out) unknownSet.add(u);
  }

  function entryFor(look, rev) {
    let e = entries.get(look);
    if (e && e.rev === rev) return e;
    const key = JSON.stringify(look);
    let bank = banks.get(key);
    if (!bank) { bank = []; banks.set(key, bank); report(look); }
    if (!e) { e = { rev, key, bank, rig: look.rig }; entries.set(look, e); }
    else { e.rev = rev; e.key = key; e.bank = bank; e.rig = look.rig; }
    return e;
  }

  function finish(res, flip, scale) {
    const pix = flip ? res.pix.flipped() : res.pix;
    const c = pix.toCanvas();
    const ax = flip ? pix.w - res.ax : res.ax;
    const glow = res.glow ? res.glow.map((g) => [flip ? pix.w - g[0] : g[0], g[1], g[2], g[3] || 1]) : [];
    built++; buildsThisFrame++;
    const b = pix.bounds();
    return { c, w: c.width, h: c.height, ax, ay: res.ay, top: b ? b.y0 : 0, glow, scale: scale || 1, flash: null, tints: null };
  }

  /** ko / sleep: rotate the standing frame so the character lies on the ground. */
  function lying(res) {
    const b = res.pix.bounds();
    if (!b) return res;
    const crop = res.pix;
    const pw = b.x1 - b.x0 + 1, ph = b.y1 - b.y0 + 1;
    const sub = new crop.constructor(pw, ph);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) sub.d[y * pw + x] = crop.d[(y + b.y0) * crop.w + x + b.x0];
    const rot = sub.rot90(-1); // head to the left
    return { pix: rot, ax: rot.w / 2, ay: rot.h - 1, glow: [] };
  }

  /**
   * Sprite for an EntityView (or a look + anim + dir + animT). Returns a sprite record or null.
   */
  function get(look, rev, anim, dir, animT, moving) {
    if (!look) return null;
    const e = entryFor(look, rev | 0);
    const rig = e.rig;
    const aid = ANIM_IDS[anim] ?? 0;
    let frame = 0, d = dir & 3;
    if (rig === 'humanoid') {
      const a2 = ANIM_IDS[anim] !== undefined ? anim : 'idle';
      frame = animFrame(a2, animT, moving);
      if (a2 === 'spin') { d = (d + frame) & 3; frame = 0; }
      if (a2 === 'ko' || a2 === 'sleep') d = 2;
    } else if (rig === 'projectile') {
      d = 0; frame = Math.floor((animT || 0) / 0.08) & 1;
    } else if (rig === 'effect') {
      d = 0; frame = effectFrames(look.model) > 1 ? Math.floor((animT || 0) / 0.12) % effectFrames(look.model) : 0;
    } else {
      frame = creatureFrame(rig, anim, animT);
      if (anim === 'spin') { d = (d + frame) & 3; frame = 0; }
    }
    const idx = (aid * 4 + d) * 8 + (frame & 7);
    let s = e.bank[idx];
    if (s) return s;
    s = build(look, rig, anim in ANIM_IDS ? anim : 'idle', d, frame);
    e.bank[idx] = s;
    return s;
  }

  function build(look, rig, anim, d, frame) {
    if (rig === 'humanoid') {
      const view = d === 3 ? 1 : d;
      const res0 = paintHumanoid(look, view, anim === 'ko' || anim === 'sleep' ? 'idle' : anim, frame);
      let res = { pix: res0.pix, ax: HAX, ay: HAY, glow: res0.glow };
      if (anim === 'ko' || anim === 'sleep') {
        const eyes = paintHumanoid(look, 2, anim, 0);
        res = lying({ pix: eyes.pix, ax: HAX, ay: HAY });
      }
      let sc = look.size || 1;
      if (Math.abs(sc - 1) < 0.09) sc = 1;
      return finish(res, d === 3, sc);
    }
    if (rig === 'projectile') return finish(paintProjectile(look, frame), false, 1);
    if (rig === 'effect') return finish(paintEffectSprite(look, frame), false, 1);
    const view = d === 3 ? 1 : d;
    const res = paintCreature(look, view, anim, frame);
    if (anim === 'ko' || anim === 'sleep') {
      // creatures: squash flat and roll over a little
      return finish(res, d === 3, 1);
    }
    return finish(res, d === 3, 1);
  }

  /** White silhouette (hit flash). */
  function flashOf(s) {
    if (s.flash) return s.flash;
    const c = makeCanvas(s.w, s.h), g = c.getContext('2d');
    g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, s.w, s.h);
    s.flash = c;
    return c;
  }

  /** Solid-color silhouette (tint overlays, afterimages, stealth shimmer). */
  function tintOf(s, color) {
    if (!s.tints) s.tints = new Map();
    let c = s.tints.get(color);
    if (c) return c;
    c = makeCanvas(s.w, s.h);
    const g = c.getContext('2d');
    g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, s.w, s.h);
    s.tints.set(color, c);
    return c;
  }

  return {
    get, flashOf, tintOf, isSpriteEffect: (m) => !!SPRITE_EFFECTS[m],
    stats() { return { banks: banks.size, built }; },
    frameBegin() { buildsThisFrame = 0; },
    get buildsThisFrame() { return buildsThisFrame; },
    clear() { banks.clear(); },
  };
}

export { ANIM_FRAMES, creatureFrames };
