// Meta package. inventory (CONTRACTS 12, 12a): items, 6-slot hotbar, gold, cosmetics, item effects, shops,
// loot tables and chests, lessons. Item / shop / loot / lesson data is read from game.data at call time;
// unknown ids are tolerated with a one-time warning. See docs/notes/meta.md for the fields honored.

const HOTBAR = 6;
const HAGGLE_DISCOUNT = 0.2;
const LESSON_PAUSE = 0.9;      // seconds the lesson card shows the score between questions
const FOCUS_SECONDS = 6;

/** Used only for ids that data/items.js does not define (so the story's items work before content lands). */
export const FALLBACK_ITEMS = {
  potion_small: { id: 'potion_small', type: 'consumable', name: 'Small Potion', desc: 'Restores some health.', icon: 'potion', price: 12, stack: 20, cd: 1, use: { effect: 'heal', frac: 0.35, amount: 10 } },
  potion_big: { id: 'potion_big', type: 'consumable', name: 'Big Potion', desc: 'Restores a lot of health.', icon: 'potion', price: 30, stack: 20, cd: 1, use: { effect: 'heal', frac: 0.7, amount: 20 } },
  bread: { id: 'bread', type: 'consumable', name: 'Fresh Bread', desc: 'Heals slowly over 8 seconds.', icon: 'bread', price: 5, stack: 20, cd: 1, use: { effect: 'heal_over_time', frac: 0.4, dur: 8 } },
  bomb: { id: 'bomb', type: 'consumable', name: 'Bomb', desc: 'Throw it ahead. Stand back.', icon: 'bomb', price: 15, stack: 10, cd: 1.5, use: { effect: 'bomb', dmg: 3, r: 1.8, delay: 0.7, range: 2.5, knockback: 6 } },
  speed_tonic: { id: 'speed_tonic', type: 'consumable', name: 'Speed Tonic', desc: 'Run faster for 10 seconds.', icon: 'tonic', price: 18, stack: 10, cd: 2, use: { effect: 'haste', mult: 1.35, dur: 10 } },
  shield_charm: { id: 'shield_charm', type: 'consumable', name: 'Shield Charm', desc: 'A bubble that soaks up damage.', icon: 'charm', price: 20, stack: 10, cd: 2, use: { effect: 'shield', frac: 0.3, dur: 8 } },
  smoke_pellet: { id: 'smoke_pellet', type: 'consumable', name: 'Smoke Pellet', desc: 'Vanish in a puff of smoke.', icon: 'smoke', price: 14, stack: 10, cd: 2, use: { effect: 'smoke', r: 2, dur: 4 } },
  focus_scroll: { id: 'focus_scroll', type: 'consumable', name: 'Focus Scroll', desc: 'Answer correctly to refill your power and reset cooldowns.', icon: 'book', price: 40, stack: 5, cd: 3, use: { effect: 'resource', focus: true } },
};

const DEFAULT_PET_LOOK = { rig: 'quadruped', size: 0.55, colors: { body: '#ff9a3c', belly: '#fff1dc', accent: '#ffffff', eye: '#222222' }, features: ['tail_bushy', 'ears_pointy'], hero: null };
const NEGATIVE_STATUS = ['stun', 'slow', 'burn', 'frost', 'root', 'mark', 'venom'];

function cosmeticSlot(def) {
  if (!def) return null;
  if (def.slot) return def.slot;
  const l = def.look || {};
  if (l.hat) return 'hat';
  if (l.cape) return 'cape';
  return 'outfitColor';
}

function cosmeticPatch(def) {
  if (!def) return null;
  const slot = cosmeticSlot(def);
  if (def.look) return def.look;
  if (slot === 'outfitColor' && def.color) return { outfit: { primary: def.color } };
  if (slot === 'hat' && def.color) return { hat: { style: def.style || 'cap', color: def.color } };
  if (slot === 'cape' && def.color) return { cape: { color: def.color } };
  return null;
}

function compare(a, op, b) {
  switch (op) {
    case '>=': return a >= b; case '<=': return a <= b; case '>': return a > b; case '<': return a < b;
    case '==': case '=': case '===': return a === b; case '!=': case '!==': return a !== b;
    default: return false;
  }
}

