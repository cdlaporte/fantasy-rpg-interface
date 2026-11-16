// Tiny SVG figure builder for the Unit 4 diagrams. Pure (no DOM): it returns an SVG string.
//
// Geometry is given in math coordinates (y up). render() scales it into a box of at most maxW x maxH screen units,
// then places every text label in screen space so it clears the drawn lines, arcs, marks and other labels, and
// finally crops the viewBox to what was drawn (so every coordinate is inside the viewBox).
// Marks follow the worksheet conventions: angle arcs (1, 2 or 3 arcs = congruence classes), right-angle boxes,
// parallel arrows (chevrons) on segments, arrowheads at the ends of lines, dimension lines |--- 27 ---|.
// Styling comes from css/questions.css (classes f-*); presentation attributes are fallbacks.

const LABEL_FS = 16;   // side / number labels
const VERTEX_FS = 17;  // vertex letters (italic serif, like the packet)
const DEG_FS = 14;     // degree labels inside angles

const r1 = (v) => Math.round(v * 10) / 10;

/** Rough width of a text in screen units (used for placement; generous so labels never touch lines). */
export function textWidth(s, fs) {
  let w = 0;
  for (const ch of String(s)) {
    if (ch === ' ') w += 0.3;
    else if (/[0-9]/.test(ch)) w += 0.58;
    else if (/[A-Z]/.test(ch)) w += 0.7;
    else if (ch === '−' || ch === '+' || ch === '=') w += 0.62;
    else if (ch === '.' || ch === ',') w += 0.3;
    else if (ch === '°') w += 0.4;
    else w += 0.56;
  }
  return w * fs;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const dist = (a, b) => len(sub(a, b));

function segDist(p, a, b) {
  const ab = sub(b, a);
  const L2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
  let t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}

function segsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** Distance from a box to a segment (0 when they touch). */
export function boxSegDist(box, a, b) {
  if (segHitsBox(a, b, box)) return 0;
  const c = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]];
  let d = Infinity;
  for (let i = 0; i < 4; i++) d = Math.min(d, segDist(c[i], a, b));
  // segment endpoints to the box
  for (const p of [a, b]) {
    const dx = Math.max(box.x0 - p[0], 0, p[0] - box.x1), dy = Math.max(box.y0 - p[1], 0, p[1] - box.y1);
    d = Math.min(d, Math.hypot(dx, dy));
  }
  return d;
}

/** Does segment a-b touch the box {x0, y0, x1, y1}? */
export function segHitsBox(a, b, box) {
  const inside = (p) => p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1;
  if (inside(a) || inside(b)) return true;
  const c = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]];
  for (let i = 0; i < 4; i++) if (segsCross(a, b, c[i], c[(i + 1) % 4])) return true;
  return false;
}

