// Tiny WebAudio synth (no music files). Plays the 'sfx' ids of CONTRACTS section 10 plus a few bus events
// (hit / hurt, levelup, item pickup, gold, modal open). Unlocked on the first key press or click (browser autoplay
// rules); mute is persisted in localStorage ('flinkerton.audio.muted').
//
// createAudio() -> {attach(game), play(id), music(), setVolume(v), setMuted(b), toggleMute(), isMuted(), dispose()}
// getAudio()    -> the last created instance (the UI uses it for the pause menu's Sound toggle).

const MUTE_KEY = 'flinkerton.audio.muted';
let shared = null;

function readMuted() { try { return globalThis.localStorage && localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } }
function writeMuted(b) { try { if (globalThis.localStorage) localStorage.setItem(MUTE_KEY, b ? '1' : '0'); } catch { /* ignore */ } }

/**
 * Recipes: arrays of voices. Voice: {type: osc wave | 'noise', f: [startHz, endHz], d: seconds, v: volume,
 * at: start offset, q: filter Q, filter: 'lowpass'|'bandpass'|'highpass', ff: [filterStart, filterEnd]}.
 */
export const RECIPES = {
  swing: [{ type: 'noise', d: 0.09, v: 0.22, filter: 'bandpass', ff: [2200, 500], q: 1.2 }],
  hit: [{ type: 'square', f: [220, 80], d: 0.07, v: 0.18 }, { type: 'noise', d: 0.05, v: 0.2, filter: 'lowpass', ff: [3000, 800] }],
  hurt: [{ type: 'sawtooth', f: [330, 110], d: 0.16, v: 0.16 }, { type: 'noise', d: 0.06, v: 0.12, filter: 'lowpass', ff: [1500, 400] }],
  poof: [{ type: 'noise', d: 0.22, v: 0.2, filter: 'lowpass', ff: [1400, 200] }],
  pickup: [{ type: 'square', f: [660, 660], d: 0.05, v: 0.12 }, { type: 'square', f: [990, 990], d: 0.07, v: 0.12, at: 0.05 }],
  coin: [{ type: 'square', f: [988, 988], d: 0.06, v: 0.11 }, { type: 'square', f: [1319, 1319], d: 0.16, v: 0.11, at: 0.06 }],
  levelup: [523, 659, 784, 1047].map((f, i) => ({ type: 'triangle', f: [f, f], d: i === 3 ? 0.3 : 0.1, v: 0.2, at: i * 0.09 }))
    .concat([{ type: 'square', f: [1047, 1047], d: 0.3, v: 0.06, at: 0.27 }]),
  spell: [{ type: 'sine', f: [500, 1300], d: 0.2, v: 0.16, vib: 18 }, { type: 'triangle', f: [1000, 2000], d: 0.15, v: 0.06, at: 0.04 }],
  blink: [{ type: 'sine', f: [1400, 300], d: 0.14, v: 0.16 }],
  dash: [{ type: 'noise', d: 0.12, v: 0.18, filter: 'highpass', ff: [800, 3000] }],
  door: [{ type: 'triangle', f: [140, 60], d: 0.14, v: 0.25 }, { type: 'noise', d: 0.1, v: 0.1, filter: 'lowpass', ff: [700, 200], at: 0.02 }],
  ui_move: [{ type: 'square', f: [700, 700], d: 0.025, v: 0.05 }],
  ui_ok: [{ type: 'square', f: [880, 880], d: 0.04, v: 0.07 }, { type: 'square', f: [1320, 1320], d: 0.06, v: 0.07, at: 0.04 }],
  ui_bad: [{ type: 'square', f: [220, 150], d: 0.12, v: 0.09 }],
  boss: [{ type: 'sawtooth', f: [110, 98], d: 0.5, v: 0.12 }, { type: 'sawtooth', f: [116, 104], d: 0.5, v: 0.1 }, { type: 'noise', d: 0.3, v: 0.08, filter: 'lowpass', ff: [500, 100] }],
  laporte: [523, 659, 784].map((f, i) => ({ type: 'sine', f: [f, f], d: 0.45, v: 0.13, at: i * 0.12 })),
  talk: [{ type: 'square', f: [520, 480], d: 0.025, v: 0.03 }],
};

