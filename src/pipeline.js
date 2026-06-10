// pipeline.js - standalone P1 pipeline:
//   brief + referenceUrl -> fingerprint -> baseline -> Ollama generation -> files
//
// This is the same flow as the n8n workflow but runnable from a single CLI
// without Docker or n8n. Designed for `codex-ollama` invocations.

import { createAwwwards } from '../scraper/src/awwwards.js';
import { extractFingerprint } from '../scraper/src/extract.js';
import { chat } from './ollama-client.js';

const SYSTEM_PROMPT = `You generate a single-file React + Vite landing page that approximates the reference site's design language.

Rules:
- Use ONLY the colors, fonts, and components listed in the baseline.
- The landing page must be a complete, working React component.
- Use inline styles or a <style> block — no external CSS dependencies.
- Include a proper package.json with react, react-dom, and vite.
- Output valid JSON with this exact shape:
  {
    "files": [
      { "path": "package.json", "content": "..." },
      { "path": "src/App.jsx", "content": "..." },
      { "path": "index.html", "content": "..." },
      { "path": "vite.config.js", "content": "..." }
    ],
    "notes": "One-paragraph self-critique of the result."
  }
- Do NOT wrap the JSON in markdown fences.
- Do NOT include any text before or after the JSON object.`;

export async function buildBaseline(fingerprint) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceFingerprints: [fingerprint.sourceUrl].filter(Boolean),
    palette: fingerprint.palette.map((p) => p.hex),
    fonts: fingerprint.fonts.map((f) => f.family),
    motion: fingerprint.motion,
    components: fingerprint.components,
  };
}

export async function scrapeAndFingerprint(url, { fetchImpl } = {}) {
  const aww = createAwwwards({ fetchImpl });
  const site = await aww.fetchSite(url);
  const fp = await extractFingerprint({ html: site.html, sourceUrl: site.finalUrl });
  return { fingerprint: fp, fetch: { status: site.status, finalUrl: site.finalUrl } };
}

export async function generate({ brief, baseline, fingerprint, targetStack = 'react-vite' }, ollamaOpts = {}) {
  const userContent = JSON.stringify({ brief, baseline, targetStack });

  const result = await chat({
    model: ollamaOpts.model || process.env.OLLAMA_MODEL_CODER || 'minimax-m3:cloud',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.4,
    ...ollamaOpts,
  });

  let parsed = null;
  try {
    // Strip markdown fences if the model wraps them
    const cleaned = result.content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Return raw if unparseable; caller can handle
  }

  return {
    ok: parsed !== null && Array.isArray(parsed.files) && parsed.files.length > 0,
    files: parsed?.files || [],
    notes: parsed?.notes || '',
    raw: result.content,
    fingerprint,
    baseline,
  };
}

export async function runPipeline({ brief, referenceUrl, targetStack = 'react-vite' }, ollamaOpts = {}) {
  if (!brief) throw new Error('brief is required');
  if (!referenceUrl) throw new Error('referenceUrl is required');

  console.log('[pipeline] scraping reference:', referenceUrl);
  const { fingerprint, fetch: fetchInfo } = await scrapeAndFingerprint(referenceUrl, {
    fetchImpl: ollamaOpts.fetchImpl,
  });
  console.log('[pipeline] fingerprint extracted:', fingerprint.palette.length, 'colors,', fingerprint.components.length, 'components');

  console.log('[pipeline] building baseline...');
  const baseline = await buildBaseline(fingerprint);

  console.log('[pipeline] generating with Ollama (model:', ollamaOpts.model || process.env.OLLAMA_MODEL_CODER || 'minimax-m3:cloud', ')...');
  const result = await generate({ brief, baseline, fingerprint, targetStack }, ollamaOpts);

  if (result.ok) {
    console.log('[pipeline] generation succeeded:', result.files.length, 'files');
  } else {
    console.log('[pipeline] generation returned unparseable output (raw length:', result.raw.length, ')');
  }

  return result;
}
