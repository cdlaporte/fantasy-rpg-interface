// Quest log modal ({type: 'questLog'}), round 3 package G. Opened with Q, from the pause menu and by clicking the
// panel's quest box. Two tabs (Active, Completed), a list on the left, a detail pane on the right (giver, steps with
// their state, rewards, Track button). Reads game.quests (active/done/step/progress/goal/track/tracked) and the quest
// defs in game.data.quests; acts only through game.quests.track(id) and game.commands.closeModal().
// The pure helpers (questEntries, stepViews, normalizeRewards, goalNeed) are exported for node tests.
import { el, add, clear, setClass, keycap } from './dom.js';
import { iconCanvas } from './icons.js';
import { K, selectable, hints, livePortrait, shake } from './modalKit.js';
import { tip } from './tooltip.js';
import { fmtNum } from './format.js';

export const EMPTY_TEXT = 'No quests yet. Talk to people around Flinkerton!';
const HIDDEN_STEP = '???';

/** How many of the current step's goal are needed (kill / collect counts), or 0 when the goal is not a counter. */
export function goalNeed(goal) {
  if (!goal || (goal.type !== 'kill' && goal.type !== 'collect')) return 0;
  const n = goal.n == null ? 1 : Math.max(1, goal.n | 0);
  return n > 1 ? n : 0;
}

/** Rewards of a quest def as {xp, gold, items: [{id, name, icon, desc, n}]} (items may be ids, [id, n], {id, n} or a map). */
export function normalizeRewards(rewards, itemDefs = {}) {
  const r = rewards || {};
  const list = [];
  const raw = r.items;
  if (Array.isArray(raw)) {
    for (const it of raw) {
      if (typeof it === 'string') list.push([it, 1]);
      else if (Array.isArray(it)) list.push([it[0], it[1] == null ? 1 : it[1]]);
      else if (it && typeof it === 'object') list.push([it.id || it.item, it.n == null ? 1 : it.n]);
    }
  } else if (raw && typeof raw === 'object') for (const k of Object.keys(raw)) list.push([k, raw[k]]);
  else if (typeof raw === 'string') list.push([raw, 1]);
  const items = list.filter(([id, n]) => id && n > 0).map(([id, n]) => {
    const d = itemDefs[id] || {};
    return { id, n, name: d.name || id, icon: d.icon || 'potion', desc: d.desc || '' };
  });
  return { xp: r.xp > 0 ? r.xp | 0 : 0, gold: r.gold > 0 ? r.gold | 0 : 0, items };
}

/**
 * The steps of a quest for display. status 'active' marks steps before `stepIndex` done, the step itself current (with
 * "n/need" when it counts something) and the later ones upcoming; the first `reveal` upcoming steps show their text and
 * the rest read "???" so later parts of the story are not spoiled. status 'done' marks every step done.
 */
export function stepViews(def, status, stepIndex, progress = 0, need = 0, reveal = 1) {
  const steps = (def && Array.isArray(def.steps)) ? def.steps : [];
  const out = [];
  let ahead = 0;
  for (let i = 0; i < steps.length; i++) {
    const text = (steps[i] && steps[i].text) || '';
    if (status === 'done' || i < stepIndex) out.push({ index: i, state: 'done', text, count: '' });
    else if (i === stepIndex) out.push({ index: i, state: 'current', text, count: need > 1 ? `${Math.min(progress | 0, need)}/${need}` : '' });
    else { out.push({ index: i, state: 'todo', text: ahead < reveal ? text : HIDDEN_STEP, count: '' }); ahead++; }
  }
  return out;
}

/** First zone named by a goal of the quest (to show where it takes place), or ''. */
export function questZone(def) {
  const steps = (def && def.steps) || [];
  for (const s of steps) {
    const g = s && s.goal;
    const z = g && (g.zone || (g.reach && g.reach.zone) || (g.kill && g.kill.zone) || (Array.isArray(g) && g[1] && g[1].zone));
    if (z) return String(z);
  }
  return '';
}

/**
 * Entries for both tabs: {active: [...], done: [...]}; each {id, name, giver, giverName, zone, zoneName, status, stepIndex,
 * stepCount, progress, need, tracked, hint}. Quests without a definition are skipped.
 */
