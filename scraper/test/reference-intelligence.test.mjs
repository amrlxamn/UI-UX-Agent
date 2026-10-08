import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  REFERENCE_INTELLIGENCE_SCHEMA_VERSION,
  createReferenceIntelligence,
  validateReferenceIntelligence,
} from '../src/reference-intelligence.js';

const fingerprint = {
  sourceUrl: 'https://example.com/reference',
  palette: [
    { hex: '#111111', count: 8 },
    { hex: '#f5f5f5', count: 5 },
  ],
  fonts: [{ family: 'Inter', count: 3 }],
  radius: [0, 12],
  motion: {
    durations: [250, 400],
    easings: ['ease-out'],
  },
  grid: { columns: [4, 12] },
  components: ['header', 'hero', 'footer'],
  extractedAt: '2026-10-07T20:00:00.000Z',
  schemaVersion: 1,
};

const motionPattern = {
  name: 'Project reveal',
  trigger: 'viewport entry',
  target: 'project card',
  properties: ['opacity', 'transform'],
  timing: '400ms',
  easing: 'ease-out',
  sequence: ['image', 'title'],
  purpose: 'Direct attention',
  mobileAdaptation: 'Shorter travel distance',
  reducedMotionBehavior: 'Immediate reveal',
};

const qualityDimensions = {
  concept: 94,
  originality: 89,
  artDirection: 92,
  typography: 91,
  composition: 90,
  color: 88,
  imagery: 87,
  motion: 86,
  interaction: 85,
  technicalExecution: 93,
  usability: 84,
  accessibility: 83,
  responsiveness: 82,
  performance: 81,
};

const evidence = {
  screenshots: [{
    uri: 'file:///tmp/reference.png',
    width: 1440,
    height: 900,
    capturedAt: '2026-10-07T20:01:00.000Z',
  }],
  motionTraces: [{
    uri: 'file:///tmp/motion.json',
    format: 'json',
    capturedAt: '2026-10-07T20:02:00.000Z',
  }],
  videos: [{
    uri: 'file:///tmp/walkthrough.mp4',
    capturedAt: '2026-10-07T20:03:00.000Z',
  }],
  sourceMaterials: [{
    type: 'official-doc',
    url: 'https://example.com/design-system',
    title: 'Example design system',
  }],
};

function assertInvalidError(fn) {
  assert.throws(fn, (error) => {
    assert.equal(error.code, 'reference-intelligence.invalid');
    return true;
  });
}

test('builds a valid pending trend record from a fixture fingerprint', () => {
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'framer',
  });

  assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
  assert.equal(record.analysis.status, 'pending');
  assert.equal(record.source.url, fingerprint.sourceUrl);
  assert.equal(record.source.capturedAt, fingerprint.extractedAt);
  assert.deepEqual(record.analysis.design.visualLanguage, []);
  assert.deepEqual(record.analysis.motion.patterns, []);
  assert.deepEqual(record.analysis.taste.reusablePrinciples, []);
  assert.deepEqual(record.analysis.quality, { status: 'unrated' });
});

test('builds a full excellence analysis with rated quality', () => {
  const analysis = {
    status: 'complete',
    design: {
      concept: ['A digital gallery that behaves like a physical archive'],
      emotionalObjective: ['Curiosity', 'Trust'],
      visualLanguage: ['Editorial', 'Minimal'],
      typography: ['Large grotesk display type'],
      composition: ['Asymmetric twelve-column grid'],
      colorRoles: ['Black as structure', 'Red as action'],
      imagery: ['Full-bleed project photography'],
      material: ['Paper grain overlays'],
      responsiveStrategy: ['Collapse asymmetry while preserving hierarchy'],
    },
    motion: {
      patterns: [{
        name: 'Project reveal',
        trigger: 'viewport entry',
        target: 'project card',
        properties: ['opacity', 'transform'],
        timing: '400ms',
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        sequence: ['image', 'title', 'metadata'],
        purpose: 'Direct attention through the project hierarchy',
        mobileAdaptation: 'Shorter travel distance',
        reducedMotionBehavior: 'Immediate reveal without transform',
      }],
    },
    taste: {
      baselinePatterns: ['Editorial project index'],
      avoidedOverusedPatterns: ['Cursor follower'],
      followedRules: ['Clear visual hierarchy'],
      brokenRules: ['Navigation changes position between views'],
      originalContribution: ['Archive navigation tied to chronology'],
      strongestDecision: ['Restrained palette keeps work dominant'],
      weakestDecision: ['Dense metadata at small widths'],
      awwwardsDelta: ['More accessible than the category baseline'],
      reusablePrinciples: ['Use motion to disclose hierarchy'],
      copyingRisks: ['Chronology treatment is identity-specific'],
    },
    quality: {
      status: 'rated',
      dimensions: qualityDimensions,
    },
  };
  const identity = {
    creator: 'Example Creator',
    studio: 'Example Studio',
    industry: 'Culture',
    siteType: 'Portfolio',
    publishedAt: '2026-09-01',
    recognition: ['Site of the Day'],
    sourceUrls: ['https://example.com/reference', 'https://awwwards.com/example'],
  };
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'excellence',
    platform: 'custom',
    identity,
    analysis,
  });

  assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
  assert.deepEqual(record.identity, identity);
  assert.deepEqual(record.analysis, analysis);
});

