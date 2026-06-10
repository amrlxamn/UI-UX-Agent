// extract.js - turn raw HTML+CSS into a design fingerprint.
//
// The fingerprint is the contract shared with the critic and the
// generator. P1 dependencies:
//   - css-tree (already cached)
//   - jsdom (already cached), with a regex fallback for offline tests
//
// No headless browser required for extraction. Playwright is only
// used by the screenshot module.

import * as csstree from 'css-tree';

const PALETTE_MAX = 8;
const FONT_MAX = 6;
const RADIUS_BUCKETS = [0, 2, 4, 8, 12, 16, 24, 9999];
const MOTION_DURATIONS = [150, 250, 400, 700];
const MOTION_EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];

function bucketRadius(value) {
  const n = Number(value) || 0;
  for (const b of RADIUS_BUCKETS) if (n <= b) return b;
  return RADIUS_BUCKETS[RADIUS_BUCKETS.length - 1];
}

function bucketDuration(value) {
  const n = Number(value) || 0;
  let best = MOTION_DURATIONS[0];
  let bestDelta = Math.abs(n - best);
  for (const d of MOTION_DURATIONS) {
    const d2 = Math.abs(n - d);
    if (d2 < bestDelta) { best = d; bestDelta = d2; }
  }
  return best;
}

function normalizeEasing(value) {
  if (!value) return 'ease';
  const v = String(value).toLowerCase().trim();
  if (v.includes('cubic-bezier')) return v;
  if (MOTION_EASINGS.includes(v)) return v;
  if (v.startsWith('ease')) return 'ease';
  return 'ease';
}

function rgbToHex(rgb) {
  if (!rgb) return null;
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0'));
  return `#${r}${g}${b}`;
}

function extractColors(cssText) {
  const colors = new Map();
  let m;
  const re = /#([0-9a-fA-F]{3,8})\b|rgba?\(\s*[\d.,\s%]+\)/g;
  while ((m = re.exec(cssText)) !== null) {
    const raw = m[0];
    const hex = raw.startsWith('#') ? `#${raw.slice(1).toLowerCase()}` : rgbToHex(raw);
    if (!hex) continue;
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    colors.set(normalized, (colors.get(normalized) || 0) + 1);
  }
  return [...colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PALETTE_MAX)
    .map(([hex, count]) => ({ hex, count }));
}

function extractFonts(cssText) {
  const fonts = new Map();
  const re = /font-family\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const list = m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    for (const f of list) {
      const key = f.toLowerCase();
      if (key === 'serif' || key === 'sans-serif' || key === 'monospace' || key === 'system-ui') continue;
      fonts.set(f, (fonts.get(f) || 0) + 1);
    }
  }
  return [...fonts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, FONT_MAX)
    .map(([family, count]) => ({ family, count }));
}

function extractRadii(cssText) {
  const counts = new Map();
  const re = /border-radius\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const val = m[1].trim().split(/\s+/)[0];
    const b = bucketRadius(parseFloat(val));
    counts.set(b, (counts.get(b) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([radius]) => radius);
}

function extractMotion(cssText) {
  const durations = new Set();
  const easings = new Set();
  const re1 = /transition(?:-duration)?\s*:\s*([^;}]+)/gi;
  const re2 = /animation(?:-duration)?\s*:\s*([^;}]+)/gi;
  for (const re of [re1, re2]) {
    let m;
    while ((m = re.exec(cssText)) !== null) {
      const parts = m[1].split(/\s+/);
      for (const p of parts) {
        if (/^\d+(\.\d+)?(ms|s)$/i.test(p)) {
          const n = p.endsWith('ms') ? parseFloat(p) : parseFloat(p) * 1000;
          durations.add(bucketDuration(n));
        }
        if (p.includes('cubic-bezier') || MOTION_EASINGS.includes(p.toLowerCase())) {
          easings.add(normalizeEasing(p));
        }
      }
    }
  }
  return {
    durations: [...durations].sort((a, b) => a - b),
    easings: [...easings],
  };
}

