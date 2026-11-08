 'use strict';
/* DIWALI CINEMATIC - browser port of diwali.py (1920x1080 @ 60fps, 2x playback speed).
   Keys: SPACE pause | R restart.  Add ?loop to the URL to restart after the finale. */
const W = 1920, H = 1080, PI = Math.PI;
const TL = { sky: [.35, 2.25], stars: [.25, 2.5], moon: [1.25, 2.75], rockets: 4.25, diyas: [8.5, 13], morph: [18, 26], reveal: [23, 29], giant: 29, rain: 30, ending: [35, 42], total: 45 };
const GOLD = [255, 196, 60], RED = [255, 38, 44], ORANGE = [255, 114, 18], PURPLE = [170, 64, 255], BLUE = [46, 150, 255], WHITE = [255, 244, 226], PINK = [255, 84, 176];
const COMBOS = [[GOLD, RED], [RED, ORANGE], [PURPLE, BLUE], [BLUE, WHITE], [ORANGE, GOLD], [PURPLE, PINK], [GOLD, WHITE], [BLUE, GOLD], [RED, GOLD], [PURPLE, GOLD], [ORANGE, RED], [BLUE, PURPLE]];
const STYLES = ["peony", "chrysanthemum", "willow", "ring", "heart", "spiral", "crossette", "double"];
const STYLE_P = [.20, .16, .11, .12, .06, .08, .11, .16];
const SEED = 2026, LOOP = location.search.includes('loop');
const FONTS = '"Palatino Linotype","Book Antiqua",Palatino,Georgia,"Times New Roman",serif';

/* ---------- helpers ---------- */
class RNG {
  constructor(s) { this.s = s >>> 0; }
  next() { let t = this.s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  u(a = 0, b = 1) { return a + (b - a) * this.next(); }
  n(m = 0, s = 1) { const u = 1 - this.next(), v = this.next(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * v); }
  i(a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.floor(this.next() * (b - a)); }
  exp(scale) { return -Math.log(1 - this.next()) * scale; }
  pois(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= this.next(); } while (p > L); return k - 1; }
  pick(p) { let r = this.next(), c = 0; for (let i = 0; i < p.length; i++) { c += p[i]; if (r < c) return i; } return p.length - 1; }
}
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeIO = q => q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
const cx2 = c => c.getContext('2d', { willReadFrequently: true });
const hq = c => { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; return c; };
/* canvas from a per-pixel callback fn(d, w, h) that fills RGBA bytes */
function img(w, h, fn) { const c = mk(w, h), x = cx2(c), id = x.createImageData(c.width, c.height); fn(id.data, c.width, c.height); x.putImageData(id, 0, 0); return c; }
function scaled(src, w, h) { const c = mk(w, h), x = hq(cx2(c)); x.drawImage(src, 0, 0, c.width, c.height); return c; }
function blurSurf(s, f) { const w = s.width, h = s.height; return scaled(scaled(s, Math.max(2, w / f | 0), Math.max(2, h / f | 0)), w, h); }
const ADD = (c, fn) => { c.globalCompositeOperation = 'lighter'; fn(); c.globalCompositeOperation = 'source-over'; };
const gains = (n, a, b) => Array.from({ length: n }, (_, i) => a + b * i);
function glowSet(rx, ry, col, power, gs) {
  const w = rx * 2, h = ry * 2, base = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { const yy = (y - ry + .5) / ry; for (let x = 0; x < w; x++) { const xx = (x - rx + .5) / rx; base[y * w + x] = Math.pow(clamp01(1 - Math.sqrt(xx * xx + yy * yy)), power); } }
  return gs.map(g => img(w, h, d => { for (let i = 0; i < w * h; i++) { const v = base[i] * g; d[i * 4] = Math.min(255, v * col[0]); d[i * 4 + 1] = Math.min(255, v * col[1]); d[i * 4 + 2] = Math.min(255, v * col[2]); d[i * 4 + 3] = 255; } }));
}
const glow1 = (rx, ry, col, p, g) => glowSet(rx, ry, col, p, [g])[0];
function noise(w, h, rng, oct) {
  const out = new Float32Array(w * h); let tot = 0;
  for (const [cx, cy, amp] of oct) {
    const g = img(cx, cy, d => { for (let i = 0; i < cx * cy; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.floor(rng.next() * 255); d[i * 4 + 3] = 255; } });
    const b = scaled(g, w, h), d = cx2(b).getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) out[i] += d[i * 4] / 255 * amp; tot += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
const interp = (x, xs, ys) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * t; } return ys[ys.length - 1]; };

