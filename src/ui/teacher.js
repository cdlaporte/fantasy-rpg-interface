// Teacher mode (round 2, package A): PIN pad, teacher options (title screen), teacher tools (pause menu), badge.
// A classroom lock, not real security: the PIN is config.teacherPin and the unlock is remembered only for this
// browser session (sessionStorage), so a student who sits down later has to type it again.
//
//   createPinPad({pin, sfx, onSuccess, onCancel})                         -> {el, key(e), destroy()}
//   createTeacherOptions({storage, saves, sfx, questions, onPlay, onBack})  -> {el, key(e), destroy()}
//       onPlay({continueSave: json|null, name})  (the title turns it into a teacher game)
//   createTeacherTools(game, {sfx, onClose})                              -> {el, key(e), destroy()}
//   teacherBadge()                                                       -> element
// Pure helpers (Node-safe): teacher save names, topic / question settings in storage.
import { el, add, setText, setClass, clear } from './dom.js';
import { hints, shake, CLASS_COLORS } from './modalKit.js';
import { TOPICS } from '../questions/unit4/index.js';
import { createStorage, createMemoryStorage } from '../platform/storage.js';
import { keyLabel } from '../platform/bindings.js';

export const TOPICS_KEY = 'flinkerton.settings.topics';
export const QUESTIONS_KEY = 'flinkerton.settings.questions';
export const UNLOCK_KEY = 'flinkerton.teacher.unlocked';
/** Teacher games save under "<name> (teacher)": a student cannot type the brackets, so never overwrites one. */
export const TEACHER_TAG = ' (teacher)';

// ---------------------------------------------------------------------------------------------------- pure helpers

export function isTeacherSave(save) { return !!(save && save.flags && save.flags.teacher_game); }
export function teacherSaveName(name) {
  const n = String(name || 'Teacher');
  return n.endsWith(TEACHER_TAG) ? n : n + TEACHER_TAG;
}
export function displayName(name) {
  const n = String(name || '');
  return n.endsWith(TEACHER_TAG) ? n.slice(0, -TEACHER_TAG.length) : n;
}

/** Enabled topic ids from storage, or null (= every topic). */
export function loadTopics(storage) {
  const v = storage && storage.getJSON ? storage.getJSON(TOPICS_KEY) : null;
  if (!Array.isArray(v)) return null;
  const ids = TOPICS.map((t) => t.id);
  const on = v.filter((id) => ids.includes(id));
  return on.length && on.length < ids.length ? on : null;
}
export function saveTopics(storage, topics) {
  if (!storage || !storage.setJSON) return;
  if (topics == null) storage.remove(TOPICS_KEY); else storage.setJSON(TOPICS_KEY, topics);
}
/** Teacher switch for questions: true (default) or false. */
export function loadQuestionsOn(storage) { return !(storage && storage.get && storage.get(QUESTIONS_KEY) === 'off'); }
export function saveQuestionsOn(storage, on) { if (storage && storage.set) storage.set(QUESTIONS_KEY, on ? 'on' : 'off'); }

/**
 * Apply the teacher's classroom settings to the shared Questions object (main.js at boot, and the options screen
 * when changed). A URL `questions=` parameter wins over the switch.
 */
export function applyQuestionSettings(questions, storage, params = {}, base = null) {
  if (!questions) return;
  questions.topics = loadTopics(storage);
  if (!params.questions) {
    if (!loadQuestionsOn(storage)) questions.mode = 'off';
    else if (base && questions.mode === 'off') questions.mode = base;
  }
}

let sessionStore = null;
function session() {
  if (sessionStore) return sessionStore;
  try { sessionStore = globalThis.sessionStorage ? createStorage(globalThis.sessionStorage) : createMemoryStorage(); } catch { sessionStore = createMemoryStorage(); }
  return sessionStore;
}
export function isTeacherUnlocked() { return session().get(UNLOCK_KEY) === '1'; }
export function setTeacherUnlocked(on) { if (on) session().set(UNLOCK_KEY, '1'); else session().remove(UNLOCK_KEY); }