export function boxesOverlap(a, b, gap = 0) {
  return a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function createFigure() {
  const segs = [];      // {a, b, ends}
  const marks = [];     // parallel chevrons / ticks: {kind, a, b, n, t}
  const arcs = [];      // {v, p, q, n, r}
  const rights = [];    // {v, p, q}
  const labels = [];    // {kind, text, ...}
  const dims = [];      // {a, b, text, ref}

  const fig = {
    /** A segment. opts.ends: 'both' | 'a' | 'b' draws arrowheads (lines in the packet), opts.ext extends it. */
    seg(a, b, opts = {}) { segs.push({ a, b, ends: opts.ends || null, ext: opts.ext || 0 }); return fig; },
    poly(pts) { for (let i = 0; i < pts.length; i++) fig.seg(pts[i], pts[(i + 1) % pts.length]); return fig; },
    /** n parallel chevrons on a-b, pointing toward b, centered at parameter t. */
    parallel(a, b, n = 1, t = 0.5) { marks.push({ kind: 'par', a, b, n, t }); return fig; },
    ticks(a, b, n = 1, t = 0.5) { marks.push({ kind: 'tick', a, b, n, t }); return fig; },
    /** n concentric arcs at vertex v between rays v->p and v->q (the smaller angle). r = first radius (screen). */
    arc(v, p, q, n = 1, r = 16) { arcs.push({ v, p, q, n, r }); return fig; },
    right(v, p, q) { rights.push({ v, p, q }); return fig; },
    vertex(p, text) { labels.push({ kind: 'vertex', p, text, fs: VERTEX_FS }); return fig; },
    /** Label for side a-b, placed away from `ref` (an interior point) when possible. */
    side(a, b, text, ref = null) { labels.push({ kind: 'side', a, b, text, ref, fs: LABEL_FS }); return fig; },
    /** Degree (or other) label inside the angle p-v-q. */
    angle(v, p, q, text, r = 16) { labels.push({ kind: 'angle', v, p, q, text, r, fs: DEG_FS }); return fig; },
    /** Dimension line |--- text ---| parallel to a-b, offset away from ref. */
    dim(a, b, text, ref = null) { dims.push({ a, b, text, ref }); return fig; },
    render(opts) { return render(opts); },
  };

  function render({ maxW = 400, maxH = 230, pad = 34, title = '' } = {}) {
    // ---- fit geometry
    const pts = [];
    for (const s of segs) pts.push(s.a, s.b);
    for (const l of labels) if (l.p) pts.push(l.p);
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    const bw = Math.max(1e-6, maxx - minx), bh = Math.max(1e-6, maxy - miny);
    const s = Math.min((maxW - 2 * pad) / bw, (maxH - 2 * pad) / bh);
    const T = (p) => [pad + (p[0] - minx) * s, pad + (maxy - p[1]) * s];

    const lines = [];     // screen segments that labels must avoid: [a, b]
    const out = [];       // svg elements (screen coords, translated at the end)
    const boxes = [];     // placed label boxes
    const extent = [];    // every drawn point (for the final viewBox)
    const placed = [];    // label records for tests: {text, kind, x, y, w, h, own}

    // ---- segments
    for (const sg of segs) {
      let a = T(sg.a), b = T(sg.b);
      if (sg.ext) {
        const u = norm(sub(b, a));
        if (sg.ends === 'both' || sg.ends === 'a') a = sub(a, mul(u, sg.ext));
        if (sg.ends === 'both' || sg.ends === 'b') b = add(b, mul(u, sg.ext));
      }
      lines.push([a, b]);
      extent.push(a, b);
      out.push({ t: 'line', a, b, cls: 'f-line' });
      const head = (tip, dir) => {
        const u = norm(dir), n = [-u[1], u[0]];
        const p1 = add(sub(tip, mul(u, 9)), mul(n, 4.5)), p2 = sub(sub(tip, mul(u, 9)), mul(n, 4.5));
        out.push({ t: 'path', d: [['M', p1], ['L', tip], ['L', p2], ['Z']], cls: 'f-head' });
        extent.push(p1, p2, tip);
      };
      if (sg.ends === 'both' || sg.ends === 'b') head(b, sub(b, a));
      if (sg.ends === 'both' || sg.ends === 'a') head(a, sub(a, b));
    }

    // ---- marks (parallel chevrons, ticks)
    for (const m of marks) {
      const a = T(m.a), b = T(m.b);
      const u = norm(sub(b, a)), n = [-u[1], u[0]];
      const c = add(a, mul(sub(b, a), m.t));
      for (let i = 0; i < m.n; i++) {
        const off = (i - (m.n - 1) / 2) * 7;
        const tip = add(c, mul(u, off + 4));
        if (m.kind === 'par') {
          const p1 = add(sub(tip, mul(u, 7)), mul(n, 5.5)), p2 = sub(sub(tip, mul(u, 7)), mul(n, 5.5));
          out.push({ t: 'path', d: [['M', p1], ['L', tip], ['L', p2]], cls: 'f-mark' });
          lines.push([p1, tip], [tip, p2]);
          extent.push(p1, p2, tip);
        } else {
          const q = add(c, mul(u, off));
          const p1 = add(q, mul(n, 6)), p2 = sub(q, mul(n, 6));
          out.push({ t: 'line', a: p1, b: p2, cls: 'f-mark' });
          lines.push([p1, p2]);
          extent.push(p1, p2);
        }
      }
    }

    // ---- right-angle boxes
    for (const ra of rights) {
      const v = T(ra.v), u1 = norm(sub(T(ra.p), v)), u2 = norm(sub(T(ra.q), v));
      const k = 11;
      const p1 = add(v, mul(u1, k)), p2 = add(add(v, mul(u1, k)), mul(u2, k)), p3 = add(v, mul(u2, k));
      out.push({ t: 'path', d: [['M', p1], ['L', p2], ['L', p3]], cls: 'f-mark' });
      lines.push([p1, p2], [p2, p3]);
      extent.push(p1, p2, p3);
    }

    // ---- angle arcs
    for (const ac of arcs) {
      const v = T(ac.v);
      const u1 = norm(sub(T(ac.p), v)), u2 = norm(sub(T(ac.q), v));
      const cross = u1[0] * u2[1] - u1[1] * u2[0];
      const sweep = cross > 0 ? 1 : 0;
      for (let i = 0; i < ac.n; i++) {
        const r = ac.r + i * 4.5;
        const p1 = add(v, mul(u1, r)), p2 = add(v, mul(u2, r));
        out.push({ t: 'path', d: [['M', p1], ['A', r, sweep, p2]], cls: 'f-arc' });
        // polyline approximation for label avoidance and the bounding box
        const a1 = Math.atan2(u1[1], u1[0]);
        let da = Math.atan2(u2[1], u2[0]) - a1;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        let prev = p1;
        for (let k = 1; k <= 6; k++) {
          const ang = a1 + (da * k) / 6;
          const q = [v[0] + Math.cos(ang) * r, v[1] + Math.sin(ang) * r];
          lines.push([prev, q]);
          extent.push(q);
          prev = q;
        }
        extent.push(p1, p2);
      }
    }

    // ---- label placement helpers
    const boxAt = (c, w, h) => ({ x0: c[0] - w / 2, y0: c[1] - h / 2, x1: c[0] + w / 2, y1: c[1] + h / 2 });
    const shrink = (b, k) => ({ x0: b.x0 + k, y0: b.y0 + k, x1: b.x1 - k, y1: b.y1 - k });
    const ext = (dir, w, h) => Math.abs(dir[0]) * w / 2 + Math.abs(dir[1]) * h / 2;
    const score = (box, own) => {
      let bad = 0;
      const sb = shrink(box, -1.5);
      for (const ln of lines) if (segHitsBox(ln[0], ln[1], sb)) bad += 10;
      for (const b of boxes) if (boxesOverlap(box, b, 3)) bad += 10;
      if (own) {
        // a side label must sit closer to its own side than to any other line
        const d0 = boxSegDist(box, own[0], own[1]);
        for (const ln of lines) {
          if (ln === own) continue;
          if (boxSegDist(box, ln[0], ln[1]) < d0 - 0.5) { bad += 3; break; }
        }
      }
      return bad;
    };
    const choose = (cands, w, h, own) => {
      let best = null, bestScore = Infinity;
      for (const c of cands) {
        const box = boxAt(c, w, h);
        const sc = score(box, own);
        if (sc < bestScore) { best = box; bestScore = sc; if (sc === 0) break; }
      }
      return { box: best, bad: bestScore };
    };
    const emitLabel = (l, box, cls, bad, own) => {
      boxes.push(box);
      const c = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
      out.push({ t: 'text', p: c, text: l.text, cls, fs: l.fs });
      extent.push([box.x0, box.y0], [box.x1, box.y1]);
      placed.push({ text: l.text, kind: l.kind, x: c[0], y: c[1], w: box.x1 - box.x0, h: box.y1 - box.y0, bad, own: own || null });
    };
    const findLine = (a, b) => lines.find((ln) => (dist(ln[0], a) < 0.5 && dist(ln[1], b) < 0.5) || (dist(ln[0], b) < 0.5 && dist(ln[1], a) < 0.5));

    // angle labels first (they need the space inside the angle)
    for (const l of labels.filter((x) => x.kind === 'angle')) {
      const v = T(l.v), u1 = norm(sub(T(l.p), v)), u2 = norm(sub(T(l.q), v));
      const bis = norm(add(u1, u2));
      const w = textWidth(l.text, l.fs) + 2, h = l.fs;
      const half = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))) / 2;
      const cands = [];
      for (const extra of [5, 9, 14, 20, 28, 36, 46]) {
        // distance so the box clears both rays: e / sin(half)
        const e = ext([-bis[1], bis[0]], w, h) + 2;
        const d = Math.max(l.r + extra + ext(bis, w, h), e / Math.max(0.2, Math.sin(half)));
        cands.push(add(v, mul(bis, d)));
      }
      const r = choose(cands, w, h, null);
      emitLabel(l, r.box, 'f-lbl f-deg', r.bad);
    }

    // side labels
    for (const l of labels.filter((x) => x.kind === 'side')) {
      const a = T(l.a), b = T(l.b);
      const u = norm(sub(b, a));
      let n = [-u[1], u[0]];
      if (l.ref) {
        const rr = T(l.ref);
        const mid = mul(add(a, b), 0.5);
        if ((rr[0] - mid[0]) * n[0] + (rr[1] - mid[1]) * n[1] > 0) n = mul(n, -1);
      }
      const w = textWidth(l.text, l.fs) + 2, h = l.fs;
      const cands = [];
      for (const side of [1, -1]) {
        const nn = mul(n, side);
        for (const extra of [5, 10]) {
          for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
            const base = add(a, mul(sub(b, a), t));
            cands.push(add(base, mul(nn, extra + ext(nn, w, h))));
          }
        }
      }
      const own = findLine(a, b) || [a, b];
      const r = choose(cands, w, h, own);
      emitLabel(l, r.box, 'f-lbl f-side', r.bad, own);
    }

    // dimension lines
    for (const dm of dims) {
      const a = T(dm.a), b = T(dm.b);
      const u = norm(sub(b, a));
      let n = [-u[1], u[0]];
      if (dm.ref) {
        const rr = T(dm.ref), mid = mul(add(a, b), 0.5);
        if ((rr[0] - mid[0]) * n[0] + (rr[1] - mid[1]) * n[1] > 0) n = mul(n, -1);
      }
      const w = textWidth(dm.text, LABEL_FS) + 2, h = LABEL_FS;
      let off = 18;
      // move the dimension line out until it clears the drawing near it
      for (let tries = 0; tries < 6; tries++) {
        const a2 = add(a, mul(n, off)), b2 = add(b, mul(n, off));
        const hit = lines.some((ln) => segsCross(a2, b2, ln[0], ln[1]))
          || boxes.some((bx) => segHitsBox(a2, b2, { x0: bx.x0 - 3, y0: bx.y0 - 3, x1: bx.x1 + 3, y1: bx.y1 + 3 }));
        if (!hit) break;
        off += 10;
      }
      const a2 = add(a, mul(n, off)), b2 = add(b, mul(n, off));
      const mid = mul(add(a2, b2), 0.5);
      const gap = ext(u, w, h) + 3;
      const total = dist(a2, b2);
      const g1 = add(mid, mul(u, -gap)), g2 = add(mid, mul(u, gap));
      if (total / 2 > gap + 4) {
        out.push({ t: 'line', a: a2, b: g1, cls: 'f-dim' }, { t: 'line', a: g2, b: b2, cls: 'f-dim' });
        lines.push([a2, g1], [g2, b2]);
      }
      for (const e of [a2, b2]) {
        const p1 = add(e, mul(n, 6)), p2 = sub(e, mul(n, 6));
        out.push({ t: 'line', a: p1, b: p2, cls: 'f-dim' });
        lines.push([p1, p2]);
        extent.push(p1, p2);
      }
      extent.push(a2, b2);
      const box = boxAt(mid, w, h);
      emitLabel({ text: dm.text, kind: 'dim', fs: LABEL_FS }, box, 'f-lbl f-side', score(box, null));
    }

    // vertex labels last: they go into the widest free direction around the point
    for (const l of labels.filter((x) => x.kind === 'vertex')) {
      const p = T(l.p);
      const dirs = [];
      for (const ln of lines) {
        for (const [e, o] of [[ln[0], ln[1]], [ln[1], ln[0]]]) {
          if (dist(e, p) < 1) { if (dist(o, p) > 1) dirs.push(Math.atan2(o[1] - p[1], o[0] - p[0])); }
        }
        if (dist(ln[0], p) >= 1 && dist(ln[1], p) >= 1 && segDist(p, ln[0], ln[1]) < 1) {
          dirs.push(Math.atan2(ln[0][1] - p[1], ln[0][0] - p[0]), Math.atan2(ln[1][1] - p[1], ln[1][0] - p[0]));
        }
      }
      dirs.sort((x, y) => x - y);
      const gaps = [];
      if (!dirs.length) gaps.push({ mid: -Math.PI / 2, size: 2 * Math.PI });
      for (let i = 0; i < dirs.length; i++) {
        const a0 = dirs[i], a1 = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + 2 * Math.PI;
        gaps.push({ mid: (a0 + a1) / 2, size: a1 - a0 });
      }
      gaps.sort((x, y) => y.size - x.size);
      const w = textWidth(l.text, l.fs) + 2, h = l.fs + 1;
      const cands = [];
      for (const g of gaps) {
        for (const off of [0, -0.3, 0.3]) {
          if (g.size < 0.5 && off !== 0) continue;
          const dir = [Math.cos(g.mid + off * g.size * 0.5), Math.sin(g.mid + off * g.size * 0.5)];
          for (const d of [6, 11, 17]) cands.push(add(p, mul(dir, d + ext(dir, w, h))));
        }
      }
      const r = choose(cands, w, h, null);
      emitLabel(l, r.box, 'f-lbl f-vtx', r.bad);
    }

    // ---- crop to content
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of extent) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const M = 4;
    const dx = M - x0, dy = M - y0;
    const W = Math.ceil(x1 - x0 + 2 * M), H = Math.ceil(y1 - y0 + 2 * M);
    const P = (p) => `${r1(p[0] + dx)} ${r1(p[1] + dy)}`;
    const parts = [];
    const strokes = [], texts = [];
    for (const o of out) {
      if (o.t === 'line') strokes.push(`<line class="${o.cls}" x1="${r1(o.a[0] + dx)}" y1="${r1(o.a[1] + dy)}" x2="${r1(o.b[0] + dx)}" y2="${r1(o.b[1] + dy)}"/>`);
      else if (o.t === 'path') {
        const d = o.d.map((c) => {
          if (c[0] === 'Z') return 'Z';
          if (c[0] === 'A') return `A ${r1(c[1])} ${r1(c[1])} 0 0 ${c[2]} ${P(c[3])}`;
          return `${c[0]} ${P(c[1])}`;
        }).join(' ');
        strokes.push(`<path class="${o.cls}" d="${d}"/>`);
      } else if (o.t === 'text') {
        texts.push(`<text class="${o.cls}" x="${r1(o.p[0] + dx)}" y="${r1(o.p[1] + dy)}" font-size="${o.fs}" text-anchor="middle" dominant-baseline="central">${esc(o.text)}</text>`);
      }
    }
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" class="q4-fig" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"${title ? ` aria-label="${esc(title)}"` : ''}>`);
    parts.push(`<g class="f-ink" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${strokes.join('')}</g>`);
    parts.push(`<g class="f-text" fill="currentColor">${texts.join('')}</g>`);
    parts.push('</svg>');
    const meta = {
      width: W, height: H,
      labels: placed.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy, own: l.own ? l.own.map((p) => [p[0] + dx, p[1] + dy]) : null })),
      lines: lines.map((ln) => [[ln[0][0] + dx, ln[0][1] + dy], [ln[1][0] + dx, ln[1][1] + dy]]),
      scale: s,
      map: (p) => { const q = T(p); return [q[0] + dx, q[1] + dy]; },
    };
    return { svg: parts.join(''), meta };
  }

  return fig;
}

/**
 * A proportion written the worksheet way, as stacked fractions: [[num, den], [num, den]] -> {svg, meta}.
 * Terms are plain strings ("x − 3", "18").
 */
export function equationSvg(left, right) {
  const fs = 24;
  const pad = 8;
  const fracW = (f) => Math.max(textWidth(f[0], fs), textWidth(f[1], fs)) + 14;
  const w1 = fracW(left), w2 = fracW(right), eqW = 34;
  const W = Math.ceil(pad * 2 + w1 + eqW + w2), H = Math.ceil(fs * 2 + 26);
  const mid = H / 2;
  const parts = [];
  const texts = [];
  const frac = (f, x0, w) => {
    parts.push(`<line class="f-bar" x1="${r1(x0)}" y1="${r1(mid)}" x2="${r1(x0 + w)}" y2="${r1(mid)}"/>`);
    texts.push(`<text class="f-eq" x="${r1(x0 + w / 2)}" y="${r1(mid - fs * 0.62)}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${esc(f[0])}</text>`);
    texts.push(`<text class="f-eq" x="${r1(x0 + w / 2)}" y="${r1(mid + fs * 0.66)}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${esc(f[1])}</text>`);
  };
  frac(left, pad, w1);
  texts.push(`<text class="f-eq" x="${r1(pad + w1 + eqW / 2)}" y="${r1(mid)}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">=</text>`);
  frac(right, pad + w1 + eqW, w2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="q4-fig q4-eq" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`
    + `<g class="f-ink" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${parts.join('')}</g>`
    + `<g class="f-text" fill="currentColor">${texts.join('')}</g></svg>`;
  return { svg, meta: { width: W, height: H, labels: [], lines: [] } };
}

// ---- geometry helpers shared by generators (math coordinates) ----

export const deg = (d) => (d * Math.PI) / 180;
export const P = (x, y) => [x, y];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const rot = (p, ang, c = [0, 0]) => {
  const x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * Math.cos(ang) - y * Math.sin(ang), c[1] + x * Math.sin(ang) + y * Math.cos(ang)];
};
export const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
export const pdist = dist;

/** Angle (degrees) at vertex v of the triangle v, p, q. */
export function angleAt(v, p, q) {
  const a = norm(sub(p, v)), b = norm(sub(q, v));
  return (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) * 180) / Math.PI;
}

/** Triangle from side lengths: returns [A, B, C] with |BC| = a, |CA| = b, |AB| = c, B at origin, C on +x. */
export function triFromSides(a, b, c) {
  const B = [0, 0], C = [a, 0];
  const x = (a * a + c * c - b * b) / (2 * a);
  const y = Math.sqrt(Math.max(0, c * c - x * x));
  return [[x, y], B, C];
}

/** Triangle from two angles (degrees) at B and C with BC = base: returns [A, B, C]. */
export function triFromAngles(angB, angC, base = 10) {
  const B = [0, 0], C = [base, 0];
  const angA = 180 - angB - angC;
  const c = (base * Math.sin(deg(angC))) / Math.sin(deg(angA)); // AB
  return [[c * Math.cos(deg(angB)), c * Math.sin(deg(angB))], B, C];
}

/** Rotate / mirror / scale / translate a point list (used to draw the second triangle "in a different orientation"). */
export function place(pts, { angle = 0, mirror = false, scale = 1, at = [0, 0] } = {}) {
  const c = centroid(pts);
  return pts.map((p) => {
    let x = (p[0] - c[0]) * scale, y = (p[1] - c[1]) * scale;
    if (mirror) x = -x;
    const q = rot([x, y], angle);
    return [q[0] + at[0], q[1] + at[1]];
  });
}

/** Minimum angle (degrees) of a triangle. */
export function minAngle(t) {
  return Math.min(angleAt(t[0], t[1], t[2]), angleAt(t[1], t[2], t[0]), angleAt(t[2], t[0], t[1]));
}

/** Bounding box of points. */
export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