/* ---------- asset builders ---------- */
function buildSky(rng) {
  const stops = [0, .45, .78, 1], cols = [[1, 3, 14], [5, 10, 40], [12, 22, 68], [58, 40, 30]];
  const n1 = noise(W, H, rng, [[4, 3, .55], [9, 6, .28], [20, 12, .12], [44, 25, .05]]);
  const n2 = noise(W, H, rng, [[4, 3, .55], [9, 6, .28], [20, 12, .12], [44, 25, .05]]);
  const base = []; for (let y = 0; y < H; y++) { const yf = y / (H - 1); base.push([0, 1, 2].map(k => interp(yf, stops, cols.map(c => c[k])))); }
  return img(W, H, d => {
    for (let y = 0; y < H; y++) {
      const yf = y / (H - 1), ys = (y - H / 2) / (H / 2), b = base[y], hz = Math.exp(-Math.pow((1 - yf) / .16, 2));
      for (let x = 0; x < W; x++) {
        const i = y * W + x, g = Math.pow(clamp01((n1[i] - .46) * 2.4), 1.5) * (.25 + .75 * yf), p = Math.pow(clamp01((n2[i] - .5) * 2.6), 1.5);
        const xs = (x - W / 2) / (W / 2), v = 1 - .42 * Math.pow(clamp01((xs * xs + ys * ys) / 2), 1.15), o = i * 4;
        d[o] = Math.min(255, (b[0] + g * 36 + p * 14 + hz * 46) * v); d[o + 1] = Math.min(255, (b[1] + g * 21 + p * 6 + hz * 26) * v); d[o + 2] = Math.min(255, (b[2] + g * 5 + p * 32 + hz * 6) * v); d[o + 3] = 255;
      }
    }
  });
}
function buildMoon(R = 88) {
  const r = new RNG(7), S = R * 2, cr = [], sm = [];
  for (let k = 0; k < 5; k++) cr.push([r.u(-R * .6, R * .6), r.u(-R * .6, R * .6), r.u(R * .22, R * .42)]);
  for (let k = 0; k < 26; k++) sm.push([r.u(-R * .85, R * .85), r.u(-R * .85, R * .85), r.u(3, 11)]);
  return img(S, S, d => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const xx = x - R + .5, yy = y - R + .5, dd = Math.sqrt(xx * xx + yy * yy), al = clamp01((R - dd) / 1.6), z = Math.sqrt(clamp01(1 - (dd / R) ** 2));
      let b = .8 + .2 * z - .1 * clamp01((xx + yy * .6) / R);
      for (const [cx, cy, rad] of cr) b -= .13 * Math.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / rad ** 2) * 1.6);
      for (const [cx, cy, rad] of sm) { const q = Math.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rad; b -= .16 * Math.exp(-(q ** 4) * 1.2) - .07 * Math.exp(-(((q - 1.05) / .18) ** 2)); }
      b = Math.max(0, Math.min(1.1, b)); const o = (y * S + x) * 4;
      d[o] = Math.min(255, b * 255); d[o + 1] = Math.min(255, b * 244); d[o + 2] = Math.min(255, b * 214); d[o + 3] = al * 255;
    }
  });
}
function buildDiya(tw, flat = false) {
  const ss = 3, m = ss * tw / 450, cw = Math.floor(450 * m), ch = Math.floor(240 * m), s = mk(cw, ch), c = cx2(s);
  const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * m, y * m) : c.moveTo(x * m, y * m)); c.closePath(); c.fill(); };
  const ell = (x, y, w, h, col, lw) => { c.beginPath(); if (lw) { c.strokeStyle = col; c.lineWidth = lw; c.ellipse((x + w / 2) * m, (y + h / 2) * m, w / 2 * m - lw / 2, h / 2 * m - lw / 2, 0, 0, 2 * PI); c.stroke(); } else { c.fillStyle = col; c.ellipse((x + w / 2) * m, (y + h / 2) * m, w / 2 * m, h / 2 * m, 0, 0, 2 * PI); c.fill(); } };
  const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x * m, y * m, r * m, 0, 2 * PI); c.fill(); };
  const col = flat ? '#fff' : 'rgb(190,95,40)', bowl = []; for (let k = 0; k < 48; k++) { const a = PI * k / 47; bowl.push([225 + 190 * Math.cos(a), 88 + 128 * Math.sin(a)]); }
  poly(bowl, col); poly([[165, 200], [285, 200], [300, 228], [150, 228]], col); poly([[38, 100], [6, 50], [74, 66], [120, 92]], col); ell(35, 48, 380, 80, col);
  if (flat) { c.globalCompositeOperation = 'destination-out'; ell(66, 62, 318, 50, '#000'); c.globalCompositeOperation = 'source-over'; }
  else {
    const id = c.getImageData(0, 0, cw, ch), d = id.data;
    for (let y = 0; y < ch; y++) { const v = clamp01((y / (ch - 1) - .2) / .8); for (let x = 0; x < cw; x++) { const hz = .78 + .4 * Math.exp(-(((x / (cw - 1) - .38) / .28) ** 2)), o = (y * cw + x) * 4; d[o] = (236 * (1 - v) + 86 * v) * hz; d[o + 1] = (142 * (1 - v) + 36 * v) * hz; d[o + 2] = (70 * (1 - v) + 20 * v) * hz; } }
    c.putImageData(id, 0, 0);
    ell(35, 48, 380, 80, 'rgb(236,178,64)'); ell(35, 48, 380, 80, 'rgb(255,226,130)', Math.max(2, Math.floor(m * 1.4)));
    ell(56, 57, 338, 62, 'rgb(58,22,8)'); ell(110, 72, 230, 32, 'rgb(150,66,14)');
    for (let k = 0; k < 9; k++) { const a = (.2 + .6 * k / 8) * PI; dot(225 + 167 * Math.cos(a), 88 + 110 * Math.sin(a), 7, 'rgb(244,196,74)'); }
    for (let k = 0; k < 6; k++) { const a = (.3 + .4 * k / 5) * PI; dot(225 + 130 * Math.cos(a), 88 + 84 * Math.sin(a), 4, 'rgb(255,214,110)'); }
    c.strokeStyle = 'rgb(236,178,64)'; c.lineWidth = 5 * m; c.beginPath(); c.moveTo(170 * m, 207 * m); c.lineTo(280 * m, 207 * m); c.stroke();
    c.fillStyle = 'rgb(40,20,10)'; c.fillRect(211 * m, 60 * m, 8 * m, 30 * m); dot(215, 60, 4, 'rgb(255,170,70)');
    ell(80, 112, 120, 36, 'rgba(255,235,200,.216)');
  }
  return scaled(s, tw, Math.floor(240 * tw / 450));
}
function buildFlames(w = 64, h = 150, n = 20) {
  const fr = [], outer = [255, 70, 8], mid = [255, 170, 40], inner = [255, 248, 205];
  for (let f = 0; f < n; f++) {
    const ph = 2 * PI * f / n, sway = .28 * Math.sin(ph) + .12 * Math.sin(2 * ph + 1.3), L = .92 + .07 * Math.sin(3 * ph + .7) + .04 * Math.sin(5 * ph);
    fr.push(img(w, h, d => {
      for (let y = 0; y < h; y++) {
        const v = 1 - y / (h - 1), vv = clamp01(v / L), hw = .78 * Math.pow(Math.max(0, Math.sin(PI * Math.pow(vv, .62))), .85) + 1e-4, center = sway * vv * vv + .04 * Math.sin(ph * 2 + vv * 5) * vv;
        for (let x = 0; x < w; x++) {
          const xs = -1 + 2 * x / (w - 1), dd = Math.abs(xs - center) / hw, I = v <= L ? Math.pow(clamp01(1 - dd), 1.35) : 0, k = clamp01(1 - dd * 1.4) * clamp01(1 - vv * .9);
          const a = clamp01(k * 2), b = clamp01(k * 2 - 1), bb = clamp01(1 - vv * 6) * clamp01(1 - dd * 1.1) * .5, o = (y * w + x) * 4;
          d[o] = Math.min(255, (outer[0] + (mid[0] - outer[0]) * a + (inner[0] - mid[0]) * b) * I + bb * 40);
          d[o + 1] = Math.min(255, (outer[1] + (mid[1] - outer[1]) * a + (inner[1] - mid[1]) * b) * I + bb * 90);
          d[o + 2] = Math.min(255, (outer[2] + (mid[2] - outer[2]) * a + (inner[2] - mid[2]) * b) * I + bb * 255); d[o + 3] = 255;
        }
      }
    }));
  }
  return fr;
}
function buildHeart(size) {
  const S = size * 2;
  return scaled(img(S, S, d => {
    for (let y = 0; y < S; y++) { const ys = 1.35 - 2.6 * y / (S - 1); for (let x = 0; x < S; x++) {
      const xs = -1.35 + 2.7 * x / (S - 1), f = (xs * xs + ys * ys - 1) ** 3 - xs * xs * ys ** 3, a = clamp01(.5 - f * 30), light = Math.exp(-(((xs + .45) ** 2 + (ys - .55) ** 2) / .35)), edge = clamp01(-f * 6), k = .62 + .38 * edge, o = (y * S + x) * 4, sh = .75 + .3 * (1 - ys * .2);
      d[o] = Math.min(255, (214 * sh + light * 255 * .55) * k); d[o + 1] = Math.min(255, (8 * sh + light * 150 * .55) * k); d[o + 2] = Math.min(255, (38 * sh + light * 160 * .55) * k); d[o + 3] = a * 255; } }
  }), size, size);
}
function renderTracked(text, font, size, tracking, fat) {
  const t = cx2(mk(8, 8)); t.font = font; const asc = Math.ceil(t.measureText('Hg').fontBoundingBoxAscent || size), dsc = Math.ceil(t.measureText('Hg').fontBoundingBoxDescent || size * .25);
  const adv = [...text].map(c => Math.round(t.measureText(c).width));
  const w = adv.reduce((a, b) => a + b, 0) + tracking * (text.length - 1) + 2 * fat + 6, h = asc + dsc + 2 * fat + 4, m = mk(w, h), c = cx2(m);
  c.font = font; c.fillStyle = '#fff'; c.textBaseline = 'alphabetic'; let x = fat + 3;
  [...text].forEach((ch, i) => { for (let dx = -fat; dx <= fat; dx++) for (let dy = -fat; dy <= fat; dy++) if (dx * dx + dy * dy <= fat * fat + 1) c.fillText(ch, x + dx, fat + 2 + asc + dy); x += adv[i] + tracking; });
  const d = c.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (d[(y * w + xx) * 4 + 3] > 0) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const o = mk(x1 - x0 + 1, y1 - y0 + 1); cx2(o).drawImage(m, -x0, -y0); return o;
}
function roll(a, cw, ch, dx, dy) { const o = new Float32Array(a.length); for (let y = 0; y < ch; y++) { const sy = ((y - dy) % ch + ch) % ch; for (let x = 0; x < cw; x++) o[y * cw + x] = a[sy * cw + (((x - dx) % cw) + cw) % cw]; } return o; }
function blur3(a, cw, ch) { const r1 = roll(a, cw, ch, 1, 0), r2 = roll(a, cw, ch, -1, 0), r3 = roll(a, cw, ch, 0, 1), r4 = roll(a, cw, ch, 0, -1), o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] + r1[i] + r2[i] + r3[i] + r4[i]) / 5; return o; }
function finishGold(mask, depth = 15) {
  const w = mask.width, h = mask.height, pad = depth + 40, cw = w + 2 * pad, ch = h + 2 * pad, A = new Float32Array(cw * ch);
  const md = cx2(mask).getImageData(0, 0, w, h).data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) A[(y + pad) * cw + x + pad] = md[(y * w + x) * 4 + 3] / 255;
  const sh = (a, dx, dy) => roll(a, cw, ch, dx, dy), s1 = sh(A, 3, 3), s2 = sh(A, -3, -3), hiA = new Float32Array(A.length), loA = new Float32Array(A.length);
  for (let i = 0; i < A.length; i++) { hiA[i] = A[i] * (1 - s1[i]); loA[i] = A[i] * (1 - s2[i]); }
  const hi = blur3(hiA, cw, ch), lo = blur3(loA, cw, ch), e1 = sh(A, 2, 0), e2 = sh(A, -2, 0), e3 = sh(A, 0, 2), e4 = sh(A, 0, -2), rA = new Float32Array(A.length);
  for (let i = 0; i < A.length; i++) rA[i] = clamp01(A[i] - Math.min(A[i], e1[i], e2[i], e3[i], e4[i]));
  const rim = blur3(rA, cw, ch), st = [0, .16, .40, .54, .76, 1], cs = [[255, 249, 214], [255, 226, 122], [238, 172, 42], [176, 104, 14], [244, 196, 84], [255, 238, 160]];
  const fs = img(cw, ch, d => { for (let y = 0; y < ch; y++) { const t = clamp01((y - pad) / Math.max(h, 1)), g = [0, 1, 2].map(k => interp(t, st, cs.map(c => c[k]))); for (let x = 0; x < cw; x++) { const i = y * cw + x, sk = 1 + .045 * Math.sin(x * .21 + y * .55), l = 1 - .55 * lo[i], o = i * 4;
    d[o] = Math.min(255, g[0] * sk * l + hi[i] * 255 * .8 + rim[i] * 255 * .22); d[o + 1] = Math.min(255, g[1] * sk * l + hi[i] * 250 * .8 + rim[i] * 226 * .22); d[o + 2] = Math.min(255, g[2] * sk * l + hi[i] * 222 * .8 + rim[i] * 140 * .22); d[o + 3] = clamp01(A[i]) * 255; } } });
  const maskc = mk(cw, ch); cx2(maskc).drawImage(mask, pad, pad);
  const out = mk(cw, ch), oc = cx2(out), tint = (col) => { const t = mk(cw, ch), tc = cx2(t); tc.fillStyle = col; tc.fillRect(0, 0, cw, ch); tc.globalCompositeOperation = 'destination-in'; tc.drawImage(maskc, 0, 0); return t; };
  oc.globalAlpha = 150 / 255; oc.drawImage(blurSurf(tint('#000'), 4), depth + 6, depth + 14); oc.globalAlpha = 1;
  for (let i = depth; i > 0; i--) { const u = i / depth; oc.drawImage(tint(`rgb(${205 - 135 * u | 0},${128 - 94 * u | 0},${30 - 24 * u | 0})`), Math.floor(i * .6), Math.floor(i * .92)); }
  oc.drawImage(fs, 0, 0);
  const lum = img(cw, ch, d => { for (let i = 0; i < A.length; i++) { const v = clamp01(A[i]) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } });
  const bw = cw + 900, band = img(bw, ch, d => { for (let y = 0; y < ch; y++) for (let x = 0; x < bw; x++) { const dd = x - y * .65 - bw / 2, I = Math.exp(-((dd / 70) ** 2)) * .9 + Math.exp(-(((dd - 230) / 26) ** 2)) * .4, o = (y * bw + x) * 4; d[o] = Math.min(255, I * 255); d[o + 1] = Math.min(255, I * 246); d[o + 2] = Math.min(255, I * 205); d[o + 3] = 255; } });
  return { out, lum, band, A, pad, size: [cw, ch], cw, ch, tmp: mk(cw, ch) };
}
function pickSome(arr, k, rng) { const idx = arr.map((_, i) => i); for (let i = 0; i < Math.min(k, idx.length); i++) { const j = i + rng.i(idx.length - i); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx.slice(0, Math.min(k, idx.length)).map(i => arr[i]); }
class Greeting {
  constructor(rng) {
    let size = 190, m1, icon_w, gap, total, f1;
    for (;;) { f1 = `bold ${size}px ${FONTS}`; const tr = Math.floor(size * .06); m1 = renderTracked("HAPPY DIWALI JAAN", f1, size, tr, Math.max(2, Math.floor(size / 55))); icon_w = Math.floor(size); gap = Math.floor(size * .30); total = icon_w * 2 + gap * 2 + m1.width; if (total <= 1800 || size <= 70) break; size -= 6; }
    const ih = Math.floor(240 * icon_w / 450), mh = Math.max(m1.height, ih + 10), mask1 = mk(total, mh), mc = cx2(mask1), icon = buildDiya(icon_w, true), iy = Math.floor((mh - ih) / 2) + Math.floor(ih * .18);
    mc.drawImage(icon, 0, iy); mc.save(); mc.translate(total, 0); mc.scale(-1, 1); mc.drawImage(icon, 0, iy); mc.restore(); mc.drawImage(m1, icon_w + gap, Math.floor((mh - m1.height) / 2));
    const s2 = Math.max(40, Math.floor(size * .5)), m2 = renderTracked("BEST WISHES, SOURAV", `bold ${s2}px ${FONTS}`, s2, Math.floor(s2 * .10), Math.max(2, Math.floor(s2 / 50)));
    const hsz = Math.floor(s2 * 1.3), hgap = Math.floor(s2 * .45), total2 = m2.width + hgap + hsz; this.heart = buildHeart(hsz);
    const c1y = 462, c2y = c1y + Math.floor(mh / 2) + 80 + Math.floor(m2.height / 2);
    const L1 = finishGold(mask1); L1.pos = [Math.floor((W - total) / 2) - L1.pad, c1y - Math.floor(mh / 2) - L1.pad];
    const L2 = finishGold(m2, 11), l2x = Math.floor((W - total2) / 2); L2.pos = [l2x - L2.pad, c2y - Math.floor(m2.height / 2) - L2.pad];
    this.lines = [L1, L2]; this.heart_pos = [l2x + m2.width + hgap, c2y - Math.floor(hsz / 2)];
    const ax = 215 * icon_w / 450, ay = 66 * icon_w / 450, x0 = Math.floor((W - total) / 2), y0 = c1y - Math.floor(mh / 2); this.icon_w = icon_w;
    this.flame_anchors = [[x0 + ax, y0 + iy + ay], [x0 + total - ax, y0 + iy + ay]];
    const pts = [], edge = [];
    for (const L of this.lines) { const { A, cw, ch } = L, [ox, oy] = L.pos, e1 = roll(A, cw, ch, 3, 0), e2 = roll(A, cw, ch, -3, 0), e3 = roll(A, cw, ch, 0, 3), e4 = roll(A, cw, ch, 0, -3);
      for (let x = 0; x < cw; x++) for (let y = 0; y < ch; y++) { const i = y * cw + x; if (A[i] > .6) { pts.push([x + ox, y + oy]); if (Math.min(A[i], e1[i], e2[i], e3[i], e4[i]) < .5) edge.push([x + ox, y + oy]); } } }
    this.targets = pickSome(pts, 9500, rng); this.edge = pickSome(edge, 3000, rng);
    this.bx = 0; this.by = 150; this.bw = W; this.bh = 800;
    const blk = new Float32Array(this.bw * this.bh);
    for (const L of this.lines) { const al = cx2(L.out).getImageData(0, 0, L.cw, L.ch).data, ox = L.pos[0] - this.bx, oy = L.pos[1] - this.by;
      for (let y = 0; y < L.ch; y++) { const yy = y + oy; if (yy < 0 || yy >= this.bh) continue; for (let x = 0; x < L.cw; x++) { const xx = x + ox; if (xx < 0 || xx >= this.bw) continue; const v = al[(y * L.cw + x) * 4 + 3] / 255; if (v > blk[yy * this.bw + xx]) blk[yy * this.bw + xx] = v; } } }
    const gray = img(this.bw, this.bh, d => { for (let i = 0; i < blk.length; i++) { const v = blk[i] * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } });
    const half = scaled(gray, this.bw / 2, this.bh / 2), aura = mk(half.width, half.height), ac = cx2(aura);
    ac.drawImage(blurSurf(half, 10), 0, 0); ADD(ac, () => { ac.drawImage(blurSurf(half, 3), 0, 0); ac.drawImage(blurSurf(half, 28), 0, 0); });
    ac.globalCompositeOperation = 'multiply'; ac.fillStyle = 'rgb(255,168,48)'; ac.fillRect(0, 0, aura.width, aura.height); this.aura = aura;
  }
}

/* ---------- particles / fireworks ---------- */
class Particles {
  constructor(cap = 24000) { this.cap = cap; this.n = 0; const F = Float32Array; ['x', 'y', 'px', 'py', 'vx', 'vy', 'life', 'ml', 'r', 'g', 'b', 'drag', 'grav', 'depth'].forEach(k => this[k] = new F(cap)); this.kind = new Int8Array(cap); }
  add(x, y, vx, vy, life, r, g, b, drag, grav, kind, depth) { if (this.n >= this.cap) return; const i = this.n++; this.x[i] = this.px[i] = x; this.y[i] = this.py[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.life[i] = this.ml[i] = life; this.r[i] = r; this.g[i] = g; this.b[i] = b; this.drag[i] = drag; this.grav[i] = grav; this.kind[i] = kind; this.depth[i] = depth; }
  update(dt, rng) {
    const n0 = this.n;
    for (let i = 0; i < n0; i++) {
      this.px[i] = this.x[i]; this.py[i] = this.y[i]; const d = Math.exp(-this.drag[i] * dt); this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt; this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.life[i] -= dt;
      if (this.kind[i] === 2 && this.life[i] < this.ml[i] * .5) { this.kind[i] = 0;
        for (let k = 0; k < 6; k++) { const a = rng.u(0, 6.2832), sp = rng.u(70, 190); this.add(this.x[i], this.y[i], Math.cos(a) * sp + this.vx[i] * .25, Math.sin(a) * sp + this.vy[i] * .25, rng.u(.6, 1.1), this.r[i], this.g[i], this.b[i], 1.6, 90, 1, .6); } }
    }
    let j = 0; const n = this.n;
    for (let i = 0; i < n; i++) if (this.life[i] > 0) { if (i !== j) for (const k of ['x', 'y', 'px', 'py', 'vx', 'vy', 'life', 'ml', 'r', 'g', 'b', 'drag', 'grav', 'depth', 'kind']) this[k][j] = this[k][i]; j++; }
    this.n = j;
  }
  draw(d, rng) {
    for (let i = 0; i < this.n; i++) {
      const u = clamp01(this.life[i] / this.ml[i]), age = 1 - u, wh = clamp01(1 - age / .10) * .8, em = clamp01((age - .55) / .45);
      const br = Math.pow(u, .55) * (.55 + .45 * this.depth[i]) * (this.kind[i] === 1 ? rng.u(.15, 1.25) : 1);
      const R = Math.min(255, Math.max(0, (this.r[i] * (1 - wh) + 255 * wh) * br)) | 0, G = Math.min(255, Math.max(0, (this.g[i] * (1 - wh) + 255 * wh) * (1 - em * .5) * br)) | 0, B = Math.min(255, Math.max(0, (this.b[i] * (1 - wh) + 255 * wh) * (1 - em * .85) * br)) | 0, mx = Math.max(R, G, B);
      if (mx <= 12) continue;
      for (let s = 0; s < 5; s++) { const t = s / 4, xi = Math.trunc(this.px[i] * (1 - t) + this.x[i] * t), yi = Math.trunc(this.py[i] * (1 - t) + this.y[i] * t);
        if (xi < 0 || xi >= W - 1 || yi < 0 || yi >= H - 1) continue; let o = (yi * W + xi) * 4; d[o] = R; d[o + 1] = G; d[o + 2] = B;
        if (mx > 120) { o += 4; d[o] = R; d[o + 1] = G; d[o + 2] = B; o = ((yi + 1) * W + xi) * 4; d[o] = R; d[o + 1] = G; d[o + 2] = B; } }
    }
  }
}
function sphereDir(rng) { const z = rng.u(-1, 1), a = rng.u(0, 2 * PI), r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; }
class Show {
  constructor(rng, q = 1) { this.rng = rng; this.q = q; this.ps = new Particles(); this.rockets = []; this.flashes = []; this.rings = []; this.fcache = new Map(); this.screen_flash = 0; this.G = 340; }
  launch(o = {}) { const r = this.rng, x = o.x !== undefined ? o.x : r.u(220, 1700), h = o.apex !== undefined ? o.apex : r.u(560, 880), v0 = Math.sqrt(2 * this.G * h), [cA, cB] = o.cols || COMBOS[r.i(COMBOS.length)];
    this.rockets.push({ x, y: H + 10, vx: r.u(-70, 70), vy: -v0, cA, cB, scale: o.scale || 1, style: o.style, ph: r.u(0, 6.28) }); }
  step(dt, t) {
    const r = this.rng;
    for (const rk of this.rockets.slice()) {
      rk.vy += this.G * dt; rk.x += rk.vx * dt + Math.sin(t * 18 + rk.ph) * .5; rk.y += rk.vy * dt;
      for (let k = 0; k < 4; k++) { const f = r.u(.7, 1); this.ps.add(rk.x, rk.y, r.n(0, 22), r.u(60, 160), r.u(.4, .9), 255 * f, 175 * f, 70 * f, 2, 120, 1, .5); }
      if (rk.vy > -35) { this.explode(rk.x, rk.y, rk.cA, rk.cB, rk.scale, rk.style); this.rockets.splice(this.rockets.indexOf(rk), 1); }
    }
    for (const f of this.flashes.slice()) { f[3] *= Math.exp(-f[4] * dt); if (f[3] < .05) this.flashes.splice(this.flashes.indexOf(f), 1); }
    for (const g of this.rings.slice()) { g[2] += g[3] * dt; g[4] -= dt; if (g[4] <= 0) this.rings.splice(this.rings.indexOf(g), 1); }
    this.screen_flash *= Math.exp(-3.5 * dt); this.ps.update(dt, r);
  }
  shell(x, y, n, speed, col, life, o = {}) {
    const r = this.rng, drag = o.drag ?? 1.35, grav = o.grav ?? 70, kind = o.kind ?? 0, jit = o.jitter ?? .08; let dirs = o.dirs;
    if (!dirs) { n = Math.max(4, Math.floor(n * this.q)); dirs = Array.from({ length: n }, () => sphereDir(r)); } n = dirs.length;
    for (let i = 0; i < n; i++) { const d = dirs[i], sp = (Array.isArray(speed) ? speed[i] : speed) * (1 - jit * r.next()), depth = (d[2] + 1) / 2, k = .9 + .2 * depth, f = r.u(.85, 1);
      this.ps.add(x, y, d[0] * sp * k, d[1] * sp * k, r.u(life * .8, life * 1.15), col[0] * f, col[1] * f, col[2] * f, drag, grav, kind, depth); }
  }
  flash(x, y, col, I, decay = 3, R = 80) { this.flashes.push([x, y, col, I, decay, R]); }
  explode(x, y, cA, cB, s = 1, style) {
    const r = this.rng; style = style || STYLES[r.pick(STYLE_P)]; const sh = (...a) => this.shell(x, y, ...a), q = this.q;
    sh(50 * s, Array.from({ length: Math.max(4, Math.floor(50 * s * q)) }, () => r.u(100, 300)), WHITE, .45, { drag: 3, grav: 0, jitter: 0 });
    const ringDirs = (n, tilt) => Array.from({ length: n }, (_, k) => { const th = 2 * PI * k / n; return [Math.cos(th), Math.sin(th) * Math.cos(tilt), Math.sin(th) * Math.sin(tilt)]; });
    if (style === "peony") { sh(320 * s, 560 * s, cA, 2.2); sh(160 * s, 330 * s, cB, 1.9, { drag: 1.5 }); sh(80 * s, 440 * s, WHITE, 2.8, { grav: 55, kind: 1 }); }
    else if (style === "chrysanthemum") { sh(380 * s, 600 * s, cA, 3, { drag: 1.1, grav: 60 }); sh(160 * s, 360 * s, cB, 2.6, { drag: 1.2 }); sh(40 * s, 480 * s, cB, 1.5, { kind: 2 }); }
    else if (style === "willow") { sh(300 * s, 420 * s, GOLD, 4.2, { drag: .95, grav: 150 }); sh(100 * s, 300 * s, WHITE, 3.5, { drag: 1, grav: 130, kind: 1 }); }
    else if (style === "ring") { for (const [col, tilt, spd] of [[cA, r.u(.5, 1.3), 520], [cB, r.u(.3, 1.2), 380]]) { const n = Math.max(8, Math.floor(150 * s * q)); sh(n, spd * s, col, 2.3, { drag: 1.4, dirs: ringDirs(n, tilt), jitter: .02 }); } sh(100 * s, 240 * s, WHITE, 1.8, { kind: 1 }); }
    else if (style === "heart") { for (const [sc, col] of [[1, cA], [.55, cB]]) { const n = Math.max(16, Math.floor(160 * s * q)), dirs = Array.from({ length: n }, (_, k) => { const t = 2 * PI * k / n, hx = 16 * Math.sin(t) ** 3, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [hx / 17, -hy / 17, 0]; }); sh(n, 560 * s * sc, col, 2.4, { drag: 1.5, dirs, jitter: 0 }); } sh(70 * s, 300 * s, WHITE, 2, { kind: 1 }); }
    else if (style === "spiral") { const n = Math.max(30, Math.floor(360 * s * q)), dirs = [], sp = []; for (let i = 0; i < n; i++) { const fr = i / n, ang = (i % 3) * 2 * PI / 3 + fr * 5.5; dirs.push([Math.cos(ang), Math.sin(ang), 0]); sp.push(60 + fr * 600 * s); } sh(n, sp, cA, 2.4, { drag: 1.3, dirs, jitter: 0 }); sh(120 * s, 380 * s, cB, 1.8, { kind: 1 }); }
    else if (style === "crossette") { sh(120 * s, 500 * s, cA, 1.9, { kind: 2 }); sh(180 * s, 420 * s, cB, 2); }
    else { sh(300 * s, 600 * s, cA, 2.4); const n = Math.max(10, Math.floor(140 * s * q)); sh(n, 380 * s, cB, 2.2, { drag: 1.4, dirs: ringDirs(n, r.u(.4, 1.2)), jitter: .02 }); sh(80 * s, 240 * s, WHITE, 1.6, { kind: 1 }); }
    this.flash(x, y, cA, .8 * Math.min(1.3, s + .2)); this.rings.push([x, y, 6, 800 * s, .5, .5, cA]);
  }
  giant(x, y) {
    const sh = (...a) => this.shell(x, y, ...a);
    sh(1100, 980, GOLD, 4.6, { drag: 1.05, grav: 50 }); sh(600, 720, [255, 150, 30], 4, { drag: 1.1, grav: 55 }); sh(350, 480, [255, 232, 160], 3.6, { drag: 1.2, grav: 60 });
    sh(350, 600, GOLD, 5.6, { drag: .8, grav: 120 }); sh(500, 800, WHITE, 4.8, { drag: 1, grav: 60, kind: 1 });
    const n = Math.max(20, Math.floor(240 * this.q)), dirs = Array.from({ length: n }, (_, k) => { const th = 2 * PI * k / n; return [Math.cos(th), Math.sin(th) * .35, Math.sin(th) * .94]; });
    sh(n, 1150, [255, 220, 120], 3.4, { drag: 1.3, dirs, jitter: .01 }); sh(60, 700, GOLD, 2.6, { kind: 2 });
    this.flash(x, y, GOLD, 1.9, 1.6, 200); this.flash(x, y, WHITE, 1.2, 2.6, 200);
    for (let k = 0; k < 3; k++) this.rings.push([x, y, 6, 1300 - 250 * k, 1.1, 1.1, GOLD]); this.screen_flash = 1;
  }
  drawOverlays(d) {
    const px = (x, y, r, g, b) => { if (x < 0 || x >= W || y < 0 || y >= H) return; const o = (y * W + x) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; };
    for (const rk of this.rockets) { const cx = Math.trunc(rk.x), cy = Math.trunc(rk.y); for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const q = dx * dx + dy * dy; if (q <= 9) px(cx + dx, cy + dy, 255, 240, 200); else if (q <= 25) px(cx + dx, cy + dy, 255, 150, 50); } }
    for (const [x, y, rad, , life, ml, col] of this.rings) { const a = Math.pow(clamp01(life / ml), 1.5) * .55; if (rad <= 2) continue; const c = col.map(v => v * a | 0), n = Math.max(16, Math.ceil(2 * PI * rad));
      for (let k = 0; k < n; k++) { const an = 2 * PI * k / n; for (const rr of [rad, rad - 1]) px(Math.trunc(x + rr * Math.cos(an)), Math.trunc(y + rr * Math.sin(an)), c[0], c[1], c[2]); } }
  }
  drawFlashes(c) {
    for (const [x, y, col, I, , R] of this.flashes) { const lvl = Math.min(Math.floor(I * 10), 22); if (lvl <= 0) continue; const key = col.join() + '|' + lvl + '|' + R; let spr = this.fcache.get(key); if (!spr) { spr = glow1(R, R, col, 1.8, lvl / 10 * .9); this.fcache.set(key, spr); } c.drawImage(spr, Math.trunc(x / 4 - R), Math.trunc(y / 4 - R)); }
  }
}
class Bloom {
  constructor() { this.small = mk(W / 4, H / 4); this.tiny = mk(W / 16, Math.floor(H / 16)); this.wide = mk(W / 4, H / 4); this.mid = mk(W / 2, H / 2); this.big = mk(W, H); this.boost = mk(W / 4, H / 4);
    this.sc = hq(cx2(this.small)); this.tc = hq(cx2(this.tiny)); this.wc = hq(cx2(this.wide)); this.mc = hq(cx2(this.mid)); this.bc = cx2(this.big); this.bc.imageSmoothingEnabled = false; this.boc = cx2(this.boost); }
  run(fx, flashesFn, screen) {
    const { sc } = this; sc.globalCompositeOperation = 'source-over'; sc.drawImage(fx, 0, 0, W / 4, H / 4); this.boc.drawImage(this.small, 0, 0);
    ADD(sc, () => { sc.drawImage(this.boost, 0, 0); sc.drawImage(this.boost, 0, 0); flashesFn(sc); });
    this.tc.drawImage(this.small, 0, 0, this.tiny.width, this.tiny.height); this.wc.drawImage(this.tiny, 0, 0, W / 4, H / 4);
    ADD(sc, () => sc.drawImage(this.wide, 0, 0));
    this.mc.drawImage(this.small, 0, 0, W / 2, H / 2); this.bc.drawImage(this.mid, 0, 0, W, H);
    ADD(screen, () => screen.drawImage(this.big, 0, 0));
  }
}

/* ---------- scene elements ---------- */
class Stars {
  constructor(rng, n = 720) {
    this.n = n; this.x = []; this.y = []; this.size = []; this.phase = []; this.speed = []; this.appear = []; this.col = []; this.bright = [];
    for (let i = 0; i < n; i++) { this.x.push(rng.i(W)); this.y.push(Math.floor(H * .9 * Math.pow(rng.next(), 1.25))); this.size.push([1, 1, 1, 2, 2, 3][rng.i(6)]); this.phase.push(rng.u(0, 6.28)); this.speed.push(rng.u(.8, 3.2)); this.appear.push(rng.u(TL.stars[0], TL.stars[1])); }
    for (let i = 0; i < n; i++) this.col.push(rng.next() < .78 ? [255, 214, 120] : [225, 232, 255]);
    for (let i = 0; i < n; i++) this.bright.push(rng.u(.5, 1)); this.glow = glowSet(12, 12, [255, 215, 120], 2.2, [.25, .5, .75, 1]);
  }
  draw(c, t) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const a = clamp01((t - this.appear[i]) / 2.5); if (a <= 0) continue; const b = a * (.5 + .5 * Math.sin(t * this.speed[i] + this.phase[i])) * (.45 + .55 * this.bright[i]), cl = this.col[i], s = this.size[i], x = this.x[i], y = this.y[i];
      const col = `rgb(${cl[0] * b | 0},${cl[1] * b | 0},${cl[2] * b | 0})`;
      if (s < 3) { if (b > .04) { c.fillStyle = col; c.fillRect(x, y, s, s); } }
      else if (b > .05) { c.drawImage(this.glow[Math.min(3, Math.floor(b * 3.99))], x - 12, y - 12); c.fillStyle = col; c.fillRect(x - 6, y, 13, 1); c.fillRect(x, y - 6, 1, 13); c.fillRect(x - 1, y - 1, 3, 3); }
    }
    c.globalCompositeOperation = 'source-over';
  }
}
class Morph {
  constructor(targets, starts, rng) {
    const n = targets.length, T = TL.morph[1] - TL.morph[0]; this.n = n; this.tg = targets; this.st = starts;
    this.delay = new Float32Array(n); this.dur = new Float32Array(n); this.perp = new Float32Array(n * 2); this.amp = new Float32Array(n); this.ph = new Float32Array(n); this.col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.delay[i] = rng.u(0, .4 * T); for (let i = 0; i < n; i++) this.dur[i] = rng.u(.45 * T, .6 * T);
    for (let i = 0; i < n; i++) { const dx = targets[i][0] - starts[i][0], dy = targets[i][1] - starts[i][1], ln = Math.sqrt(dx * dx + dy * dy) + 1e-3; this.perp[i * 2] = -dy / ln; this.perp[i * 2 + 1] = dx / ln; }
    for (let i = 0; i < n; i++) this.amp[i] = rng.n(0, 170); for (let i = 0; i < n; i++) this.ph[i] = rng.u(0, 6.28);
    for (let i = 0; i < n; i++) { this.col[i * 3] = 255; this.col[i * 3 + 1] = 185 + rng.next() * 60; this.col[i * 3 + 2] = 70 + rng.next() * 80; }
  }
  draw(d, t) {
    if (t < TL.morph[0] || t > TL.reveal[1] + .5) return;
    for (let i = 0; i < this.n; i++) {
      const q0 = (t - TL.morph[0] - this.delay[i]) / this.dur[i]; if (q0 <= 0) continue; const q = Math.min(1, q0), e = easeIO(q), s = this.st[i], g = this.tg[i], pa = this.amp[i] * Math.sin(PI * e);
      const x = Math.trunc(s[0] + (g[0] - s[0]) * e + this.perp[i * 2] * pa), y = Math.trunc(s[1] + (g[1] - s[1]) * e + this.perp[i * 2 + 1] * pa); if (x < 0 || x >= W - 2 || y < 0 || y >= H - 2) continue;
      const br = (.35 + .65 * Math.pow(Math.max(0, Math.sin(PI * q)), .6)) * (.8 + .2 * Math.sin(t * 8 + this.ph[i])), R = Math.min(255, this.col[i * 3] * br) | 0, G = Math.min(255, this.col[i * 3 + 1] * br) | 0, B = Math.min(255, this.col[i * 3 + 2] * br) | 0;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const o = ((y + oy) * W + x + ox) * 4; d[o] = R; d[o + 1] = G; d[o + 2] = B; }
    }
  }
}
class Diyas {
  constructor(rng, base) {
    this.nf = base.length; this.sets = {};
    for (const [key, tw, fsz] of [["f", 132, [34, 84]], ["b", 92, [24, 60]]]) {
      const body = buildDiya(tw), rf = mk(body.width, body.height), rc = cx2(rf); rc.translate(0, body.height); rc.scale(1, -1); rc.drawImage(body, 0, 0); rc.setTransform(1, 0, 0, 1, 0, 0);
      const g = rc.createLinearGradient(0, 0, 0, body.height); g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)'); rc.globalCompositeOperation = 'destination-in'; rc.fillStyle = g; rc.fillRect(0, 0, body.width, body.height);
      this.sets[key] = { body, refl: rf, anc: [215 * tw / 450, 62 * tw / 450], fsz, flames: base.map(f => scaled(f, fsz[0], fsz[1])), glow: glowSet(Math.floor(tw * .8), Math.floor(tw * .8), [255, 128, 36], 2.3, gains(8, .2, .1)), floor: glowSet(Math.floor(tw * 1.2), Math.floor(tw * .26), [255, 150, 50], 1.6, gains(8, .14, .09)) };
    }
    this.cache = new Map(); this.items = []; const [d0, d1] = TL.diyas, lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
    for (const [k, cx, by] of [...lin(130, 1790, 13).map(c => ["b", c, 958]), ...lin(80, 1840, 15).map(c => ["f", c, 1004])]) { const dist = Math.abs(cx - 960) / 960; this.items.push({ k, x: cx, y: by, t0: d0 + dist * (d1 - d0 - 3) + rng.u(0, .8) + (k === "b" ? .5 : 0), ph: rng.u(0, 6.28) }); }
    this.order = [...this.items].sort((a, b) => (a.k !== "b") - (b.k !== "b") || a.x - b.x);
    this.floor = img(W, 260, d => { for (let y = 0; y < 260; y++) { const ys = y / 259, a = Math.pow(clamp01(ys * 2.2), 1.3) * 215; for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; d[o] = 10 + ys * 26; d[o + 1] = 6 + ys * 14; d[o + 2] = 10 + ys * 8; d[o + 3] = a; } } });
    this.t_first = Math.min(...this.items.map(d => d.t0));
  }
  flameSurf(key, L, fi) {
    const k = key + L + '|' + fi; let s = this.cache.get(k);
    if (!s) { const base = this.sets[key].flames[fi]; if (L >= 6) s = base; else { const f = L / 6; s = scaled(base, Math.max(2, Math.floor(base.width * (.35 + .65 * f))), Math.max(2, Math.floor(base.height * f))); } this.cache.set(k, s); } return s;
  }
  draw(c, t) {
    if (t < this.t_first) return; const fa = smooth(this.t_first, this.t_first + 2.5, t);
    c.globalAlpha = fa; c.drawImage(this.floor, 0, H - 260); c.globalAlpha = 1;
    for (const d of this.order) {
      const age = t - d.t0; if (age <= 0) continue; const s = this.sets[d.k], a = smooth(0, 1, age), bw = s.body.width, bh = s.body.height, x = Math.floor(d.x - Math.floor(bw / 2)), y = Math.floor(d.y - bh);
      c.globalAlpha = a; c.drawImage(s.refl, x, Math.floor(d.y) + 2); c.drawImage(s.body, x, y); c.globalAlpha = 1;
      const g = smooth(d.t0 + .7, d.t0 + 2.2, t); if (g <= .01) continue;
      const ph = d.ph, fl = .5 + .5 * (.55 * Math.sin(t * 11.3 + ph) + .3 * Math.sin(t * 23.7 + 2.1 * ph) + .15 * Math.sin(t * 37.1 + 3 * ph)), idx = Math.min(7, Math.floor(fl * g * 7.99)), ax = x + s.anc[0], ay = y + s.anc[1];
      const gl = s.glow[idx], fg = s.floor[idx], L = Math.floor(g * 6 + .001), fi = ((Math.floor(t * 16 + ph * 3) % this.nf) + this.nf) % this.nf, fs = this.flameSurf(d.k, L, fi), w = fs.width, h = fs.height;
      ADD(c, () => {
        c.drawImage(gl, Math.floor(ax - gl.width / 2), Math.floor(ay - gl.height / 2 - 18)); c.drawImage(fg, Math.floor(d.x - fg.width / 2), Math.floor(d.y - fg.height / 2 + 12));
        c.drawImage(fs, Math.floor(ax - w / 2), Math.floor(ay - h + 8));
        c.globalAlpha = 78 / 255; c.save(); c.translate(Math.floor(ax - w / 2), Math.floor(2 * d.y - ay - 8)); c.scale(1, -1); c.drawImage(fs, 0, -h); c.restore(); c.globalAlpha = 1;
      });
    }
  }
}
class Rain {
  constructor(rng, n = 520) { this.rng = rng; this.n = n; this.x = []; this.y = []; this.v = []; this.sw = []; this.ph = []; this.sz = []; this.rank = []; this.col = [];
    for (let i = 0; i < n; i++) this.x.push(rng.u(0, W)); for (let i = 0; i < n; i++) this.y.push(rng.u(-H, H)); for (let i = 0; i < n; i++) this.v.push(rng.u(26, 85)); for (let i = 0; i < n; i++) this.sw.push(rng.u(8, 34));
    for (let i = 0; i < n; i++) this.ph.push(rng.u(0, 6.28)); for (let i = 0; i < n; i++) this.sz.push([1, 1, 1, 2, 2, 3][rng.i(6)]); for (let i = 0; i < n; i++) this.rank.push(rng.next()); for (let i = 0; i < n; i++) this.col.push([255, 190 + rng.next() * 50, 80 + rng.next() * 70]);
    this.glow = glowSet(9, 9, [255, 205, 100], 2, [.3, .6, .9]); }
  draw(c, t, dt, vis) {
    if (vis <= 0) return;
    for (let i = 0; i < this.n; i++) { this.y[i] += this.v[i] * dt; if (this.y[i] > H + 10) { this.y[i] = -10; this.x[i] = this.rng.u(0, W); } }
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) { if (this.rank[i] >= vis) continue; const x = Math.trunc(this.x[i] + Math.sin(t * .7 + this.ph[i]) * this.sw[i]), y = Math.trunc(this.y[i]), tw = .55 + .45 * Math.sin(t * 5 + this.ph[i] * 3), s = this.sz[i], cl = this.col[i];
      c.fillStyle = `rgb(${cl[0] * tw | 0},${cl[1] * tw | 0},${cl[2] * tw | 0})`; c.fillRect(x, y, s, s); if (s === 3) c.drawImage(this.glow[Math.min(2, Math.floor(tw * 2.99))], x - 9, y - 9); }
    c.globalCompositeOperation = 'source-over';
  }
}
class Ending {
  constructor() {
    this.small = img(W / 4, H / 4, d => { for (let y = 0; y < H / 4; y++) { const ys = (y - H / 8) / (H / 8); for (let x = 0; x < W / 4; x++) { const xs = (x - W / 8) / (W / 8), r = Math.sqrt(xs * xs + ys * ys) / 1.41, I = .28 + .72 * Math.pow(clamp01(r), 1.4), o = (y * (W / 4) + x) * 4; d[o] = I * 255; d[o + 1] = I * 176; d[o + 2] = I * 54; d[o + 3] = 255; } } });
    const R = 400; this.rays = img(R, R, d => { for (let y = 0; y < R; y++) { const b = (y - R / 2 + .5) / (R / 2); for (let x = 0; x < R; x++) { const a = (x - R / 2 + .5) / (R / 2), rr = Math.sqrt(a * a + b * b), th = Math.atan2(b, a), I = Math.pow(.5 + .5 * Math.cos(12 * th), 4) * Math.pow(clamp01(1 - rr), .9) * Math.pow(clamp01(rr / .22), 1.5), o = (y * R + x) * 4; d[o] = I * 255; d[o + 1] = I * 190; d[o + 2] = I * 80; d[o + 3] = 255; } } });
  }
  draw(c, t) {
    const e = smooth(TL.ending[0], TL.ending[1], t); if (e <= 0) return; const pulse = .84 + .16 * Math.sin(t * 1.7);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.floor(255 * e * .7) / 255; c.translate(W / 2, H / 2); c.rotate(-t * 3.5 * PI / 180); c.scale(3, 3); c.drawImage(this.rays, -200, -200); c.restore();
    ADD(c, () => { c.globalAlpha = Math.floor(255 * e * pulse * .85) / 255; c.drawImage(this.small, 0, 0, W, H); c.globalAlpha = 1; c.fillStyle = `rgb(${44 * e | 0},${28 * e | 0},${6 * e | 0})`; c.fillRect(0, 0, W, H); });
  }
}