// ---------------------------------------------------------------------------------------------------- shared nav
// A 2D grid of buttons: rows of cells; arrows move (left/right within a row, up/down keep the column), Enter clicks.
function gridNav(rows, sfx) {
  let r = 0, c = 0;
  const live = () => rows.filter((row) => row.length);
  const api = {
    get cell() { const rs = live(); return rs[r] && rs[r][c]; },
    set(nr, nc, quiet) {
      const rs = live();
      if (!rs.length) return;
      const old = api.cell;
      r = Math.max(0, Math.min(rs.length - 1, nr));
      c = Math.max(0, Math.min(rs[r].length - 1, nc));
      const now = api.cell;
      if (old && old !== now) setClass(old, 'sel', false);
      if (now) setClass(now, 'sel', true);
      if (!quiet && old !== now) sfx('ui_move');
    },
    move(dr, dc) {
      const rs = live();
      if (dr) {
        const old = rs[r];
        const frac = old.length > 1 ? c / (old.length - 1) : 0;
        const nr = Math.max(0, Math.min(rs.length - 1, r + dr));
        api.set(nr, Math.round(frac * (rs[nr].length - 1)));
      } else api.set(r, (c + dc + rs[r].length) % rs[r].length);
    },
    find(node) {
      const rs = live();
      for (let i = 0; i < rs.length; i++) { const j = rs[i].indexOf(node); if (j >= 0) return [i, j]; }
      return null;
    },
    hook(node) {
      node.addEventListener('mouseenter', () => { const p = api.find(node); if (p) api.set(p[0], p[1], true); });
    },
    key(e, onOk) {
      const k = e.code;
      if (k === 'ArrowUp' || k === 'KeyW') { api.move(-1, 0); return true; }
      if (k === 'ArrowDown' || k === 'KeyS') { api.move(1, 0); return true; }
      if (k === 'ArrowLeft' || k === 'KeyA') { api.move(0, -1); return true; }
      if (k === 'ArrowRight' || k === 'KeyD') { api.move(0, 1); return true; }
      if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') { if (!e.repeat && api.cell) onOk(api.cell); return true; }
      return false;
    },
  };
  return api;
}

function button(text, cls) {
  const b = el('button', 'tch-btn' + (cls ? ' ' + cls : ''), text);
  b.type = 'button';
  return b;
}

// ---------------------------------------------------------------------------------------------------- PIN pad

