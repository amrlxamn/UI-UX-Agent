export const REFERENCE_INTELLIGENCE_SCHEMA_VERSION = 2;

const LIBRARIES = new Set(['trend', 'excellence', 'rejection']);
const PLATFORMS = new Set(['framer', 'webflow', 'custom', 'unknown']);
const ANALYSIS_STATUSES = new Set(['pending', 'complete']);
const FINGERPRINT_KEYS = new Set([
  'sourceUrl',
  'palette',
  'fonts',
  'radius',
  'motion',
  'grid',
  'components',
  'extractedAt',
  'schemaVersion',
]);
const FINGERPRINT_COMPONENTS = new Set([
  'header',
  'nav',
  'main',
  'section',
  'article',
  'aside',
  'footer',
  'form',
  'hero',
  'marquee',
  'carousel',
  'modal',
  'video',
  'three',
]);
const FINGERPRINT_DURATIONS = new Set([150, 250, 400, 700]);
const QUALITY_DIMENSIONS = new Set([
  'concept',
  'originality',
  'artDirection',
  'typography',
  'composition',
  'color',
  'imagery',
  'motion',
  'interaction',
  'technicalExecution',
  'usability',
  'accessibility',
  'responsiveness',
  'performance',
]);
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/i;
const RELATIVE_ARTIFACT_PATTERN = /^[A-Za-z0-9_~-]+(?:\.[A-Za-z0-9_~-]+)*(?:\/[A-Za-z0-9_~-]+(?:\.[A-Za-z0-9_~-]+)*)+$/;
const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'library',
  'platform',
  'source',
  'identity',
  'analysis',
  'evidence',
]);
const INPUT_KEYS = new Set(['fingerprint', 'library', 'platform', 'identity', 'analysis', 'evidence']);
const EVIDENCE_KEYS = new Set([
  'fingerprint',
  'screenshots',
  'motionTraces',
  'videos',
  'sourceMaterials',
]);
const INPUT_EVIDENCE_KEYS = new Set(['screenshots', 'motionTraces', 'videos', 'sourceMaterials']);
const SOURCE_MATERIAL_TYPES = new Set([
  'official-doc',
  'template',
  'walkthrough',
  'case-study',
  'award-listing',
  'published-site',
  'other',
]);
const IDENTITY_KEYS = new Set([
  'creator',
  'studio',
  'industry',
  'siteType',
  'publishedAt',
  'dates',
  'recognition',
  'sourceUrls',
]);
const DESIGN_KEYS = new Set([
  'concept',
  'emotionalObjective',
  'visualLanguage',
  'typography',
  'composition',
  'colorRoles',
  'imagery',
  'material',
  'responsiveStrategy',
]);
const MOTION_PATTERN_KEYS = new Set([
  'name',
  'trigger',
  'target',
  'properties',
  'timing',
  'easing',
  'sequence',
  'purpose',
  'mobileAdaptation',
  'reducedMotionBehavior',
]);
const TASTE_KEYS = new Set([
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
]);

function createArrayDefaults(keys) {
  return Object.fromEntries([...keys].map((key) => [key, []]));
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function containsOnlyPlainJsonObjects(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.every((item) => containsOnlyPlainJsonObjects(item, seen));
  }
  return isPlainObject(value)
    && Object.values(value).every((item) => containsOnlyPlainJsonObjects(item, seen));
}

function unknownKey(value, allowed) {
  return Object.keys(value).find((key) => !allowed.has(key)) ?? null;
}

function isValidCalendarDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function isValidDateTime(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match || !isValidCalendarDate(`${match[1]}-${match[2]}-${match[3]}`)) return false;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  return hour <= 23 && minute <= 59 && second <= 59
    && offsetHour <= 23 && offsetMinute <= 59;
}

function parseAbsoluteUrl(value, protocols) {
  if (typeof value !== 'string' || value !== value.trim() || /[\u0000-\u0020]/.test(value)
    || /%(?![0-9a-f]{2})/i.test(value)) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (!protocols.has(parsed.protocol) || parsed.username || parsed.password) return null;
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname) return null;
  return parsed;
}