function extractGrid(cssText) {
  const cols = new Set();
  const re = /grid-template-columns\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const val = m[1].trim();
    let n = 0;
    const repeatMatch = val.match(/repeat\s*\(\s*(\d+)\s*,/i);
    if (repeatMatch) {
      n = Number(repeatMatch[1]);
    } else {
      // strip parens contents, then count space-separated tracks.
      // Each track is at least one token: "1fr", "200px", "auto", "minmax(...)".
      const cleaned = val
        .replace(/minmax\s*\([^)]*\)/gi, 'X')
        .replace(/min\s*\([^)]*\)/gi, 'X')
        .replace(/max\s*\([^)]*\)/gi, 'X')
        .replace(/fit-content\s*\([^)]*\)/gi, 'X');
      n = cleaned.split(/\s+/).filter(Boolean).length;
    }
    if (n > 0) cols.add(n);
  }
  return { columns: [...cols].sort((a, b) => a - b) };
}

function regexComponents(html) {
  const set = new Set();
  for (const t of ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'form']) {
    if (new RegExp(`<${t}[\\s>]`, 'i').test(html)) set.add(t);
  }
  if (/class\s*=\s*"[^"]*hero/i.test(html) || /class\s*=\s*'[^']*hero/i.test(html)) set.add('hero');
  if (/class\s*=\s*"[^"]*marquee/i.test(html) || /class\s*=\s*'[^']*marquee/i.test(html)) set.add('marquee');
  if (/class\s*=\s*"[^"]*(carousel|slider)/i.test(html) || /class\s*=\s*'[^']*(carousel|slider)/i.test(html)) set.add('carousel');
  if (/<dialog[\s>]/i.test(html) || /class\s*=\s*"[^"]*modal/i.test(html)) set.add('modal');
  if (/<video[\s>]/i.test(html) || /class\s*=\s*"[^"]*video/i.test(html)) set.add('video');
  if (/<canvas[\s>]/i.test(html) || /class\s*=\s*"[^"]*(three|webgl)/i.test(html)) set.add('three');
  return [...set].sort();
}

function regexCssText(html) {
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  const parts = [];
  while ((m = re.exec(html)) !== null) parts.push(m[1]);
  return parts.join('\n');
}

async function tryJsdomComponents(html) {
  try {
    const mod = await import('jsdom');
    const { JSDOM } = mod;
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const set = new Set();
    const tags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'form'];
    for (const t of tags) if (doc.querySelector(t)) set.add(t);
    if (doc.querySelector('[class*="hero" i]')) set.add('hero');
    if (doc.querySelector('[class*="marquee" i]')) set.add('marquee');
    if (doc.querySelector('[class*="carousel" i], [class*="slider" i]')) set.add('carousel');
    if (doc.querySelector('[class*="modal" i], dialog')) set.add('modal');
    if (doc.querySelector('video, [class*="video" i]')) set.add('video');
    if (doc.querySelector('canvas, [class*="three" i], [class*="webgl" i]')) set.add('three');
    return [...set].sort();
  } catch {
    return null;
  }
}

export function validateFingerprint(fp) {
  const required = ['sourceUrl', 'palette', 'fonts', 'radius', 'motion', 'grid', 'components', 'extractedAt'];
  for (const k of required) {
    if (!(k in fp)) return { ok: false, error: `missing field: ${k}` };
  }
  if (!Array.isArray(fp.palette) || fp.palette.length === 0) {
    return { ok: false, error: 'palette must be a non-empty array' };
  }
  for (const p of fp.palette) {
    if (typeof p.hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(p.hex)) {
      return { ok: false, error: `palette entry has invalid hex: ${p.hex}` };
    }
  }
  return { ok: true };
}

export async function extractFingerprint({ html, sourceUrl }) {
  if (typeof html !== 'string') {
    throw new Error('html must be a string');
  }
  const css = regexCssText(html);
  const components = (await tryJsdomComponents(html)) || regexComponents(html);
  const fp = {
    sourceUrl: sourceUrl || null,
    palette: extractColors(css),
    fonts: extractFonts(css),
    radius: extractRadii(css),
    motion: extractMotion(css),
    grid: extractGrid(css),
    components,
    extractedAt: new Date().toISOString(),
    schemaVersion: 1,
  };
  const v = validateFingerprint(fp);
  if (!v.ok) {
    const err = new Error(`fingerprint invalid: ${v.error}`);
    err.code = 'fingerprint.invalid';
    throw err;
  }
  return fp;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: extract.js <fixture.html>');
    process.exit(2);
  }
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(path, 'utf8');
  const fp = await extractFingerprint({ html, sourceUrl: `file://${process.cwd()}/${path}` });
  console.log(JSON.stringify(fp, null, 2));
}