export function questEntries(game) {
  const out = { active: [], done: [] };
  const qs = game && game.quests;
  if (!qs || !qs.active) return out;
  const data = game.data || {};
  const defs = data.quests || {};
  const npcs = data.npcs || {};
  const zones = data.zones || {};
  const build = (id, status) => {
    const def = defs[id];
    if (!def || typeof def !== 'object') return null;
    const stepIndex = status === 'done' ? (def.steps || []).length : Math.max(0, qs.step(id));
    const goal = status === 'active' && qs.goal ? qs.goal(id) : null;
    const need = goalNeed(goal);
    const progress = status === 'active' ? qs.progress(id) : 0;
    const npc = def.giver ? npcs[def.giver] : null;
    const zone = questZone(def);
    const count = (def.steps || []).length;
    let hint = '';
    if (status === 'done') hint = 'Done';
    else if (need > 1) hint = `${Math.min(progress | 0, need)}/${need}`;
    else if (count > 1) hint = `Step ${Math.min(stepIndex + 1, count)}/${count}`;
    return {
      id, name: def.name || id, giver: def.giver || '', giverName: npc ? npc.name : (def.giver || ''),
      zone, zoneName: zone && zones[zone] ? (zones[zone].name || zone) : '', status, stepIndex, stepCount: count,
      progress, need, tracked: status === 'active' && qs.tracked === id, hint,
    };
  };
  for (const id of qs.active()) { const e = build(id, 'active'); if (e) out.active.push(e); }
  for (const id of qs.done()) { const e = build(id, 'done'); if (e) out.done.push(e); }
  // the tracked quest first, then the rest from newest to oldest (the core lists them oldest first)
  out.active.reverse();
  out.active.sort((a, b) => (b.tracked ? 1 : 0) - (a.tracked ? 1 : 0));
  out.done.reverse();
  return out;
}