export function createAudio() {
  let ctx = null, master = null, noiseBuf = null;
  let muted = readMuted();
  let volume = 0.55;
  const lastAt = {};
  let active = 0;
  const offs = [];
  let game = null;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    } catch { ctx = null; }
  }
  const onFirst = () => unlock();
  if (globalThis.addEventListener) {
    globalThis.addEventListener('keydown', onFirst, true);
    globalThis.addEventListener('pointerdown', onFirst, true);
  }

  function voice(vc, t0) {
    const t = t0 + (vc.at || 0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vc.v || 0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + vc.d);
    let src;
    if (vc.type === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = noiseBuf;
    } else {
      src = ctx.createOscillator();
      src.type = vc.type;
      src.frequency.setValueAtTime(vc.f[0], t);
      src.frequency.exponentialRampToValueAtTime(Math.max(20, vc.f[1]), t + vc.d);
      if (vc.vib) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = vc.vib; lg.gain.value = vc.f[0] * 0.04;
        lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(t + vc.d + 0.02);
      }
    }
    let node = src;
    if (vc.filter) {
      const f = ctx.createBiquadFilter();
      f.type = vc.filter; f.Q.value = vc.q || 0.8;
      f.frequency.setValueAtTime(vc.ff[0], t);
      f.frequency.exponentialRampToValueAtTime(vc.ff[1], t + vc.d);
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(master);
    active++;
    src.onended = () => { active--; try { g.disconnect(); } catch { /* ignore */ } };
    src.start(t);
    src.stop(t + vc.d + 0.03);
  }

  const api = {
    attach(g) {
      game = g;
      const on = (evt, fn) => { if (g && g.bus) offs.push(g.bus.on(evt, fn)); };
      on('sfx', (e) => api.play(e && e.id));
      on('hit', (e) => api.play(e && e.target && e.target.type === 'player' ? 'hurt' : 'hit'));
      on('levelup', () => api.play('levelup'));
      on('item:gained', () => api.play('pickup'));
      on('gold', (e) => { if (!e || e.amount > 0) api.play('coin'); });
      on('modal:open', (e) => { const t = e && e.modal && e.modal.type; if (t && t !== 'dialogue') api.play('ui_ok'); });
      on('death', () => api.play('poof'));
    },
    play(id) {
      if (!id || muted || !ctx || ctx.state !== 'running') return;
      const r = RECIPES[id];
      if (!r) return;
      const now = ctx.currentTime;
      if (lastAt[id] !== undefined && now - lastAt[id] < 0.05) return; // collapse duplicates (bus event + sfx hint)
      if (active > 24) return;
      lastAt[id] = now;
      for (const vc of r) voice(vc, now + 0.005);
    },
    music() { /* no music files in this game */ },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master && !muted) master.gain.value = volume; },
    setMuted(b) { muted = !!b; writeMuted(muted); if (master) master.gain.value = muted ? 0 : volume; },
    toggleMute() { api.setMuted(!muted); if (!muted) { unlock(); setTimeout(() => api.play('ui_ok'), 30); } return muted; },
    isMuted() { return muted; },
    get unlocked() { return !!ctx; },
    dispose() {
      for (const off of offs) try { off(); } catch { /* ignore */ }
      offs.length = 0;
      if (globalThis.removeEventListener) {
        globalThis.removeEventListener('keydown', onFirst, true);
        globalThis.removeEventListener('pointerdown', onFirst, true);
      }
      if (ctx) ctx.close().catch(() => {});
      ctx = null; game = null;
    },
  };
  shared = api;
  return api;
}

export function getAudio() { return shared; }

export default createAudio;
