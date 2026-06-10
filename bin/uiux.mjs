#!/usr/bin/env node
// uiux.mjs - CLI entry point for the ui-ux-agent pipeline.
//
// Usage:
//   node bin/uiux.mjs --brief "A Berlin studio site" --url https://example.com
//   node bin/uiux.mjs --brief "..." --url ... --model minimax-m3:cloud --out ./output
//
// Environment variables (fallbacks):
//   OLLAMA_BASE_URL  - Ollama API base (default: http://127.0.0.1:11434/v1)
//   OLLAMA_API_KEY   - API key for cloud (blank for local)
//   OLLAMA_MODEL_CODER - model for generation (default: minimax-m3:cloud)

import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runPipeline } from '../src/pipeline.js';

const { values } = parseArgs({
  options: {
    brief: { type: 'string' },
    url: { type: 'string' },
    model: { type: 'string' },
    'ollama-url': { type: 'string' },
    'api-key': { type: 'string' },
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
  --ollama-url    Ollama API base URL (default: OLLAMA_BASE_URL or http://127.0.0.1:11434/v1)
  --api-key       Ollama API key (default: OLLAMA_API_KEY env var)
  --out           Output directory (default: ./output)
  --stack         Target stack (default: react-vite)
  --json          Print full result as JSON to stdout
  --help          Show this help
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

try {
  const result = await runPipeline(
    {
      brief: values.brief,
      referenceUrl: values.url,
      targetStack: values.stack,
    },
    {
      model: values.model,
      baseUrl: values['ollama-url'],
      apiKey: values['api-key'],
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
  process.exit(1);
}