export function createQuestLog(modal, ctx, prev) {
  const game = ctx.game;
  const itemDefs = (game.data && game.data.items) || {};
  const defs = (game.data && game.data.quests) || {};
  const npcs = (game.data && game.data.npcs) || {};
  const root = el('div', 'qlog');
  const box = el('div', 'qlog-box px-box');
  const tabs = el('div', 'qlog-tabs');
  const tabActive = el('div', 'inv-tab qlog-tab pxfont');
  const tabDone = el('div', 'inv-tab qlog-tab pxfont');
  add(tabs, tabActive, tabDone);
  const body = el('div', 'qlog-body');
  const list = el('div', 'qlog-list');
  const detail = el('div', 'qlog-detail');
  add(body, list, detail);
  const empty = el('div', 'qlog-empty');
  const foot = hints([['↑', '↓', 'Choose'], ['Enter', 'Track'], ['←', '→', 'Tab'], ['Q', 'Close']]);
  add(box, tabs, body, empty, foot);
  root.appendChild(box);

  let tab = prev && prev.tab === 'done' ? 'done' : 'active';
  let wantId = prev && prev.id ? prev.id : null;
  let data = questEntries(game);
  let sig = '';
  let sel = null;
  let shown = [];
  let portrait = null;

  const signature = () => JSON.stringify(data.active.map((e) => [e.id, e.stepIndex, e.progress, e.tracked]).concat(data.done.map((e) => e.id)));

  function setTab(t, quiet) {
    if (t === tab && sel) return;
    tab = t;
    wantId = null;
    if (!quiet) ctx.sfx('ui_move');
    build();
  }
  tabActive.addEventListener('click', () => setTab('active'));
  tabDone.addEventListener('click', () => setTab('done'));

  function build() {
    data = questEntries(game);
    sig = signature();
    clear(list);
    portrait = null;
    shown = tab === 'active' ? data.active : data.done;
    tabActive.textContent = `ACTIVE ${data.active.length}`;
    tabDone.textContent = `DONE ${data.done.length}`;
    setClass(tabActive, 'on', tab === 'active');
    setClass(tabDone, 'on', tab === 'done');
    const none = !data.active.length && !data.done.length;
    empty.textContent = none ? EMPTY_TEXT : '';
    empty.hidden = !none;
    body.hidden = none;
    const rows = shown.map((e) => {
      const r = el('div', 'qlog-row' + (e.tracked ? ' tracked' : '') + (e.status === 'done' ? ' isdone' : ''));
      const mark = el('span', 'qlog-mark pxfont', e.status === 'done' ? '✓' : e.tracked ? '★' : '');
      const txt = el('span', 'qlog-rtext');
      add(txt, el('span', 'qlog-rname', e.name), el('span', 'qlog-rsub', [e.zoneName || '', e.giverName ? 'from ' + e.giverName : ''].filter(Boolean).join(' · ')));
      add(r, mark, txt, el('span', 'qlog-hint pxfont', e.hint));
      list.appendChild(r);
      return r;
    });
    if (!rows.length && !none) list.appendChild(el('div', 'qlog-none', tab === 'active' ? 'No active quests. Talk to people!' : 'Nothing finished yet.'));
    let start = 0;
    if (wantId) { const k = shown.findIndex((e) => e.id === wantId); if (k >= 0) start = k; }
    sel = selectable(rows, {
      layout: 'vertical', sfx: ctx.sfx, digits: false, start,
      onMove: () => renderDetail(),
      onPick: () => track(),
    });
    renderDetail();
  }

  function current() { return shown[sel ? sel.index : -1] || null; }

  function track() {
    const e = current();
    if (!e || e.status !== 'active') { ctx.sfx('ui_bad'); if (sel && sel.items[sel.index]) shake(sel.items[sel.index]); return; }
    if (!e.tracked && game.quests && game.quests.track) {
      game.quests.track(e.id);
      wantId = e.id;
      build();
    }
  }

  function rewardChip(icon, text, tipData) {
    const c = el('div', 'qlog-reward');
    add(c, iconCanvas(icon, 'icon-md'), el('span', 'qlog-rtxt', text));
    if (tipData) tip(c, tipData);
    return c;
  }

  function renderDetail() {
    clear(detail);
    portrait = null;
    const e = current();
    if (!e) return;
    wantId = e.id;
    const def = defs[e.id] || {};
    const scroll = el('div', 'qlog-dscroll');
    detail.appendChild(scroll);
    const head = el('div', 'qlog-dhead');
    const npc = npcs[e.giver];
    if (npc && (npc.look || e.giver === 'laporte')) {
      const pf = el('div', 'qlog-portrait');
      portrait = livePortrait(e.giver === 'laporte' ? 'laporte' : npc.look, 'calm', 'parchment', 'qlog-portrait-canvas');
      pf.appendChild(portrait.canvas);
      head.appendChild(pf);
    }
    const t = el('div', 'qlog-dtitle');
    add(t, el('div', 'qlog-dname pxfont', e.name));
    add(t, el('div', 'qlog-dgiver', [e.giverName ? 'Given by ' + e.giverName : '', e.zoneName].filter(Boolean).join(' · ')));
    head.appendChild(t);
    scroll.appendChild(head);

    const steps = el('div', 'qlog-steps');
    for (const s of stepViews(def, e.status, e.stepIndex, e.progress, e.need)) {
      const row = el('div', 'qlog-step ' + s.state);
      add(row, el('span', 'qlog-check pxfont', s.state === 'done' ? '✓' : s.state === 'current' ? '▶' : '·'), el('span', 'qlog-stext', s.text));
      if (s.count) row.appendChild(el('span', 'qlog-count pxfont', s.count));
      steps.appendChild(row);
    }
    scroll.appendChild(steps);

    const rw = normalizeRewards(def.rewards, itemDefs);
    if (rw.xp || rw.gold || rw.items.length) {
      const wrap = el('div', 'qlog-rewards');
      wrap.appendChild(el('div', 'qlog-rtitle pxfont', e.status === 'done' ? 'REWARDS RECEIVED' : 'REWARDS'));
      const chips = el('div', 'qlog-chips');
      if (rw.xp) chips.appendChild(rewardChip('star', `${fmtNum(rw.xp)} XP`, { title: 'Experience', lines: ['Helps you level up.'] }));
      if (rw.gold) chips.appendChild(rewardChip('coin', `${fmtNum(rw.gold)} gold`, { title: 'Gold', lines: ['Spend it in the shops.'] }));
      for (const it of rw.items) chips.appendChild(rewardChip(it.icon, it.n > 1 ? `${it.name} x${it.n}` : it.name, { title: it.name, meta: it.n > 1 ? ['x' + it.n] : [], lines: [it.desc] }));
      wrap.appendChild(chips);
      scroll.appendChild(wrap);
    }

    if (e.status === 'active') {
      const btn = el('div', 'qlog-track' + (e.tracked ? ' on' : ''));
      if (e.tracked) add(btn, el('span', 'qlog-tlabel pxfont', '★ TRACKED'), el('span', 'qlog-tnote', 'shown on the side panel'));
      else add(btn, keycap('Enter'), el('span', 'qlog-tlabel pxfont', 'TRACK'), el('span', 'qlog-tnote', 'show it on the side panel'));
      btn.addEventListener('click', () => { ctx.sfx('ui_ok'); track(); });
      tip(btn, e.tracked ? { title: 'Tracked', lines: ['This quest is shown in the QUEST box on the side panel.'] } : { title: 'Track this quest', lines: ['Show it in the QUEST box on the side panel.'] });
      detail.appendChild(btn);
    }
  }

  build();

  return {
    el: root, layer: 'center', dim: true,
    tick(now) { if (portrait) portrait.draw(now / 1000); },
    refresh() {
      const next = questEntries(game);
      const s = JSON.stringify(next.active.map((e) => [e.id, e.stepIndex, e.progress, e.tracked]).concat(next.done.map((e) => e.id)));
      if (s !== sig) { const cur = current(); if (cur) wantId = cur.id; build(); }
    },
    state() { const e = current(); return { tab, id: e ? e.id : null }; },
    key(e) {
      const c = e.code;
      if (c === 'KeyQ' || K.back(c)) { if (!e.repeat) { ctx.sfx('ui_move'); game.commands.closeModal(); } return true; }
      if (K.left(c) || K.right(c) || c === 'Tab') {
        if (!e.repeat) setTab(tab === 'active' ? 'done' : 'active');
        return true;
      }
      return sel ? sel.key(e) : false;
    },
    destroy() { root.remove(); },
  };
}

export default createQuestLog;
