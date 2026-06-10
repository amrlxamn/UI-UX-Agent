#!/usr/bin/env node
// uiux.mjs - CLI entry point for the ui-ux-agent pipeline.
//
// Usage:
//   node bin/uiux.mjs --brief "A Berlin studio site" --url https://example.com
//   node bin/uiux.mjs --brief "..." --url ... --model minimax-m3:cloud --out ./output
//
// Environment variables (loaded from .env if present):
//   OLLAMA_CLOUD_BASE_URL  - cloud endpoint (default: https://ollama.com/v1)
//   OLLAMA_LOCAL_BASE_URL  - local endpoint  (default: http://127.0.0.1:11434/v1)
//   OLLAMA_API_KEY         - API key; when set, routes to cloud; when blank, routes to local
//   OLLAMA_MODEL_CODER     - default model (default: minimax-m3:cloud)

import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../src/pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// --- Load .env if present (simple, no dep needed) ---
async function loadEnv() {
  const envPath = join(PROJECT_ROOT, '.env');
  try {
    const text = await readFile(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      // Don't overwrite env vars already set by the shell
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env not found — skip silently
  }
}

// --- Resolve Ollama base URL from env ---
function resolveOllamaBaseUrl(cliUrl) {
  if (cliUrl) return cliUrl;
  const apiKey = process.env.OLLAMA_API_KEY;
  if (apiKey && apiKey.length > 0) {
    // Cloud mode: use cloud endpoint
    return process.env.OLLAMA_CLOUD_BASE_URL || 'https://ollama.com/v1';
  }
  // Local mode: use local endpoint
  return process.env.OLLAMA_LOCAL_BASE_URL || 'http://127.0.0.1:11434/v1';
}

const { values } = parseArgs({
  options: {
    brief: { type: 'string' },
    url: { type: 'string' },
    model: { type: 'string' },
    'ollama-url': { type: 'string' },
    'api-key': { type: 'string' },
    'timeout': { type: 'string', default: '180' },
    out: { type: 'string', default: './output' },
    stack: { type: 'string', default: 'react-vite' },
    help: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
  strict: true,
});

if (values.help || (!values.brief && !values.url)) {
  console.log(`
ui-ux-agent P1 — brief + reference URL → React/Vite stub

Usage:
  node bin/uiux.mjs --brief "A premium studio site" --url https://example.com

Options:
  --brief         Design brief (required)
  --url           Reference URL to scrape (required)
  --model         Ollama model (default: minimax-m3:cloud or OLLAMA_MODEL_CODER)
  --ollama-url    Ollama API base URL (overrides auto-detection)
  --api-key       Ollama API key (overrides OLLAMA_API_KEY env var)
  --timeout       Generation timeout in seconds (default: 180)
  --out           Output directory (default: ./output)
  --stack         Target stack (default: react-vite)
  --json          Print full result as JSON to stdout
  --help          Show this help

Ollama routing (auto-detected from .env):
  - If OLLAMA_API_KEY is set → routes to OLLAMA_CLOUD_BASE_URL (https://ollama.com/v1)
  - If OLLAMA_API_KEY is blank  → routes to OLLAMA_LOCAL_BASE_URL (http://127.0.0.1:11434/v1)
  - Use --ollama-url to override either default
`);
  process.exit(values.help ? 0 : 1);
}

if (!values.brief) {
  console.error('error: --brief is required');
  process.exit(1);
}
if (!values.url) {
  console.error('error: --url is required');
  process.exit(1);
}

const outDir = resolve(values.out);
const timeoutMs = Math.max(10, Number(values.timeout) || 180) * 1000;

try {
  await loadEnv();

  const baseUrl = resolveOllamaBaseUrl(values['ollama-url']);
  const apiKey = values['api-key'] !== undefined ? values['api-key'] : process.env.OLLAMA_API_KEY || '';
  const model = values.model || process.env.OLLAMA_MODEL_CODER || 'minimax-m3:cloud';

  const mode = apiKey ? 'cloud' : 'local';
  console.log(`[pipeline] Ollama routing: ${mode} → ${baseUrl.replace(/\/+$/, '')} (model: ${model})`);

  const result = await runPipeline(
    {
      brief: values.brief,
      referenceUrl: values.url,
      targetStack: values.stack,
    },
    {
      model,
      baseUrl,
      apiKey,
      timeoutMs,
    },
  );

  if (values.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }

  // Always write files to disk if generation succeeded
  if (result.ok && result.files.length > 0) {
    await mkdir(outDir, { recursive: true });
    for (const file of result.files) {
      const filePath = join(outDir, file.path);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, file.content, 'utf8');
      console.log(`  wrote: ${filePath}`);
    }
    console.log(`\ndone: ${result.files.length} files in ${outDir}`);
    if (result.notes) console.log(`notes: ${result.notes}`);
  } else if (!values.json) {
    console.error('\ngeneration failed or returned unparseable output.');
    console.error('raw output (first 500 chars):');
    console.error(result.raw.slice(0, 500));
    process.exit(1);
  }
} catch (err) {
  console.error(`\nerror: ${err.message}`);
  if (err.code) console.error(`code: ${err.code}`);
  if (err.code === 'ollama.request.timeout') {
    console.error('\nHint: Ollama timed out. Common fixes:');
    console.error('  1. Start Ollama:  open -a Ollama  (or: ollama serve)');
    console.error('  2. For cloud models, check your API key and network access to ollama.com');
    console.error('  3. Try a local model:  --model deepseek-r1:latest  --ollama-url http://127.0.0.1:11434/v1');
    console.error('  4. Increase timeout:   --timeout 300');
  } else if (err.code === 'ollama.request.failed') {
    console.error('\nHint: Could not reach Ollama. Is the daemon running?');
    console.error('  Start it with:  ollama serve  (or open the Ollama app)');
  }
  process.exit(1);
}