function isValidHttpUrl(value) {
  return /^https?:\/\/[^/?#@]+(?:[/?#]|$)/i.test(value)
    && parseAbsoluteUrl(value, new Set(['http:', 'https:'])) !== null;
}

function isValidSourceUri(value) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    || value !== value.trim() || /[\u0000-\u0020]/.test(value)
    || /%(?![0-9a-f]{2})/i.test(value)) {
    return false;
  }
  const [scheme] = value.split(':', 1);
  const remainder = value.slice(scheme.length + 1);
  if (/^https?$/i.test(scheme)) return isValidHttpUrl(value);
  if (remainder.startsWith('//')) {
    const hierarchicalPattern = /^\/\/[^/?#@]+(?:[/?#]|$)/;
    const filePattern = /^\/\/(?:[^/?#@]+(?:[/?#]|$)|\/[^/])/;
    if (!(scheme.toLowerCase() === 'file'
      ? filePattern.test(remainder)
      : hierarchicalPattern.test(remainder))) {
      return false;
    }
  }
  try {
    const parsed = new URL(value);
    return !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function isValidArtifactLocator(value) {
  if (typeof value !== 'string') return false;
  if (/^https?:/i.test(value)) return isValidHttpUrl(value);
  if (/^file:/i.test(value)) {
    return /^file:\/\/(?:[^/?#@]+(?:[/?#]|$)|\/[^/])/i.test(value)
      && parseAbsoluteUrl(value, new Set(['file:'])) !== null;
  }
  return RELATIVE_ARTIFACT_PATTERN.test(value);
}

function validateStringArray(value, path) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return `${path} must be an array of strings`;
  }
  return null;
}

function validateIdentity(identity) {
  if (!isPlainObject(identity)) return 'identity must be an object';
  const unknown = unknownKey(identity, IDENTITY_KEYS);
  if (unknown !== null) return `identity has unknown property: ${unknown}`;
  for (const key of ['creator', 'studio', 'industry', 'siteType']) {
    if (key in identity && typeof identity[key] !== 'string') {
      return `identity.${key} must be a string`;
    }
  }
  if ('publishedAt' in identity && !isValidCalendarDate(identity.publishedAt)) {
    return 'identity.publishedAt must be a valid date';
  }
  if ('recognition' in identity) {
    const error = validateStringArray(identity.recognition, 'identity.recognition');
    if (error) return error;
  }
  if ('sourceUrls' in identity) {
    const error = validateStringArray(identity.sourceUrls, 'identity.sourceUrls');
    if (error) return error;
    if (identity.sourceUrls.some((url) => !isValidHttpUrl(url))) {
      return 'identity.sourceUrls must contain absolute HTTP(S) URLs';
    }
  }
  if ('dates' in identity) {
    if (!Array.isArray(identity.dates)) return 'identity.dates must be an array';
    for (const [index, date] of identity.dates.entries()) {
      if (!isPlainObject(date)) return `identity.dates[${index}] must be an object`;
      const unknown = unknownKey(date, new Set(['kind', 'value']));
      if (unknown !== null) return `identity.dates[${index}] has unknown property: ${unknown}`;
      for (const key of ['kind', 'value']) {
        if (!(key in date)) return `identity.dates[${index}] is missing property: ${key}`;
        if (typeof date[key] !== 'string') return `identity.dates[${index}].${key} must be a string`;
      }
      if (!isValidCalendarDate(date.value)) {
        return `identity.dates[${index}].value must be a valid date`;
      }
    }
  }
  return null;
}

function validateDesign(design) {
  if (!isPlainObject(design)) return 'analysis.design must be an object';
  const unknown = unknownKey(design, DESIGN_KEYS);
  if (unknown !== null) return `analysis.design has unknown property: ${unknown}`;
  for (const key of DESIGN_KEYS) {
    if (!(key in design)) return `analysis.design is missing property: ${key}`;
    const error = validateStringArray(design[key], `analysis.design.${key}`);
    if (error) return error;
  }
  return null;
}

function validateMotion(motion) {
  if (!isPlainObject(motion)) return 'analysis.motion must be an object';
  const unknown = unknownKey(motion, new Set(['patterns']));
  if (unknown !== null) return `analysis.motion has unknown property: ${unknown}`;
  if (!Array.isArray(motion.patterns)) return 'analysis.motion.patterns must be an array';
  for (const [index, pattern] of motion.patterns.entries()) {
    if (!isPlainObject(pattern)) return `analysis.motion.patterns[${index}] must be an object`;
    const patternUnknown = unknownKey(pattern, MOTION_PATTERN_KEYS);
    if (patternUnknown !== null) {
      return `analysis.motion.patterns[${index}] has unknown property: ${patternUnknown}`;
    }
    for (const key of MOTION_PATTERN_KEYS) {
      if (!(key in pattern)) {
        return `analysis.motion.patterns[${index}] is missing property: ${key}`;
      }
      if (key === 'properties' || key === 'sequence') {
        const error = validateStringArray(pattern[key], `analysis.motion.patterns[${index}].${key}`);
        if (error) return error;
      } else if (typeof pattern[key] !== 'string') {
        return `analysis.motion.patterns[${index}].${key} must be a string`;
      }
    }
  }
  return null;
}

function validateTaste(taste) {
  if (!isPlainObject(taste)) return 'analysis.taste must be an object';
  const unknown = unknownKey(taste, TASTE_KEYS);
  if (unknown !== null) return `analysis.taste has unknown property: ${unknown}`;
  for (const key of TASTE_KEYS) {
    if (!(key in taste)) return `analysis.taste is missing property: ${key}`;
    const error = validateStringArray(taste[key], `analysis.taste.${key}`);
    if (error) return error;
  }
  return null;
}

function validateQuality(quality) {
  if (!isPlainObject(quality)) return 'analysis.quality must be an object';
  const unknown = unknownKey(quality, new Set(['status', 'dimensions']));
  if (unknown !== null) return `analysis.quality has unknown property: ${unknown}`;
  if (quality.status === 'unrated') {
    if ('dimensions' in quality) return 'analysis.quality.dimensions is not allowed when unrated';
    return null;
  }
  if (quality.status !== 'rated') return 'analysis.quality.status must be unrated or rated';
  if (!isPlainObject(quality.dimensions)) {
    return 'analysis.quality.dimensions must be an object for rated quality';
  }
  const dimensionUnknown = unknownKey(quality.dimensions, QUALITY_DIMENSIONS);
  if (dimensionUnknown !== null) {
    return `analysis.quality.dimensions has unknown property: ${dimensionUnknown}`;
  }
  for (const dimension of QUALITY_DIMENSIONS) {
    if (!(dimension in quality.dimensions)) {
      return `analysis.quality.dimensions is missing property: ${dimension}`;
    }
    const score = quality.dimensions[dimension];
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
      return `analysis.quality.dimensions.${dimension} must be between 0 and 100`;
    }
  }
  return null;
}

function validateAnalysis(analysis) {
  if (!isPlainObject(analysis)) return 'analysis must be an object';
  const allowed = new Set(['status', 'design', 'motion', 'taste', 'quality']);
  const unknown = unknownKey(analysis, allowed);
  if (unknown !== null) return `analysis has unknown property: ${unknown}`;
  for (const key of allowed) {
    if (!(key in analysis)) return `analysis is missing property: ${key}`;
  }
  if (!ANALYSIS_STATUSES.has(analysis.status)) {
    return 'analysis.status must be pending or complete';
  }
  return validateDesign(analysis.design)
    || validateMotion(analysis.motion)
    || validateTaste(analysis.taste)
    || validateQuality(analysis.quality);
}

function validateFingerprintContract(fingerprint) {
  const unknown = unknownKey(fingerprint, FINGERPRINT_KEYS);
  if (unknown !== null) return `has unknown property: ${unknown}`;
  for (const key of FINGERPRINT_KEYS) {
    if (!(key in fingerprint)) return `is missing property: ${key}`;
  }
  if (!(fingerprint.sourceUrl === null || isValidSourceUri(fingerprint.sourceUrl))) {
    return 'sourceUrl must be null or a credential-free absolute URI';
  }
  if (fingerprint.schemaVersion !== 1) return 'schemaVersion must equal 1';
  if (!isValidDateTime(fingerprint.extractedAt)) {
    return 'extractedAt must be a valid date-time string';
  }
  if (!Array.isArray(fingerprint.palette) || fingerprint.palette.length < 1 || fingerprint.palette.length > 8) {
    return 'palette must contain between 1 and 8 entries';
  }
  for (const entry of fingerprint.palette) {
    if (!isPlainObject(entry) || unknownKey(entry, new Set(['hex', 'count'])) !== null) {
      return 'palette entries must contain only hex and count';
    }
    if (!/^#[0-9a-f]{6}$/i.test(entry.hex)) return 'palette entry hex is invalid';
    if (!Number.isInteger(entry.count) || entry.count < 1) return 'palette entry count is invalid';
  }
  if (!Array.isArray(fingerprint.fonts) || fingerprint.fonts.length > 6) {
    return 'fonts must be an array with at most 6 entries';
  }
  for (const entry of fingerprint.fonts) {
    if (!isPlainObject(entry) || unknownKey(entry, new Set(['family', 'count'])) !== null) {
      return 'font entries must contain only family and count';
    }
    if (typeof entry.family !== 'string' || entry.family.length === 0) {
      return 'font entry family is invalid';
    }
    if (!Number.isInteger(entry.count) || entry.count < 1) return 'font entry count is invalid';
  }
  if (!Array.isArray(fingerprint.radius)
    || fingerprint.radius.some((value) => !Number.isInteger(value) || value < 0)) {
    return 'radius must contain non-negative integers';
  }
  if (!isPlainObject(fingerprint.motion)
    || unknownKey(fingerprint.motion, new Set(['durations', 'easings'])) !== null
    || !('durations' in fingerprint.motion)
    || !('easings' in fingerprint.motion)) {
    return 'motion must contain only durations and easings';
  }
  if (!Array.isArray(fingerprint.motion.durations)
    || fingerprint.motion.durations.some((value) => !FINGERPRINT_DURATIONS.has(value))) {
    return 'motion durations are invalid';
  }
  if (!Array.isArray(fingerprint.motion.easings)
    || fingerprint.motion.easings.some((value) => typeof value !== 'string' || value.length === 0)) {
    return 'motion easings are invalid';
  }
  if (!isPlainObject(fingerprint.grid)
    || unknownKey(fingerprint.grid, new Set(['columns'])) !== null
    || !Array.isArray(fingerprint.grid.columns)
    || fingerprint.grid.columns.some((value) => !Number.isInteger(value) || value < 1)) {
    return 'grid columns are invalid';
  }
  if (!Array.isArray(fingerprint.components)
    || fingerprint.components.some((value) => !FINGERPRINT_COMPONENTS.has(value))) {
    return 'components are invalid';
  }
  return null;
}

function validateFingerprintEvidence(fingerprint) {
  if (!isPlainObject(fingerprint)) return 'evidence.fingerprint must be an object';
  const contractError = validateFingerprintContract(fingerprint);
  if (contractError) return `evidence.fingerprint ${contractError}`;
  return null;
}

function validateClosedEntry(entry, keys, path) {
  if (!isPlainObject(entry)) return `${path} must be an object`;
  const unknown = unknownKey(entry, keys);
  if (unknown !== null) return `${path} has unknown property: ${unknown}`;
  for (const key of keys) {
    if (!(key in entry)) return `${path} is missing property: ${key}`;
  }
  return null;
}

function validateEvidence(evidence) {
  if (!isPlainObject(evidence)) return 'evidence must be an object';
  const unknown = unknownKey(evidence, EVIDENCE_KEYS);
  if (unknown !== null) return `evidence has unknown property: ${unknown}`;
  for (const key of EVIDENCE_KEYS) {
    if (!(key in evidence)) return `evidence is missing property: ${key}`;
  }
  const fingerprintError = validateFingerprintEvidence(evidence.fingerprint);
  if (fingerprintError) return fingerprintError;
  for (const key of INPUT_EVIDENCE_KEYS) {
    if (!Array.isArray(evidence[key])) return `evidence.${key} must be an array`;
  }
  for (const [index, screenshot] of evidence.screenshots.entries()) {
    const path = `evidence.screenshots[${index}]`;
    const error = validateClosedEntry(screenshot, new Set(['uri', 'width', 'height', 'capturedAt']), path);
    if (error) return error;
    if (!isValidArtifactLocator(screenshot.uri)) return `${path}.uri must be a valid artifact locator`;
    if (!Number.isInteger(screenshot.width) || screenshot.width < 1) return `${path}.width must be a positive integer`;
    if (!Number.isInteger(screenshot.height) || screenshot.height < 1) return `${path}.height must be a positive integer`;
    if (!isValidDateTime(screenshot.capturedAt)) return `${path}.capturedAt must be a valid date-time`;
  }
  for (const [index, trace] of evidence.motionTraces.entries()) {
    const path = `evidence.motionTraces[${index}]`;
    const error = validateClosedEntry(trace, new Set(['uri', 'format', 'capturedAt']), path);
    if (error) return error;
    if (!isValidArtifactLocator(trace.uri)) return `${path}.uri must be a valid artifact locator`;
    if (trace.format !== 'json' && trace.format !== 'video') return `${path}.format must be json or video`;
    if (!isValidDateTime(trace.capturedAt)) return `${path}.capturedAt must be a valid date-time`;
  }
  for (const [index, video] of evidence.videos.entries()) {
    const path = `evidence.videos[${index}]`;
    const error = validateClosedEntry(video, new Set(['uri', 'capturedAt']), path);
    if (error) return error;
    if (!isValidArtifactLocator(video.uri)) return `${path}.uri must be a valid artifact locator`;
    if (!isValidDateTime(video.capturedAt)) return `${path}.capturedAt must be a valid date-time`;
  }
  for (const [index, material] of evidence.sourceMaterials.entries()) {
    const path = `evidence.sourceMaterials[${index}]`;
    const error = validateClosedEntry(material, new Set(['type', 'url', 'title']), path);
    if (error) return error;
    if (!SOURCE_MATERIAL_TYPES.has(material.type)) return `${path}.type is invalid`;
    if (!isValidHttpUrl(material.url)) return `${path}.url must be an absolute HTTP(S) URL`;
    if (typeof material.title !== 'string') return `${path}.title must be a string`;
  }
  return null;
}

export function validateReferenceIntelligence(record) {
  if (!isPlainObject(record)) return { ok: false, error: 'record must be an object' };
  const unknown = unknownKey(record, TOP_LEVEL_KEYS);
  if (unknown !== null) return { ok: false, error: `unknown top-level property: ${unknown}` };
  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in record)) return { ok: false, error: `missing top-level property: ${key}` };
  }
  if (record.schemaVersion !== REFERENCE_INTELLIGENCE_SCHEMA_VERSION) {
    return { ok: false, error: 'schemaVersion must equal 2' };
  }
  if (!LIBRARIES.has(record.library)) {
    return { ok: false, error: 'library must be trend, excellence, or rejection' };
  }
  if (!PLATFORMS.has(record.platform)) {
    return { ok: false, error: 'platform must be framer, webflow, custom, or unknown' };
  }
  if (!isPlainObject(record.source)) return { ok: false, error: 'source must be an object' };
  const sourceUnknown = unknownKey(record.source, new Set(['url', 'capturedAt']));
  if (sourceUnknown !== null) return { ok: false, error: `source has unknown property: ${sourceUnknown}` };
  if (!(record.source.url === null || isValidSourceUri(record.source.url))) {
    return { ok: false, error: 'source.url must be null or a credential-free absolute URI' };
  }
  if (!isValidDateTime(record.source.capturedAt)) {
    return { ok: false, error: 'source.capturedAt must be a valid date-time' };
  }
  const identityError = validateIdentity(record.identity);
  if (identityError) return { ok: false, error: identityError };
  const analysisError = validateAnalysis(record.analysis);
  if (analysisError) return { ok: false, error: analysisError };
  const evidenceError = validateEvidence(record.evidence);
  if (evidenceError) return { ok: false, error: evidenceError };
  return { ok: true };
}

export function createReferenceIntelligence(input) {
  const invalid = (message) => {
    const error = new Error(`reference intelligence invalid: ${message}`);
    error.code = 'reference-intelligence.invalid';
    throw error;
  };
  if (!isPlainObject(input)) invalid('input must be an object');
  if (!containsOnlyPlainJsonObjects(input)) invalid('input must contain only plain objects');
  const inputUnknown = unknownKey(input, INPUT_KEYS);
  if (inputUnknown !== null) invalid(`input has unknown property: ${inputUnknown}`);
  const { fingerprint, library, platform, identity = {}, analysis = {}, evidence = {} } = input;
  if (!isPlainObject(analysis)) invalid('analysis must be an object');
  const analysisUnknown = unknownKey(analysis, new Set(['status', 'design', 'motion', 'taste', 'quality']));
  if (analysisUnknown !== null) invalid(`analysis has unknown property: ${analysisUnknown}`);
  if (!isPlainObject(evidence)) invalid('evidence must be an object');
  const evidenceUnknown = unknownKey(evidence, INPUT_EVIDENCE_KEYS);
  if (evidenceUnknown !== null) invalid(`evidence has unknown property: ${evidenceUnknown}`);
  const record = {
    schemaVersion: REFERENCE_INTELLIGENCE_SCHEMA_VERSION,
    library,
    platform,
    source: {
      url: fingerprint?.sourceUrl,
      capturedAt: fingerprint?.extractedAt,
    },
    identity,
    analysis: {
      status: analysis.status ?? 'pending',
      design: { ...createArrayDefaults(DESIGN_KEYS), ...analysis.design },
      motion: { patterns: [], ...analysis.motion },
      taste: { ...createArrayDefaults(TASTE_KEYS), ...analysis.taste },
      quality: { status: 'unrated', ...analysis.quality },
    },
    evidence: {
      fingerprint,
      screenshots: evidence.screenshots ?? [],
      motionTraces: evidence.motionTraces ?? [],
      videos: evidence.videos ?? [],
      sourceMaterials: evidence.sourceMaterials ?? [],
    },
  };
  let isolated;
  try {
    isolated = structuredClone(record);
  } catch {
    invalid('input cannot be cloned');
  }
  const result = validateReferenceIntelligence(isolated);
  if (!result.ok) invalid(result.error);
  return isolated;
}
