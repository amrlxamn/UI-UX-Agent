// Offline smoke test. Run with `node --test scraper/test/` from the
// project root, or `node --test scraper/test/` from inside
// `scraper/`. Verifies:
//   1. extractor produces a valid fingerprint from the fixture
//   2. validator accepts it
//   3. the schema-version and required fields are present
//   4. CSS-side heuristics pick up the expected palette + motion
//   5. awwwards search returns the structured "not implemented" hint
//   6. awwwards fetchSite handles success + invalid-url cases
//
// The test runs without network. It does NOT require jsdom; the
// extractor has a regex fallback for component detection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { extractFingerprint, validateFingerprint } from '../src/extract.js';
import { createAwwwards, AwwwardsError } from '../src/awwwards.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'awwwards-1.html');

test('extractor produces a valid fingerprint from the fixture', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html, sourceUrl: 'file://fixture/awwwards-1.html' });
  const v = validateFingerprint(fp);
  assert.equal(v.ok, true, v.error);
  assert.equal(fp.schemaVersion, 1);
  assert.ok(fp.palette.length >= 2, 'expected at least two palette colors');
  assert.ok(fp.fonts.length >= 1, 'expected at least one named font');
  assert.ok(fp.components.includes('hero'));
  assert.ok(fp.components.includes('marquee'));
  assert.ok(fp.components.includes('video'));
});

test('palette includes ink, paper, accent', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html });
  const hexes = new Set(fp.palette.map((p) => p.hex));
  assert.ok(hexes.has('#0a0a0a'), `missing ink in ${[...hexes].join(',')}`);
  assert.ok(hexes.has('#f4f1ea'), `missing paper in ${[...hexes].join(',')}`);
  assert.ok(hexes.has('#ff5b3a'), `missing accent in ${[...hexes].join(',')}`);
});

test('motion detection picks up 250ms cubic-bezier', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html });
  assert.ok(fp.motion.durations.includes(250), `durations: ${fp.motion.durations.join(',')}`);
  assert.ok(
    fp.motion.easings.some((e) => e.includes('cubic-bezier')),
    `easings: ${fp.motion.easings.join(',')}`,
  );
});

test('grid detection reports 3 and 12 columns', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html });
  assert.deepEqual(fp.grid.columns, [3, 12]);
});

test('radius detection picks up 12 and 9999 (pill) and 8', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html });
  assert.ok(fp.radius.includes(12), `radius: ${fp.radius.join(',')}`);
  assert.ok(fp.radius.includes(8), `radius: ${fp.radius.join(',')}`);
  assert.ok(fp.radius.includes(9999), `radius: ${fp.radius.join(',')}`);
});

test('validator rejects fingerprints with empty palette', () => {
  const v = validateFingerprint({
    sourceUrl: 'x',
    palette: [],
    fonts: [],
    radius: [],
    motion: { durations: [], easings: [] },
    grid: { columns: [] },
    components: [],
    extractedAt: new Date().toISOString(),
  });
  assert.equal(v.ok, false);
  assert.match(v.error, /palette/);
});

test('awwwards search returns the P1 not-implemented hint', async () => {
  const aww = createAwwwards({ fetchImpl: async () => new Response('') });
  const out = await aww.search('design studio', { limit: 3 });
  assert.deepEqual(out.urls, []);
  assert.match(out.hint, /not implemented/);
  assert.equal(out.limit, 3);
});

test('awwwards fetchSite rejects invalid URLs', async () => {
  const aww = createAwwwards({ fetchImpl: async () => new Response('') });
  await assert.rejects(
    () => aww.fetchSite('not-a-url'),
    (err) => err instanceof AwwwardsError && err.code === 'awwwards.url.invalid',
  );
});

test('awwwards fetchSite records finalUrl and status from a stub fetch', async () => {
  let received = null;
  const stub = async (url, init) => {
    received = { url, init };
    return new Response('<html></html>', { status: 200, headers: { 'x-test': '1' } });
  };
  const aww = createAwwwards({ fetchImpl: stub, ratePerSec: 0 });
  const out = await aww.fetchSite('https://example.com/');
  assert.equal(out.status, 200);
  assert.equal(out.headers['x-test'], '1');
  assert.equal(received.url, 'https://example.com/');
  assert.equal(received.init.headers['user-agent'], process.env.AWWARDS_USER_AGENT || 'ui-ux-agent/0.1');
});

test('fingerprint output has the schema-1 contract shape', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html, sourceUrl: 'file://fixture/awwwards-1.html' });
  // Spot-check the contract without pulling in ajv. The hand-rolled
  // validator in extract.js already runs as part of extractFingerprint.
  for (const k of ['sourceUrl', 'palette', 'fonts', 'radius', 'motion', 'grid', 'components', 'extractedAt', 'schemaVersion']) {
    assert.ok(k in fp, `missing contract field: ${k}`);
  }
  assert.equal(fp.schemaVersion, 1);
  assert.ok(typeof fp.extractedAt === 'string');
  assert.ok(typeof fp.motion === 'object');
  assert.ok(Array.isArray(fp.motion.durations));
  assert.ok(Array.isArray(fp.motion.easings));
  assert.ok(Array.isArray(fp.grid.columns));
  assert.ok(typeof fp.grid.columns[0] === 'number');
});
