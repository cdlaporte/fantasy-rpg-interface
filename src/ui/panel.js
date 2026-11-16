// Left panel (--panel-w, 296 px): portrait, name, class line, level, HP / XP / resource bars, stats, basic attack, four ability
// slots, six item slots, tracked quest, companions and nudges. Built once; update(hud) only touches what changed.
import { el, add, setText, setStyle, setClass, show, keycap, pixelCanvas } from './dom.js';
import { iconCanvas, setIcon } from './icons.js';
import { buildPortrait, portraitKey } from './portraits.js';
import { blitGrid } from './pixelart.js';
import { roman, frac, fmtNum } from './format.js';
import { keyLabel, keyLabels, onBindingsChange } from '../platform/bindings.js';
import { tip } from './tooltip.js';

const ABILITY_SLOTS = ['space', 'q', 'f', 'shift'];

/** Seconds as '6s' / '1.5s'. */
const secs = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10) + 's';

const STAT_TIPS = {
  Power: ['Power', 'How hard you hit. Your attacks and abilities deal more damage the higher this is.'],
  Defense: ['Defense', 'Soaks up damage. The higher it is, the less every enemy hit hurts.'],
  Speed: ['Speed', 'How fast you walk and run, in tiles per second.'],
};

/** Crop a 32x32 portrait grid to the face (x 4..27, y 0..23) for small 2x avatars. */
export function faceCrop(g) { return g.slice(0, 24).map((r) => r.slice(4, 28)); }

function bar(cls, label) {
  const b = el('div', 'bar ' + cls);
  const lab = el('span', 'bar-label', label);
  const track = el('div', 'bar-track');
  const fill = el('div', 'bar-fill');
  const ghost = el('div', 'bar-ghost');
  const pips = el('div', 'bar-pips');
  const txt = el('span', 'bar-text');
  add(track, ghost, fill, pips, txt);
  add(b, lab, track);
  return { root: b, lab, fill, ghost, txt, pips, lastFrac: -1, pipN: -1 };
}

function setBar(b, f, text) {
  if (Math.abs(b.lastFrac - f) > 0.001) {
    // the ghost lags behind on loss (chip damage feel)
    if (f < b.lastFrac) setStyle(b.ghost, 'width', (b.lastFrac * 100).toFixed(1) + '%');
    b.lastFrac = f;
    setStyle(b.fill, 'width', (f * 100).toFixed(1) + '%');
    clearTimeout(b.ghostT);
    b.ghostT = setTimeout(() => setStyle(b.ghost, 'width', (b.lastFrac * 100).toFixed(1) + '%'), 450);
  }
  setText(b.txt, text);
}

function setPips(b, n, max, color) {
  const want = max > 0 && max <= 12 ? max : 0;
  if (b.pipN !== want) {
    b.pipN = want;
    while (b.pips.firstChild) b.pips.removeChild(b.pips.firstChild);
    for (let i = 0; i < want; i++) b.pips.appendChild(el('i', 'pip'));
  }
  for (let i = 0; i < want; i++) setClass(b.pips.children[i], 'on', i < n);
  if (color) setStyle(b.pips, '--pip', color);
}

/**
 * @param {HTMLElement} root  #panel
 * @param {Object} [ctx] {game, emitSfx}
 */
