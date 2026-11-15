// HUD feedback inside #hud: banners (level up, ability unlocked, rank up, quests), boss bar, tutorial prompt,
// interact-prompt fallback, letterbox bars, zone fade + title card, low-HP vignette.
import { el, add, setText, setStyle, setClass, show, clear, keycap } from './dom.js';
import { iconCanvas } from './icons.js';
import { roman, frac, howTo, keyLabel } from './format.js';

const BANNER_MS = 2300;

export function createFeedback(hudEl, viewEl, ctx) {
  // --- banners
  const bannerHost = el('div', 'banner-host');
  hudEl.appendChild(bannerHost);
  // One queue for every centered announcement (zone card, level up, ability, rank, quest): only one shows at a time.
  // Lower prio shows first (zone card 0, level 1, ability 2, rank 3, quest 4); a backlog shortens each item's time.
  const queue = [];
  let curUntil = 0, cur = null;

  function enqueue(item) {
    queue.push(item);
    if (queue.length > 8) queue.pop();
    let i = queue.length - 1;           // stable insertion by prio
    while (i > 0 && queue[i - 1].prio > item.prio) { queue[i] = queue[i - 1]; i--; }
    queue[i] = item;
  }
  function pushBanner(build, ms = BANNER_MS, sfx, prio = 4) {
    enqueue({ prio, ms, sfx, start: () => { const e = build(); bannerHost.appendChild(e); return () => { e.classList.add('out'); setTimeout(() => e.remove(), 300); }; } });
  }

  function nextBanner(now) {
    if (cur && now < curUntil) return;
    if (cur) { cur(); cur = null; }
    const nx = queue.shift();
    if (!nx) return;
    cur = nx.start();
    const ms = queue.length >= 2 ? Math.min(nx.ms, 1500) : queue.length === 1 ? Math.min(nx.ms, 2000) : nx.ms;
    curUntil = now + ms;
    if (nx.sfx) ctx.sfx(nx.sfx);
  }

  const banner = (cls, kicker, title, sub, icon) => () => {
    const b = el('div', 'banner ' + cls);
    if (kicker) b.appendChild(el('div', 'banner-kicker pxfont', kicker));
    const row = el('div', 'banner-row');
    if (icon) row.appendChild(icon);
    row.appendChild(el('div', 'banner-title pxfont', title));
    b.appendChild(row);
    if (sub) b.appendChild(typeof sub === 'string' ? el('div', 'banner-sub', sub) : sub);
    for (let i = 0; i < 8; i++) { const s = el('i', 'spark'); s.style.setProperty('--i', i); b.appendChild(s); }
    return b;
  };

  // --- boss bar
  const boss = el('div', 'boss px-box dark');
  const bossName = el('div', 'boss-name pxfont');
  const bossTrack = el('div', 'boss-track');
  const bossFill = el('div', 'boss-fill');
  const bossShield = el('div', 'boss-shield pxfont');
  add(bossShield, iconCanvas('rune', 'icon-sm'), el('span', null, 'SHIELDED'));
  add(bossTrack, bossFill);
  add(boss, bossName, bossTrack, bossShield);
  const bossbarEl = document.getElementById('bossbar');
  (bossbarEl || hudEl).appendChild(boss);
  show(boss, false);

  // --- tutorial
  const tutEl = document.getElementById('tutorial') || hudEl;
  const tut = el('div', 'tutorial px-box');
  const tutKeys = el('div', 'tut-keys');
  const tutText = el('div', 'tut-text');
  add(tut, tutKeys, tutText);
  tutEl.appendChild(tut);
  show(tut, false);
  let tutSig = '';

  // --- prompt fallback (#prompt), used when the overlay cannot place the prompt above its entity
  const promptEl = document.getElementById('prompt') || hudEl;
  const prompt = el('div', 'prompt-fallback px-box');
  const promptKey = keycap('E', 'big');
  const promptText = el('span', 'prompt-text');
  add(prompt, promptKey, promptText);
  promptEl.appendChild(prompt);
  show(prompt, false);

  // --- letterbox, fade, zone card, vignette
  const lbTop = el('div', 'letterbox lb-top'), lbBot = el('div', 'letterbox lb-bot');
  const fade = el('div', 'zone-fade');
  const card = el('div', 'zone-card');
  const cardName = el('div', 'zone-card-name pxfont');
  const cardSub = el('div', 'zone-card-sub');
  add(card, el('div', 'zone-card-orn'), cardName, cardSub, el('div', 'zone-card-orn'));
  const vignette = el('div', 'vignette');
  // integration: "Esc  Skip" hint while a skippable cutscene runs (Story: cutscene.active && cutscene.skippable)
  const skipHint = el('div', 'skip-hint pxfont');
  skipHint.textContent = 'Esc  Skip';
  skipHint.hidden = true;
  hudEl.prepend(vignette, lbTop, lbBot);
  hudEl.append(skipHint);
  hudEl.append(fade, card);
  
  let lastHp = -1;
  let lastBasic = '';

  const api = {
    tick(now) { if (queue.length || cur) nextBanner(now); },

    update(hud) {
      // boss
      const b = hud.boss;
      show(boss, !!b);
      setClass(hudEl, 'has-boss', !!b);
      if (b) {
        setText(bossName, b.name || '');
        setStyle(bossFill, 'width', (frac(b.hpFrac, 1) * 100).toFixed(1) + '%');
        setClass(boss, 'shielded', !!b.shield);
        show(bossShield, !!b.shield);
      }
      // tutorial
      const t = hud.tutorial;
      show(tut, !!t);
      if (t) {
        const sig = (t.text || '') + '|' + (t.keys || []).join(',');
        if (sig !== tutSig) {
          tutSig = sig;
          clear(tutKeys);
          for (const k of t.keys || []) tutKeys.appendChild(keycap(keyLabel(k), 'big'));
          show(tutKeys, (t.keys || []).length > 0);
          tutText.textContent = t.text || '';
          tut.classList.remove('pop'); void tut.offsetWidth; tut.classList.add('pop');
        }
      } else tutSig = '';
      // vignette
      const p = hud.player || {};
      const f = p.hpMax > 0 ? p.hp / p.hpMax : 1;
      setClass(vignette, 'low', f < 0.3 && p.hp > 0);
      if (lastHp >= 0 && p.hp < lastHp && p.hpMax > 0) {
        vignette.classList.remove('hurt'); void vignette.offsetWidth; vignette.classList.add('hurt');
      }
      lastHp = p.hp;
      if (hud.basic && hud.basic.name) lastBasic = hud.basic.name;
    },

    /** Fallback prompt text when the overlay could not anchor it (null hides it). */
    setPromptFallback(pr) {
      show(prompt, !!pr);
      if (pr) { setText(promptKey, pr.key || 'E'); setText(promptText, pr.text || ''); }
    },

    levelup(e) {
      pushBanner(banner('banner-level', 'LEVEL UP!', `Level ${e.level}`, e.gained > 1 ? `+${e.gained} levels! Fully healed.` : 'Fully healed. You feel stronger!', iconCanvas('up', 'icon-xl')), BANNER_MS, null, 1);
    },
    abilityUnlocked(e, hud) {
      const a = hud && hud.abilities ? hud.abilities.find((x) => x.slot === e.slot) || {} : {};
      const key = a.key || { space: 'Space', q: 'Q', f: 'F', shift: 'Shift' }[e.slot] || '';
      const sub = el('div', 'banner-sub');
      add(sub, el('span', null, howTo(Object.assign({ key }, a))));
      const icon = el('div', 'banner-ab');
      add(icon, iconCanvas(a.icon || 'star', 'icon-xl'), keycap(keyLabel(key), 'big'));
      pushBanner(banner('banner-ability', 'NEW ABILITY', a.name || e.id || 'New ability', sub, icon), 3000, null, 2);
    },
    rankUp(e, hud) {
      const oldName = e.from || lastBasic;
      const newName = hud && hud.basic ? hud.basic.name : '';
      const sub = oldName && newName && oldName !== newName ? `${oldName} → ${newName}` : (newName || 'Your basic attack grows stronger!');
      pushBanner(banner('banner-rank', 'ATTACK RANK ' + roman(e.rank || 1), newName || 'Rank up!', sub, iconCanvas((hud && hud.basic && hud.basic.icon) || 'sword', 'icon-xl')), 2600, null, 3);
      if (newName) lastBasic = newName;
    },
    quest(kind, name, extra) {
      if (kind === 'started') pushBanner(banner('banner-quest', 'NEW QUEST', name, extra || '', iconCanvas('book', 'icon-xl')), 2600, 'ui_ok');
      else if (kind === 'done') pushBanner(banner('banner-quest done', 'QUEST COMPLETE!', name, extra || '', iconCanvas('star', 'icon-xl')), 3000, 'levelup');
      else pushBanner(banner('banner-quest small', 'QUEST UPDATED', name, extra || '', null), 2000);
    },
    letterbox(on) { setClass(hudEl, 'letterboxed', !!on); },
    /** Truth check each poll: bars follow the cutscene runner, not only the event. */
    reconcileLetterbox(game) {
      const cs = game && game.cutscene;
      const on = !!(cs && cs.letterbox && cs.active);
      if (hudEl.classList.contains('letterboxed') !== on) setClass(hudEl, 'letterboxed', on);
    },
    /** Show the skip hint while a skippable cutscene runs. */
    skippable(on) { if (skipHint.hidden === !!on) skipHint.hidden = !on; },
    transition(phase) {
      if (phase === 'out') { fade.classList.add('instant'); fade.classList.add('on'); void fade.offsetWidth; fade.classList.remove('instant'); }
      else { fade.classList.remove('on'); }
    },
    zoneCard(name, sub) {
      if (!name) return;
      setText(cardName, name);
      setText(cardSub, sub || '');
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].zone) queue.splice(i, 1);   // only the latest zone card
      enqueue({ prio: 0, ms: 2400, zone: true, start: () => {
        card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
        return () => card.classList.remove('show');
      } });
    },
    dispose() { for (const n of [bannerHost, boss, tut, prompt, lbTop, lbBot, fade, card, vignette, skipHint]) n.remove(); },
  };
  return api;
}

export default createFeedback;