export default {
  id: 'inventory',
  init(game) {
    const warned = new Set();
    const warn = (key, msg) => {
      if (warned.has(key)) return;
      warned.add(key);
      if (typeof console !== 'undefined') console.warn('[inventory] ' + msg);
    };
    const data = () => game.data || {};
    const emit = (e, p) => game.bus.emit(e, p);
    const sfx = (id) => emit('sfx', { id });
    const combat = () => game.sys.combat || null;
    const gates = () => game.sys.gates || null;
    const prog = () => game.sys.progression || null;

    const cds = {};                     // itemId -> {left, total}
    const buffs = [];                   // {kind, left, rate, acc}
    const useTick = new Array(HOTBAR).fill(-1);
    let addedHaste = false;
    let patchCache = null, patchDirty = true;
    let shop = null;                    // current visit {id, def, haggled, tried, suspended, modal, resolve}
    let lessonBusy = false;

    // ---------- defs ----------
    function itemDef(id) {
      const d = (data().items || {})[id];
      if (d) return d.id ? d : Object.assign({ id }, d);
      if (FALLBACK_ITEMS[id]) { warn('fb:' + id, `item ${id} missing from data/items.js; using a built-in fallback`); return FALLBACK_ITEMS[id]; }
      return null;
    }
    const itemName = (id) => { const d = itemDef(id); return (d && d.name) || id; };
    const isConsumable = (d) => !!d && (d.type === 'consumable' || (!d.type && !!d.use));

    // ---------- items ----------
    function count(id) {
      if (api.cosmetics.includes(id)) return 1;
      return api.items[id] || 0;
    }

    function autoSlot(id) {
      if (api.hotbar.includes(id)) return;
      const i = api.hotbar.indexOf(null);
      if (i >= 0) api.hotbar[i] = id;
    }

    function give(id, n = 1, opts = {}) {
      n = Math.floor(Number(n));
      if (!id || !(n > 0)) return 0;
      const def = itemDef(id);
      if (!def) warn('missing:' + id, `give: unknown item ${id} (kept as a plain item)`);
      if (def && def.type === 'cosmetic') {
        if (!api.cosmetics.includes(id)) api.cosmetics.push(id);
        n = 1;
      } else {
        const stack = def && def.stack ? def.stack : (def && def.type === 'key' ? 1 : 99);
        const have = api.items[id] || 0;
        const add = Math.max(0, Math.min(n, stack - have));
        if (add <= 0) { if (!opts.silent) game.toast(`You can't carry more ${itemName(id)}.`, 'info'); return 0; }
        api.items[id] = have + add;
        n = add;
        if (isConsumable(def)) autoSlot(id);
      }
      emit('item:gained', { id, n });
      if (!opts.silent) {
        sfx('pickup');
        game.toast(n > 1 ? `+${n} ${itemName(id)}` : `+ ${itemName(id)}`, 'loot');
      }
      refreshInventoryModal();
      refreshShop();
      return n;
    }

    function take(id, n = 1) {
      n = Math.floor(Number(n));
      if (!(n > 0)) return true;
      if (api.cosmetics.includes(id)) {
        api.cosmetics.splice(api.cosmetics.indexOf(id), 1);
        for (const s in api.equipped) if (api.equipped[s] === id) { api.equipped[s] = null; patchDirty = true; }
        refreshInventoryModal();
        return true;
      }
      const have = api.items[id] || 0;
      if (have < n) return false;
      if (have === n) {
        delete api.items[id];
        const i = api.hotbar.indexOf(id);
        if (i >= 0) api.hotbar[i] = null;
      } else api.items[id] = have - n;
      refreshInventoryModal();
      return true;
    }

    function addGold(n) {
      n = Math.round(Number(n) || 0);
      if (!n) return api.gold;
      const before = api.gold;
      api.gold = Math.max(0, api.gold + n);
      const amount = api.gold - before;
      if (amount) {
        emit('gold', { amount, total: api.gold });
        if (amount > 0) sfx('coin');
      }
      refreshShop();
      return api.gold;
    }
    function spend(n) {
      n = Math.round(n);
      if (n < 0 || api.gold < n) return false;
      addGold(-n);
      return true;
    }

    // ---------- hotbar ----------
    function assignSlot(id, i) {
      if (i === null || i === undefined || i < 0) {
        const j = api.hotbar.indexOf(id);
        if (j >= 0) api.hotbar[j] = null;
        refreshInventoryModal();
        return true;
      }
      i = i | 0;
      if (i < 0 || i >= HOTBAR) return false;
      if (id == null) { api.hotbar[i] = null; refreshInventoryModal(); return true; }
      const def = itemDef(id);
      if (!count(id) || (def && def.type === 'cosmetic')) return false;
      const j = api.hotbar.indexOf(id);
      if (j >= 0) api.hotbar[j] = api.hotbar[i];      // swap
      api.hotbar[i] = id;
      refreshInventoryModal();
      return true;
    }

    // ---------- buffs and stats ----------
    function setMod(key, mod) {
      const p = game.player;
      if (!p) return;
      if (!p.data.statMods) p.data.statMods = {};
      if (mod) p.data.statMods[key] = mod; else delete p.data.statMods[key];
      const pr = prog();
      if (pr && pr.recalc) pr.recalc();
    }
    function syncHasteTag() {
      const p = game.player;
      if (!p) return;
      const want = buffs.some((b) => b.kind === 'haste' || b.kind === 'focus');
      const has = p.fxTags.includes('haste');
      if (want && !has) { p.fxTags.push('haste'); addedHaste = true; }
      else if (!want && has && addedHaste) { p.fxTags.splice(p.fxTags.indexOf('haste'), 1); addedHaste = false; }
    }
    function addBuff(kind, seconds, extra) {
      for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i].kind === kind) buffs.splice(i, 1);
      buffs.push(Object.assign({ kind, left: seconds, acc: 0 }, extra));
      if (kind === 'haste') setMod('item_haste', { speed: extra.mult || 1.35 });
      if (kind === 'focus') setMod('focus', { power: 1.5 });
      syncHasteTag();
    }
    function endBuff(b) {
      if (b.kind === 'haste') setMod('item_haste', null);
      if (b.kind === 'focus') setMod('focus', null);
    }

    function heal(n) {
      const p = game.player;
      if (!p || n <= 0) return 0;
      const c = combat();
      const before = p.hp;
      if (c && typeof c.heal === 'function') c.heal(p, n, { source: p, tags: ['item'] });
      if (p.hp === before) p.hp = Math.min(p.hpMax, p.hp + n);   // stub combat
      return p.hp - before;
    }

    // ---------- effects ----------
    function focus(def) {
      const p = game.player;
      const k = game.sys.kits;
      const g = gates();
      const ask = g && g.ask ? g.ask({ context: 'focus', difficulty: (def.use && def.use.difficulty) || 2, tags: (def.use && def.use.tags) || [] })
        : Promise.resolve({ correct: true });
      return ask.then((r) => {
        if (!p) return r;
        const res = k && k.resource ? k.resource(p) : { value: 0, max: 0 };
        if (r && r.correct) {
          if (k && k.gain && res.max) k.gain(p, res.max - (res.value || 0));
          const ab = game.sys.abilities;
          const reset = ab && (ab.resetCooldowns || ab.resetAll || ab.reset);
          if (typeof reset === 'function') reset.call(ab, p);
          else if (p.data.cd && typeof p.data.cd === 'object') for (const s in p.data.cd) p.data.cd[s] = 0;
          addBuff('focus', FOCUS_SECONDS, {});
          game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1, color: '#7fe7ff', dur: 0.8 });
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 20, r: 1.2, color: '#7fe7ff' });
          sfx('spell');
          game.toast('Focus! Power restored, cooldowns reset.', 'good');
        } else {
          if (k && k.gain && res.max) k.gain(p, Math.round(res.max * 0.25));
          game.toast('Your focus wavers... a little power trickles back.', 'info');
        }
        return r;
      });
    }

    /** Returns false to refuse (item not consumed). */
    function applyEffect(def) {
      const p = game.player;
      if (!p) return false;
      const u = def.use || {};
      const c = combat();
      switch (u.effect) {
        case 'heal': {
          if (p.hp >= p.hpMax) { game.toast('You are already at full health.', 'info'); return false; }
          const n = Math.round((u.amount || 0) + (u.frac || 0) * p.hpMax) || 10;
          heal(n);
          game.fx({ type: 'heal', x: p.x, y: p.y });
          game.fx({ type: 'text', x: p.x, y: p.y, text: '+' + n, style: 'heal', ent: p.id });
          return true;
        }
        case 'heal_over_time': {
          const dur = u.dur || 8;
          const total = (u.amount || 0) + (u.frac || 0) * p.hpMax || 10;
          addBuff('hot', dur, { rate: total / dur });
          game.fx({ type: 'heal', x: p.x, y: p.y });
          return true;
        }
        case 'bomb': {
          const range = u.range ?? 2.5;
          const ang = p.angle || 0;
          const x = p.x + Math.cos(ang) * range, y = p.y + Math.sin(ang) * range;
          if (c && typeof c.aoe === 'function') {
            c.aoe(p, { x, y, r: u.r || 1.8, dmg: u.dmg ?? 3, knockback: u.knockback ?? 6, type: 'magic', element: u.element || 'fire',
              fx: 'meteor', delay: u.delay ?? 0.7, telegraph: true, tags: ['item', 'bomb'] });
          } else {
            game.fx({ type: 'meteor', x, y, r: u.r || 1.8, color: '#ff8a3c' });
          }
          sfx('swing');
          return true;
        }
        case 'haste': {
          addBuff('haste', u.dur || 10, { mult: u.mult || 1.35 });
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 12, r: 0.8, color: '#9be7ff' });
          return true;
        }
        case 'shield': {
          const amount = Math.round((u.amount || 0) + (u.frac || 0) * p.hpMax) || 10;
          const dur = u.dur || 8;
          if (c && typeof c.status === 'function') c.status(p, 'shield', dur, amount);
          if (!(p.status.shield > 0)) { p.status.shield = dur; p.statusPower.shield = amount; }
          game.fx({ type: 'ring', x: p.x, y: p.y, r: 1, color: '#8fd3ff', dur: 0.5 });
          return true;
        }
        case 'cure': {
          for (const k of NEGATIVE_STATUS) if (p.status[k]) p.status[k] = 0;
          for (const t of ['burn', 'frost', 'stun', 'mark', 'venom']) { const i = p.fxTags.indexOf(t); if (i >= 0) p.fxTags.splice(i, 1); }
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 14, r: 0.9, color: '#c8ffb0' });
          return true;
        }
        case 'smoke': {
          const r = u.r || 2, dur = u.dur || 4;
          if (c && typeof c.zone === 'function') c.zone(p, { x: p.x, y: p.y, r, dur, tick: 0.5, dmg: 0, status: 'slow', look: { rig: 'effect', model: 'smoke', r } });
          if (c && typeof c.status === 'function') c.status(p, 'stealth', dur);
          if (!(p.status.stealth > 0)) p.status.stealth = dur;
          game.fx({ type: 'smoke', x: p.x, y: p.y, r, dur });
          game.fx({ type: 'poof', x: p.x, y: p.y, color: '#cfd2dc' });
          return true;
        }
        case 'xp': {
          const pr = prog();
          const n = u.amount || 10;
          if (pr && pr.addXp) pr.addXp(n);
          game.fx({ type: 'text', x: p.x, y: p.y, text: `+${n} XP`, style: 'xp', ent: p.id });
          return true;
        }
        case 'summon_pet': {
          const ents = game.ents;
          if (!ents || !ents.spawn) return false;
          const kind = u.kind || 'pet';
          const known = (data().enemies || {})[kind] || (data().npcs || {})[kind];
          const ang = (p.angle || 0) + Math.PI;
          const pet = ents.spawn(kind, p.x + Math.cos(ang) * 0.9, p.y + Math.sin(ang) * 0.9, {
            type: 'summon', team: 'player', owner: p.id, ttl: u.dur || 30, name: u.name || (known && known.name) || 'Pet',
            look: u.look || (known && known.look) || DEFAULT_PET_LOOK, tags: ['pet', 'summoned'], fxTags: ['summoned'],
            hp: u.hp || 30, hpMax: u.hp || 30,
            stats: { power: Math.max(1, (p.stats.power || 2) * (u.powerFrac || 0.5)), defense: 0, speed: u.speed || 4, radius: 0.3 },
            ai: { brain: u.brain || 'chaser', aggro: 6, leash: 8 },
          });
          if (pet && pet.data) pet.data.pet = true;
          game.fx({ type: 'poof', x: pet ? pet.x : p.x, y: pet ? pet.y : p.y, color: '#ffffff' });
          return true;
        }
        case 'resource': {
          if (u.focus || u.gate === 'focus' || def.id === 'focus_scroll') { focus(def); return true; }
          const k = game.sys.kits;
          if (!k || !k.resource) return false;
          const res = k.resource(p);
          if (!res.max) { game.toast('You have nothing to refill yet.', 'info'); return false; }
          const n = u.full ? res.max : (u.amount ?? Math.round(res.max * (u.frac ?? 0.5)));
          if (k.gain) k.gain(p, n);
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 12, r: 0.8, color: '#9fb8ff' });
          return true;
        }
        default:
          warn('effect:' + u.effect, `item ${def.id} has unknown effect ${u.effect}`);
          return false;
      }
    }

    function useItem(id) {
      if (!id || count(id) <= 0) return false;
      const def = itemDef(id);
      if (!def || !def.use) return false;
      if (cds[id] && cds[id].left > 0) return false;
      if (!applyEffect(def)) return false;
      take(id, 1);
      const cd = def.cd ?? 1;
      if (cd > 0) cds[id] = { left: cd, total: cd };
      sfx('pickup');
      emit('item:used', { id });
      return true;
    }

    function useSlot(i) {
      i = i | 0;
      if (i < 0 || i >= HOTBAR) return false;
      useTick[i] = game.tick;
      return useItem(api.hotbar[i]);
    }

    // ---------- cosmetics ----------
    function equippedLookPatch() {
      if (!patchDirty) return patchCache;
      patchDirty = false;
      let out = null;
      for (const slot of ['outfitColor', 'cape', 'hat']) {
        const id = api.equipped[slot];
        if (!id) continue;
        const patch = cosmeticPatch(itemDef(id));
        if (!patch) continue;
        out = out || {};
        for (const k in patch) {
          const v = patch[k];
          out[k] = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign({}, out[k], v) : v;
        }
      }
      patchCache = out;
      return out;
    }

    function equipCosmetic(id, slotArg) {
      if (id == null) {
        if (slotArg && api.equipped[slotArg] !== undefined) {
          const prev = api.equipped[slotArg];
          api.equipped[slotArg] = null;
          patchDirty = true;
          afterCosmetic(prev, slotArg, false);
          return true;
        }
        return false;
      }
      if (!api.cosmetics.includes(id)) return false;
      const def = itemDef(id);
      const slot = cosmeticSlot(def) || 'hat';
      const on = api.equipped[slot] !== id;
      api.equipped[slot] = on ? id : null;
      patchDirty = true;
      afterCosmetic(id, slot, on);
      return true;
    }
    function afterCosmetic(id, slot, on) {
      const pr = prog();
      if (pr && pr.refreshLook) pr.refreshLook();
      const p = game.player;
      if (p && on) game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 10, r: 0.8, color: '#ffe680' });
      emit('cosmetic:equipped', { id, slot, equipped: on });
      refreshInventoryModal();
    }

    // ---------- inventory modal ----------
    function inventoryPayload() {
      const items = [];
      for (const id in api.items) {
        if (!(api.items[id] > 0)) continue;
        const d = itemDef(id) || {};
        items.push({ id, name: d.name || id, desc: d.desc || '', icon: d.icon || 'star', type: d.type || 'key',
          count: api.items[id], slot: api.hotbar.indexOf(id), usable: !!d.use });
      }
      const cosmetics = api.cosmetics.map((id) => {
        const d = itemDef(id) || {};
        const slot = cosmeticSlot(d) || 'hat';
        return { id, name: d.name || id, desc: d.desc || '', icon: d.icon || 'hat', slot, equipped: api.equipped[slot] === id };
      });
      return { items, cosmetics, equipped: Object.assign({}, api.equipped), hotbar: api.hotbar.slice(), gold: api.gold };
    }
    function openInventory() {
      game.openModal(Object.assign({ type: 'inventory' }, inventoryPayload()));
      return true;
    }
    function refreshInventoryModal() {
      const m = game.modal;
      if (!m || m.type !== 'inventory') return;
      Object.assign(m, inventoryPayload());
      emit('modal:update', { modal: m });
    }

    // ---------- shops ----------
    function shopDef(id) {
      const d = (data().shops || {})[id];
      if (!d) return null;
      return d.id ? d : Object.assign({ id }, d);
    }
    function stockList(visit) {
      const out = [];
      const def = visit.def;
      for (const e of def.stock || []) {
        const entry = typeof e === 'string' ? { item: e } : e;
        const id = entry.item || entry.id;
        if (entry.req && game.ops && !game.ops.test(entry.req, {})) continue;
        const d = itemDef(id);
        if (!d) { warn('shopitem:' + id, `shop ${def.id}: unknown item ${id}`); continue; }
        const base = entry.price ?? d.price ?? 1;
        const price = visit.haggled ? Math.max(1, Math.round(base * (1 - HAGGLE_DISCOUNT))) : base;
        const owned = d.type === 'cosmetic' && api.cosmetics.includes(id);
        const full = d.type !== 'cosmetic' && (api.items[id] || 0) >= (d.stack || 99);
        out.push({ id, name: d.name || id, desc: d.desc || '', icon: d.icon || 'star', price, basePrice: base,
          n: entry.n || 1, owned, canBuy: !owned && !full && api.gold >= price });
      }
      return out;
    }
    function fillShop(m, visit) {
      m.id = visit.id; m.name = visit.def.name || visit.id;
      m.keeper = visit.def.keeper || null;
      const npcs = data().npcs || {};
      m.keeperName = (m.keeper && npcs[m.keeper] && npcs[m.keeper].name) || '';
      m.stock = stockList(visit); m.gold = api.gold; m.haggled = visit.haggled;
      m.canHaggle = visit.def.haggle !== false && !visit.tried;
      return m;
    }
    function showShop(visit) {
      const m = fillShop({ type: 'shop' }, visit);
      m.onClose = () => {
        if (visit.modal !== m) return;
        visit.modal = null;
        if (visit.suspended) return;
        if (shop === visit) shop = null;
        visit.resolve();
      };
      visit.modal = m;
      game.openModal(m);
    }
    function openShop(id) {
      const def = shopDef(id);
      if (!def) { warn('shop:' + id, `unknown shop ${id}`); return Promise.resolve(); }
      return new Promise((resolve) => {
        const visit = { id, def, haggled: false, tried: false, suspended: false, modal: null, resolve };
        shop = visit;
        showShop(visit);
      });
    }
    function refreshShop() {
      const v = shop;
      if (!v || !v.modal || game.modal !== v.modal) return;
      fillShop(v.modal, v);
      emit('modal:update', { modal: v.modal });
    }
    function buy(itemId) {
      const v = shop;
      if (!v) return false;
      const entry = stockList(v).find((s) => s.id === itemId);
      if (!entry) return false;
      if (!entry.canBuy) {
        sfx('ui_bad');
        game.toast(entry.owned ? 'You already own that.' : api.gold < entry.price ? 'Not enough gold.' : "You can't carry more of that.", 'bad');
        return false;
      }
      addGold(-entry.price);
      give(itemId, entry.n, { silent: true });
      sfx('coin');
      game.toast(`Bought ${entry.name} for ${entry.price} gold.`, 'loot');
      refreshShop();
      return true;
    }
    function haggle() {
      const v = shop;
      if (!v || v.def.haggle === false || v.tried || v.haggled) return Promise.resolve(false);
      v.tried = true;
      v.suspended = true;
      const g = gates();
      const keeper = v.def.keeper && (data().npcs || {})[v.def.keeper];
      const who = keeper && keeper.name ? keeper.name + ': ' : '';
      const ask = g && g.ask ? g.ask({ context: 'haggle', difficulty: 1 }) : Promise.resolve({ correct: true });
      return ask.then((r) => {
        v.suspended = false;
        if (r && r.correct) {
          v.haggled = true;
          game.toast(`${who}"Sharp mind! Fine, 20% off. Don't tell the others."`, 'good');
        } else {
          game.toast(`${who}"Nice try. Prices stay as they are."`, 'info');
        }
        if (shop === v) {
          if (v.modal && game.modal === v.modal) refreshShop();
          else showShop(v);
        }
        return !!(r && r.correct);
      });
    }

    // ---------- loot and chests ----------
    function rollList(list, out) {
      const rng = game.rng;
      for (const e of list || []) {
        if (!e) continue;
        const id = e.id || e.item;
        if (!rng.chance(e.p ?? 1)) continue;
        const n = Array.isArray(e.n) ? rng.int(e.n[0], e.n[1]) : (e.n ?? 1);
        if (n > 0) out.push({ id, n });
      }
    }
    function rollLoot(lootId, opts = {}, depth = 0) {
      const out = { gold: 0, items: [] };
      let t = (data().loot || {})[lootId];
      if (!t) { warn('loot:' + lootId, `unknown loot table ${lootId}; using a small default`); t = { gold: [2, 6], items: [] }; }
      const rng = game.rng;
      if (Array.isArray(t.gold)) out.gold += rng.int(t.gold[0], t.gold[1]);
      else if (typeof t.gold === 'number') out.gold += t.gold;
      rollList(t.items, out.items);
      if (opts.rune && t.runeBonus) {
        const rb = t.runeBonus;
        if (Array.isArray(rb.gold)) out.gold += rng.int(rb.gold[0], rb.gold[1]);
        else if (typeof rb.gold === 'number') out.gold += rb.gold;
        if (rb.goldMult) out.gold = Math.round(out.gold * rb.goldMult);
        rollList(rb.items, out.items);
        const extra = rb.table || rb.loot;
        if (extra && depth < 2) {
          const more = rollLoot(extra, {}, depth + 1);
          out.gold += more.gold;
          out.items.push(...more.items);
        }
      }
      return out;
    }
    function grantLoot(loot, at) {
      const x = at ? at.x : game.player ? game.player.x : 0, y = at ? at.y : game.player ? game.player.y : 0;
      if (loot.gold > 0) {
        addGold(loot.gold);
        game.fx({ type: 'text', x, y, text: `+${loot.gold} gold`, style: 'gold' });
        game.toast(`+${loot.gold} gold`, 'loot');
      }
      for (const it of loot.items) give(it.id, it.n);
      game.fx({ type: 'sparkle', x, y, n: 18, r: 1, color: '#ffd24a' });
      sfx('pickup');
    }
    function openChest(lootId, opts = {}, self = null) {
      const zoneId = game.zone ? game.zone.id : 'none';
      const chestId = opts.id ?? (self && self.data && self.data.chestId) ?? lootId;
      const flag = `chest_${zoneId}_${chestId}`;
      if (game.flags[flag]) { game.toast("It's empty.", 'info'); return undefined; }
      if (self && self.data) { if (self.data.opening) return undefined; self.data.opening = true; }
      const finish = (bonus) => {
        const loot = rollLoot(lootId, { rune: bonus });
        grantLoot(loot, self);
        game.setFlag(flag, true);
        if (self) {
          self.look = Object.assign({}, self.look || { rig: 'effect' }, { model: 'chest_open' });
          self.lookRev = (self.lookRev || 0) + 1;
          self.interact = null;
          if (self.data) self.data.opening = false;
          game.fx({ type: 'poof', x: self.x, y: self.y, color: '#fff3c4' });
        }
        emit('chest:opened', { id: chestId, zone: zoneId, loot, rune: !!opts.rune, bonus });
        return loot;
      };
      if (!opts.rune) { finish(false); return undefined; }
      const g = gates();
      const ask = g && g.ask ? g.ask({ context: 'chest', difficulty: opts.difficulty ?? 2, tags: opts.tags || [], blocking: false })
        : Promise.resolve({ correct: true });
      return ask.then((r) => {
        const ok = !!(r && r.correct);
        game.toast(ok ? 'The rune glows! There is a bonus inside.' : 'The rune fizzles. The chest opens anyway.', ok ? 'good' : 'info');
        return finish(ok);
      });
    }

    // ---------- lessons ----------
    function runLesson(lessonId) {
      const def = (data().lessons || {})[lessonId];
      if (!def) { warn('lesson:' + lessonId, `unknown lesson ${lessonId}`); return Promise.resolve(null); }
      if (lessonBusy) return Promise.resolve(null);
      lessonBusy = true;
      const g = gates();
      const total = Math.max(1, def.questions ?? 3);
      const reward = def.reward || {};
      const npcs = data().npcs || {};
      const st = { done: 0, correct: 0, aborted: false, asking: false, modal: null, finished: false };
      let closedResolve = null;
      const closed = new Promise((r) => { closedResolve = r; });
      const show = () => {
        const m = {
          type: 'lesson', id: lessonId, teacher: def.teacher || null,
          teacherName: (def.teacher && npcs[def.teacher] && npcs[def.teacher].name) || '',
          title: def.title || lessonId, total, done: st.done, correct: st.correct, finished: st.finished,
          reward: { xpEach: reward.xpEach || 0, goldEach: reward.goldEach || 0 },
        };
        m.onClose = () => {
          if (st.modal !== m) return;
          st.modal = null;
          if (st.asking) return;
          st.aborted = true;
          closedResolve();
        };
        st.modal = m;
        game.openModal(m);
      };
      const pause = () => (g && g.wait ? g.wait(LESSON_PAUSE) : Promise.resolve());
      const loop = async () => {
        show();
        await pause();
        for (let i = 0; i < total && !st.aborted; i++) {
          st.asking = true;
          const r = g && g.ask ? await g.ask({ context: 'lesson', difficulty: def.difficulty ?? 1, tags: def.tags || [], id: lessonId })
            : { correct: true };
          st.asking = false;
          st.done++;
          if (r && r.correct) {
            st.correct++;
            const pr = prog();
            if (reward.xpEach && pr) pr.addXp(reward.xpEach);
            if (reward.goldEach) addGold(reward.goldEach);
          }
          if (st.aborted) break;
          st.finished = st.done >= total;
          if (st.modal && game.modal === st.modal) Object.assign(st.modal, { done: st.done, correct: st.correct, finished: st.finished });
          else show();
          emit('modal:update', { modal: st.modal });
          if (!st.finished) await pause();
        }
        if (st.done > 0 && def.teacher) {
          const npc = game.sys.npc;
          if (npc && typeof npc.addRel === 'function') npc.addRel(def.teacher, 1);
        }
        const xp = st.correct * (reward.xpEach || 0), gold = st.correct * (reward.goldEach || 0);
        game.toast(`Lesson done: ${st.correct}/${total} correct` + (xp || gold ? ` (+${xp} XP, +${gold} gold)` : '') + '.', 'quest');
        emit('lesson:done', { id: lessonId, total, done: st.done, correct: st.correct });
        lessonBusy = false;
        if (!st.aborted && st.modal) await closed;
        return { id: lessonId, total, done: st.done, correct: st.correct };
      };
      return loop().catch((e) => { lessonBusy = false; warn('lessonerr', String(e && (e.stack || e))); return null; });
    }

    // ---------- api ----------
    const api = {
      items: {}, hotbar: new Array(HOTBAR).fill(null), gold: 0, cosmetics: [],
      equipped: { hat: null, cape: null, outfitColor: null },
      cooldowns: cds,
      itemDef, give, take, count,
      has(id, n = 1) { return count(id) >= n; },
      useSlot, useItem, assignSlot, addGold, spend,
      equipCosmetic, equippedLookPatch,
      openInventory,
      openShop, buy, haggle,
      shopVisit() { return shop ? { id: shop.id, haggled: shop.haggled, tried: shop.tried } : null; },
      rollLoot, openChest, runLesson,
      cdFrac(id) { const c = cds[id]; return c && c.left > 0 ? c.left / c.total : 0; },
      buffs() { return buffs.map((b) => ({ kind: b.kind, left: b.left })); },
      reset() {
        api.items = {}; api.hotbar.fill(null); api.gold = 0; api.cosmetics.length = 0;
        api.equipped.hat = api.equipped.cape = api.equipped.outfitColor = null; patchDirty = true;
        for (const k in cds) delete cds[k];
        while (buffs.length) endBuff(buffs.pop());
        syncHasteTag();
      },
      _tick(dt) {
        for (const id in cds) { const c = cds[id]; if (c.left > 0) c.left = Math.max(0, c.left - dt); }
        if (buffs.length) {
          let changed = false;
          for (let i = buffs.length - 1; i >= 0; i--) {
            const b = buffs[i];
            if (b.kind === 'hot') {
              b.acc += b.rate * dt;
              if (b.acc >= 1) { const n = Math.floor(b.acc); b.acc -= n; heal(n); }
            }
            b.left -= dt;
            if (b.left <= 0) { buffs.splice(i, 1); endBuff(b); changed = true; }
          }
          if (changed) syncHasteTag();
        }
      },
      _markPatchDirty() { patchDirty = true; },
      _lastUse: useTick,
    };

    // ---------- ops, conditions, commands ----------
    const ops = game.ops;
    if (ops && ops.register) {
      ops.register('give', (g, a) => { give(a[1], a.length > 2 ? a[2] : 1); });
      ops.register('take', (g, a) => { take(a[1], a.length > 2 ? a[2] : 1); });
      ops.register('gold', (g, a) => {
        const n = Math.round(Number(a[1]) || 0);
        const before = api.gold;
        addGold(n);
        const d = api.gold - before;
        if (d > 0) g.toast(`+${d} gold`, 'loot'); else if (d < 0) g.toast(`-${-d} gold`, 'info');
      });
      ops.register('shop', (g, a) => openShop(a[1]));
      ops.register('chest', (g, a, ctx) => openChest(a[1], a[2] || {}, (ctx && ctx.self) || null));
      ops.register('lesson', (g, a) => runLesson(a[1]));
      ops.registerCond('hasItem', (g, c) => count(c[1]) >= (c.length > 2 ? Number(c[2]) : 1));
      ops.registerCond('gold', (g, c) => (c.length >= 3 ? compare(api.gold, c[1], Number(c[2])) : api.gold >= Number(c[1] || 0)));
    }
    game.commands.useSlot = (i) => useSlot(i);
    game.commands.assignSlot = (id, i) => assignSlot(id, i);
    game.commands.equipCosmetic = (id, slot) => equipCosmetic(id, slot);
    game.commands.openInventory = () => openInventory();
    game.commands.shopBuy = (id) => buy(id);
    game.commands.shopHaggle = () => haggle();

    return api;
  },

  update(game, dt) {
    const inv = game.sys.inventory;
    inv._tick(dt);
    // Fallback hotbar keys: the player system (Sim) normally calls useSlot; never double-use within one step.
    const inp = game.input;
    if (inp && inp.pressed && !game.modal && !game.inputLock) {
      for (let i = 0; i < HOTBAR; i++) {
        if (!inp.pressed['item' + (i + 1)] || inv._lastUse[i] === game.tick) continue;
        inv.useSlot(i);
      }
    }
  },

  save(game) {
    const inv = game.sys.inventory;
    return {
      items: Object.assign({}, inv.items), hotbar: inv.hotbar.slice(), gold: inv.gold,
      cosmetics: inv.cosmetics.slice(), equipped: Object.assign({}, inv.equipped),
    };
  },

  load(game, j) {
    const inv = game.sys.inventory;
    if (!j) return;
    inv.items = Object.assign({}, j.items || {});
    const hb = Array.isArray(j.hotbar) ? j.hotbar : [];
    for (let i = 0; i < HOTBAR; i++) inv.hotbar[i] = hb[i] && inv.items[hb[i]] > 0 ? hb[i] : null;
    inv.gold = Math.max(0, Number(j.gold) || 0);
    inv.cosmetics.length = 0;
    for (const c of j.cosmetics || []) inv.cosmetics.push(c);
    const eq = j.equipped || {};
    inv.equipped.hat = eq.hat || null; inv.equipped.cape = eq.cape || null; inv.equipped.outfitColor = eq.outfitColor || null;
    inv._markPatchDirty();
  },

  hud(game, hud) {
    const inv = game.sys.inventory;
    hud.player.gold = inv.gold;
    const slots = inv._hudSlots || (inv._hudSlots = Array.from({ length: HOTBAR }, () => ({ id: null, name: '', icon: 'star', count: 0, cdFrac: 0 })));
    for (let i = 0; i < HOTBAR; i++) {
      const id = inv.hotbar[i];
      if (!id) { hud.items[i] = null; continue; }
      const s = slots[i];
      const d = inv.itemDef(id);
      s.id = id; s.name = (d && d.name) || id; s.icon = (d && d.icon) || 'star';
      s.count = inv.count(id); s.cdFrac = inv.cdFrac(id);
      hud.items[i] = s;
    }
  },
};
