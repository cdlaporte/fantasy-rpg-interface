// Story package: the day clock (CONTRACTS section 11). A full day lasts config.dayLengthSeconds (720 s).
// Writes game.ambience {daypart, tint, tintAmount}; presentation is never dark (tintAmount <= 0.2).
// Emits 'hour' {hour} on every whole hour crossed (and once from set()).

const KEYS = [
  // [hour, '#rrggbb', amount]
  [0, '#ffb060', 0.2],
  [4.5, '#ffb060', 0.2],
  [6, '#c8dcff', 0.12],     // cool dawn
  [8, '#ffe2b8', 0.07],     // warm morning
  [11, '#ffffff', 0],
  [16, '#ffffff', 0],
  [18, '#ffc27a', 0.12],
  [20, '#ffb060', 0.2],     // warm amber evening (max)
  [24, '#ffb060', 0.2],
];
const RES = 10;               // tint table entries per hour
export const MAX_TINT = 0.2;

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function toHex(r, g, b) {
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
function seg(h) {
  for (let i = 0; i < KEYS.length - 1; i++) if (h >= KEYS[i][0] && h < KEYS[i + 1][0]) return i;
  return KEYS.length - 2;
}
/** Tint strings precomputed per 1/RES hour (no per-step allocation). */
const TINTS = [];
for (let i = 0; i <= 24 * RES; i++) {
  const h = Math.min(i / RES, 23.999);
  const s = seg(h);
  const a = KEYS[s], b = KEYS[s + 1];
  const f = (h - a[0]) / (b[0] - a[0]);
  const ca = hex(a[1]), cb = hex(b[1]);
  TINTS.push(toHex(ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f));
}

export function daypartAt(h) { return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : 'evening'; }
export function tintAmountAt(h) {
  const s = seg(h);
  const a = KEYS[s], b = KEYS[s + 1];
  const f = (h - a[0]) / (b[0] - a[0]);
  return Math.min(MAX_TINT, a[2] + (b[2] - a[2]) * f);
}
export function tintAt(h) { return TINTS[Math.max(0, Math.min(TINTS.length - 1, Math.round(h * RES)))]; }

function wrap(h) { h %= 24; return h < 0 ? h + 24 : h; }

export default {
  id: 'clock',
  init(game) {
    const api = {
      hour: wrap(Number(game.config.startHour) || 8),
      day: 1,
      daypart: 'morning',
      /** Seconds of real time per game hour. */
      get secondsPerHour() { return (game.config.dayLengthSeconds || 720) / 24; },
      set(h) {
        api.hour = wrap(Number(h) || 0);
        apply(game);
        game.bus.emit('hour', { hour: Math.floor(api.hour), set: true });
      },
      /** '08:30' style label. */
      label() {
        const h = Math.floor(api.hour), m = Math.floor((api.hour - h) * 60);
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      },
    };
    function apply(g) {
      api.daypart = daypartAt(api.hour);
      const amb = g.ambience;
      amb.daypart = api.daypart;
      amb.tint = tintAt(api.hour);
      amb.tintAmount = tintAmountAt(api.hour);
    }
    api._apply = apply;
    apply(game);
    return api;
  },
  update(game, dt) {
    const c = game.clock;
    const before = Math.floor(c.hour);
    let h = c.hour + dt / c.secondsPerHour;
    if (h >= 24) { h -= 24; c.day++; }
    c.hour = h;
    c._apply(game);
    const after = Math.floor(h);
    if (after !== before) game.bus.emit('hour', { hour: after });
  },
  save(game) { return { hour: game.clock.hour, day: game.clock.day }; },
  load(game, json) {
    if (!json) return;
    const c = game.clock;
    if (typeof json.hour === 'number') c.hour = wrap(json.hour);
    if (typeof json.day === 'number') c.day = json.day;
    c._apply(game);
  },
  hud(game, hud) { hud.hour = game.clock.hour; hud.daypart = game.clock.daypart; },
};