test('builds a rejection library record', () => {
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'rejection',
    platform: 'webflow',
    analysis: {
      taste: {
        avoidedOverusedPatterns: ['Decorative infinite marquee'],
        weakestDecision: ['Motion obscures navigation'],
        copyingRisks: ['Repeating this interaction harms usability'],
      },
    },
  });

  assert.equal(record.library, 'rejection');
  assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
});

test('rejects an invalid library', () => {
  assertInvalidError(() => createReferenceIntelligence({
    fingerprint,
    library: 'inspiration',
    platform: 'custom',
  }));
});

test('rejects an invalid platform', () => {
  assertInvalidError(() => createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'wordpress',
  }));
});

test('rejects an invalid fingerprint', () => {
  assertInvalidError(() => createReferenceIntelligence({
    fingerprint: { ...fingerprint, palette: [] },
    library: 'trend',
    platform: 'unknown',
  }));
});

test('rejects quality dimension scores below zero and above one hundred', () => {
  for (const score of [-1, 101]) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'excellence',
      platform: 'custom',
      analysis: {
        quality: {
          status: 'rated',
          dimensions: { ...qualityDimensions, concept: score },
        },
      },
    }));
  }
});

test('requires exactly every canonical rated quality dimension with finite scores', () => {
  const invalidDimensions = [
    Object.fromEntries(Object.entries(qualityDimensions).slice(1)),
    Object.fromEntries(Object.entries(qualityDimensions).map(([key, value]) => [
      key === 'artDirection' ? 'artdirection' : key,
      value,
    ])),
    Object.fromEntries(Object.entries(qualityDimensions).map(([key, value]) => [
      key === 'concept' ? ' concept' : key,
      value,
    ])),
    { ...qualityDimensions, craft: 90 },
    { ...qualityDimensions, concept: Number.NaN },
    { ...qualityDimensions, concept: Number.POSITIVE_INFINITY },
  ];

  for (const dimensions of invalidDimensions) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'excellence',
      platform: 'custom',
      analysis: { quality: { status: 'rated', dimensions } },
    }));
  }
});

test('rejects unknown top-level properties', () => {
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'framer',
  });
  const result = validateReferenceIntelligence({ ...record, unexpected: true });

  assert.equal(result.ok, false);
  assert.match(result.error, /unexpected/);
});

test('preserves the complete original fingerprint without data loss', () => {
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'unknown',
  });

  assert.deepEqual(record.evidence.fingerprint, fingerprint);
  assert.notStrictEqual(record.evidence.fingerprint, fingerprint);
});

test('exports and writes schema version two', () => {
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'framer',
  });

  assert.equal(REFERENCE_INTELLIGENCE_SCHEMA_VERSION, 2);
  assert.equal(record.schemaVersion, 2);
});

test('defaults every evidence collection to an empty array', () => {
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'framer',
  });

  assert.deepEqual(record.evidence, {
    fingerprint,
    screenshots: [],
    motionTraces: [],
    videos: [],
    sourceMaterials: [],
  });
  assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
});

test('accepts populated evidence and identity dates while preserving publishedAt', () => {
  const identity = {
    publishedAt: '2026-09-01',
    dates: [
      { kind: 'launched', value: '2026-08-15' },
      { kind: 'awarded', value: '2026-09-01' },
    ],
  };
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'excellence',
    platform: 'custom',
    identity,
    evidence,
  });

  assert.deepEqual(record.evidence, { fingerprint, ...evidence });
  assert.deepEqual(record.identity, identity);
  assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
});

