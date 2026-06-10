# AGENTS.md (ui-ux-agent)

Conventions for the UI/UX Designer AI Agent. P1 scope only.

## Stack

- Runtime: Node 20+ (ESM only). Lint/format inherited from HLYM.
- Scraper service: Fastify.
- HTML/DOM parsing: linkedom + css-tree (no headless browser required
  for extraction; Playwright only for screenshots).
- Tests: built-in `node --test` runner. No Jest/Vitest in P1.
- Type discipline: plain JSDoc + ts-check where useful; no TS toolchain
  in P1 to keep cold start fast. P2 may add `tsc --noEmit`.

## Style

- 2-space indent. LF line endings. ASCII only.
- One module per file under `scraper/src/`. Pure functions where
  possible; side effects live in `serve.ts` and `screenshot.ts`.
- Errors: throw `Error` with a `code` string field
  (`'awwwards.search.failed'`, `'fingerprint.invalid'`). Never swallow.
- Logging: `console.log('[scraper]', ...)` prefix-style. n8n reads
  stdout; do not log secrets.
- No `any` in JSDoc. Prefer `unknown` + narrowing.

## Schemas

- `schema/fingerprint.schema.json` and `schema/baseline.schema.json`
  are the contracts. Hand-edited; do not regenerate from code.
- Extractor output MUST validate against `fingerprint.schema.json`
  before it leaves the service. Use `Ajv` in P2; for P1 we ship a
  hand-rolled `validateFingerprint()` so the dep footprint is small.

## n8n

- Workflows live in `n8n/workflows/*.json` as exported n8n flow files.
- Edits: make them in n8n UI, then re-export. Do not hand-edit the
  JSON for cosmetic reasons; do hand-edit when wiring new nodes.
- The P1 workflow `uiux-p1-modeB.json` MUST be loadable on a fresh
  n8n container with only `.env` set. No external credentials.

## Secrets

- `.env` is git-ignored. `.env.example` is the template.
- Never bake `OLLAMA_API_KEY` or `POSTGRES_PASSWORD` into JSON files
  or compose. Reference them via `${VAR}` and let compose interpolate.

## Testing

- Offline smoke test is the gate. New extraction logic MUST extend
  the fixture or add a new one. Live awwwards is for manual checks.
- A run is green when `node --test scraper/test/` exits 0 AND the
  validator accepts the produced fingerprint.

## Don't

- Don't add RAG, vector DB writes, or critic loops in P1. They are P2.
- Don't pull in headless browsers in CI. Playwright runs only in the
  scraper container with its own base image.
- Don't introduce a build step for the scraper; it ships as ESM.