export function createPinPad(opts = {}) {
  const pin = String(opts.pin || '');
  const sfx = opts.sfx || (() => {});
  let typed = '';
  let busy = false;
  const root = el('div', 'pin px-box');
  const title = el('div', 'pin-title pxfont', 'TEACHER OPTIONS');
  const sub = el('div', 'pin-sub', 'Enter the 4-digit teacher PIN.');
  const dots = el('div', 'pin-dots');
  const dotEls = [];
  for (let i = 0; i < Math.max(4, pin.length); i++) { const d = el('span', 'pin-dot'); dotEls.push(d); dots.appendChild(d); }
  const pad = el('div', 'pin-pad');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  const rows = [[], [], [], []];
  keys.forEach((k, i) => {
    const b = button(k === 'clear' ? 'Clear' : k === 'back' ? 'Back' : k, 'pin-key' + (k.length > 1 ? ' pin-word' : ' pxfont'));
    b.dataset.k = k;
    b.addEventListener('click', (e) => { e.preventDefault(); press(k); });
    pad.appendChild(b);
    rows[Math.floor(i / 3)].push(b);
  });
  const note = el('div', 'pin-note');
  add(root, title, sub, dots, pad, note, hints([['0', '-', '9', 'Type'], ['Bksp', 'Delete'], ['Esc', 'Back']]));
  const nav = gridNav(rows, sfx);
  for (const row of rows) for (const b of row) nav.hook(b);
  nav.set(0, 0, true);

  function render() { dotEls.forEach((d, i) => setClass(d, 'on', i < typed.length)); }
  function check() {
    if (typed === pin) {
      busy = true;
      setClass(root, 'ok', true);
      setText(note, 'Unlocked!');
      sfx('ui_ok');
      setTimeout(() => { if (opts.onSuccess) opts.onSuccess(); }, 250);
      return;
    }
    busy = true;
    sfx('ui_bad');
    setText(note, 'Wrong PIN. Try again.');
    shake(dots);
    shake(root);
    setTimeout(() => { typed = ''; busy = false; render(); }, 380);
  }
  function press(k) {
    if (busy) return;
    if (k === 'back') { if (typed.length) { typed = typed.slice(0, -1); sfx('ui_move'); render(); } else if (opts.onCancel) opts.onCancel(); return; }
    if (k === 'clear') { typed = ''; sfx('ui_move'); render(); return; }
    if (typed.length >= dotEls.length) return;
    typed += k;
    sfx('ui_move');
    setText(note, '');
    render();
    if (typed.length >= pin.length) check();
  }
  render();
  return {
    el: root,
    key(e) {
      const c = e.code;
      const d = /^(Digit|Numpad)([0-9])$/.exec(c);
      if (d) { if (!e.repeat) press(d[2]); return true; }
      if (c === 'Backspace' || c === 'Delete') { if (!busy && typed.length) { typed = typed.slice(0, -1); render(); } return true; }
      if (c === 'Escape') { if (opts.onCancel) opts.onCancel(); return true; }
      return nav.key(e, (b) => press(b.dataset.k));
    },
    /** For tests: the digits typed so far. */
    typed: () => typed,
    destroy() { root.remove(); },
  };
}

// ---------------------------------------------------------------------------------------------------- options