test('rejects malformed and open evidence entries', () => {
  const invalidEvidence = [
    { screenshots: [{ ...evidence.screenshots[0], width: 0 }] },
    { screenshots: [{ ...evidence.screenshots[0], extra: true }] },
    { motionTraces: [{ ...evidence.motionTraces[0], format: 'gif' }] },
    { motionTraces: [{ ...evidence.motionTraces[0], extra: true }] },
    { videos: [{ ...evidence.videos[0], capturedAt: 1 }] },
    { videos: [{ ...evidence.videos[0], extra: true }] },
    { sourceMaterials: [{ ...evidence.sourceMaterials[0], type: 'tweet' }] },
    { sourceMaterials: [{ ...evidence.sourceMaterials[0], extra: true }] },
  ];

  for (const value of invalidEvidence) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'unknown',
      evidence: { ...evidence, ...value },
    }));
  }
});

test('does not accept fingerprint inside input evidence', () => {
  assertInvalidError(() => createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'unknown',
    evidence: { ...evidence, fingerprint },
  }));
});

test('rejects invalid identity date items and unknown date properties', () => {
  for (const dates of [
    [{ kind: 'launched', value: 2026 }],
    [{ kind: 'launched', value: '2026-08-15', extra: true }],
  ]) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      identity: { dates },
    }));
  }
});

test('rejects unrated quality with dimensions and rated quality with empty dimensions', () => {
  for (const quality of [
    { status: 'unrated', dimensions: qualityDimensions },
    { status: 'rated', dimensions: {} },
  ]) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'excellence',
      platform: 'custom',
      analysis: { quality },
    }));
  }
});

test('rejects unknown nested properties across every closed contract', async (t) => {
  const base = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
    evidence,
    analysis: { motion: { patterns: [motionPattern] } },
  });
  const cases = [
    ['source', (record) => { record.source.extra = true; }],
    ['identity', (record) => { record.identity.extra = true; }],
    ['analysis', (record) => { record.analysis.extra = true; }],
    ['analysis.design', (record) => { record.analysis.design.extra = []; }],
    ['analysis.motion', (record) => { record.analysis.motion.extra = []; }],
    ['analysis.motion.patterns entry', (record) => { record.analysis.motion.patterns[0].extra = true; }],
    ['analysis.taste', (record) => { record.analysis.taste.extra = []; }],
    ['analysis.quality', (record) => { record.analysis.quality.extra = true; }],
    ['evidence', (record) => { record.evidence.extra = []; }],
    ['fingerprint', (record) => { record.evidence.fingerprint.extra = true; }],
    ['fingerprint palette entry', (record) => { record.evidence.fingerprint.palette[0].extra = true; }],
    ['fingerprint font entry', (record) => { record.evidence.fingerprint.fonts[0].extra = true; }],
    ['fingerprint motion', (record) => { record.evidence.fingerprint.motion.extra = true; }],
    ['fingerprint grid', (record) => { record.evidence.fingerprint.grid.extra = true; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const record = structuredClone(base);
      mutate(record);
      assert.equal(validateReferenceIntelligence(record).ok, false);
    });
  }
});

