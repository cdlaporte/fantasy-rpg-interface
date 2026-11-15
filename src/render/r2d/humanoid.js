// Humanoid rig: the player, NPCs, classmates, goblins, hexguards, Laporte, Malgrim.
// Painted procedurally in art pixels into a Pix (layered: cape, back hair, legs, outfit, arms, head, face, hair,
// hat, held item), auto-outlined (#1e1a22, the studyHallSim house style) and cached by the sprite cache.
// Coordinates below are offsets from the anchor (feet center): x<0 is the left half, row -1 is the shoe soles.
import { Pix } from './pix.js';
import { dark, light, mix, col, OUTLINE } from './color.js';
import { LAPORTE } from '../../data/palettes.js';

export const HW = 44, HH = 56, HAX = 22, HAY = 47;

const KNOWN = {
  hair: ['short', 'long', 'bun', 'ponytail', 'curly', 'spiky', 'bald', 'braids', 'm_hairline'],
  facial: ['none', 'goatee', 'beard', 'mustache'],
  outfit: ['tunic', 'robe', 'cloak', 'plate', 'leather', 'gi', 'quarterzip', 'dress', 'apron', 'uniform', 'vest'],
  hat: ['wizard', 'cap', 'crown', 'bandana', 'helm', 'straw', 'chef', 'feather', 'horned', 'circlet'],
  held: ['stick', 'sword', 'sword_shield', 'axes', 'runeblade', 'staff', 'orb', 'wand', 'fists', 'daggers', 'bow',
    'shuriken', 'spear', 'book', 'broom', 'lantern'],
  aura: ['glow', 'flame', 'sparkle', 'shadow', 'frost', 'storm'],
  ears: ['round', 'pointed'],
  build: ['a', 'b'],
  hero: ['laporte', 'malgrim'],
};

/** Report look values this rig cannot draw (falls back to defaults). */
export function humanoidUnknown(look, out) {
  const chk = (field, v) => { if (v != null && !KNOWN[field].includes(v)) out.push('humanoid.' + field + ':' + v); };
  chk('build', look.build);
  chk('hair', look.hair && look.hair.style);
  chk('facial', look.facial);
  chk('outfit', look.outfit && look.outfit.style);
  chk('hat', look.hat && look.hat.style);
  chk('held', look.held && look.held.style);
  chk('aura', look.aura && look.aura.style);
  chk('ears', look.ears);
  chk('hero', look.hero);
}

/** Resolve hero overrides (Laporte, Malgrim) into a full look. */
export function resolveHero(look) {
  if (look.hero === 'laporte') {
    return Object.assign({}, look, {
      hair: { style: 'm_hairline', color: LAPORTE.hair[0] },
      facial: 'stubble',
      outfit: { style: 'quarterzip', primary: LAPORTE.quarterZipNavy[0], secondary: LAPORTE.quarterZipGray[0], accent: LAPORTE.collar },
      cape: look.cape || { color: '#4b2f7d', trim: '#ffd24a' },
      held: look.held || { style: 'staff', color: '#8a5a33', glow: '#9fe6ff' },
      skin: LAPORTE.skin[0],
      _pants: LAPORTE.pants, _shoes: '#2a2a33',
    });
  }
  if (look.hero === 'malgrim') {
    const o = look.outfit || {};
    return Object.assign({}, look, {
      hair: { style: 'slick', color: (look.hair && look.hair.color) || '#2a1a3a' },
      facial: 'villain',
      outfit: { style: 'robe', primary: col(o.primary, '#4a2e6a'), secondary: col(o.secondary, '#2a1a3a'), accent: col(o.accent, '#c9a6ff') },
      hat: look.hat || { style: 'wizard', color: col(o.primary, '#4a2e6a'), crooked: true },
      cape: look.cape || { color: '#2a1a3a', trim: '#d4a83a', lining: '#b0203a' },
      held: look.held || { style: 'staff', color: '#3a2a4a', glow: col(o.accent, '#c9a6ff'), orbTop: true },
      _collar: true,
    });
  }
  return look;
}

// ------------------------------------------------------------------ poses

/**
 * Pose for (anim, frame). dir: 0 up, 1 right, 2 down (left is a mirrored right).
 * by: body bob; legs: stand|walkA|walkB|sit|crouch|lunge; arm: rest|swingF|swingB|raise|cast|forward|out|block
 * wf: weapon frame for attacks.
 */
export const ANIM_FRAMES = { idle: 2, walk: 4, attack: 3, cast: 2, hurt: 1, ko: 1, sleep: 1, sit: 1, charge: 2, block: 1, spin: 4, dash: 1 };

export function animFrame(anim, animT, moving) {
  const t = animT || 0;
  switch (anim) {
    case 'idle': return Math.floor(t / 0.6) % 2;
    case 'walk': return Math.floor(t / 0.13) % 4;
    case 'attack': return Math.min(2, Math.floor(t / 0.07));
    case 'cast': return Math.floor(t / 0.16) % 2;
    case 'charge': return Math.floor(t / 0.07) % 2;
    case 'spin': return Math.floor(t / 0.06) % 4;
    default: return 0;
  }
}

function poseFor(anim, f) {
  const P = { by: 0, legs: 'stand', arm: 'rest', eyes: 'open', lean: 0, wf: -1, shake: 0, mouth: false };
  switch (anim) {
    case 'idle': P.by = f === 1 ? 1 : 0; P.breath = f; break;
    case 'walk': P.legs = f === 1 ? 'walkA' : f === 3 ? 'walkB' : 'stand'; P.by = (f === 1 || f === 3) ? 1 : 0; P.arm = f === 1 ? 'swingF' : f === 3 ? 'swingB' : 'rest'; break;
    case 'attack': P.arm = 'attack'; P.wf = f; P.legs = f >= 1 ? 'lunge' : 'stand'; P.lean = f >= 1 ? 1 : 0; P.mouth = f === 1; break;
    case 'cast': P.arm = 'cast'; P.by = f; P.mouth = true; break;
    case 'hurt': P.arm = 'out'; P.eyes = 'hurt'; P.lean = -1; P.by = 1; P.mouth = true; break;
    case 'sit': P.legs = 'sit'; P.by = 3; break;
    case 'charge': P.arm = 'charge'; P.legs = 'crouch'; P.by = 2; P.shake = f ? 1 : 0; P.eyes = 'focus'; break;
    case 'block': P.arm = 'block'; P.legs = 'crouch'; P.by = 1; P.eyes = 'focus'; break;
    case 'spin': P.arm = 'spin'; P.legs = 'crouch'; P.by = 1; break;
    case 'dash': P.legs = 'lunge'; P.arm = 'swingB'; P.lean = 2; P.by = 1; P.eyes = 'focus'; break;
    case 'ko': P.eyes = 'ko'; break;
    case 'sleep': P.eyes = 'closed'; break;
    default: break;
  }
  return P;
}

// ------------------------------------------------------------------ palette

function palette(L) {
  const skin = col(L.skin, '#c68e62');
  const hair = col(L.hair && L.hair.color, '#3a2618');
  const o = L.outfit || {};
  const p = col(o.primary, '#4a90d9'), s = col(o.secondary, '#f4e3c4'), a = col(o.accent, '#ffd24a');
  const style = KNOWN.outfit.includes(o.style) ? o.style : 'tunic';
  let pants = mix(p, '#2e2838', 0.55), shoes = '#5a3a2a';
  if (style === 'plate') { pants = dark(p, 0.25); shoes = dark(p, 0.45); }
  if (style === 'gi') pants = p;
  if (style === 'leather') pants = dark(s, 0.35);
  if (style === 'vest') pants = mix(p, '#2e2838', 0.4);
  if (style === 'quarterzip' || style === 'uniform') pants = '#3b3b58';
  if (L._pants) pants = L._pants;
  if (L._shoes) shoes = L._shoes;
  return {
    skin, skinLo: dark(skin, 0.22), skinHi: light(skin, 0.22), skinDk: dark(skin, 0.4), blush: mix(skin, '#ff6f86', 0.3),
    hair, hairLo: dark(hair, 0.3), hairHi: light(hair, 0.28),
    p, pLo: dark(p, 0.28), pHi: light(p, 0.22), pDk: dark(p, 0.5),
    s, sLo: dark(s, 0.25), sHi: light(s, 0.25),
    a, aLo: dark(a, 0.3), aHi: light(a, 0.35),
    pants, pantsLo: dark(pants, 0.3), shoes, shoesHi: light(shoes, 0.2),
    eye: '#2a2030', white: '#ffffff', style,
  };
}

// ------------------------------------------------------------------ painter

/**
 * Paint one humanoid frame. Returns {pix, glow: [[x, y, colorHex]]} in sprite px (unflipped for right).
 * dirView: 0 up, 1 right, 2 down.
 */