export function createTeacherOptions(opts = {}) {
  const storage = opts.storage || null;
  const sfx = opts.sfx || (() => {});
  const saves = opts.saves || [];
  let topics = loadTopics(storage);        // null = all
  let qOn = loadQuestionsOn(storage);
  const root = el('div', 'tch-opts px-box');
  const body = el('div', 'tch-body');
  add(root, el('div', 'tch-title pxfont', 'TEACHER OPTIONS'), body);
  const note = el('div', 'tch-note');
  const foot = hints([['↑', '↓', '←', '→', 'Choose'], ['Enter', 'OK'], ['Esc', 'Back']]);
  add(root, note, foot);
  let nav = null;
  let view = 'main';
  let actions = new Map();

  const topicOn = (id) => topics == null || topics.includes(id);
  function setTopic(id, on) {
    const all = TOPICS.map((t) => t.id);
    let cur = topics == null ? all.slice() : topics.slice();
    if (on && !cur.includes(id)) cur.push(id);
    if (!on) cur = cur.filter((x) => x !== id);
    if (!cur.length) return false;
    cur = all.filter((x) => cur.includes(x));
    topics = cur.length === all.length ? null : cur;
    saveTopics(storage, topics);
    if (opts.questions) opts.questions.topics = topics;
    return true;
  }
  function flash(t, kind) { setText(note, t); note.className = 'tch-note' + (kind ? ' ' + kind : ''); }

  function buildMain() {
    view = 'main';
    clear(body);
    actions = new Map();
    const rows = [];
    const act = (node, fn) => { actions.set(node, fn); node.addEventListener('click', (e) => { e.preventDefault(); const p = nav.find(node); if (p) nav.set(p[0], p[1], true); fn(node); }); return node; };

    const sPlay = el('div', 'tch-sec');
    sPlay.appendChild(el('div', 'tch-label pxfont', 'PLAY IN TEACHER MODE'));
    const pr = el('div', 'tch-row');
    const bNew = act(button('New teacher game', 'tch-play'), () => { sfx('ui_ok'); opts.onPlay({ continueSave: null }); });
    const bCont = act(button('Continue a save…', 'tch-play'), () => { if (!saves.length) { sfx('ui_bad'); shake(bCont); flash('There are no saved games yet.', 'bad'); return; } sfx('ui_ok'); buildSaves(); });
    bCont.disabled = !saves.length;
    add(pr, bNew, bCont);
    add(sPlay, pr, el('div', 'tch-hint', 'Teacher games are saved separately, with "(teacher)" after the name. Student saves are never changed.'));
    rows.push([bNew, bCont]);

    const sQ = el('div', 'tch-sec');
    sQ.appendChild(el('div', 'tch-label pxfont', 'MATH QUESTIONS'));
    const bQ = act(button('', 'tch-toggle tch-q'), () => {
      qOn = !qOn; saveQuestionsOn(storage, qOn);
      if (opts.questions && opts.onQuestions) opts.onQuestions(qOn);
      sfx('ui_ok'); refresh();
    });
    add(sQ, bQ);
    rows.push([bQ]);

    const sT = el('div', 'tch-sec');
    sT.appendChild(el('div', 'tch-label pxfont', 'UNIT 4 TOPICS'));
    const tg = el('div', 'tch-topics');
    const topicBtns = [];
    for (const t of TOPICS) {
      const b = act(button('', 'tch-toggle tch-topic'), () => {
        if (!setTopic(t.id, !topicOn(t.id))) { sfx('ui_bad'); shake(b); flash('At least one topic stays on.', 'bad'); return; }
        sfx('ui_ok'); flash(''); refresh();
      });
      b.dataset.topic = t.id;
      b.__topic = t;
      add(b, el('span', 'tch-check'), el('span', 'tch-day pxfont', 'DAY ' + t.day), el('span', 'tch-tname', t.name));
      tg.appendChild(b);
      topicBtns.push(b);
    }
    sT.appendChild(tg);
    for (let i = 0; i < topicBtns.length; i += 2) rows.push(topicBtns.slice(i, i + 2));

    const bBack = act(button('Back', 'tch-back pxfont'), () => { sfx('ui_move'); opts.onBack && opts.onBack(); });
    const backRow = el('div', 'tch-row tch-row-end');
    backRow.appendChild(bBack);
    rows.push([bBack]);
    add(body, sPlay, sQ, sT, backRow);

    function refresh() {
      bQ.textContent = '';
      add(bQ, el('span', 'tch-check'), el('span', null, qOn ? 'Questions: ON' : 'Questions: OFF (no math questions anywhere)'));
      setClass(bQ, 'on', qOn);
      for (const b of topicBtns) { setClass(b, 'on', topicOn(b.__topic.id)); setClass(b, 'dim', !qOn); }
    }
    refresh();
    nav = gridNav(rows, sfx);
    for (const row of rows) for (const b of row) nav.hook(b);
    nav.set(0, 0, true);
  }

  function buildSaves() {
    view = 'saves';
    clear(body);
    actions = new Map();
    body.appendChild(el('div', 'tch-label pxfont', 'CONTINUE IN TEACHER MODE'));
    body.appendChild(el('div', 'tch-hint', 'A student save is copied into a new teacher save; the original is not changed.'));
    const list = el('div', 'tch-saves');
    const rows = [];
    for (const s of saves) {
      const b = button('', 'tch-save');
      const teach = isTeacherSave(s.save);
      add(b, el('span', 'tch-sname pxfont', displayName(s.name)),
        el('span', 'tch-smeta', [s.level ? 'Level ' + s.level : '', s.zone || '', teach ? 'teacher save' : 'student save'].filter(Boolean).join(' · ')));
      const fn = () => { sfx('ui_ok'); opts.onPlay({ continueSave: s.save, name: s.name }); };
      actions.set(b, fn);
      b.addEventListener('click', (e) => { e.preventDefault(); fn(); });
      list.appendChild(b);
      rows.push([b]);
    }
    const back = button('Back', 'tch-back pxfont');
    const backFn = () => { sfx('ui_move'); buildMain(); };
    actions.set(back, backFn);
    back.addEventListener('click', (e) => { e.preventDefault(); backFn(); });
    rows.push([back]);
    add(body, list, back);
    nav = gridNav(rows, sfx);
    for (const row of rows) for (const b of row) nav.hook(b);
    nav.set(0, 0, true);
  }

  buildMain();
  return {
    el: root,
    key(e) {
      if (e.code === 'Escape' || (e.code === 'Backspace' && view === 'saves')) {
        if (view === 'saves') { sfx('ui_move'); buildMain(); } else { sfx('ui_move'); if (opts.onBack) opts.onBack(); }
        return true;
      }
      return nav.key(e, (b) => { const fn = actions.get(b); if (fn) fn(b); });
    },
    destroy() { root.remove(); },
  };
}