test('isolates builder outputs from every mutable input and from each other', () => {
  const mutableFingerprint = structuredClone(fingerprint);
  const identity = {
    dates: [{ kind: 'launched', value: '2026-08-15' }],
    recognition: ['Site of the Day'],
    sourceUrls: ['https://example.com/reference'],
  };
  const analysis = {
    status: 'complete',
    design: Object.fromEntries([
      'concept',
      'emotionalObjective',
      'visualLanguage',
      'typography',
      'composition',
      'colorRoles',
      'imagery',
      'material',
      'responsiveStrategy',
    ].map((key) => [key, [`${key} value`]])),
    motion: { patterns: [structuredClone(motionPattern)] },
    taste: Object.fromEntries([
      'baselinePatterns',
      'avoidedOverusedPatterns',
      'followedRules',
      'brokenRules',
      'originalContribution',
      'strongestDecision',
      'weakestDecision',
      'awwwardsDelta',
      'reusablePrinciples',
      'copyingRisks',
    ].map((key) => [key, [`${key} value`]])),
    quality: { status: 'rated', dimensions: structuredClone(qualityDimensions) },
  };
  const mutableEvidence = structuredClone(evidence);
  const input = {
    fingerprint: mutableFingerprint,
    library: 'excellence',
    platform: 'custom',
    identity,
    analysis,
    evidence: mutableEvidence,
  };
  const first = createReferenceIntelligence(input);
  const second = createReferenceIntelligence(input);
  const expected = structuredClone(first);

  mutableFingerprint.palette[0].hex = '#222222';
  mutableFingerprint.palette.push({ hex: '#333333', count: 1 });
  mutableFingerprint.fonts[0].family = 'Changed';
  mutableFingerprint.fonts.push({ family: 'Changed', count: 1 });
  mutableFingerprint.radius.push(24);
  mutableFingerprint.motion.durations.push(700);
  mutableFingerprint.motion.easings.push('linear');
  mutableFingerprint.grid.columns.push(8);
  mutableFingerprint.components.push('nav');
  identity.dates[0].value = 'changed';
  identity.dates.push({ kind: 'changed', value: 'changed' });
  identity.recognition.push('changed');
  identity.sourceUrls.push('https://example.com/changed');
  for (const values of Object.values(analysis.design)) values.push('changed');
  analysis.motion.patterns[0].name = 'changed';
  analysis.motion.patterns[0].properties.push('changed');
  analysis.motion.patterns[0].sequence.push('changed');
  analysis.motion.patterns.push(structuredClone(analysis.motion.patterns[0]));
  for (const values of Object.values(analysis.taste)) values.push('changed');
  analysis.quality.dimensions.concept = 1;
  for (const [collection, property] of [
    [mutableEvidence.screenshots, 'uri'],
    [mutableEvidence.motionTraces, 'uri'],
    [mutableEvidence.videos, 'uri'],
    [mutableEvidence.sourceMaterials, 'url'],
  ]) {
    collection[0][property] = 'changed';
    collection.push(structuredClone(collection[0]));
  }

  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);

  first.evidence.fingerprint.palette[0].hex = '#333333';
  first.evidence.fingerprint.palette.push({ hex: '#444444', count: 1 });
  first.evidence.fingerprint.fonts[0].family = 'Changed again';
  first.evidence.fingerprint.fonts.push({ family: 'Changed again', count: 1 });
  first.evidence.fingerprint.radius.push(48);
  first.evidence.fingerprint.motion.durations.push(150);
  first.evidence.fingerprint.motion.easings.push('ease-in');
  first.evidence.fingerprint.grid.columns.push(16);
  first.evidence.fingerprint.components.push('main');
  first.identity.dates[0].value = 'changed again';
  first.identity.dates.push({ kind: 'changed again', value: 'changed again' });
  first.identity.recognition.push('changed again');
  first.identity.sourceUrls.push('https://example.com/changed-again');
  for (const values of Object.values(first.analysis.design)) values.push('changed again');
  first.analysis.motion.patterns[0].name = 'changed again';
  first.analysis.motion.patterns[0].properties.push('changed again');
  first.analysis.motion.patterns[0].sequence.push('changed again');
  first.analysis.motion.patterns.push(structuredClone(first.analysis.motion.patterns[0]));
  for (const values of Object.values(first.analysis.taste)) values.push('changed again');
  first.analysis.quality.dimensions.concept = 2;
  for (const [collection, property] of [
    [first.evidence.screenshots, 'uri'],
    [first.evidence.motionTraces, 'uri'],
    [first.evidence.videos, 'uri'],
    [first.evidence.sourceMaterials, 'url'],
  ]) {
    collection[0][property] = 'changed again';
    collection.push(structuredClone(collection[0]));
  }

  assert.deepEqual(second, expected);
});

test('converts native cloning failures to reference intelligence invalid errors', () => {
  const identity = new Proxy({}, {});

  assertInvalidError(() => createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
    identity,
  }));
});

test('keeps all default design and taste arrays isolated between records', () => {
  const first = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'framer',
  });
  const second = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'framer',
  });

  for (const value of Object.values(first.analysis.design)) value.push('changed');
  for (const value of Object.values(first.analysis.taste)) value.push('changed');

  for (const value of Object.values(second.analysis.design)) assert.deepEqual(value, []);
  for (const value of Object.values(second.analysis.taste)) assert.deepEqual(value, []);
});

