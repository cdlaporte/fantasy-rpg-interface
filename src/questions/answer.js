// Typed-answer parsing for number questions. Pure (no DOM), shared by every question provider.
// Accepts: 12, -3, −3, 10.5, .5, 10,5, 21/2, -21/2, 10 1/2, x = 12, x=21/2, 80°, 80 degrees, 60 feet. Spaces are ignored.

const UNITS = /(degrees?|deg|°|feet|foot|ft|inches|inch|in|centimeters?|cm|meters?|m|yards?|yd|units?)$/i;

/** -> {value, n, d} (n/d exact when the input was a fraction or a terminating decimal) or null. */
export function parseAnswer(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[−‒–—﹣－]/g, '-');
  s = s.replace(/^[a-z?]\s*=\s*/i, '');                 // "x = 12"
  s = s.trim().replace(UNITS, '').trim();
  if (!s) return null;
  const mixed = s.match(/^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const sign = mixed[1] === '-' ? -1 : 1, w = Number(mixed[2]), n = Number(mixed[3]), d = Number(mixed[4]);
    if (d === 0) return null;
    return { value: sign * (w + n / d), n: sign * (w * d + n), d };
  }
  s = s.replace(/\s+/g, '');
  if (/^[+-]?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) {
    const value = Number(s);
    const dec = (s.split('.')[1] || '').length;
    const d = 10 ** dec;
    return Number.isFinite(value) ? { value, n: Math.round(value * d), d } : null;
  }
  const fr = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))\/([+-]?(?:\d+\.?\d*|\.\d+))$/);
  if (fr) {
    const n = Number(fr[1]), d = Number(fr[2]);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return { value: n / d, n, d };
  }
  return null;
}

/** Is the typed text a right answer to the number question q? -> {ok, parsed, invalid} */
export function checkAnswer(q, raw) {
  const p = parseAnswer(raw);
  if (!p) return { ok: false, parsed: null, invalid: true };
  const tol = q.accept && typeof q.accept.tolerance === 'number' ? q.accept.tolerance : 0.01;
  let ok = Math.abs(p.value - q.answer) <= tol + 1e-9;
  const f = q.accept && q.accept.fraction;
  if (!ok && f && Number.isInteger(p.n) && Number.isInteger(p.d)) ok = p.n * f[1] === f[0] * p.d;
  return { ok, parsed: p, invalid: false };
}