export function paintHumanoid(look0, dirView, anim, frame) {
  const L = resolveHero(look0);
  const C = palette(L);
  const pose = poseFor(anim, frame);
  const p = new Pix(HW, HH);
  const glow = [];
  const AX = HAX + pose.shake * (frame ? 1 : -1), AY = HAY;
  const buildA = L.build !== 'b';
  const dir = dirView;
  const by = pose.by;
  const leanX = dir === 1 ? pose.lean : 0;
  const leanY = dir === 2 ? Math.max(0, pose.lean) : dir === 0 ? -Math.max(0, pose.lean) : 0;
  const bx = leanX;
  const hx = leanX + (dir === 1 && pose.lean > 1 ? 1 : 0);
  const hairStyle = L.hood ? 'hood' : (L.hair && (KNOWN.hair.includes(L.hair.style) || L.hair.style === 'slick') ? L.hair.style : 'short');
  const held = L.held && KNOWN.held.includes(L.held.style) ? L.held : (L.held ? { style: 'stick', color: L.held.color } : null);
  const hat = L.hood ? null : (L.hat && KNOWN.hat.includes(L.hat.style) ? L.hat : null);
  const capeCol = L.cape ? col(L.cape.color, '#c8503c') : null;
  const robeLong = C.style === 'robe' || C.style === 'dress' || C.style === 'cloak';

  // offset painters
  const S = (x, y, c, ox = 0, oy = 0) => p.set(AX + x + ox, AY + y + oy, c);
  const R = (x0, y0, x1, y1, c, ox = 0, oy = 0) => p.rect(AX + Math.min(x0, x1) + ox, AY + Math.min(y0, y1) + oy, Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1, c);
  const RI = (x0, y0, x1, y1, c, ox = 0, oy = 0) => p.rectIn(AX + Math.min(x0, x1) + ox, AY + Math.min(y0, y1) + oy, Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1, c);

  // torso extents
  const tw0 = buildA ? -5 : -4, tw1 = buildA ? 4 : 3;
  const armL0 = buildA ? -7 : -6, armR0 = buildA ? 5 : 4;

  // ---------- held item geometry ----------
  // hand position (offset coords) and weapon direction (8-way unit-ish vector) for the weapon hand
  let hand = null, wdir = [0, -1], heldBehind = false, offHand = null;
  const H = held ? held.style : null;
  const longW = H === 'staff' || H === 'spear' || H === 'broom';
  if (dir === 2) {
    hand = [armL0 - (longW ? 1 : 0), -7 + by]; wdir = longW ? [0, -1] : [-1, -1];
    offHand = [armR0 + 1, -7 + by];
  } else if (dir === 0) {
    hand = [armR0 + 1 + (longW ? 1 : 0), -7 + by]; wdir = longW ? [0, -1] : [1, -1]; heldBehind = true;
    offHand = [armL0, -7 + by];
  } else {
    hand = [1 + bx, -8 + by]; wdir = longW ? [0, -1] : [1, -1];
    offHand = [-3 + bx, -8 + by];
  }
  // pose-driven arm/hand overrides
  const arm = pose.arm;
  if (arm === 'swingF' && dir !== 1) hand = [hand[0], hand[1] - 1];
  if (arm === 'attack') {
    const f = pose.wf;
    if (dir === 1) {
      hand = [[-1, -14], [4, -12], [5, -9]][f]; wdir = [[-1, -1], [1, -1], [1, 0]][f];
      if (longW) wdir = [[0, -1], [1, -1], [1, 0]][f];
    } else if (dir === 2) {
      hand = [[armL0, -14], [-3, -9], [0, -6]][f]; wdir = [[-1, -1], [-1, 1], [0, 1]][f];
    } else {
      hand = [[armR0 + 1, -11], [3, -16], [-2, -16]][f]; wdir = [[1, -1], [0, -1], [-1, -1]][f]; heldBehind = true;
    }
  } else if (arm === 'cast') {
    if (dir === 1) { hand = [5 + bx, -17 + by]; wdir = [1, -1]; }
    else if (dir === 2) { hand = [armL0 - 1, -17 + by]; wdir = [0, -1]; }
    else { hand = [armR0 + 2, -17 + by]; wdir = [0, -1]; }
  } else if (arm === 'charge') {
    if (dir === 1) { hand = [-4 + bx, -9 + by]; wdir = [-1, -1]; }
    else if (dir === 2) { hand = [armL0 - 1, -10 + by]; wdir = [-1, -1]; }
    else { hand = [armR0 + 2, -10 + by]; wdir = [1, -1]; }
  } else if (arm === 'block') {
    if (dir === 1) { hand = [4 + bx, -10 + by]; wdir = [1, -1]; }
    else if (dir === 2) { hand = [-2, -9 + by]; wdir = [-1, -1]; }
    else { hand = [2, -11 + by]; wdir = [1, -1]; }
  } else if (arm === 'spin' || arm === 'out') {
    if (dir === 1) { hand = [5 + bx, -10 + by]; wdir = [1, 0]; }
    else if (dir === 2) { hand = [armL0 - 2, -10 + by]; wdir = [-1, 0]; }
    else { hand = [armR0 + 3, -10 + by]; wdir = [1, 0]; }
    if (arm === 'out' && !held) hand = null;
  }

  // ---------- layer: cape (behind, for down/right) ----------
  const flutter = (anim === 'walk' || anim === 'dash') ? (frame % 2) : 0;
  const capeTrim = L.cape && L.cape.trim ? L.cape.trim : null;
  if (capeCol && dir !== 0) {
    const cLo = dark(capeCol, 0.3), cIn = L.cape.lining ? L.cape.lining : dark(capeCol, 0.45);
    if (dir === 2) {
      // visible as two flared panels behind the arms, plus the collar over the shoulders
      const l0 = armL0, r0 = armR0 + 1, fl = flutter;
      p.poly([AX + l0, AY - 13 + by, AX + l0 + 2, AY - 13 + by, AX + l0 + 1, AY - 2 + by, AX + l0 - 3 - fl, AY - 2 + by], capeCol);
      p.poly([AX + r0 - 1, AY - 13 + by, AX + r0 + 1, AY - 13 + by, AX + r0 + 4 + fl, AY - 2 + by, AX + r0, AY - 2 + by], cLo);
      R(l0 - 2 - fl, -4 + by, l0, -3 + by, cIn); R(r0 + 1, -4 + by, r0 + 3 + fl, -3 + by, cIn);
      if (capeTrim) { R(l0 - 3 - fl, -2 + by, l0 + 1, -2 + by, capeTrim); R(r0, -2 + by, r0 + 4 + fl, -2 + by, capeTrim); }
    } else {
      const back = anim === 'dash' ? -10 : anim === 'walk' ? -8 - flutter : -7;
      p.poly([AX - 3 + bx, AY - 13 + by, AX + 0 + bx, AY - 13 + by, AX - 2 + bx, AY - 2 + by, AX + back + bx, AY - 3 + by - flutter], capeCol);
      p.poly([AX + back + 1 + bx, AY - 4 + by - flutter, AX - 2 + bx, AY - 3 + by, AX - 3 + bx, AY - 6 + by], cLo);
      if (capeTrim) p.line(AX + back + bx, AY - 3 + by - flutter, AX - 2 + bx, AY - 2 + by, capeTrim);
    }
  }
  // Malgrim's theatrical high collar (behind the head)
  if (L._collar && dir !== 0) {
    const cc = col(L.cape && L.cape.lining, '#b0203a'), cd = L.outfit.secondary;
    if (dir === 2) {
      p.poly([AX - 9, AY - 25 + by, AX - 4, AY - 13 + by, AX + 3, AY - 13 + by, AX + 8, AY - 25 + by, AX + 3, AY - 20 + by, AX - 4, AY - 20 + by], cd);
      p.poly([AX - 7, AY - 22 + by, AX - 4, AY - 14 + by, AX + 3, AY - 14 + by, AX + 6, AY - 22 + by, AX + 3, AY - 18 + by, AX - 4, AY - 18 + by], cc);
    } else {
      p.poly([AX - 9 + bx, AY - 26 + by, AX - 2 + bx, AY - 13 + by, AX - 1 + bx, AY - 18 + by], cd);
      p.poly([AX - 7 + bx, AY - 23 + by, AX - 2 + bx, AY - 14 + by, AX - 2 + bx, AY - 18 + by], cc);
    }
  }

  // ---------- layer: back hair (long styles behind body) ----------
  if (!L.hood) backHair(hairStyle, dir, hx, by + leanY);

  // ---------- held item behind the body ----------
  if (held && heldBehind) drawHeld(true);
  if (held && H === 'sword_shield' && dir === 1 && arm !== 'block') drawShield(-5 + bx, -11 + by, true);

  // far arm (side view)
  if (dir === 1) armSide(-3 + bx, by, true);

  // ---------- legs ----------
  legs();

  // ---------- torso / outfit ----------
  torso();

  // ---------- arms ----------
  if (dir !== 1) { armFront(true); armFront(false); }
  if (capeCol && dir === 2 && !L._collar) {
    R(tw0, -13 + by, tw0 + 1, -12 + by, capeCol); R(tw1 - 1, -13 + by, tw1, -12 + by, dark(capeCol, 0.2));
    S(tw0 + 1, -11 + by, capeTrim || '#ffd24a'); S(tw1 - 1, -11 + by, capeTrim || '#ffd24a');
  }

  // ---------- head ----------
  head();

  // ---------- cape over the back (up view) ----------
  if (capeCol && dir === 0) {
    const cLo = dark(capeCol, 0.3), cHi = light(capeCol, 0.15);
    const fl = flutter;
    R(armL0, -13 + by, armR0 + 1, -3 + by, capeCol);
    R(armL0 - 1, -6 + by, armR0 + 2, -2 + by - fl, capeCol);
    R(armL0, -13 + by, armL0, -3 + by, cHi);
    R(-2, -10 + by, -2, -3 + by, cLo); R(2, -9 + by, 2, -3 + by, cLo);
    R(armR0 + 1, -12 + by, armR0 + 2, -2 + by - fl, cLo);
    if (capeTrim) R(armL0 - 1, -2 + by - fl, armR0 + 2, -2 + by - fl, capeTrim);
    R(-4, -14 + by, 3, -13 + by, cHi);
  }
  // hair that falls over the cape (up view)
  if (dir === 0 && !L.hood) hairOverBack(hairStyle, by);

  // ---------- hat ----------
  if (hat) drawHat(hat, dir, hx, by + leanY);

  // ---------- near arm (side) + held in front ----------
  if (dir === 1) armSide(1 + bx, by, false);
  if (held && !heldBehind) drawHeld(false);
  if (held && H === 'sword_shield' && (dir === 2 || arm === 'block')) {
    if (dir === 2) drawShield(arm === 'block' ? -2 : armR0 - 1, -11 + by, false);
    else if (dir === 1) drawShield(4 + bx, -12 + by, false);
    else drawShield(-3, -12 + by, true);
  }
  if (held && H === 'sword_shield' && dir === 0 && arm !== 'block') drawShield(armL0 - 2, -12 + by, true);

  p.outline(OUTLINE);
  return { pix: p, glow };

  // ================================================================ parts

  function legs() {
    const L0 = buildA ? -4 : -3, L1 = buildA ? -2 : -2, R0 = 1, R1 = buildA ? 3 : 2;
    const pc = C.pants, pl = C.pantsLo, sh = C.shoes;
    const lg = pose.legs;
    if (lg === 'sit') {
      if (dir === 1) {
        R(-2, -6, 4, -4, pc); R(-2, -4, 4, -4, pl); R(3, -3, 5, -1, pc); R(3, -2, 6, -1, sh);
      } else {
        R(L0, -6, R1, -3, pc); R(L0, -3, R1, -3, pl);
        if (dir === 2) { R(L0, -2, L1, -1, sh); R(R0, -2, R1, -1, sh); }
      }
      return;
    }
    if (dir === 1) {
      // side view: near and far leg
      const stride = lg === 'walkA' || lg === 'walkB' || lg === 'lunge';
      if (stride) {
        const far = lg === 'walkB' ? 1 : -1;
        // far leg (darker)
        R(-1 + far * 2, -5, 0 + far * 2, -2, pl); R(-1 + far * 3, -2, 1 + far * 3, -1, dark(sh, 0.2));
        // near leg
        R(-1 - far * 2, -5, 1 - far * 2, -2, pc); R(-1 - far * 2, -2, 2 - far * 2, -1, sh); S(2 - far * 2, -2, C.shoesHi);
      } else if (lg === 'crouch') {
        R(-3, -5, -1, -2, pl); R(-3, -2, -1, -1, dark(sh, 0.2));
        R(0, -5, 2, -2, pc); R(0, -2, 3, -1, sh);
      } else {
        R(-2, -5, 0, -2, pl); R(-2, -2, 0, -1, dark(sh, 0.2));
        R(-1, -5, 1, -2, pc); R(-1, -2, 2, -1, sh); S(2, -2, C.shoesHi);
      }
      return;
    }
    // front/back view
    let la = 0, ra = 0; // lift (shorter leg)
    if (lg === 'walkA') { la = 1; } else if (lg === 'walkB') { ra = 1; }
    let spread = lg === 'crouch' || lg === 'lunge' ? 1 : 0;
    R(L0 - spread, -5, L1 - spread, -2 - la, pc); R(L1 - spread, -5, L1 - spread, -2 - la, pl);
    R(R0 + spread, -5, R1 + spread, -2 - ra, pc); R(R1 + spread, -5, R1 + spread, -2 - ra, pl);
    R(L0 - spread, -2 - la, L1 - spread, -1 - la, sh); R(R0 + spread, -2 - ra, R1 + spread, -1 - ra, sh);
    if (dir === 2) { S(L0 - spread, -2 - la, C.shoesHi); S(R0 + spread, -2 - ra, C.shoesHi); }
  }

  function torso() {
    const y0 = -13 + by, y1 = -6 + by;
    const st = C.style;
    if (dir === 1) {
      // side: 8 wide, a bit of depth
      const x0 = -4 + bx, x1 = 3 + bx;
      sideTorso(st, x0, x1, y0, y1);
      return;
    }
    const x0 = tw0, x1 = tw1;
    // base block with rounded shoulders
    const main = st === 'vest' ? C.s : C.p;
    R(x0, y0 + 1, x1, y1, main); R(x0 + 1, y0, x1 - 1, y0, main);
    // shading: left highlight column, right/bottom shadow
    const lo = st === 'vest' ? C.sLo : C.pLo, hi = st === 'vest' ? C.sHi : C.pHi;
    R(x1, y0 + 1, x1, y1, lo); R(x0, y1, x1, y1, lo);
    R(x0, y0 + 1, x0, y1 - 1, hi);
    const back = dir === 0;
    switch (st) {
      case 'tunic': {
        if (!back) { R(-1, y0, 0, y0 + 2, C.s); S(-1, y0 + 3, C.s); S(0, y0 + 3, C.sLo); }
        else R(x0 + 1, y0, x1 - 1, y0, C.pHi);
        R(x0, y1 - 1, x1, y1 - 1, C.a); if (!back) { S(-1, y1 - 1, C.aHi); S(0, y1 - 1, C.aLo); }
        R(x0 - 1, y1, x1 + 1, y1 + 1, C.p); R(x0 - 1, y1 + 1, x1 + 1, y1 + 1, C.pLo);
        break;
      }
      case 'robe': case 'cloak': case 'dress': {
        const hemY = st === 'dress' ? -3 : -2;
        const flare = st === 'dress' ? 2 : 1;
        const mc = st === 'dress' ? C.p : C.p;
        p.poly([AX + x0, AY + y1 - 2, AX + x1 + 1, AY + y1 - 2, AX + x1 + 1 + flare, AY + hemY + 1, AX + x0 - flare, AY + hemY + 1], mc);
        R(x0 - flare, hemY, x1 + flare, hemY, C.pLo);
        R(x1 + 1, y1 - 1, x1 + flare, hemY, C.pLo);
        if (st === 'robe') {
          if (!back) { R(-1, y0, 0, hemY, C.s); R(0, y0, 0, hemY, C.sLo); R(-1, y0, 0, y0 + 1, C.a); }
          R(x0 - flare, hemY, x1 + flare, hemY, C.a);
          R(x0, y1 - 2, x1, y1 - 2, C.aLo);
        } else if (st === 'cloak') {
          if (!back) { R(-1, y0 + 2, 0, hemY, C.pDk); S(-1, y0 + 1, C.a); S(0, y0 + 1, C.aHi); }
          else { R(-2, y0 + 3, -2, hemY - 1, C.pLo); R(2, y0 + 2, 2, hemY - 1, C.pLo); R(-4, y0 + 1, -4, y0 + 6, C.pHi); }
          R(x0 - 1, y0 + 1, x0 - 1, hemY, C.p); R(x1 + 1, y0 + 1, x1 + 1, hemY, C.pLo);
          R(x0 - 1, y0 + 1, x0 - 1, y0 + 5, C.pHi);
        } else {
          if (!back) { R(-1, y0, 0, y0 + 1, C.s); }
          R(x0, y1 - 2, x1, y1 - 2, C.a); R(x0 - flare, hemY, x1 + flare, hemY, C.s);
          R(x0 - flare + 1, hemY - 2, x0 - flare + 1, hemY - 1, C.pHi);
        }
        break;
      }
      case 'plate': {
        const m = C.p, mh = light(m, 0.45), ml = C.pLo;
        if (!back) { R(-1, y0 + 1, 0, y1 - 2, mh); R(0, y0 + 1, 0, y1 - 2, m); S(-3, y0 + 3, mh); S(2, y0 + 3, mh); }
        R(x0, y1 - 2, x1, y1 - 2, C.s); S(-1, y1 - 2, C.a); S(0, y1 - 2, C.a);
        R(x0, y1 - 1, x1, y1, ml); R(x0 + 1, y1 - 1, x0 + 2, y1, m); R(x1 - 2, y1 - 1, x1 - 1, y1, m);
        // pauldrons
        p.shaded(AX + x0 - 0.5, AY + y0 + 2, 2.6, 2.2, m, ml, mh);
        p.shaded(AX + x1 + 1.5, AY + y0 + 2, 2.6, 2.2, m, ml, mh);
        break;
      }
      case 'leather': {
        if (!back) {
          for (let i = 0; i < 8; i++) { S(x0 + i + 1, y0 + i, C.a); }
          S(x0 + 3, y0 + 2, C.aHi); S(-1, y0, C.s); S(0, y0, C.s);
          S(x1 - 1, y0 + 2, C.aHi); S(x0 + 1, y0 + 5, C.aHi);
        } else for (let i = 0; i < 8; i++) S(x1 - 1 - i, y0 + i, C.a);
        R(x0, y1 - 1, x1, y1 - 1, C.sLo); S(-1, y1 - 1, C.aHi);
        R(x0, y1, x1, y1 + 1, C.p); R(x0, y1 + 1, x1, y1 + 1, C.pLo);
        break;
      }
      case 'gi': {
        if (!back) {
          for (let i = 0; i < 4; i++) { S(-2 + i, y0 + i, C.pLo); }
          S(-1, y0, C.skin); S(0, y0, C.skin); S(-1, y0 + 1, C.skin); S(0, y0 + 1, C.skinLo); S(0, y0 + 2, C.skinLo);
          S(1, y0 + 1, C.pLo); S(2, y0, C.pLo);
        }
        R(x0, y1 - 1, x1, y1 - 1, C.a); R(x0, y1, x1, y1, C.pLo);
        if (!back) { R(2, y1, 2, y1 + 3, C.a); R(3, y1, 3, y1 + 2, C.aLo); }
        break;
      }
      case 'quarterzip': {
        // navy and gray stripes, gray collar, undershirt peeking, zipper (studyHallSim)
        const nav = C.p, gr = C.s;
        R(x0, y0 + 1, x1, y1, nav); R(x0 + 1, y0, x1 - 1, y0, back ? C.a : nav);
        R(x0, y0 + 4, x1, y0 + 5, gr); R(x0, y0 + 5, x1, y0 + 5, dark(gr, 0.2));
        R(x1, y0 + 1, x1, y1, dark(nav, 0.3)); R(x0, y1, x1, y1, dark(nav, 0.3));
        R(x0, y0 + 1, x0, y0 + 3, light(nav, 0.15));
        if (!back) {
          R(-3, y0, -2, y0 + 1, C.a); R(1, y0, 2, y0 + 1, C.a);
          R(-1, y0, 0, y0, '#ecf0f1');
          R(-1, y0 + 1, -1, y1, '#d0d4d6'); R(0, y0 + 1, 0, y1, dark(nav, 0.15));
          S(-1, y0 + 2, '#ffffff');
        } else { R(x0 + 1, y0, x1 - 1, y0, C.a); }
        break;
      }
      case 'apron': {
        if (!back) {
          R(-3, y0 + 3, 2, y1 + 2, C.s); R(2, y0 + 3, 2, y1 + 2, C.sLo); R(-3, y1 + 2, 2, y1 + 2, C.sLo);
          S(-3, y0, C.s); S(-3, y0 + 1, C.s); S(-3, y0 + 2, C.s); S(2, y0, C.s); S(2, y0 + 1, C.s); S(2, y0 + 2, C.s);
          R(-1, y0 + 6, 0, y0 + 7, C.a);
          R(-1, y0, 0, y0, C.pHi);
        } else { R(x0, y0 + 5, x1, y0 + 5, C.s); S(-1, y0 + 6, C.s); S(0, y0 + 6, C.s); S(-1, y0 + 7, C.sLo); }
        break;
      }
      case 'uniform': {
        if (!back) {
          R(-2, y0, 1, y0 + 4, C.s); S(-2, y0 + 3, C.p); S(1, y0 + 3, C.p); S(-2, y0 + 4, C.p); S(1, y0 + 4, C.p);
          R(-1, y0 + 1, 0, y0 + 5, C.a); S(-1, y0 + 6, C.aLo); S(0, y0 + 6, C.aLo); S(0, y0 + 1, C.aHi);
          S(-3, y0 + 1, C.pHi); S(2, y0 + 1, C.pLo);
          S(1, y0 + 6, C.aHi); S(1, y1 - 1, C.aHi);
          R(x0 + 1, y0 + 4, x0 + 2, y0 + 4, C.pLo);
        }
        R(x0, y1, x1, y1, C.pDk);
        break;
      }
      case 'vest': {
        // shirt (secondary) is the base; vest panels in primary
        R(x0, y0 + 1, -1, y1, C.p); R(0, y0 + 1, x1, y1, C.p);
        if (!back) { R(-1, y0, 0, y1, C.s); R(0, y0, 0, y1, C.sLo); S(-2, y0 + 3, C.a); S(-2, y0 + 6, C.a); }
        else { R(x0, y0, x1, y0, C.p); }
        R(x0, y0 + 1, x0, y1, C.pHi); R(x1, y0 + 1, x1, y1, C.pLo); R(x0, y1, x1, y1, C.pLo);
        break;
      }
      default: break;
    }
  }

  function sideTorso(st, x0, x1, y0, y1) {
    const main = st === 'vest' ? C.s : C.p;
    R(x0, y0 + 1, x1, y1, main); R(x0 + 1, y0, x1 - 1, y0, main);
    R(x0, y0 + 1, x0, y1, st === 'vest' ? C.sLo : C.pLo); R(x0, y1, x1, y1, st === 'vest' ? C.sLo : C.pLo);
    R(x1, y0 + 1, x1, y1 - 1, st === 'vest' ? C.sHi : C.pHi);
    switch (st) {
      case 'tunic':
        R(x1 - 1, y0, x1, y0 + 2, C.s); R(x0, y1 - 1, x1, y1 - 1, C.a); S(x1, y1 - 1, C.aHi);
        R(x0 - 1, y1, x1 + 1, y1 + 1, C.p); R(x0 - 1, y1 + 1, x1 + 1, y1 + 1, C.pLo);
        break;
      case 'robe': case 'cloak': case 'dress': {
        const hemY = st === 'dress' ? -3 : -2, fl = st === 'dress' ? 2 : 1;
        const tail = anim === 'walk' && frame % 2 ? 1 : 0;
        p.poly([AX + x0, AY + y1 - 2, AX + x1 + 1, AY + y1 - 2, AX + x1 + 1 + fl, AY + hemY + 1, AX + x0 - fl - tail, AY + hemY + 1], C.p);
        R(x0 - fl - tail, hemY, x1 + fl, hemY, st === 'dress' ? C.s : st === 'robe' ? C.a : C.pLo);
        R(x0 - fl, hemY - 4, x0, hemY - 1, C.pLo);
        if (st === 'robe') { R(x1, y0, x1, hemY - 1, C.s); R(x0, y1 - 2, x1, y1 - 2, C.aLo); }
        if (st === 'cloak') { R(x1 - 1, y0 + 1, x1 - 1, hemY - 1, C.pDk); S(x1, y0 + 1, C.a); R(x0 - 1, y0 + 1, x0 - 1, hemY - 1, C.pLo); }
        if (st === 'dress') R(x0, y1 - 2, x1, y1 - 2, C.a);
        break;
      }
      case 'plate': {
        R(x1 - 1, y0 + 1, x1 - 1, y1 - 2, light(C.p, 0.45)); R(x0, y1 - 2, x1, y1 - 2, C.s);
        p.shaded(AX + x0 + 3.5, AY + y0 + 2, 2.6, 2.2, C.p, C.pLo, light(C.p, 0.45));
        break;
      }
      case 'leather':
        for (let i = 0; i < 7; i++) S(x0 + (i >> 1) + 1, y0 + i, C.a);
        R(x0, y1, x1, y1 + 1, C.p); R(x0, y1 + 1, x1, y1 + 1, C.pLo); R(x0, y1 - 1, x1, y1 - 1, C.sLo);
        break;
      case 'gi':
        S(x1, y0, C.skin); S(x1, y0 + 1, C.skinLo); S(x1 - 1, y0 + 2, C.pLo); S(x1 - 2, y0 + 3, C.pLo);
        R(x0, y1 - 1, x1, y1 - 1, C.a); R(x0 - 1, y1 - 1, x0 - 1, y1 + 2, C.a);
        break;
      case 'quarterzip':
        R(x0, y0 + 4, x1, y0 + 5, C.s); R(x0, y0 + 5, x1, y0 + 5, dark(C.s, 0.2));
        R(x1 - 2, y0, x1, y0 + 1, C.a); S(x1, y0 + 2, '#d0d4d6'); R(x0, y0, x0 + 2, y0, C.a);
        break;
      case 'apron':
        R(x1 - 1, y0 + 3, x1 + 1, y1 + 2, C.s); R(x1 + 1, y0 + 3, x1 + 1, y1 + 2, C.sLo); S(x1 - 1, y0, C.s); S(x1 - 1, y0 + 1, C.s);
        R(x0, y0 + 5, x1, y0 + 5, C.s);
        break;
      case 'uniform':
        R(x1 - 1, y0, x1, y0 + 3, C.s); R(x1, y0 + 1, x1, y0 + 5, C.a); R(x0, y1, x1, y1, C.pDk);
        break;
      case 'vest':
        R(x0, y0 + 1, x1 - 2, y1, C.p); R(x0, y0 + 1, x0, y1, C.pLo); S(x1 - 2, y0 + 3, C.a);
        break;
      default: break;
    }
  }

  function sleeveCol() {
    const st = C.style;
    if (st === 'vest' || st === 'gi' && false) return [C.s, C.sLo];
    if (st === 'apron') return [C.p, C.pLo];
    return [C.p, C.pLo];
  }

  /** Front/back view arms. left = viewer's left. */
  function armFront(left) {
    const st = C.style;
    if (st === 'cloak') {
      // arms tucked under the cloak; hands peek out only when used
      const isW = (dir === 2) === left;
      if (isW && hand && (held || arm === 'cast' || arm === 'attack' || arm === 'block' || arm === 'charge')) drawHandAt(hand[0], hand[1]);
      return;
    }
    const [sc, sl] = sleeveCol();
    const x = left ? armL0 : armR0;
    const isWeapon = (dir === 2) === left; // weapon hand: viewer-left when facing down, viewer-right when up
    const y0 = -12 + by;
    let hy = -7 + by;
    if (arm === 'swingF') hy += left ? -1 : 1;
    if (arm === 'swingB') hy += left ? 1 : -1;
    const posed = isWeapon && hand && (arm === 'attack' || arm === 'cast' || arm === 'charge' || arm === 'block' || arm === 'spin' || arm === 'out');
    const posedOff = !isWeapon && (arm === 'cast' || arm === 'spin' || arm === 'out' || arm === 'block');
    if (posed) {
      // upper arm stub then a line to the hand
      R(x, y0, x + 1, y0 + 2, sc);
      p.thick(AX + x + (left ? 0 : 1), AY + y0 + 1, AX + hand[0], AY + hand[1] - 1, 2, sc);
      drawHandAt(hand[0], hand[1]);
      return;
    }
    if (posedOff) {
      const ox = left ? x - 2 : x + 3, oy = arm === 'cast' ? -15 + by : -10 + by;
      R(x, y0, x + 1, y0 + 2, sc);
      p.thick(AX + x + (left ? 0 : 1), AY + y0 + 1, AX + ox, AY + oy, 2, sc);
      drawHandAt(ox, oy + 1);
      return;
    }
    R(x, y0, x + 1, hy - 1, sc);
    R(left ? x + 1 : x, y0 + 1, left ? x + 1 : x, hy - 1, dark(sc, 0.4));
    S(left ? x : x + 1, y0, light(sc, 0.25));
    if (st === 'robe') { R(x - (left ? 1 : 0), hy - 2, x + 1 + (left ? 0 : 1), hy - 2, C.a); R(x - (left ? 1 : 0), hy - 1, x + 1 + (left ? 0 : 1), hy - 1, C.pLo); }
    if (st === 'plate') R(x, hy - 2, x + 1, hy - 1, C.pHi);
    if (st === 'quarterzip') R(x, y0 + 4, x + 1, y0 + 5, C.s);
    drawHandAt(x + 0.5, hy + 1, true);
  }

  function armSide(x, oy, far) {
    if (C.style === 'cloak' && far) return;
    const [sc] = sleeveCol();
    const c = far ? dark(sc, 0.3) : sc;
    const y0 = -12 + oy;
    if (!far && hand && (arm === 'attack' || arm === 'cast' || arm === 'charge' || arm === 'block' || arm === 'spin' || arm === 'out')) {
      if (C.style !== 'cloak') R(x - 1, y0, x + 1, y0 + 2, c);
      p.thick(AX + x, AY + y0 + 1, AX + hand[0], AY + hand[1] - 1, 2, c);
      p.line(AX + x, AY + y0 + 2, AX + hand[0], AY + hand[1], dark(sc, 0.45));
      drawHandAt(hand[0], hand[1]);
      return;
    }
    if (C.style === 'cloak') { if (!far && held) drawHandAt(hand[0], hand[1]); return; }
    let sw = 0;
    if (arm === 'swingF') sw = far ? -2 : 2;
    if (arm === 'swingB') sw = far ? 2 : -2;
    if (pose.legs === 'sit') sw = far ? 0 : 2;
    const hx2 = x + sw, hy2 = -7 + oy - (Math.abs(sw) > 1 ? 1 : 0);
    p.thick(AX + x, AY + y0, AX + hx2, AY + hy2 - 1, 2, c);
    if (!far) p.line(AX + x - 1, AY + y0 + 1, AX + hx2 - 1, AY + hy2 - 1, dark(sc, 0.45));
    if (!far) { S(x, y0, light(sc, 0.2)); if (C.style === 'quarterzip') { S(x, y0 + 3, C.s); S(x + 1, y0 + 3, C.s); } }
    if (!far && C.style === 'robe') R(hx2 - 1, hy2 - 2, hx2 + 1, hy2 - 2, C.a);
    drawHandAt(hx2, hy2, true, far);
    if (!far) { hand = hand || [hx2, hy2]; if (arm === 'rest' || arm === 'swingF' || arm === 'swingB') hand = [hx2 + 0.5, hy2 + 0.5]; }
  }

  function drawHandAt(x, y, small, far) {
    const hx0 = Math.round(x - 0.5), hy0 = Math.round(y - 1);
    if (H === 'fists' && !far) {
      const fc = col(held.color, '#d0d4dc');
      R(hx0 - 1, hy0 - 1, hx0 + 1, hy0 + 1, fc); S(hx0 - 1, hy0 - 1, light(fc, 0.4)); R(hx0 + 1, hy0, hx0 + 1, hy0 + 1, dark(fc, 0.3));
      return;
    }
    const sk = far ? C.skinLo : C.skin;
    R(hx0, hy0, hx0 + 1, hy0 + 1, sk); S(hx0 + 1, hy0 + 1, C.skinLo);
  }

  function headMask(ox, oy, c, inset = 0) {
    const rows = [[-24, -4, 3], [-23, -5, 4], [-22, -6, 5], [-21, -6, 5], [-20, -6, 5], [-19, -6, 5], [-18, -6, 5], [-17, -6, 5], [-16, -6, 5], [-15, -5, 4], [-14, -4, 3]];
    for (const [y, a, b] of rows) R(a + inset, y, b - inset, y, c, ox, oy);
  }

  function head() {
    const ox = hx, oy = by + leanY + (pose.breath ? 0 : 0);
    if (L.hood) { hood(ox, oy); return; }
    // skin base
    headMask(ox, oy, C.skin);
    if (dir === 2) {
      R(5, -21, 5, -16, C.skinLo, ox, oy); R(-4, -14, 3, -14, C.skinLo, ox, oy); S(4, -15, C.skinLo, ox, oy);
      ears(ox, oy);
      face(ox, oy);
    } else if (dir === 1) {
      R(-6, -21, -3, -15, C.skinLo, ox, oy); R(-4, -14, 3, -14, C.skinLo, ox, oy);
      S(6, -18, C.skin, ox, oy); S(6, -17, C.skinLo, ox, oy);
      ears(ox, oy);
      face(ox, oy);
    } else {
      ears(ox, oy);
    }
    hair(ox, oy);
    if (L.facial && L.facial !== 'none') facial(ox, oy);
  }

  function ears(ox, oy) {
    const pointed = L.ears === 'pointed';
    if (dir === 2 || dir === 0) {
      if (pointed) {
        S(-7, -18, C.skin, ox, oy); S(-7, -19, C.skin, ox, oy); S(-8, -20, C.skin, ox, oy); S(-7, -17, C.skinLo, ox, oy);
        S(6, -18, C.skin, ox, oy); S(6, -19, C.skin, ox, oy); S(7, -20, C.skin, ox, oy); S(6, -17, C.skinLo, ox, oy);
      } else {
        S(-7, -18, C.skin, ox, oy); S(-7, -17, C.skinLo, ox, oy);
        S(6, -18, C.skin, ox, oy); S(6, -17, C.skinLo, ox, oy);
      }
    } else {
      R(-2, -18, -1, -17, C.skinLo, ox, oy); S(-2, -18, C.skin, ox, oy);
      if (pointed) { S(-3, -19, C.skin, ox, oy); S(-4, -20, C.skin, ox, oy); S(-3, -20, C.skinLo, ox, oy); }
    }
  }

  function face(ox, oy) {
    const e = pose.eyes;
    const ex = dir === 2 ? [-3, 2] : [3];
    for (const x of ex) {
      if (e === 'open' || e === 'focus') {
        if (e === 'focus') { S(x, -17, C.eye, ox, oy); S(x + (dir === 1 ? 0 : (x < 0 ? -1 : 1)), -18, C.hairLo, ox, oy); }
        else { S(x, -18, C.eye, ox, oy); S(x, -17, C.eye, ox, oy); S(x, -18, mix(C.eye, '#ffffff', 0.35), ox, oy); S(x, -17, C.eye, ox, oy); }
        if (e === 'open') S(x, -18, '#4a4060', ox, oy);
      } else if (e === 'closed') {
        S(x, -17, C.eye, ox, oy); S(x - 1, -17, C.skinDk, ox, oy);
      } else if (e === 'hurt') {
        S(x, -18, C.eye, ox, oy); S(x + (x < 0 || dir === 1 ? 1 : -1), -17, C.eye, ox, oy); S(x, -16, C.eye, ox, oy);
      } else if (e === 'ko') {
        S(x - 1, -19, C.eye, ox, oy); S(x + 1, -19, C.eye, ox, oy); S(x, -18, C.eye, ox, oy); S(x - 1, -17, C.eye, ox, oy); S(x + 1, -17, C.eye, ox, oy);
      }
    }
    if (dir === 2) {
      S(-4, -16, C.blush, ox, oy); S(3, -16, C.blush, ox, oy);
      if (pose.mouth) { S(-1, -15, C.skinDk, ox, oy); S(0, -15, C.skinDk, ox, oy); S(-1, -14, dark(C.skinDk, 0.2), ox, oy); }
      else { S(-1, -15, C.skinLo, ox, oy); S(0, -15, C.skinLo, ox, oy); }
    } else if (dir === 1) {
      S(4, -16, C.blush, ox, oy);
      S(4, -15, pose.mouth ? C.skinDk : C.skinLo, ox, oy);
    }
  }

  function facial(ox, oy) {
    const f = L.facial;
    const hc = f === 'stubble' ? LAPORTE.stubble[0] : C.hair, hl = f === 'stubble' ? LAPORTE.stubble[1] : C.hairHi;
    if (dir === 0) return;
    if (dir === 2) {
      if (f === 'goatee' || f === 'stubble') {
        R(-2, -15, 1, -14, hc, ox, oy); S(-2, -15, hl, ox, oy); S(1, -14, hl, ox, oy);
        if (f === 'stubble') { S(-3, -15, hl, ox, oy); S(2, -15, hl, ox, oy); S(-1, -16, hl, ox, oy); S(0, -16, hl, ox, oy); S(-1, -15, C.skinDk, ox, oy); S(0, -15, C.skinDk, ox, oy); }
        else S(-1, -13, hc, ox, oy), S(0, -13, hc, ox, oy);
      } else if (f === 'mustache') {
        R(-3, -16, 2, -16, hc, ox, oy); S(-3, -15, hc, ox, oy); S(2, -15, hc, ox, oy); S(-1, -16, C.hairHi, ox, oy);
      } else if (f === 'beard') {
        R(-6, -18, -5, -14, hc, ox, oy); R(4, -18, 5, -14, hc, ox, oy); R(-5, -15, 4, -13, hc, ox, oy); R(-3, -12, 2, -12, hc, ox, oy);
        R(-2, -16, 1, -16, hc, ox, oy); S(-1, -15, C.skinDk, ox, oy); S(0, -15, C.skinDk, ox, oy);
        S(-4, -14, C.hairHi, ox, oy); S(-1, -13, C.hairHi, ox, oy); R(4, -14, 4, -13, C.hairLo, ox, oy);
      } else if (f === 'villain') {
        // curled theatrical mustache + pointed goatee
        R(-3, -16, 2, -16, hc, ox, oy); S(-4, -17, hc, ox, oy); S(3, -17, hc, ox, oy); S(-5, -18, hc, ox, oy); S(4, -18, hc, ox, oy);
        R(-1, -14, 0, -12, hc, ox, oy); S(-1, -11, hc, ox, oy);
        S(-3, -19, C.hair, ox, oy); S(-2, -19, C.hair, ox, oy); S(2, -19, C.hair, ox, oy); S(1, -19, C.hair, ox, oy);
      }
    } else {
      if (f === 'goatee' || f === 'stubble') {
        R(3, -15, 5, -14, hc, ox, oy); S(5, -15, hl, ox, oy);
        if (f === 'stubble') { S(1, -15, hl, ox, oy); S(2, -14, hl, ox, oy); S(5, -16, hl, ox, oy); S(4, -15, C.skinDk, ox, oy); }
      } else if (f === 'mustache') {
        R(3, -16, 6, -16, hc, ox, oy); S(6, -15, hc, ox, oy);
      } else if (f === 'beard') {
        R(-1, -18, 0, -14, hc, ox, oy); R(0, -15, 5, -13, hc, ox, oy); R(2, -12, 4, -12, hc, ox, oy); S(5, -16, hc, ox, oy); S(4, -15, C.skinDk, ox, oy);
      } else if (f === 'villain') {
        R(3, -16, 6, -16, hc, ox, oy); S(7, -17, hc, ox, oy); S(4, -14, hc, ox, oy); R(4, -13, 4, -11, hc, ox, oy); S(2, -19, C.hair, ox, oy); S(3, -19, C.hair, ox, oy);
      }
    }
  }

  function hood(ox, oy) {
    const hc = C.p, hl = C.pLo, hh = C.pHi, shadowFace = mix(C.skin, '#1e1a22', 0.62);
    if (dir === 2) {
      headMask(ox, oy, hc); R(-7, -21, 6, -14, hc, ox, oy); R(-6, -25, 5, -24, hc, ox, oy); R(-4, -26, 3, -26, hc, ox, oy);
      R(-4, -21, 3, -15, shadowFace, ox, oy); R(-5, -19, 4, -16, shadowFace, ox, oy);
      R(-3, -21, 2, -21, dark(shadowFace, 0.3), ox, oy);
      S(-3, -18, '#ffe9a8', ox, oy); S(2, -18, '#ffe9a8', ox, oy);
      R(-7, -21, -7, -15, hh, ox, oy); R(6, -21, 6, -14, hl, ox, oy); R(-5, -25, -3, -25, hh, ox, oy);
      R(-6, -14, 5, -14, hl, ox, oy);
    } else if (dir === 1) {
      headMask(ox, oy, hc); R(-7, -22, 5, -14, hc, ox, oy); R(-6, -25, 3, -24, hc, ox, oy); R(-8, -23, -7, -19, hc, ox, oy);
      R(1, -21, 5, -15, shadowFace, ox, oy); R(2, -21, 5, -21, dark(shadowFace, 0.3), ox, oy);
      S(3, -18, '#ffe9a8', ox, oy);
      R(-7, -22, -7, -15, hl, ox, oy); R(-4, -25, 1, -25, hh, ox, oy); R(0, -21, 0, -15, hl, ox, oy);
    } else {
      headMask(ox, oy, hc); R(-7, -21, 6, -14, hc, ox, oy); R(-6, -25, 5, -24, hc, ox, oy); R(-3, -26, 2, -26, hc, ox, oy);
      R(-1, -22, 0, -15, hl, ox, oy); R(6, -21, 6, -14, hl, ox, oy); R(-6, -24, -3, -23, hh, ox, oy);
      R(-6, -13, 5, -11, hc, ox, oy); R(-6, -11, 5, -11, hl, ox, oy);
    }
  }

  function backHair(st, d, ox, oy) {
    const c = C.hair, lo = C.hairLo;
    if (st === 'long' && d !== 0) {
      if (d === 2) { R(-7, -20, -5, -9, lo, ox, oy); R(4, -20, 6, -9, lo, ox, oy); }
      else { R(-7, -20, -3, -9, c, ox, oy); R(-7, -12, -3, -9, lo, ox, oy); S(-7, -8, lo, ox, oy); }
    }
    if (st === 'ponytail' && d === 2) { R(5, -22, 7, -16, lo, ox, oy); }
    if (st === 'ponytail' && d === 1) {
      const sw = anim === 'walk' && frame % 2 ? 1 : 0;
      R(-9 - sw, -22, -7, -20, c, ox, oy); R(-10 - sw, -20, -8 - sw, -15, c, ox, oy); R(-10 - sw, -16, -9 - sw, -14, lo, ox, oy);
      S(-7, -21, C.a, ox, oy);
    }
    if (st === 'braids' && d === 1) { for (let i = 0; i < 8; i++) R(-5, -17 + i, -4, -17 + i, i % 2 ? lo : c, ox, oy); S(-5, -9, C.a, ox, oy); }
    if (st === 'curly' && d !== 0) { p.ellipse(AX + ox - 0.5 + (d === 1 ? -2 : 0), AY + oy - 16, 8, 5, lo); }
  }

  function hair(ox, oy) {
    const st = hairStyle, c = C.hair, lo = C.hairLo, hi = C.hairHi;
    if (st === 'bald') {
      if (dir === 2) { S(-3, -23, C.skinHi, ox, oy); S(-2, -23, C.skinHi, ox, oy); S(-4, -22, C.skinHi, ox, oy); R(-6, -19, -6, -16, c, ox, oy); R(5, -19, 5, -16, c, ox, oy); }
      else if (dir === 1) { S(0, -23, C.skinHi, ox, oy); S(1, -23, C.skinHi, ox, oy); R(-6, -19, -3, -16, c, ox, oy); }
      else { R(-6, -18, 5, -16, c, ox, oy); S(-2, -23, C.skinHi, ox, oy); S(-1, -23, C.skinHi, ox, oy); R(-6, -17, 5, -16, lo, ox, oy); }
      return;
    }
    // base cap (shared): top of the head
    const cap = () => {
      R(-4, -25, 3, -25, c, ox, oy); R(-5, -24, 4, -24, c, ox, oy); R(-6, -23, 5, -21, c, ox, oy);
      R(-3, -25, 1, -25, hi, ox, oy); R(-4, -24, -2, -24, hi, ox, oy); S(-5, -23, hi, ox, oy);
      R(5, -23, 5, -21, lo, ox, oy);
    };
    if (dir === 0) {
      // back of the head: all hair
      cap(); R(-6, -20, 5, -15, c, ox, oy); R(-5, -14, 4, -14, c, ox, oy);
      R(-6, -16, 5, -15, lo, ox, oy); R(5, -21, 5, -15, lo, ox, oy); R(-6, -21, -6, -17, hi, ox, oy);
      R(-4, -14, 3, -14, C.skinLo, ox, oy);
      if (st === 'm_hairline' || st === 'short' || st === 'slick') { R(-5, -14, 4, -14, c, ox, oy); R(-3, -13, 2, -13, C.skinLo, ox, oy); }
      if (st === 'spiky') spikes(ox, oy, 0);
      if (st === 'bun') { p.shaded(AX + ox - 0.5, AY + oy - 25.5, 3, 2.5, c, lo, hi); }
      if (st === 'curly') curls(ox, oy);
      return;
    }
    if (dir === 2) {
      cap();
      if (st === 'm_hairline') {
        // receding temples, central peak (Laporte)
        R(-6, -20, -5, -19, c, ox, oy); R(4, -20, 5, -19, c, ox, oy); R(-6, -18, -6, -17, c, ox, oy); R(5, -18, 5, -17, lo, ox, oy);
        R(-4, -21, -3, -21, C.skin, ox, oy); R(2, -21, 3, -21, C.skin, ox, oy); S(-4, -22, C.skinHi, ox, oy); S(3, -22, C.skinHi, ox, oy);
        R(-1, -21, 0, -20, c, ox, oy); S(-1, -20, lo, ox, oy);
        return;
      }
      if (st === 'slick') {
        R(-6, -20, -5, -17, c, ox, oy); R(4, -20, 5, -17, c, ox, oy); R(-2, -21, 1, -21, c, ox, oy); S(-1, -20, c, ox, oy); S(0, -20, lo, ox, oy);
        R(-4, -24, 3, -24, hi, ox, oy);
        return;
      }
      // bangs
      R(-6, -20, 5, -20, c, ox, oy);
      for (let x = -5; x <= 4; x++) if ((x + 6) % 3 !== 0) S(x, -19, c, ox, oy);
      R(-6, -19, -6, -16, c, ox, oy); R(5, -19, 5, -16, lo, ox, oy);
      S(-4, -20, hi, ox, oy); S(-1, -20, hi, ox, oy);
      if (st === 'long') { R(-7, -21, -6, -12, c, ox, oy); R(5, -21, 6, -12, lo, ox, oy); S(-7, -11, c, ox, oy); S(6, -11, lo, ox, oy); R(-7, -20, -7, -14, hi, ox, oy); }
      if (st === 'ponytail') { S(5, -23, C.a, ox, oy); }
      if (st === 'bun') { p.shaded(AX + ox - 0.5, AY + oy - 26.5, 3, 2.5, c, lo, hi); }
      if (st === 'spiky') spikes(ox, oy, 2);
      if (st === 'curly') curls(ox, oy);
      if (st === 'braids') {
        for (let i = 0; i < 8; i++) { const cc = i % 2 ? lo : c; S(-7, -17 + i, cc, ox, oy); S(-6, -17 + i, cc, ox, oy); S(5, -17 + i, cc, ox, oy); S(6, -17 + i, cc, ox, oy); }
        S(-7, -9, C.a, ox, oy); S(-6, -9, C.a, ox, oy); S(5, -9, C.a, ox, oy); S(6, -9, C.a, ox, oy);
      }
      return;
    }
    // side (right)
    cap();
    R(-6, -21, -2, -16, c, ox, oy); R(-5, -15, -3, -15, c, ox, oy); R(-6, -17, -3, -16, lo, ox, oy);
    S(-2, -18, C.skinLo, ox, oy); // ear peeks
    R(-2, -18, -1, -17, C.skinLo, ox, oy); S(-2, -18, C.skin, ox, oy);
    if (L.ears === 'pointed') { S(-2, -19, C.skin, ox, oy); S(-3, -20, C.skin, ox, oy); }
    if (st === 'm_hairline') {
      R(-1, -21, 2, -21, c, ox, oy); R(3, -21, 4, -21, C.skin, ox, oy); S(3, -22, C.skinHi, ox, oy);
      R(-6, -21, -1, -20, c, ox, oy);
      return;
    }
    if (st === 'slick') { R(-1, -21, 5, -21, c, ox, oy); R(0, -24, 4, -24, hi, ox, oy); return; }
    R(-1, -21, 5, -20, c, ox, oy); S(5, -19, c, ox, oy); S(3, -19, c, ox, oy); S(1, -20, hi, ox, oy);
    if (st === 'long') { R(-7, -21, -3, -12, c, ox, oy); R(-7, -14, -4, -12, lo, ox, oy); }
    if (st === 'bun') { p.shaded(AX + ox - 4.5, AY + oy - 25, 3, 2.5, c, lo, hi); }
    if (st === 'spiky') spikes(ox, oy, 1);
    if (st === 'curly') curls(ox, oy);
    if (st === 'braids') { for (let i = 0; i < 6; i++) S(-4, -15 + i, i % 2 ? lo : c, ox, oy); }
  }

  function spikes(ox, oy, d) {
    const c = C.hair, hi = C.hairHi, lo = C.hairLo;
    const xs = d === 1 ? [-5, -2, 1, 4] : [-5, -2, 1, 4];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] + (d === 1 ? -1 : 0);
      p.poly([AX + ox + x - 1, AY + oy - 23, AX + ox + x + 2, AY + oy - 23, AX + ox + x + (d === 1 ? -1 : 0) + 0.5, AY + oy - 28 + (i % 2)], c);
      S(x, -25 + (i % 2), hi, ox, oy);
    }
    if (d === 2) { S(-5, -19, lo, ox, oy); S(4, -19, lo, ox, oy); S(-2, -18, c, ox, oy); S(1, -18, c, ox, oy); }
  }

  function curls(ox, oy) {
    const c = C.hair, hi = C.hairHi, lo = C.hairLo;
    const pts = dir === 1 ? [[-6, -24], [-2, -26], [2, -25], [-7, -20], [-6, -16]] : [[-6, -24], [-2, -26], [2, -26], [5, -24], [-7, -20], [6, -20], [-7, -16], [6, -16]];
    for (const [x, y] of pts) { p.shaded(AX + ox + x + 0.5, AY + oy + y + 0.5, 2.6, 2.4, c, lo, hi); }
    if (dir === 2) { S(-3, -20, c, ox, oy); S(2, -20, c, ox, oy); S(-1, -20, c, ox, oy); S(0, -19, c, ox, oy); }
  }

  function hairOverBack(st, oy) {
    const c = C.hair, lo = C.hairLo;
    if (st === 'long') { R(-6, -15, 5, -10, c, 0, oy); R(-6, -11, 5, -10, lo, 0, oy); R(-5, -9, 4, -9, lo, 0, oy); R(-1, -15, -1, -10, lo, 0, oy); }
    if (st === 'ponytail') { R(-1, -16, 0, -9, c, 0, oy); S(0, -10, lo, 0, oy); S(-1, -9, lo, 0, oy); R(-1, -16, 0, -16, C.a, 0, oy); }
    if (st === 'braids') { for (let i = 0; i < 7; i++) { S(-4, -15 + i, i % 2 ? lo : c, 0, oy); S(3, -15 + i, i % 2 ? lo : c, 0, oy); } S(-4, -8, C.a, 0, oy); S(3, -8, C.a, 0, oy); }
  }

  // ---------- hats ----------
  function drawHat(h, d, ox, oy) {
    const c = col(h.color, '#c8503c'), lo = dark(c, 0.3), hi = light(c, 0.28), gold = '#ffd24a', goldLo = '#c8901e';
    const side = d === 1;
    switch (h.style) {
      case 'wizard': {
        const bend = side ? -4 : (h.crooked ? 4 : 3);
        p.ellipse(AX + ox - 0.5 + (side ? 0 : 0), AY + oy - 21.5, side ? 8 : 9, 2, lo);
        p.ellipse(AX + ox - 0.5, AY + oy - 22, side ? 7.5 : 8.5, 1.5, c);
        p.poly([AX + ox - 6, AY + oy - 22, AX + ox + 5, AY + oy - 22, AX + ox + 1, AY + oy - 31, AX + ox - 1, AY + oy - 31], c);
        p.poly([AX + ox - 1, AY + oy - 31, AX + ox + 1, AY + oy - 31, AX + ox + bend, AY + oy - 35], c);
        R(-4, -29, -3, -23, hi, ox, oy); R(3, -26, 4, -23, lo, ox, oy);
        R(-5, -24, 4, -23, h.crooked ? '#d4a83a' : gold, ox, oy); R(-5, -23, 4, -23, goldLo, ox, oy);
        if (d !== 0) { S(-1, -27, gold, ox, oy); S(0, -28, '#fff4b0', ox, oy); S(1, -27, gold, ox, oy); S(0, -26, gold, ox, oy); }
        break;
      }
      case 'cap': {
        R(-5, -26, 4, -22, c, ox, oy); R(-6, -24, 5, -21, c, ox, oy); R(-3, -26, 0, -25, hi, ox, oy); R(5, -24, 5, -21, lo, ox, oy);
        if (d === 2) { R(-5, -21, 4, -20, lo, ox, oy); R(-4, -20, 3, -20, dark(c, 0.45), ox, oy); }
        if (d === 1) { R(3, -22, 8, -21, lo, ox, oy); }
        if (d === 0) { R(-2, -22, 1, -21, lo, ox, oy); S(-1, -23, '#ffffff', ox, oy); }
        S(-1, -27, lo, ox, oy); S(0, -27, lo, ox, oy);
        break;
      }
      case 'crown': {
        const cc = col(h.color, gold);
        const g = (cc === '#c8503c') ? gold : cc;
        R(-5, -24, 4, -22, g, ox, oy); R(-5, -22, 4, -22, dark(g, 0.3), ox, oy);
        for (const x of [-5, -1, 3]) { R(x, -26, x + 1, -25, g, ox, oy); S(x, -27, light(g, 0.4), ox, oy); }
        S(-3, -23, '#e83a5a', ox, oy); S(1, -23, '#3a7ae8', ox, oy); S(-1, -23, '#ffffff', ox, oy);
        break;
      }
      case 'bandana': {
        R(-6, -23, 5, -21, c, ox, oy); R(-6, -21, 5, -21, lo, ox, oy); R(-4, -23, 1, -23, hi, ox, oy);
        for (let x = -5; x <= 4; x += 3) S(x, -22, light(c, 0.55), ox, oy);
        if (d === 0) { R(-1, -21, 0, -18, c, ox, oy); S(-2, -17, lo, ox, oy); S(1, -17, lo, ox, oy); }
        if (d === 1) { R(-8, -22, -6, -21, c, ox, oy); S(-9, -20, lo, ox, oy); S(-8, -19, lo, ox, oy); }
        if (d === 2) R(-6, -24, 5, -24, c, ox, oy);
        break;
      }
      case 'helm': {
        const m = c === '#c8503c' ? '#b8c0cc' : c, mh = light(m, 0.45), ml = dark(m, 0.3);
        p.shaded(AX + ox - 0.5, AY + oy - 21, 7, 5.5, m, ml, mh);
        R(-7, -21, 6, -15, m, ox, oy);
        if (d === 2) {
          R(-5, -20, 4, -14, C.skin, ox, oy); R(-5, -20, 4, -20, C.skinLo, ox, oy); R(4, -19, 4, -14, C.skinLo, ox, oy);
          R(-1, -20, 0, -16, m, ox, oy); S(-1, -20, mh, ox, oy); S(0, -16, ml, ox, oy);
          S(-3, -18, C.eye, ox, oy); S(-3, -17, C.eye, ox, oy); S(2, -18, C.eye, ox, oy); S(2, -17, C.eye, ox, oy); S(-4, -16, C.blush, ox, oy); S(3, -16, C.blush, ox, oy);
          R(-7, -15, -6, -13, ml, ox, oy); R(5, -15, 6, -13, ml, ox, oy);
        }
        else if (d === 1) { R(1, -20, 6, -14, C.skin, ox, oy); R(1, -20, 6, -20, C.skinLo, ox, oy); S(3, -18, C.eye, ox, oy); S(3, -17, C.eye, ox, oy); S(4, -15, C.skinLo, ox, oy); R(-7, -16, -1, -13, ml, ox, oy); R(1, -21, 6, -21, ml, ox, oy); }
        else { R(-7, -15, 6, -13, ml, ox, oy); R(-1, -26, 0, -16, mh, ox, oy); }
        R(-7, -21, 6, -21, ml, ox, oy);
        S(-1, -27, '#e8503c', ox, oy); S(0, -27, '#e8503c', ox, oy); S(-1, -28, '#ff7a5a', ox, oy);
        break;
      }
      case 'straw': {
        const s = c === '#c8503c' ? '#f0d070' : c, sl = dark(s, 0.25), sh = light(s, 0.3);
        p.ellipse(AX + ox - 0.5, AY + oy - 21, 10.5, 3, sl);
        p.ellipse(AX + ox - 0.5, AY + oy - 21.5, 10, 2.5, s);
        p.shaded(AX + ox - 0.5, AY + oy - 24, 5.5, 3.5, s, sl, sh);
        R(-5, -23, 4, -22, '#c8503c', ox, oy);
        for (let x = -9; x <= 8; x += 3) S(x, -21, sl, ox, oy);
        break;
      }
      case 'chef': {
        const w = '#ffffff', wl = '#d8dce8';
        R(-5, -24, 4, -21, w, ox, oy); R(-5, -22, 4, -21, wl, ox, oy);
        p.shaded(AX + ox - 3.5, AY + oy - 27, 3.5, 3.5, w, wl, null);
        p.shaded(AX + ox + 2.5, AY + oy - 27, 3.5, 3.5, w, wl, null);
        p.shaded(AX + ox - 0.5, AY + oy - 29.5, 4, 3.5, w, wl, null);
        break;
      }
      case 'feather': {
        p.ellipse(AX + ox - 0.5, AY + oy - 21.5, 9, 2.2, lo);
        p.ellipse(AX + ox - 0.5, AY + oy - 22, 8.5, 1.6, c);
        p.shaded(AX + ox - 0.5, AY + oy - 24.5, 5, 3, c, lo, hi);
        R(-5, -23, 4, -23, gold, ox, oy);
        const fx = d === 1 ? -3 : 3, fs = d === 1 ? -1 : 1;
        const fc = '#f4f0e0', fl = '#c8c4d4';
        for (let i = 0; i < 7; i++) { S(fx + fs * Math.floor(i / 2), -24 - i, fc, ox, oy); S(fx + fs * Math.floor(i / 2) + fs, -24 - i, fl, ox, oy); }
        S(fx + fs * 4, -31, c, ox, oy); S(fx + fs * 3, -31, hi, ox, oy);
        break;
      }
      case 'horned': {
        const m = c === '#c8503c' ? '#a8b0bc' : c, mh = light(m, 0.45), ml = dark(m, 0.3), horn = '#f4ecd8', hornLo = '#c8bca0';
        p.shaded(AX + ox - 0.5, AY + oy - 21.5, 6.8, 5, m, ml, mh);
        R(-7, -21, 6, -20, ml, ox, oy); for (let x = -6; x <= 5; x += 2) S(x, -20, mh, ox, oy);
        if (d !== 1) {
          p.poly([AX + ox - 7, AY + oy - 22, AX + ox - 6, AY + oy - 24, AX + ox - 10, AY + oy - 29, AX + ox - 10, AY + oy - 26], horn);
          p.poly([AX + ox + 6, AY + oy - 22, AX + ox + 5, AY + oy - 24, AX + ox + 9, AY + oy - 29, AX + ox + 9, AY + oy - 26], horn);
          S(-9, -26, hornLo, ox, oy); S(8, -26, hornLo, ox, oy);
        } else {
          p.poly([AX + ox - 2, AY + oy - 25, AX + ox + 1, AY + oy - 25, AX + ox + 5, AY + oy - 31, AX + ox + 4, AY + oy - 27], horn);
          S(2, -26, hornLo, ox, oy);
        }
        break;
      }
      case 'circlet': {
        const g = c === '#c8503c' ? gold : c;
        if (d !== 0) { R(-6, -21, 5, -21, g, ox, oy); S(d === 1 ? 4 : -1, -22, '#9fe6ff', ox, oy); S(d === 1 ? 4 : 0, -22, '#9fe6ff', ox, oy); S(d === 1 ? 4 : -1, -21, '#ffffff', ox, oy); if (d === 1) R(-1, -21, 5, -21, g, ox, oy); }
        else R(-6, -21, 5, -21, g, ox, oy);
        if (d === 2) glow.push([AX + ox - 0.5, AY + oy - 22, '#9fe6ff', 0.6]);
        break;
      }
      default: break;
    }
  }

  // ---------- held items ----------
  function drawShield(x, y, back) {
    const sc = col(held.color, '#b0b8c8');
    const face = sc, rim = dark(sc, 0.35), em = '#ffd24a';
    if (back) {
      p.ellipse(AX + x + 0.5, AY + y + 3.5, 3.5, 4.5, rim); p.ellipse(AX + x + 0.5, AY + y + 3.5, 2.5, 3.5, dark(sc, 0.15));
      return;
    }
    p.poly([AX + x - 3, AY + y, AX + x + 4, AY + y, AX + x + 4, AY + y + 5, AX + x + 0.5, AY + y + 8, AX + x - 3, AY + y + 5], rim);
    p.poly([AX + x - 2, AY + y + 1, AX + x + 3, AY + y + 1, AX + x + 3, AY + y + 5, AX + x + 0.5, AY + y + 7, AX + x - 2, AY + y + 5], face);
    R(x, y + 1, x, y + 6, em); R(x - 2, y + 3, x + 2, y + 3, em); S(x - 1, y + 1, light(face, 0.5));
  }

  function drawHeld(behind) {
    if (!hand) return;
    const s = H, c0 = held.color;
    const hx0 = AX + Math.round(hand[0] - 0.5), hy0 = AY + Math.round(hand[1] - 1);
    const [dx, dy] = wdir;
    const diag0 = dx !== 0 && dy !== 0;
    const px = -dy, py = diag0 ? 0 : dx; // perpendicular (axis-aligned on diagonals so 2px blades stay solid)
    const seg = (t0, t1, c, wOff = 0) => { for (let t = t0; t <= t1; t++) p.set(hx0 + dx * t + px * wOff, hy0 + dy * t + py * wOff, c); };
    const dot = (t, w, c) => p.set(hx0 + dx * t + px * w, hy0 + dy * t + py * w, c);
    const g = held.glow && /^#/.test(held.glow) ? held.glow : null;
    const diag = dx !== 0 && dy !== 0;
    switch (s) {
      case 'stick': {
        const w = col(c0, '#a0703c');
        const wc = (w === '#b0b8c8') ? '#a0703c' : w;
        seg(-1, 9, wc); if (!diag) seg(1, 8, dark(wc, 0.3), 1); dot(5, -1, wc); dot(6, -2, light(wc, 0.3)); dot(9, 0, light(wc, 0.3));
        break;
      }
      case 'sword': case 'runeblade': case 'sword_shield': {
        const blade = s === 'runeblade' ? col(c0, '#9fe6ff') : col(c0, '#d8dee8');
        const bl = light(blade, 0.55), bd = dark(blade, 0.3);
        seg(-1, -1, '#ffd24a'); seg(0, 1, '#6b4423');
        for (let w = -2; w <= 2; w++) dot(2, w, w === 0 ? '#fff0a0' : '#ffd24a');
        if (diag) { dot(2, 0, '#ffd24a'); }
        const len = s === 'runeblade' ? 11 : 10;
        seg(3, len, blade);
        if (diag) { seg(3, len - 1, bl, 1); dot(len, 1, blade); }
        else { seg(3, len - 1, bl, -1); seg(3, len - 1, bd, 1); }
        dot(len + 1, 0, bl);
        if (s === 'runeblade') {
          const rc = g || '#9fe6ff';
          dot(4, 0, rc); dot(6, 0, '#ffffff'); dot(8, 0, rc);
          glow.push([hx0 + dx * 7 + 0.5, hy0 + dy * 7 + 0.5, rc, 1]);
        } else if (g) glow.push([hx0 + dx * 7 + 0.5, hy0 + dy * 7 + 0.5, g, 0.8]);
        break;
      }
      case 'axes': {
        const m = col(c0, '#c8ccd8');
        const one = (sx, sy, flip) => {
          const ddx = flip ? -dx : dx;
          for (let t = -1; t <= 6; t++) p.set(sx + ddx * t, sy + dy * t, '#7a4e2c');
          const ppx = -dy * (flip ? -1 : 1), ppy = ddx * (flip ? -1 : 1);
          for (let t = 4; t <= 7; t++) for (let w = 1; w <= (t === 4 || t === 7 ? 2 : 3); w++) p.set(sx + ddx * t + ppx * w, sy + dy * t + ppy * w, w === 3 || t === 7 ? light(m, 0.5) : m);
          p.set(sx + ddx * 7, sy + dy * 7, dark(m, 0.3));
        };
        one(hx0, hy0, false);
        if (dir !== 1 && offHand && arm !== 'attack') one(AX + Math.round(offHand[0]), AY + Math.round(offHand[1] - 1), true);
        if (dir === 1) one(hx0 - 4, hy0 + 1, false);
        if (g) glow.push([hx0 + dx * 5, hy0 + dy * 5, g, 0.7]);
        break;
      }
      case 'daggers': {
        const m = col(c0, '#d8dee8');
        const one = (sx, sy, ddx) => {
          p.set(sx, sy, '#5a3a2a'); p.set(sx + ddx, sy + dy, '#5a3a2a');
          p.set(sx + ddx * 2 + (-dy), sy + dy * 2 + ddx, '#ffd24a'); p.set(sx + ddx * 2 - (-dy), sy + dy * 2 - ddx, '#ffd24a');
          for (let t = 2; t <= 6; t++) p.set(sx + ddx * t, sy + dy * t, t === 6 ? light(m, 0.5) : m);
          p.set(sx + ddx * 3 + (-dy), sy + dy * 3 + ddx, light(m, 0.5));
        };
        one(hx0, hy0, dx);
        if (offHand && arm !== 'attack') one(AX + Math.round(offHand[0]), AY + Math.round(offHand[1] - 1), dir === 1 ? dx : -dx);
        if (g) glow.push([hx0 + dx * 4, hy0 + dy * 4, g, 0.6]);
        break;
      }
      case 'staff': case 'spear': case 'broom': {
        const wood = s === 'staff' ? (c0 && c0 !== '#b0b8c8' ? col(c0, '#8a5a33') : '#8a5a33') : '#a0703c';
        const len = s === 'staff' ? 17 : s === 'spear' ? 16 : 15;
        seg(-5, len, wood); if (!diag) seg(-4, len - 1, dark(wood, 0.3), 1); else { dot(0, 1, light(wood, 0.25)); dot(-3, 1, light(wood, 0.25)); }
        if (s === 'staff') {
          const gc = g || col(c0, '#9fe6ff');
          const tip = [hx0 + dx * (len + 2), hy0 + dy * (len + 2)];
          if (held.orbTop || g) {
            p.shaded(tip[0] + 0.5, tip[1] + 0.5, 2.6, 2.6, gc, dark(gc, 0.3), '#ffffff', 0.4, 0.4);
            p.set(tip[0] + 1, tip[1] + 2, wood); p.set(tip[0] - 1, tip[1] + 2, wood);
            p.set(tip[0] - 2, tip[1] + 1, dark(wood, 0.2)); p.set(tip[0] + 2, tip[1] + 1, dark(wood, 0.2));
            glow.push([tip[0] + 0.5, tip[1] + 0.5, gc, 1.2]);
          } else {
            // curled wooden crook
            p.set(tip[0], tip[1] - 1, wood); p.set(tip[0] + 1, tip[1] - 2, wood); p.set(tip[0] + 2, tip[1] - 1, wood); p.set(tip[0] + 2, tip[1], wood);
            p.set(tip[0], tip[1], light(wood, 0.3));
          }
        } else if (s === 'spear') {
          const m = col(c0, '#d8dee8');
          for (let t = len + 1; t <= len + 4; t++) { dot(t, 0, m); if (t < len + 4) { dot(t, -1, light(m, 0.4)); dot(t, 1, dark(m, 0.25)); } }
          dot(len + 5, 0, light(m, 0.5)); dot(len, -1, '#c8503c'); dot(len, 1, '#c8503c');
          if (g) glow.push([hx0 + dx * (len + 3), hy0 + dy * (len + 3), g, 0.8]);
        } else {
          const br = '#e8c060', brl = '#b8903a';
          for (let t = -9; t <= -5; t++) for (let w = -2; w <= 2; w++) if (Math.abs(w) <= 1 + ((t + 9) >> 1)) dot(t, w, (w + t) % 2 ? brl : br);
          dot(-5, 0, '#c8503c'); dot(-5, 1, '#c8503c'); dot(-5, -1, '#c8503c');
        }
        break;
      }
      case 'wand': {
        const w = col(c0, '#f4ecd8'), wc = w === '#b0b8c8' ? '#4a3a5a' : w;
        seg(0, 6, wc); seg(0, 1, '#ffd24a');
        const gc = g || '#ffe680';
        const tx = hx0 + dx * 7, ty = hy0 + dy * 7;
        p.set(tx, ty, '#ffffff'); p.set(tx + 1, ty, gc); p.set(tx - 1, ty, gc); p.set(tx, ty + 1, gc); p.set(tx, ty - 1, gc);
        glow.push([tx + 0.5, ty + 0.5, gc, 0.9]);
        break;
      }
      case 'orb': {
        const gc = g || col(c0, '#9fe6ff');
        const ox = hx0 + (dir === 1 ? 2 : dir === 2 ? -1 : 1), oy = hy0 - 4;
        p.shaded(ox + 0.5, oy + 0.5, 3, 3, gc, dark(gc, 0.35), '#ffffff', 0.3, 0.45);
        p.set(ox - 1, oy - 1, '#ffffff');
        glow.push([ox + 0.5, oy + 0.5, gc, 1.3]);
        break;
      }
      case 'fists': break; // drawn as gauntlet hands
      case 'bow': {
        const w = col(c0, '#a0703c'), wc = w === '#b0b8c8' ? '#a0703c' : w;
        // bow perpendicular to the aim direction
        const ax = dir === 1 ? 1 : dir === 2 ? 0 : 0, ay = dir === 1 ? 0 : dir === 2 ? 1 : -1;
        const qx = -ay, qy = ax;
        const cx = hx0 + ax * 1, cy = hy0 + ay * 1;
        for (let t = -6; t <= 6; t++) {
          const bend = Math.round(2.4 * (1 - (t * t) / 36));
          p.set(cx + qx * t + ax * bend, cy + qy * t + ay * bend, Math.abs(t) > 4 ? light(wc, 0.25) : wc);
        }
        const pull = arm === 'charge' ? -3 : 0;
        for (let t = -5; t <= 5; t++) {
          const k = Math.abs(t) / 5;
          p.set(cx + qx * t + ax * Math.round(pull * (1 - k)), cy + qy * t + ay * Math.round(pull * (1 - k)), '#f4f0e0');
        }
        if (arm === 'charge' || arm === 'attack') { for (let t = pull; t <= 5; t++) p.set(cx + ax * t, cy + ay * t, '#c8a070'); p.set(cx + ax * 6, cy + ay * 6, '#d8dee8'); }
        if (g) glow.push([cx + ax * 3, cy + ay * 3, g, 0.8]);
        break;
      }
      case 'shuriken': {
        const m = col(c0, '#c8ccd8');
        const sx = hx0 + dx, sy = hy0 + dy;
        p.set(sx, sy, dark(m, 0.4)); p.set(sx - 1, sy, m); p.set(sx + 1, sy, m); p.set(sx, sy - 1, m); p.set(sx, sy + 1, m);
        p.set(sx - 2, sy - 1, light(m, 0.4)); p.set(sx + 2, sy + 1, light(m, 0.4)); p.set(sx + 1, sy - 2, light(m, 0.4)); p.set(sx - 1, sy + 2, light(m, 0.4));
        if (g) glow.push([sx + 0.5, sy + 0.5, g, 0.6]);
        break;
      }
      case 'book': {
        const cv = col(c0, '#8a3a5a'), cvc = cv === '#b0b8c8' ? '#8a3a5a' : cv;
        const bx2 = hx0 + (dir === 2 ? 1 : dir === 1 ? 1 : -2), by2 = hy0 - 2;
        p.rect(bx2 - 1, by2, 6, 4, cvc); p.rect(bx2, by2, 2, 3, '#fff8e8'); p.rect(bx2 + 2, by2, 2, 3, '#f0e4cc');
        p.set(bx2 + 2, by2 + 3, dark(cvc, 0.3)); p.set(bx2 + 1, by2 + 1, '#a0a0b8'); p.set(bx2 + 3, by2 + 1, '#a0a0b8');
        if (g || arm === 'cast') { const gc = g || '#ffe680'; glow.push([bx2 + 2, by2 - 1, gc, 0.9]); p.set(bx2 + 2, by2 - 2, gc); }
        break;
      }
      case 'lantern': {
        const m = col(c0, '#3a3a4a'), mc = m === '#b0b8c8' ? '#3a3a4a' : m;
        const lx = hx0, ly = hy0 + 2;
        p.set(lx, ly - 1, mc); p.rect(lx - 2, ly, 5, 1, mc); p.rect(lx - 2, ly + 1, 5, 4, '#ffe680'); p.rect(lx - 1, ly + 2, 3, 2, '#fffbe0');
        p.rect(lx - 2, ly + 1, 1, 4, mc); p.rect(lx + 2, ly + 1, 1, 4, mc); p.rect(lx - 2, ly + 5, 5, 1, mc);
        glow.push([lx + 0.5, ly + 3, g || '#ffd66a', 1.4]);
        break;
      }
      default: break;
    }
    void behind;
  }
}