test('accepts source and fingerprint mismatch while builder derives matching source values', () => {
  const built = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'framer',
  });
  const mismatched = structuredClone(built);
  mismatched.source.url = 'https://example.com/other';
  mismatched.source.capturedAt = '2026-10-07T21:00:00.000Z';

  assert.equal(built.source.url, fingerprint.sourceUrl);
  assert.equal(built.source.capturedAt, fingerprint.extractedAt);
  assert.deepEqual(validateReferenceIntelligence(mismatched), { ok: true });
});

test('requires a credential-free absolute URI for every non-null principal source locator', () => {
  for (const sourceUrl of [
    'not a URL',
    'example.com/reference',
    '/tmp/reference.html',
    'https:/example.com/reference',
    'https://user:password@example.com/reference',
    'https:////user:pass@example.com/reference',
    'fixture://user:secret@example/reference',
    'fixture:////user:secret@example/reference',
  ]) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint: { ...fingerprint, sourceUrl },
      library: 'trend',
      platform: 'custom',
    }));
  }

  const record = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
  });
  record.source.url = 'not a URL';
  assert.equal(validateReferenceIntelligence(record).ok, false);
});

test('accepts null and credential-free absolute URI schemes for the principal source locator', () => {
  for (const sourceUrl of [
    null,
    'HTTPS://example.com/reference',
    'FILE:///tmp/reference.html',
    'fixture://reference/site',
    'custom:reference',
  ]) {
    const sourceFingerprint = { ...fingerprint, sourceUrl };
    const record = createReferenceIntelligence({
      fingerprint: sourceFingerprint,
      library: 'trend',
      platform: 'custom',
    });

    assert.equal(record.source.url, sourceUrl);
    assert.deepEqual(record.evidence.fingerprint, sourceFingerprint);
    assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
  }
});

test('validates the embedded fingerprint source locator independently', () => {
  const base = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
  });

  for (const sourceUrl of [
    'not a URL',
    'example.com/reference',
    '/tmp/reference.html',
    'https:/example.com/reference',
    'https://user:secret@example.com/reference',
    'fixture://user:secret@example/reference',
  ]) {
    const record = structuredClone(base);
    record.evidence.fingerprint.sourceUrl = sourceUrl;
    assert.equal(validateReferenceIntelligence(record).ok, false);
  }

  for (const sourceUrl of [
    null,
    'HTTPS://example.com/reference',
    'FILE:///tmp/reference.html',
    'fixture://reference/site',
    'custom:reference',
  ]) {
    const record = structuredClone(base);
    record.evidence.fingerprint.sourceUrl = sourceUrl;
    assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
  }
});

test('rejects empty-string unknown properties at top-level and nested boundaries', () => {
  const base = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
  });
  const topLevel = structuredClone(base);
  topLevel[''] = true;
  const nested = structuredClone(base);
  nested.identity[''] = true;
  const deeplyNested = structuredClone(base);
  deeplyNested.evidence.fingerprint.palette[0][''] = true;

  assert.equal(validateReferenceIntelligence(topLevel).ok, false);
  assert.equal(validateReferenceIntelligence(nested).ok, false);
  assert.equal(validateReferenceIntelligence(deeplyNested).ok, false);
  assertInvalidError(() => createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
    '': true,
  }));
});

test('accepts https and safe relative artifact evidence locators', () => {
  const record = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
    identity: { sourceUrls: ['https://example.com/reference'] },
    evidence: {
      screenshots: [{
        ...evidence.screenshots[0],
        uri: 'artifacts/screenshots/reference.png',
      }],
      motionTraces: [{
        ...evidence.motionTraces[0],
        uri: 'https://cdn.example.com/traces/motion.json',
      }],
      videos: [{
        ...evidence.videos[0],
        uri: 'artifacts/videos/walkthrough.mp4',
      }],
      sourceMaterials: evidence.sourceMaterials,
    },
  });

  assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
});

