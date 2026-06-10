#!/usr/bin/env node
// build-baseline.mjs - merge 1..N fingerprints into a baseline.
//
// P1: always N=1. P2 will call this with N=3.
// Usage:
//   node scripts/build-baseline.mjs fingerprint.json [more.json ...]
// Output: a single Baseline JSON on stdout.

import { readFile } from 'node:fs/promises';

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error('usage: build-baseline.mjs <fp.json> [more.json ...]');
  process.exit(2);
}

const fps = [];
for (const p of inputs) {
  const raw = await readFile(p, 'utf8');
  fps.push(JSON.parse(raw));
}

function tally(items, getKey) {
  const m = new Map();
  for (const it of items) {
    const k = getKey(it);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

const baseline = {
  version: 1,
  createdAt: new Date().toISOString(),
  sourceFingerprints: fps.map((f) => f.sourceUrl).filter(Boolean),
  palette: tally(fps.flatMap((f) => f.palette), (p) => p.hex),
  fonts: tally(fps.flatMap((f) => f.fonts), (f) => f.family),
  motion: {
    durations: [...new Set(fps.flatMap((f) => f.motion.durations))].sort((a, b) => a - b),
    easings: [...new Set(fps.flatMap((f) => f.motion.easings))],
  },
  components: [...new Set(fps.flatMap((f) => f.components))].sort(),
};

process.stdout.write(JSON.stringify(baseline, null, 2) + '\n');
