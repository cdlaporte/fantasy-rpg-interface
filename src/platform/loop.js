// Frozen. Fixed-step loop with interpolation (CONTRACTS section 2).
// step(dt) runs up to maxSteps times per frame; render(alpha) once per animation frame.
// manual: true (test=1) -> no stepping; time advances only through __game.step(n); render(1) each frame.
import { DT } from '../contracts.js';

export function createLoop({ step, render, maxSteps = 4, manual = false, onError }) {
  let acc = 0;
  let last = -1;
  let raf = 0;
  let running = false;
  let lastErr = 0;
  const report = (e) => {
    const now = performance.now();
    if (onError) onError(e);
    if (now - lastErr > 1000) { lastErr = now; console.error(e); }
  };
  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = -1; return; }
    try {
      if (manual) { render(1); return; }
      if (last < 0) last = now;
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      let n = 0;
      while (acc >= DT && n < maxSteps) { step(DT); acc -= DT; n++; }
      if (n === maxSteps && acc >= DT) acc = 0; // too slow: drop the backlog instead of spiraling
      render(acc / DT);
    } catch (e) { report(e); }
  };
  const onVis = () => { last = -1; acc = 0; };
  document.addEventListener('visibilitychange', onVis);
  return {
    get running() { return running; },
    get manual() { return manual; },
    start() { if (running) return; running = true; last = -1; acc = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    dispose() { this.stop(); document.removeEventListener('visibilitychange', onVis); },
  };
}

export default createLoop;