test('accepts uppercase HTTP(S) and FILE schemes wherever those locator kinds are allowed', () => {
  const record = createReferenceIntelligence({
    fingerprint: { ...fingerprint, sourceUrl: 'HTTPS://example.com/reference' },
    library: 'trend',
    platform: 'custom',
    identity: { sourceUrls: ['HTTPS://example.com/reference'] },
    evidence: {
      screenshots: [{ ...evidence.screenshots[0], uri: 'FILE:///tmp/reference.png' }],
      motionTraces: [{ ...evidence.motionTraces[0], uri: 'HTTPS://cdn.example.com/motion.json' }],
      sourceMaterials: [{ ...evidence.sourceMaterials[0], url: 'HTTPS://example.com/design-system' }],
    },
  });

  assert.deepEqual(validateReferenceIntelligence(record), { ok: true });
});

test('rejects invalid absolute HTTP locators', () => {
  const invalidUrls = [
    'junk',
    'javascript:alert(1)',
    'https://user:password@example.com/reference',
    'https:////user:pass@example.com/reference',
    'https://',
    'file:///tmp/reference',
  ];

  for (const url of invalidUrls) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      identity: { sourceUrls: [url] },
    }));
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      evidence: {
        sourceMaterials: [{ ...evidence.sourceMaterials[0], url }],
      },
    }));
  }
});

test('rejects unsafe or malformed evidence locators', () => {
  const invalidUris = [
    'junk',
    'javascript:alert(1)',
    'https://user:password@example.com/reference.png',
    'https:////user:pass@example.com/reference.png',
    'https://',
    '/tmp/reference.png',
    'artifacts\\reference.png',
    'artifacts/../reference.png',
    'artifacts//reference.png',
    'artifacts/reference.png?download=1',
    'artifacts/reference.png#preview',
  ];

  for (const uri of invalidUris) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      evidence: {
        screenshots: [{ ...evidence.screenshots[0], uri }],
      },
    }));
  }
});

test('rejects extra-slash credential URLs in every runtime locator position', async (t) => {
  const credentialUrl = 'https:////user:pass@example.com/reference';
  const cases = [
    ['source.url', { fingerprint: { ...fingerprint, sourceUrl: credentialUrl } }],
    ['identity.sourceUrls', { identity: { sourceUrls: [credentialUrl] } }],
    ['evidence.screenshots[].uri', {
      evidence: { screenshots: [{ ...evidence.screenshots[0], uri: credentialUrl }] },
    }],
    ['evidence.motionTraces[].uri', {
      evidence: { motionTraces: [{ ...evidence.motionTraces[0], uri: credentialUrl }] },
    }],
    ['evidence.videos[].uri', {
      evidence: { videos: [{ ...evidence.videos[0], uri: credentialUrl }] },
    }],
    ['evidence.sourceMaterials[].url', {
      evidence: { sourceMaterials: [{ ...evidence.sourceMaterials[0], url: credentialUrl }] },
    }],
  ];

  for (const [name, overrides] of cases) {
    await t.test(name, () => {
      assertInvalidError(() => createReferenceIntelligence({
        fingerprint,
        library: 'trend',
        platform: 'custom',
        ...overrides,
      }));
    });
  }
});

test('builder rejects non-plain objects before construction can normalize them', () => {
  class ContractObject {}
  const nonPlainValues = [new Date(), new Map(), new Set(), new ContractObject()];

  for (const value of nonPlainValues) {
    assertInvalidError(() => createReferenceIntelligence(value));
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      identity: value,
    }));
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      analysis: { design: value },
    }));
  }
});

test('accepts objects with Object.prototype or null prototypes', () => {
  const nullPrototypeIdentity = Object.assign(Object.create(null), {
    creator: 'Null Prototype Creator',
  });
  const built = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
    identity: nullPrototypeIdentity,
  });
  const nullPrototypeRecord = Object.assign(Object.create(null), built);
  nullPrototypeRecord.identity = nullPrototypeIdentity;

  assert.deepEqual(validateReferenceIntelligence(built), { ok: true });
  assert.deepEqual(validateReferenceIntelligence(nullPrototypeRecord), { ok: true });
});