/* ---------- audio (synthesised firecrackers + background.mp3 @ 0.20) ---------- */
class AudioEngine {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext; this.enabled = !!AC; if (!AC) return;
    this.ctx = new AC({ sampleRate: 22050 }); this.ch = new Array(24).fill(null); this.next = 0; this.sounds = this.build();
    this.master = this.ctx.createChannelMerger(2); this.master.connect(this.ctx.destination);
    try { this.music = new Audio('background.mp3'); this.music.loop = true; this.music.volume = .20; } catch (e) { this.music = null; }
  }
  build() {
    const sr = this.ctx.sampleRate, noise = (dur, amp, decay, lp, seed) => {
      const n = Math.floor(sr * dur), r = new RNG(seed), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r.n();
      let y = x; if (lp) { const k = Math.max(2, Math.floor(sr / lp)); y = new Float32Array(n); const half = Math.floor(k / 2); let sum = 0; for (let i = 0; i < Math.min(n, k); i++) sum += x[i];
        for (let i = 0; i < n; i++) { const lo = i - half, hi = i - half + k; y[i] = (sum) / k; if (lo >= 0) sum -= x[lo]; if (hi < n) sum += x[hi]; } }
      const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = Math.max(-1, Math.min(1, amp * y[i] * Math.exp(-decay * i / sr))); const b = this.ctx.createBuffer(2, n, sr); b.copyToChannel(o, 0); b.copyToChannel(o, 1); return b;
    };
    return { launch: noise(.48, .30, 5, 650, 441), boom: noise(.95, .48, 4, 260, 442), crackle: noise(.62, .20, 7, 4200, 443), pop: noise(.20, .24, 18, 2800, 444) };
  }
  play(name, x = 960, vol = 2) {
    if (!this.enabled || this.ctx.state !== 'running') return; const pan = Math.max(0, Math.min(1, x / W)), i = this.next; this.next = (i + 1) % 24;
    if (this.ch[i]) try { this.ch[i].stop(); } catch (e) { }
    const s = this.ctx.createBufferSource(); s.buffer = this.sounds[name]; const sp = this.ctx.createChannelSplitter(2), gl = this.ctx.createGain(), gr = this.ctx.createGain(); gl.gain.value = vol * (1 - pan); gr.gain.value = vol * pan;
    s.connect(sp); sp.connect(gl, 0); sp.connect(gr, 1); gl.connect(this.master, 0, 0); gr.connect(this.master, 0, 1); s.start(); this.ch[i] = s;
  }
  startMusic() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); if (this.music) { const p = this.music.play(); if (p && p.catch) p.catch(() => { }); } }
}