export function createPanel(root, ctx = {}) {
  const wrap = el('div', 'pnl');

  // --- hero card
  const hero = el('div', 'pnl-hero px-box');
  const frame = el('div', 'portrait-frame');
  const portrait = pixelCanvas(32, 32, 'portrait');
  frame.appendChild(portrait);
  const info = el('div', 'hero-info');
  const name = el('div', 'hero-name pxfont');
  const cls = el('div', 'hero-class');
  const lvRow = el('div', 'hero-row');
  const lv = el('span', 'lv-badge pxfont');
  const gold = el('span', 'gold');
  const goldN = el('span', 'gold-n pxfont');
  add(gold, iconCanvas('coin', 'icon-sm'), goldN);
  add(lvRow, lv, gold);
  const wanted = el('div', 'wanted-badge pxfont', 'WANTED');
  frame.appendChild(wanted);
  add(hero, frame, info);

  // --- bars
  const bars = el('div', 'pnl-bars');
  const hp = bar('bar-hp', 'HP');
  const xp = bar('bar-xp', 'XP');
  const res = bar('bar-res', '');
  add(bars, hp.root, xp.root, res.root);

  // --- stats
  const stats = el('div', 'pnl-stats');
  const stat = (icon, title) => {
    const s = el('span', 'stat');
    tip(s, () => ({ title: STAT_TIPS[title][0] + ': ' + v.textContent, lines: [STAT_TIPS[title][1]] }));
    const v = el('span', 'stat-v pxfont');
    add(s, iconCanvas(icon, 'icon-sm'), el('span', 'stat-k', title), v);
    stats.appendChild(s);
    return v;
  };
  const sPow = stat('sword', 'Power'), sDef = stat('shield', 'Defense'), sSpd = stat('dash', 'Speed');
  add(info, name, cls, lvRow, stats);

  // --- basic attack
  const basic = el('div', 'pnl-basic px-box');
  const bIcon = iconCanvas('sword', 'icon-md');
  const bText = el('div', 'basic-text');
  const bTitle = el('div', 'sec-title pxfont', 'ATTACK');
  const bName = el('div', 'basic-name');
  add(bText, bTitle, bName);
  const rank = el('div', 'rank-pips');
  for (let i = 0; i < 5; i++) rank.appendChild(el('i', 'rpip'));
  const rankLab = el('span', 'rank-lab pxfont');
  add(basic, bIcon, bText, el('div', 'basic-right', null));
  add(basic.lastChild, rankLab, rank);

  // --- abilities
  const abil = el('div', 'pnl-abil');
  const slots = ABILITY_SLOTS.map((slot) => {
    const s = el('div', 'aslot');
    const box = el('div', 'aslot-box');
    const ic = iconCanvas('lock', 'icon-lg');
    const cd = el('div', 'cd-sweep');
    const lock = el('div', 'aslot-lock');
    const lockLv = el('span', 'lock-lv pxfont');
    add(lock, iconCanvas('lock', 'icon-sm'), lockLv);
    const cost = el('span', 'aslot-cost pxfont');
    const kc = keycap(keyLabel(slot), 'aslot-key');
    add(box, ic, cd, lock, cost, kc);
    const nm = el('div', 'aslot-name');
    add(s, box, nm);
    abil.appendChild(s);
    return { slot, s, box, ic, cd, lock, lockLv, cost, nm, kc, wasReady: true, flashT: 0, a: null };
  });

  // --- items
  const items = el('div', 'pnl-items');
  const islots = [];
  for (let i = 0; i < 6; i++) {
    const s = el('div', 'islot');
    const ic = iconCanvas(null, 'icon-md');
    const k = el('span', 'islot-key pxfont', keyLabel('item' + (i + 1)));
    const n = el('span', 'islot-n pxfont');
    const cd = el('div', 'cd-sweep');
    add(s, ic, cd, k, n);
    s.addEventListener('click', () => { const g = ctx.game; if (g && g.commands.useSlot) g.commands.useSlot(i); });
    items.appendChild(s);
    islots.push({ s, ic, n, cd, k, it: null });
  }

  // --- quest
  const quest = el('div', 'pnl-quest px-box');
  const qTitle = el('div', 'sec-title pxfont', 'QUEST');
  const qName = el('div', 'quest-name');
  const qStep = el('div', 'quest-step');
  const qProg = el('div', 'quest-prog');
  const qProgFill = el('div', 'quest-prog-fill');
  qProg.appendChild(qProgFill);
  add(quest, qTitle, qName, qStep, qProg);
  quest.classList.add('clickable');
  quest.addEventListener('click', () => { if (ctx.onQuestClick) ctx.onQuestClick(); });

  // --- companions
  const comps = el('div', 'pnl-comps');
  const compEls = [];

  // --- nudges
  const nudges = el('div', 'pnl-nudges');
  const nBoon = el('div', 'nudge nudge-boon');
  const nBoonText = el('span', 'nudge-text');
  const nBoonKey = keycap(keyLabel('boon'));
  add(nBoon, iconCanvas('star', 'icon-sm'), nBoonText, nBoonKey);
  nBoon.addEventListener('click', () => ctx.onBoonNudge && ctx.onBoonNudge());
  const nSpec = el('div', 'nudge nudge-spec');
  const nSpecText = el('span', 'nudge-text');
  let nSpecKey = keycap(keyLabel('boon'));
  add(nSpec, iconCanvas('up', 'icon-sm'), nSpecText, nSpecKey);
  // round 4: the mastery nudge (level 15): "See Mr. Laporte!" until the ceremony, then "Mastery ready!" + Tab
  const nMastery = el('div', 'nudge nudge-spec nudge-mastery');
  const nMasteryText = el('span', 'nudge-text');
  let nMasteryKey = keycap(keyLabel('boon'));
  add(nMastery, iconCanvas('star', 'icon-sm'), nMasteryText, nMasteryKey);
  nMastery.addEventListener('click', () => {
    const g = game0 || ctx.game;
    if (g && g.commands && g.commands.masteryNudge) g.commands.masteryNudge();
  });
  add(nudges, nBoon, nSpec, nMastery);

  add(wrap, hero, bars, basic, el('div', 'sec-title pxfont sec-abil', 'ABILITIES'), abil,
    el('div', 'sec-title pxfont sec-items', 'ITEMS'), items, quest, comps, nudges);
  root.appendChild(wrap);

  // ---- tooltips (one shared element, ui/tooltip.js)
  let lastHud = null;
  const H = () => lastHud || {};
  tip(portrait.parentElement, () => { const p = H().player || {}; return { title: p.name || 'You', tag: 'LV ' + (p.level || 1), lines: [p.className ? [p.className, p.specName, p.masteryName].filter(Boolean).join(', ') : 'Adventurer'] }; });
  tip(hp.root, () => { const p = H().player || {}; return { title: 'Health', meta: [`${Math.ceil(p.hp || 0)} / ${p.hpMax || 0}`], lines: ['If it reaches zero you are knocked out. Potions and resting bring it back.'] }; });
  tip(xp.root, () => { const p = H().player || {}; return { title: 'Experience', meta: [`${p.xp || 0} / ${p.xpNext || 0}`], lines: ['Fill the bar to level up. Right answers earn the most.'] }; });
  tip(res.root, () => {
    const h = H(), r = h.player && h.player.resource, kh = h.kitHud;
    if (!r && !(kh && kh.pipsMax)) return null;
    const name = r ? (r.name || r.id || 'Resource') : (kh.label || 'Charges');
    return { title: name, meta: [r ? `${Math.floor(r.value)} / ${r.max}` : `${kh.pips || 0} / ${kh.pipsMax}`], lines: ['Your abilities spend this. It builds as you fight.'] };
  });
  tip(gold, () => ({ title: 'Gold', meta: [fmtNum((H().player || {}).gold || 0)], lines: ['Spend it in shops.'] }));
  tip(basic, () => {
    const b = H().basic || {};
    const keys = ['attack_up', 'attack_left', 'attack_down', 'attack_right'].map(keyLabel).join(' ');
    return { title: b.name || 'Bare hands', tag: 'RANK ' + roman(Math.max(1, Math.min(5, b.rank || 1))),
      lines: [b.desc || 'Your basic attack. It is free and has no cooldown.', `Hold ${keys} to attack. Hold two keys for a diagonal. Answer questions right to raise its rank.`] };
  });
  tip(quest, () => {
    const q = H().quest;
    if (!q) return null;
    const pr = questProgress(q.progress);
    return { title: q.name || q.id, meta: pr.text ? [pr.text] : [], lines: [questStep(q, ctx.game)] };
  });
  slots.forEach((sl) => tip(sl.s, () => {
    const a = sl.a;
    if (!a || !(a.id || a.name)) return { title: 'Empty ability slot', tag: keyLabel(sl.slot), lines: ['A new ability unlocks as you level up.'] };
    const meta = [];
    if (!a.unlocked) meta.push(a.unlockLevel ? `Unlocks at level ${a.unlockLevel}` : 'Locked');
    else {
      if (a.cost) meta.push(`Cost ${a.cost}`);
      const cdTotal = a.cd ?? a.cooldown;
      if (cdTotal) meta.push(`Cooldown ${secs(cdTotal)}`);
      const g = ctx.game;
      const left = g && g.abilities && g.abilities.cdLeft && g.player ? g.abilities.cdLeft(g.player, sl.slot) : (a.cdFrac || 0) * (cdTotal || 0);
      meta.push(left > 0.05 ? `Ready in ${secs(left)}` : 'Ready');
    }
    return { title: a.name, tag: keyLabel(sl.slot), meta, lines: [a.desc || ''] };
  }));
  islots.forEach((sl, i) => tip(sl.s, () => {
    const it = sl.it;
    if (!it) return { title: 'Empty item slot', tag: keyLabel('item' + (i + 1)), lines: ['Open your bag and put an item here to use it with one key.'] };
    const d = (ctx.game && ctx.game.data && ctx.game.data.items && ctx.game.data.items[it.id]) || {};
    const meta = [`You have ${it.count ?? 1}`];
    const cdTotal = d.cd || 0;
    if (cdTotal > 1) meta.push(`Cooldown ${secs(cdTotal)}`);
    if (it.cdFrac > 0 && cdTotal) meta.push(`Ready in ${secs(it.cdFrac * cdTotal)}`);
    return { title: it.name || d.name || it.id, tag: keyLabel('item' + (i + 1)), meta, lines: [it.desc || d.desc || ''] };
  }));
  tip(nBoon, () => ({ title: 'Boon ready', lines: ['You earned a boon. Press ' + keyLabel('boon') + ' to choose one of three.'] }));
  tip(nMastery, () => ({ title: 'Mastery ready', lines: [ctx.game && ctx.game.flags && ctx.game.flags.mastery_ceremony_done ? 'Press ' + keyLabel('boon') + ' (or click) to choose your mastery.' : 'Go and see Mr. Laporte in his office to choose your mastery.'] }));
  tip(nSpec, () => ({ title: 'New path ready', lines: [ctx.game && ctx.game.flags && ctx.game.flags.spec_ceremony_done ? 'Press ' + keyLabel('boon') + ' to choose your specialization.' : 'Go and see Mr. Laporte to choose your specialization.'] }));

  // key names follow the player's bindings
  function relabel() {
    for (const sl of slots) { const nk = keycap(keyLabel(sl.slot), 'aslot-key'); sl.box.replaceChild(nk, sl.kc); sl.kc = nk; }
    islots.forEach((sl, i) => { sl.k.textContent = keyLabel('item' + (i + 1)); });
    const bk = keycap(keyLabel('boon')); nBoon.replaceChild(bk, nBoon.lastChild);
    const sk = keycap(keyLabel('boon')); nSpec.replaceChild(sk, nSpecKey); nSpecKey = sk; show(sk, !!(game0 && game0.flags && game0.flags.spec_ceremony_done));
    const mk = keycap(keyLabel('boon')); nMastery.replaceChild(mk, nMasteryKey); nMasteryKey = mk; show(mk, !!(game0 && game0.flags && game0.flags.mastery_ceremony_done));
  }
  let game0 = ctx.game;
  const offBind = onBindingsChange(relabel);

  let pKey = '';
  const compKeys = [];

  function updateCompanions(list, t) {
    const n = list ? list.length : 0;
    while (compEls.length < n) {
      const c = el('div', 'comp');
      const cv = pixelCanvas(24, 24, 'comp-face');
      const nm = el('div', 'comp-name');
      const hb = el('div', 'comp-hp');
      const hf = el('div', 'comp-hp-fill');
      hb.appendChild(hf);
      const right = el('div', 'comp-right');
      add(right, nm, hb);
      add(c, cv, right);
      comps.appendChild(c);
      const rec = { c, cv, nm, hf, co: null };
      compEls.push(rec);
      tip(c, () => {
        const o = rec.co;
        if (!o) return null;
        const cls = o.classId ? o.classId.charAt(0).toUpperCase() + o.classId.slice(1) + ' companion. ' : 'Companion. ';
        return { title: o.name || o.id, tag: o.level ? 'LV ' + o.level : '', meta: [o.down ? 'Knocked out' : `Health ${Math.round(frac(o.hpFrac ?? 1, 1) * 100)}%`], lines: [cls + 'Fights beside you and grows stronger as you level.'] };
      });
      compKeys.push('');
    }
    for (let i = 0; i < compEls.length; i++) {
      const ce = compEls[i];
      show(ce.c, i < n);
      if (i >= n) continue;
      const co = list[i];
      ce.co = co;
      setText(ce.nm, (co.name || co.id || '') + (co.level ? ' L' + co.level : ''));
      setStyle(ce.hf, 'width', (frac(co.hpFrac ?? 1, 1) * 100).toFixed(0) + '%');
      setClass(ce.c, 'down', !!co.down);
      setClass(ce.hf, 'low', (co.hpFrac ?? 1) < 0.35);
      const mood = co.down ? 'worried' : (co.hpFrac ?? 1) < 0.35 ? 'worried' : 'calm';
      const key = portraitKey(co.look, mood, t + i * 1.3, 'sky');
      if (key !== compKeys[i]) {
        compKeys[i] = key;
        blitGrid(ce.cv, faceCrop(buildPortrait(co.look, { mood, t: t + i * 1.3, bg: 'sky' })));
      }
    }
    show(comps, n > 0);
  }

  function questStep(q, game) {
    if (q.step === null || q.step === undefined) return '';
    if (typeof q.step === 'string') return q.step;
    const def = game && game.data && game.data.quests && game.data.quests[q.id];
    const st = def && def.steps && def.steps[q.step];
    return st ? st.text : '';
  }

  function questProgress(p) {
    if (p === null || p === undefined || p === '') return { text: '', f: -1 };
    if (typeof p === 'number') return p <= 1 ? { text: '', f: p } : { text: String(p), f: -1 };
    if (typeof p === 'string') {
      const m = p.match(/(\d+)\s*\/\s*(\d+)/);
      return { text: p, f: m ? frac(+m[1], +m[2]) : -1 };
    }
    if (typeof p === 'object') {
      const n = p.n ?? p.have ?? p.done ?? 0, of = p.of ?? p.need ?? p.total ?? 0;
      return { text: of ? `${n}/${of}` : '', f: of ? frac(n, of) : -1 };
    }
    return { text: '', f: -1 };
  }

  return {
    el: wrap,
    update(hud, game, t = 0) {
      lastHud = hud; game0 = game || game0;
      const p = hud.player || {};
      // portrait
      const mood = p.hpMax > 0 && p.hp / p.hpMax < 0.3 ? 'worried' : 'calm';
      const key = portraitKey(p.look, mood, t, 'sky') + (p.cloaked ? 'c' : '');
      if (key !== pKey) { pKey = key; blitGrid(portrait, buildPortrait(p.look, { mood, t, bg: 'sky' })); }
      setClass(frame, 'cloaked', !!p.cloaked);
      setText(name, p.name || '');
      // round 4: "Class · Subclass · Mastery" (the class is dropped when all three would not fit)
      const clsText = p.className ? (p.masteryName ? `${(p.className + p.specName + p.masteryName).length > 22 ? '' : p.className + ' · '}${p.specName} · ${p.masteryName}`
        : p.specName ? `${p.className} · ${p.specName}` : p.className) : (p.cloaked ? 'Mysterious traveler' : 'Novice');
      setText(cls, clsText);
      setText(lv, 'LV ' + (p.level || 1));
      setText(goldN, fmtNum(p.gold || 0));
      show(wanted, !!p.wanted);

      setBar(hp, frac(p.hp, p.hpMax), `${Math.ceil(p.hp || 0)}/${p.hpMax || 0}`);
      setClass(hp.root, 'low', p.hpMax > 0 && p.hp / p.hpMax < 0.3);
      setBar(xp, frac(p.xp, p.xpNext), `${p.xp || 0}/${p.xpNext || 0}`);
      const r = p.resource;
      const kh = hud.kitHud;
      show(res.root, !!r || !!(kh && kh.pipsMax));
      if (r || (kh && kh.pipsMax)) {
        const color = (r && r.color) || '#58d68d';
        setStyle(res.root, '--res', color);
        setText(res.lab, r ? (r.name || r.id || '').slice(0, 5) : (kh.label || 'Pips').slice(0, 5));
        if (r && kh && kh.pipsMax && r.max <= 12 && r.max === kh.pipsMax) {
          setBar(res, frac(r.value, r.max), '');
        } else {
          setBar(res, r ? frac(r.value, r.max) : frac(kh.pips, kh.pipsMax), r ? `${Math.floor(r.value)}/${r.max}` : '');
        }
        setPips(res, kh ? kh.pips || 0 : 0, kh ? kh.pipsMax || 0 : 0, color);
        setClass(res.root, 'pips-only', !r);
      }
      setText(sPow, Math.round(p.power || 0));
      setText(sDef, Math.round(p.defense || 0));
      setText(sSpd, (Math.round((p.speed || 0) * 10) / 10).toString());

      // basic attack
      const b = hud.basic || {};
      setIcon(bIcon, b.icon || 'sword');
      setText(bName, b.name || 'Bare hands');
      const rk = Math.max(1, Math.min(5, b.rank || 1));
      setText(rankLab, roman(rk));
      for (let i = 0; i < 5; i++) setClass(rank.children[i], 'on', i < rk);
      if (kh && kh.stance) setText(bTitle, 'ATTACK · ' + String(kh.stance).toUpperCase());
      else setText(bTitle, 'ATTACK');

      // abilities
      const abs = hud.abilities || [];
      for (let i = 0; i < 4; i++) {
        const s = slots[i];
        const a = abs[i] || {};
        const unlocked = !!a.unlocked;
        const hasAbility = !!a.id || !!a.name;
        setIcon(s.ic, hasAbility ? a.icon || 'star' : 'lock');
        setClass(s.s, 'locked', !unlocked);
        setClass(s.s, 'empty', !hasAbility);
        setClass(s.s, 'active', !!a.active);
        const cdf = unlocked ? Math.max(0, Math.min(1, a.cdFrac || 0)) : 0;
        setStyle(s.cd, '--cd', cdf.toFixed(3));
        const ready = unlocked && (a.ready ?? cdf <= 0);
        setClass(s.s, 'cooling', unlocked && !ready);
        if (ready && !s.wasReady) { setClass(s.s, 'flash', false); void s.s.offsetWidth; setClass(s.s, 'flash', true); }
        s.wasReady = ready;
        setText(s.lockLv, !unlocked && a.unlockLevel ? 'Lv ' + a.unlockLevel : '');
        setText(s.cost, unlocked && a.cost ? a.cost : '');
        setText(s.nm, hasAbility ? (unlocked ? a.name : a.name || '???') : '—');
        s.a = a;
      }

      // items
      const its = hud.items || [];
      for (let i = 0; i < 6; i++) {
        const s = islots[i];
        const it = its[i];
        setClass(s.s, 'empty', !it);
        if (it) {
          setIcon(s.ic, it.icon || 'potion');
          setText(s.n, it.count > 1 ? 'x' + it.count : '');
          setStyle(s.cd, '--cd', Math.max(0, Math.min(1, it.cdFrac || 0)).toFixed(3));
          s.it = it;
        } else {
          if (s.ic.__icon) { s.ic.getContext('2d').clearRect(0, 0, 16, 16); s.ic.__icon = null; }
          setText(s.n, '');
          setStyle(s.cd, '--cd', '0');
          s.it = null;
        }
      }

      // quest
      const q = hud.quest;
      show(quest, !!q);
      if (q) {
        setText(qName, q.name || q.id);
        setText(qStep, questStep(q, game));
        const pr = questProgress(q.progress);
        show(qProg, pr.f >= 0);
        if (pr.f >= 0) setStyle(qProgFill, 'width', (pr.f * 100).toFixed(0) + '%');
        setText(qTitle, pr.text ? `QUEST  ${pr.text}` : 'QUEST');
      }

      updateCompanions(hud.companions, t);

      // nudges
      const nb = hud.pendingBoons || 0;
      show(nBoon, nb > 0);
      setText(nBoonText, nb > 1 ? `${nb} boons ready!` : 'Boon ready!');
      show(nSpec, !!hud.pendingSpec);
      const ceremonyDone = game && game.flags && game.flags.spec_ceremony_done;
      setText(nSpecText, ceremonyDone ? 'New path ready!' : 'See Mr. Laporte!');
      show(nSpecKey, !!ceremonyDone);
      const pm = !!p.pendingMastery && !hud.pendingSpec;
      show(nMastery, pm);
      const mDone = !!(game && game.flags && game.flags.mastery_ceremony_done);
      setText(nMasteryText, mDone ? 'Mastery ready!' : 'See Mr. Laporte!');
      show(nMasteryKey, mDone);
      show(nudges, nb > 0 || !!hud.pendingSpec || pm);
    },
    dispose() { offBind(); wrap.remove(); },
  };
}

export default createPanel;