test('validator rejects arrays and non-plain values at object boundaries', async (t) => {
  class ContractObject {}
  const base = createReferenceIntelligence({
    fingerprint,
    library: 'excellence',
    platform: 'custom',
    identity: { dates: [{ kind: 'launched', value: '2026-08-15' }] },
    analysis: {
      motion: { patterns: [motionPattern] },
      quality: { status: 'rated', dimensions: qualityDimensions },
    },
    evidence,
  });
  const boundaries = [
    ['record', (record, value) => value],
    ['source', (record, value) => { record.source = value; return record; }],
    ['identity', (record, value) => { record.identity = value; return record; }],
    ['identity date', (record, value) => { record.identity.dates[0] = value; return record; }],
    ['analysis', (record, value) => { record.analysis = value; return record; }],
    ['design', (record, value) => { record.analysis.design = value; return record; }],
    ['motion', (record, value) => { record.analysis.motion = value; return record; }],
    ['motion pattern', (record, value) => { record.analysis.motion.patterns[0] = value; return record; }],
    ['taste', (record, value) => { record.analysis.taste = value; return record; }],
    ['quality', (record, value) => { record.analysis.quality = value; return record; }],
    ['quality dimensions', (record, value) => { record.analysis.quality.dimensions = value; return record; }],
    ['evidence', (record, value) => { record.evidence = value; return record; }],
    ['fingerprint', (record, value) => { record.evidence.fingerprint = value; return record; }],
    ['palette entry', (record, value) => { record.evidence.fingerprint.palette[0] = value; return record; }],
    ['font entry', (record, value) => { record.evidence.fingerprint.fonts[0] = value; return record; }],
    ['fingerprint motion', (record, value) => { record.evidence.fingerprint.motion = value; return record; }],
    ['fingerprint grid', (record, value) => { record.evidence.fingerprint.grid = value; return record; }],
    ['screenshot', (record, value) => { record.evidence.screenshots[0] = value; return record; }],
    ['motion trace', (record, value) => { record.evidence.motionTraces[0] = value; return record; }],
    ['video', (record, value) => { record.evidence.videos[0] = value; return record; }],
    ['source material', (record, value) => { record.evidence.sourceMaterials[0] = value; return record; }],
  ];
  const values = [[], new Date(), new Map(), new Set(), new ContractObject()];

  for (const [name, replace] of boundaries) {
    await t.test(name, () => {
      for (const value of values) {
        const candidate = replace(structuredClone(base), value);
        assert.equal(validateReferenceIntelligence(candidate).ok, false);
      }
    });
  }
});

test('requires valid RFC3339 date-times at every temporal evidence field', () => {
  for (const extractedAt of ['2026-02-31T20:00:00.000Z', '2026-10-07']) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint: { ...fingerprint, extractedAt },
      library: 'trend',
      platform: 'custom',
    }));
  }

  const built = createReferenceIntelligence({
    fingerprint,
    library: 'trend',
    platform: 'custom',
  });
  built.source.capturedAt = '2026-02-31T20:00:00.000Z';
  assert.equal(validateReferenceIntelligence(built).ok, false);

  for (const key of ['screenshots', 'motionTraces', 'videos']) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      evidence: {
        [key]: [{ ...evidence[key][0], capturedAt: '2026-02-31T20:00:00.000Z' }],
      },
    }));
  }
});

test('requires valid calendar dates for identity publication dates', () => {
  for (const identity of [
    { publishedAt: '2026-02-31' },
    { publishedAt: '2026-9-01' },
    { dates: [{ kind: 'launched', value: '2026-02-31' }] },
    { dates: [{ kind: 'launched', value: '2026-08-15T00:00:00Z' }] },
  ]) {
    assertInvalidError(() => createReferenceIntelligence({
      fingerprint,
      library: 'trend',
      platform: 'custom',
      identity,
    }));
  }
});