// ---------------------------------------------------------------------------------------------------- tools

const CLASS_SPECS = { warrior: ['knight', 'berserker', 'battlemage'], mage: ['conjurer', 'sorcerer', 'monk'], rogue: ['archer', 'thief', 'ninja'] };

/** Pause menu "Teacher tools": xp, levels, any class / subclass, god mode, gold, go to a place. */
export function createTeacherTools(game, opts = {}) {
  const sfx = opts.sfx || (() => {});
  const T = game.sys.debug && game.sys.debug.teacher;
  const pr = game.sys.progression;
  const cap = (game.config && game.config.levelCap) || 12;
  const root = el('div', 'tch-tools px-box');
  const status = el('div', 'tch-status');
  const note = el('div', 'tch-note');
  const grid = el('div', 'tch-grid');
  add(root, el('div', 'tch-title pxfont', 'TEACHER TOOLS'), status, grid, note,
    hints([['↑', '↓', '←', '→', 'Choose'], ['Enter', 'Do it'], ['Esc', 'Back']]));
  const rows = [];
  const actions = new Map();
  const marks = [];   // [button, () => bool on]

  function flash(t, kind) { setText(note, t); note.className = 'tch-note' + (kind ? ' ' + kind : ''); note.classList.remove('pop'); void note.offsetWidth; note.classList.add('pop'); }
  function line(label, buttons, cls) {
    const r = el('div', 'tch-line' + (cls ? ' ' + cls : ''));
    add(r, el('div', 'tch-llabel pxfont', label));
    const box = el('div', 'tch-lbtns');
    for (const b of buttons) box.appendChild(b);
    r.appendChild(box);
    grid.appendChild(r);
    rows.push(buttons);
  }
  function btn(text, fn, cls, on) {
    const b = button(text, cls);
    actions.set(b, fn);
    b.addEventListener('click', (e) => { e.preventDefault(); const p = nav.find(b); if (p) nav.set(p[0], p[1], true); run(b); });
    if (on) marks.push([b, on]);
    return b;
  }
  function run(b) {
    const fn = actions.get(b);
    if (!fn) return;
    let r;
    try { r = fn(); } catch (e) { console.warn('[teacher] tool failed', e); r = false; }
    if (r === false) { sfx('ui_bad'); shake(b); } else sfx('ui_ok');
    refresh();
  }

  const nameOf = (id, spec) => { const d = spec ? pr.specDef(id) : pr.classDef(id); return (d && d.name) || id; };

  line('XP & LEVEL', [
    btn('+100 XP', () => { T.addXp(100); flash(`+100 XP (level ${pr.level})`, 'good'); }),
    btn('+1000 XP', () => { T.addXp(1000); flash(`+1000 XP (level ${pr.level})`, 'good'); }),
    btn('Level up', () => { if (!T.levelUp()) { flash(`Level ${cap} is the top.`, 'bad'); return false; } flash(`Level ${pr.level}!`, 'good'); return true; }),
    btn('Level down', () => { if (!T.levelDown()) { flash('Level 1 is the bottom.', 'bad'); return false; } flash(`Down to level ${pr.level}.`, 'good'); return true; }),
  ]);
  const lv = [];
  for (let i = 1; i <= cap; i++) lv.push(btn(String(i), () => { T.setLevel(i); flash(`Level set to ${i}.`, 'good'); }, 'tch-num pxfont', () => pr.level === i));
  line('SET LEVEL', lv, 'tch-levels');
  const classes = ['warrior', 'mage', 'rogue'].filter((id) => pr.classDef(id));
  line('CLASS', classes.map((id) => btn(nameOf(id), () => { if (!T.setClass(id)) return false; flash(`Now a ${nameOf(id)} at level ${pr.level}.`, 'good'); return true; },
    'tch-class', () => pr.classId === id && !pr.specId)).map((b, i) => { b.style.setProperty('--cc', CLASS_COLORS[classes[i]] || '#9a8a7a'); return b; }));
  for (const c of classes) {
    const specs = (CLASS_SPECS[c] || []).filter((id) => pr.specDef(id));
    line(nameOf(c).toUpperCase() + ' SUBCLASS', specs.map((id) => {
      const b = btn(nameOf(id, true), () => { if (!T.setSpec(id)) return false; flash(`Now a ${nameOf(id, true)} (${nameOf(c)}) at level ${pr.level}.`, 'good'); return true; },
        'tch-class', () => pr.specId === id);
      b.style.setProperty('--cc', CLASS_COLORS[id] || '#9a8a7a');
      b.dataset.spec = id;
      return b;
    }));
  }
  line('CHEATS', [
    btn('', () => { const on = !T.isGod(); T.god(on); flash(on ? 'God mode on: you cannot be hurt.' : 'God mode off.', 'good'); }, 'tch-god', () => T.isGod()),
    btn('+500 gold', () => { T.gold(500); flash('+500 gold.', 'good'); }),
  ]);
  const places = T ? T.places() : [];
  const go = places.map((p) => btn(p.name, () => {
    const r = T.goTo(p.id);
    if (opts.onClose) opts.onClose(true);
    return !!(r && r.ok !== undefined);
  }, 'tch-go'));
  line('GO TO', go.slice(0, 3));
  line('', go.slice(3));
  line('', [btn('Back', () => { if (opts.onClose) opts.onClose(); }, 'tch-back pxfont')]);

  const nav = gridNav(rows, sfx);
  for (const row of rows) for (const b of row) nav.hook(b);
  nav.set(0, 0, true);

  let destroyed = false;
  function refresh() {
    if (destroyed) return;
    const cls = pr.classId ? nameOf(pr.classId) : 'No class';
    const sp = pr.specId ? ' · ' + nameOf(pr.specId, true) : '';
    setText(status, `Level ${pr.level} · ${cls}${sp} · XP ${pr.xp}/${pr.xpNext} · Rank ${pr.rank()} · Boons ${pr.boons.length}${pr.pendingBoons ? ` (+${pr.pendingBoons} to pick with ${keyLabel('boon')})` : ''}`);
    for (const [b, on] of marks) setClass(b, 'on', !!on());
    const godBtn = grid.querySelector('.tch-god');
    if (godBtn) godBtn.textContent = `God mode: ${T && T.isGod() ? 'On' : 'Off'}`;
  }
  refresh();

  return {
    el: root,
    key(e) {
      if (e.code === 'Escape') { sfx('ui_move'); if (opts.onClose) opts.onClose(); return true; }
      return nav.key(e, (b) => run(b)) || true;
    },
    refresh,
    destroy() { destroyed = true; root.remove(); },
  };
}

/** The small "TEACHER" badge shown during a teacher game. */
export function teacherBadge() {
  const b = el('div', 'teacher-badge pxfont', 'TEACHER');
  b.title = 'Teacher mode: questions show their answers; Teacher tools are in the pause menu.';
  return b;
}