/* ---------- main ---------- */
const canvas = document.getElementById('stage'), screen = canvas.getContext('2d'), startEl = document.getElementById('start'), msgEl = document.getElementById('msg');
function main() {
  const rng = new RNG(SEED), sky = buildSky(rng), moon = buildMoon(), mw = moon.width, moonPos = [1585 - mw / 2, 205 - mw / 2];
  const haloO = glowSet(430, 430, [150, 160, 205], 2.4, gains(6, .10, .08)), haloI = glowSet(170, 170, [255, 236, 190], 2, gains(6, .15, .14));
  const stars = new Stars(rng, 720), flames = buildFlames(64, 150, 20), diyas = new Diyas(rng, flames), greet = new Greeting(rng);
  const bigFlames = flames.map(f => scaled(f, Math.floor(greet.icon_w * .62), Math.floor(greet.icon_w * 1.35)));
  const bigGlow = glowSet(Math.floor(greet.icon_w * 1.9), Math.floor(greet.icon_w * 1.9), [255, 140, 40], 2.2, gains(8, .16, .1));
  const heartGlow = glowSet(160, 160, [255, 40, 70], 2, gains(6, .12, .12)), sparkGlow = glowSet(20, 20, [255, 235, 170], 2, [.3, .55, .8, 1]);
  const starts = greet.targets.map(() => [rng.u(80, W - 80), 0]); starts.forEach(s => s[1] = rng.u(90, H * .72));
  const morph = new Morph(greet.targets, starts, rng), ending = new Ending(), bloom = new Bloom(), rain = new Rain(rng, 520);
  const fxc = mk(W, H), fxx = cx2(fxc), fxd = fxx.createImageData(W, H); for (let i = 3; i < fxd.data.length; i += 4) fxd.data[i] = 255;
  const S = {}, drng = new RNG(SEED + 2), srng = new RNG(SEED + 3); let audio = null;
  function reset() { S.show = new Show(new RNG(SEED + 1), 1); S.sched = TL.rockets; S.volleys = [[13, 3], [24, 4], [37, 5], [53, 6], [62, 8]]; S.pending = []; S.giant = false; S.bg_next = TL.giant + 2; S.spark = []; S.t = 0; S.idle = 0; for (let i = 0; i < fxd.data.length; i += 4) { fxd.data[i] = fxd.data[i + 1] = fxd.data[i + 2] = 0; } }
  reset();
  const rate = t => t < TL.rockets ? 0 : t < 14 ? .45 : t < 26 ? .9 + .1 * (t - 14) : t < 48 ? 1.3 : t < 60 ? 1 : 1.8;
  function director(t) {
    const show = S.show;
    if (t >= S.sched) { const r = rate(t); if (r > 0) { const lx = drng.u(220, 1700); show.launch({ x: lx }); audio.play('launch', lx, .34); S.sched = t + drng.exp(1 / r); } else S.sched = TL.rockets; }
    for (const v of S.volleys.slice()) if (t >= v[0]) { for (let i = 0; i < v[1]; i++) { const x = 300 + (1620 - 300) * (v[1] === 1 ? 0 : i / (v[1] - 1)) + drng.u(-60, 60); S.pending.push([t + i * .22, { x, apex: drng.u(520, 860), cols: v[0] < 60 ? COMBOS[drng.i(COMBOS.length)] : [GOLD, WHITE] }]); } S.volleys.splice(S.volleys.indexOf(v), 1); }
    for (const p of S.pending.slice()) if (t >= p[0]) { show.launch(p[1]); audio.play('launch', p[1].x, .34); S.pending.splice(S.pending.indexOf(p), 1); }
    if (!S.giant && t >= TL.giant) { show.giant(960, 470); audio.play('boom', 960, .72); S.giant = true; }
    if (t >= TL.giant + 2 && t >= S.bg_next) { const [cA, cB] = t < 60 ? COMBOS[drng.i(COMBOS.length)] : [GOLD, ORANGE], bx = drng.u(100, 1820); show.explode(bx, drng.u(110, 560), cA, cB, drng.u(.45, .8)); audio.play('boom', bx, 1); audio.play('crackle', bx, .7); S.bg_next = t + drng.exp(1 / (t < 60 ? 1.4 : 2.6)); }
  }
  let last = performance.now(), paused = false, t = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min((now - last) / 1000, 1 / 30); last = now; if (paused) return; dt *= 2; t += dt;
    const show = S.show; director(t);
    const bursting = show.rockets.filter(rk => rk.vy + show.G * dt > -35); show.step(dt, t);
    for (const rk of bursting) { audio.play('boom', rk.x, 2); audio.play('crackle', rk.x, 1); audio.play('pop', rk.x, .6); }
    const sc = screen, sv = smooth(TL.sky[0], TL.sky[1], t);
    sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over';
    if (sv <= 0) { sc.fillStyle = '#000'; sc.fillRect(0, 0, W, H); } else { sc.drawImage(sky, 0, 0); if (sv < 1) { sc.globalAlpha = Math.floor(255 * (1 - sv)) / 255; sc.fillStyle = '#000'; sc.fillRect(0, 0, W, H); sc.globalAlpha = 1; } }
    const mv = smooth(TL.moon[0], TL.moon[1], t);
    if (mv > 0) { const pul = .9 + .1 * Math.sin(t * .8), li = Math.min(5, Math.floor(mv * pul * 5.99)); ADD(sc, () => { sc.drawImage(haloO[li], 1585 - 430, 205 - 430); sc.drawImage(haloI[li], 1585 - 170, 205 - 170); }); sc.globalAlpha = Math.floor(255 * mv) / 255; sc.drawImage(moon, moonPos[0], moonPos[1]); sc.globalAlpha = 1; }
    stars.draw(sc, t);
    const busy = show.ps.n > 0 || show.rockets.length || show.rings.length || show.flashes.length || (TL.morph[0] <= t && t <= TL.reveal[1] + .5);
    S.idle = busy ? 0 : S.idle + 1;
    if (S.idle < 24) {
      const d = fxd.data; for (let i = 0; i < d.length; i += 4) { d[i] -= 13; d[i + 1] -= 13; d[i + 2] -= 13; }
      show.drawOverlays(d); show.ps.draw(d, srng); morph.draw(d, t); fxx.putImageData(fxd, 0, 0);
      bloom.run(fxc, c => show.drawFlashes(c), sc); ADD(sc, () => sc.drawImage(fxc, 0, 0));
    }
    diyas.draw(sc, t);
    const rv = smooth(TL.reveal[0], TL.reveal[1], t);
    if (rv > 0) {
      const pul = .78 + .22 * Math.sin(t * 2.1); ADD(sc, () => { sc.globalAlpha = Math.floor(255 * rv * pul) / 255; sc.drawImage(greet.aura, 0, 0, greet.bw / 2, greet.bh / 2, greet.bx, greet.by, greet.bw, greet.bh); sc.globalAlpha = 1; });
      for (const L of greet.lines) { sc.globalAlpha = Math.floor(255 * rv) / 255; sc.drawImage(L.out, L.pos[0], L.pos[1]); sc.globalAlpha = 1; }
      if (rv > .9) for (const L of greet.lines) { const ph = (t % 7) / 5; if (ph < 1) { const cx = -350 + (L.cw + 700) * ph, tc = L.tmp.getContext('2d'); tc.globalCompositeOperation = 'source-over'; tc.fillStyle = '#000'; tc.fillRect(0, 0, L.cw, L.ch); tc.drawImage(L.band, Math.floor(cx - (L.cw + 900) / 2), 0); tc.globalCompositeOperation = 'multiply'; tc.drawImage(L.lum, 0, 0); tc.globalCompositeOperation = 'source-over'; ADD(sc, () => sc.drawImage(L.tmp, L.pos[0], L.pos[1])); } }
      const fi = Math.floor(t * 16) % bigFlames.length, fl = .5 + .5 * (.55 * Math.sin(t * 11.3) + .3 * Math.sin(t * 23.7) + .15 * Math.sin(t * 37.1));
      greet.flame_anchors.forEach(([ax, ay], k) => { const f = bigFlames[(fi + k * 7) % bigFlames.length], g = bigGlow[Math.min(7, Math.floor(fl * rv * 7.99))];
        ADD(sc, () => { sc.drawImage(g, Math.floor(ax - g.width / 2), Math.floor(ay - g.height / 2 - f.height * .35)); if (rv > .25) sc.drawImage(f, Math.floor(ax - f.width / 2), Math.floor(ay - f.height + 14)); }); });
      const beat = Math.pow(Math.max(0, Math.sin(t * 5)), 6) * .14 + .03 * Math.sin(t * 2.5), hs = greet.heart.width, sz = Math.floor(hs * (1 + beat)), [hx, hy] = greet.heart_pos, hg = heartGlow[Math.min(5, Math.max(0, Math.floor(rv * (.6 + beat * 3) * 5.99)))];
      ADD(sc, () => sc.drawImage(hg, hx + Math.floor(hs / 2) - 160, hy + Math.floor(hs / 2) - 160));
      sc.globalAlpha = Math.floor(255 * rv) / 255; sc.drawImage(greet.heart, hx + Math.floor(hs / 2) - Math.floor(sz / 2), hy + Math.floor(hs / 2) - Math.floor(sz / 2), sz, sz); sc.globalAlpha = 1;
      if (rv > .5) {
        for (let k = srng.pois(16 * dt * rv); k > 0; k--) { const p = greet.edge[srng.i(greet.edge.length)]; S.spark.push([p[0], p[1], 0, srng.u(.5, 1.1), srng.i(7, 19)]); }
        sc.globalCompositeOperation = 'lighter';
        for (const s_ of S.spark.slice()) { s_[2] += dt; if (s_[2] >= s_[3]) { S.spark.splice(S.spark.indexOf(s_), 1); continue; } const b = Math.sin(PI * s_[2] / s_[3]), x = Math.trunc(s_[0]), y = Math.trunc(s_[1]), L_ = Math.floor(s_[4] * b) + 1;
          sc.drawImage(sparkGlow[Math.min(3, Math.floor(b * 3.99))], x - 20, y - 20); sc.fillStyle = `rgb(${255 * b | 0},${238 * b | 0},${180 * b | 0})`; sc.fillRect(x - L_, y, 2 * L_ + 1, 1); sc.fillRect(x, y - L_, 1, 2 * L_ + 1); }
        sc.globalCompositeOperation = 'source-over';
      }
    }
    rain.draw(sc, t, dt, smooth(TL.rain, TL.rain + 6, t));
    if (show.screen_flash > .02) { const v = Math.floor(show.screen_flash * 110); ADD(sc, () => { sc.fillStyle = `rgb(${v},${v * .84 | 0},${v * .5 | 0})`; sc.fillRect(0, 0, W, H); }); }
    ending.draw(sc, t);
    if (LOOP && t > TL.total) { reset(); t = 0; }
  }
  /* start gate: browsers only allow audio after a user gesture */
  startEl.classList.add('ready'); msgEl.textContent = 'Tap to begin ✨';
  let started = false;
  const begin = () => {
    if (started) return; started = true; audio = new AudioEngine(); audio.startMusic();
    try { const r = document.documentElement.requestFullscreen; if (r && !/iPhone|iPad|iPod/.test(navigator.userAgent)) r.call(document.documentElement).catch(() => { }); } catch (e) { }
    startEl.classList.add('hide'); document.body.classList.add('running'); reset(); t = 0; last = performance.now(); requestAnimationFrame(frame);
  };
  startEl.addEventListener('click', begin); startEl.addEventListener('touchend', e => { e.preventDefault(); begin(); }, { passive: false });
  addEventListener('keydown', e => { if (!started) { if (e.key === ' ' || e.key === 'Enter') begin(); return; } if (e.key === ' ') { e.preventDefault(); paused = !paused; } else if (e.key === 'r' || e.key === 'R') { reset(); t = 0; } });
}
screen.fillStyle = '#000'; screen.fillRect(0, 0, W, H);
setTimeout(() => { try { main(); } catch (e) { msgEl.textContent = 'Error: ' + e.message; console.error(e); } }, 30);