test('defines the expanded closed evidence and identity date schema', async () => {
  const text = await readFile(new URL('../../schema/reference-intelligence.schema.json', import.meta.url), 'utf8');
  const schema = JSON.parse(text);
  const evidenceSchema = schema.properties.evidence;

  assert.deepEqual(evidenceSchema.required, [
    'fingerprint',
    'screenshots',
    'motionTraces',
    'videos',
    'sourceMaterials',
  ]);
  assert.equal(evidenceSchema.additionalProperties, false);
  assert.equal(evidenceSchema.properties.screenshots.items.additionalProperties, false);
  assert.equal(evidenceSchema.properties.motionTraces.items.additionalProperties, false);
  assert.equal(evidenceSchema.properties.videos.items.additionalProperties, false);
  assert.equal(evidenceSchema.properties.sourceMaterials.items.additionalProperties, false);
  assert.equal(schema.$defs.identity.properties.dates.items.additionalProperties, false);
  assert.equal(schema.properties.source.properties.capturedAt.format, 'date-time');
  assert.equal(evidenceSchema.properties.fingerprint.allOf[1].properties.extractedAt.format, 'date-time');
  assert.deepEqual(
    evidenceSchema.properties.fingerprint.allOf[1].properties.sourceUrl,
    schema.properties.source.properties.url,
  );
  assert.equal(schema.$defs.identity.properties.publishedAt.format, 'date');
  assert.equal(schema.$defs.identity.properties.dates.items.properties.value.format, 'date');
  assert.equal(evidenceSchema.properties.screenshots.items.properties.capturedAt.format, 'date-time');
  assert.equal(evidenceSchema.properties.motionTraces.items.properties.capturedAt.format, 'date-time');
  assert.equal(evidenceSchema.properties.videos.items.properties.capturedAt.format, 'date-time');
  assert.equal(schema.$defs.artifactLocator.oneOf.length, 2);
  assert.equal(schema.$defs.identity.properties.sourceUrls.items.format, 'uri');
  assert.equal(evidenceSchema.properties.sourceMaterials.items.properties.url.format, 'uri');
  assert.deepEqual(schema.$defs.quality.oneOf[1].properties.dimensions.required, Object.keys(qualityDimensions));
  assert.equal(schema.$defs.quality.oneOf[1].properties.dimensions.additionalProperties, false);
});

test('schema represents principal source URIs and case-insensitive constrained schemes', async () => {
  const text = await readFile(new URL('../../schema/reference-intelligence.schema.json', import.meta.url), 'utf8');
  const schema = JSON.parse(text);
  const sourceAlternatives = schema.properties.source.properties.url.oneOf;
  const sourceUri = sourceAlternatives.find((entry) => entry.type === 'string');
  const sourceNull = sourceAlternatives.find((entry) => entry.type === 'null');
  const httpPatterns = [
    schema.$defs.identity.properties.sourceUrls.items.pattern,
    schema.properties.evidence.properties.sourceMaterials.items.properties.url.pattern,
  ];
  const artifactPattern = schema.$defs.artifactLocator.oneOf[0].pattern;

  assert.ok(sourceNull);
  assert.equal(sourceUri.format, 'uri');
  assert.match('HTTPS://example.com/reference', new RegExp(sourceUri.pattern));
  assert.match('FILE:///tmp/reference.html', new RegExp(sourceUri.pattern));
  assert.match('fixture://reference/site', new RegExp(sourceUri.pattern));
  assert.match('custom://reference/site', new RegExp(sourceUri.pattern));
  assert.match('CUSTOM:reference', new RegExp(sourceUri.pattern));
  assert.doesNotMatch('not a URL', new RegExp(sourceUri.pattern));
  assert.doesNotMatch('https:/example.com/reference', new RegExp(sourceUri.pattern));
  assert.doesNotMatch('https://user:password@example.com/reference', new RegExp(sourceUri.pattern));
  assert.doesNotMatch('https:////user:pass@example.com/reference', new RegExp(sourceUri.pattern));
  assert.doesNotMatch('fixture:////user:pass@example.com/reference', new RegExp(sourceUri.pattern));
  for (const pattern of httpPatterns) {
    assert.match('HTTPS://example.com/reference', new RegExp(pattern));
    assert.doesNotMatch('https://', new RegExp(pattern));
    assert.doesNotMatch('https:////example.com/reference', new RegExp(pattern));
    assert.doesNotMatch('HTTPS://user:secret@example.com/reference', new RegExp(pattern));
    assert.doesNotMatch('https:////user:pass@example.com/reference', new RegExp(pattern));
  }
  assert.match('HTTPS://example.com/reference.png', new RegExp(artifactPattern));
  assert.match('FILE:///tmp/reference.png', new RegExp(artifactPattern));
  assert.doesNotMatch('https://', new RegExp(artifactPattern));
  assert.doesNotMatch('https:////example.com/reference.png', new RegExp(artifactPattern));
  assert.doesNotMatch('FILE://user:secret@example.com/reference.png', new RegExp(artifactPattern));
  assert.doesNotMatch('https:////user:pass@example.com/reference.png', new RegExp(artifactPattern));
});

test('reference intelligence runtime has no extractor dependency', async () => {
  const source = await readFile(new URL('../src/reference-intelligence.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /from ['"]\.\/extract\.js['"]/);
});
