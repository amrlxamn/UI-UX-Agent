// CLI integration test. Runs the pipeline offline by stubbing Ollama
// and using the fixture HTML instead of a live URL. This validates the
// full scrape→fingerprint→baseline→generate→output path without any
// external services.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { extractFingerprint } from '../scraper/src/extract.js';
import { buildBaseline, scrapeAndFingerprint, generate } from '../src/pipeline.js';
import { chat } from '../src/ollama-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, '..', 'scraper', 'fixtures', 'awwwards-1.html');

test('buildBaseline produces a valid schema-1 baseline from fixture fingerprint', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html, sourceUrl: 'file://fixture/awwwards-1.html' });
  const baseline = await buildBaseline(fp);

  assert.equal(baseline.version, 1);
  assert.ok(baseline.createdAt);
  assert.deepEqual(baseline.sourceFingerprints, ['file://fixture/awwwards-1.html']);
  assert.ok(Array.isArray(baseline.palette));
  assert.ok(baseline.palette.length >= 2, `palette: ${baseline.palette.join(',')}`);
  assert.ok(Array.isArray(baseline.fonts));
  assert.ok(Array.isArray(baseline.components));
  assert.ok(baseline.components.includes('hero'));
  assert.ok(baseline.motion);
  assert.ok(Array.isArray(baseline.motion.durations));
  assert.ok(Array.isArray(baseline.motion.easings));
});

test('scrapeAndFingerprint works with a stub fetch', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const stubFetch = async (url) => {
    return new Response(html, { status: 200, headers: { 'x-test': '1' } });
  };
  const { fingerprint, fetch: fetchInfo } = await scrapeAndFingerprint('https://example.com/', {
    fetchImpl: stubFetch,
  });
  assert.equal(fetchInfo.status, 200);
  assert.ok(fingerprint.palette.length >= 2);
  assert.equal(fingerprint.sourceUrl, 'https://example.com/');
});

test('generate produces structured output with stubbed Ollama', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html, sourceUrl: 'file://fixture/test.html' });
  const baseline = await buildBaseline(fp);

  const fakeFiles = [
    { path: 'package.json', content: '{"name":"test"}' },
    { path: 'src/App.jsx', content: 'export default function App() { return <div/> }' },
  ];

  const stubFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.ok(body.messages.length >= 2, 'should have system + user messages');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.model, 'test-model');

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ files: fakeFiles, notes: 'Stub result.' }) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
        model: 'test-model',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const result = await generate(
    { brief: 'A studio site', baseline, fingerprint: fp, targetStack: 'react-vite' },
    { model: 'test-model', fetchImpl: stubFetch },
  );

  assert.equal(result.ok, true);
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].path, 'package.json');
  assert.equal(result.notes, 'Stub result.');
});

test('generate handles markdown-wrapped JSON from Ollama', async () => {
  const html = await readFile(FIXTURE_PATH, 'utf8');
  const fp = await extractFingerprint({ html, sourceUrl: 'file://fixture/test.html' });
  const baseline = await buildBaseline(fp);

  const fakeFiles = [{ path: 'src/App.jsx', content: 'export default function App() {}' }];

  const stubFetch = async () => {
    const wrapped = '```json\n' + JSON.stringify({ files: fakeFiles, notes: 'Wrapped.' }) + '\n```';
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: wrapped } }],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        model: 'test-model',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const result = await generate(
    { brief: 'A studio site', baseline, fingerprint: fp },
    { model: 'test-model', fetchImpl: stubFetch },
  );

  assert.equal(result.ok, true);
  assert.equal(result.files.length, 1);
  assert.equal(result.notes, 'Wrapped.');
});

test('Ollama client rejects missing model', async () => {
  await assert.rejects(
    () => chat({ messages: [{ role: 'user', content: 'hi' }] }),
    (err) => err.code === 'ollama.model.missing',
  );
});

test('Ollama client rejects empty messages', async () => {
  await assert.rejects(
    () => chat({ model: 'test', messages: [] }),
    (err) => err.code === 'ollama.messages.empty',
  );
});

test('Ollama client handles HTTP errors', async () => {
  const stubFetch = async () => new Response('rate limited', { status: 429 });
  await assert.rejects(
    () => chat({ model: 'test', messages: [{ role: 'user', content: 'hi' }], fetchImpl: stubFetch }),
    (err) => err.code === 'ollama.request.failed' && err.status === 429,
  );
});

test('Ollama client handles empty response', async () => {
  const stubFetch = async () => new Response(
    JSON.stringify({ choices: [{ message: { content: null } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
  await assert.rejects(
    () => chat({ model: 'test', messages: [{ role: 'user', content: 'hi' }], fetchImpl: stubFetch }),
    (err) => err.code === 'ollama.response.empty',
  );
});
