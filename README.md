# UI/UX Designer AI Agent (P1)

A multi-agent design assistant. P1 ships a single-reference stub:
one awwwards URL in -> one React/Vite + screenshot out, anchored to
a 1-reference baseline.

Source plan: `../.claude/plans/ui-ux-designer-agent.md` (P1-P5).
Locked decisions: `docs/decisions.md` (mirror of `../.claude/plans/DECISIONS.md`).

## Layout

```
ui-ux-agent/
  scraper/         # Fastify service: awwwards search + scrape + fingerprint
    src/
      awwwards.ts  # search + site fetch (URL only, no live calls in CI)
      extract.ts   # palette/type/grid/motion fingerprint from HTML+CSS
      screenshot.ts# Playwright screenshot capture
      serve.ts     # Fastify entrypoint: POST /scrape, GET /healthz
    fixtures/      # offline HTML+CSS used by the smoke test
    test/          # node --test smoke tests
  n8n/
    workflows/     # exported n8n workflow JSON (v0.1)
  schema/          # fingerprint + baseline JSON Schemas
  scripts/         # helper scripts (offline smoke, ollama probe)
  docs/            # runbook, decisions, P1 acceptance gate
  .env.example
  docker-compose.yml
  AGENTS.md        # coding conventions
```

## What runs in P1

- `docker compose up` brings up n8n, postgres, qdrant, scraper.
- n8n exposes a chat webhook that accepts `{ mode: "B", brief, targetStack }`.
- Scraper service hits awwwards once, extracts a fingerprint, returns it.
- n8n sends fingerprint + brief to Ollama (cloud or local) and renders a
  React/Vite stub. Output: code bundle + screenshot.

## What does NOT run in P1

- 3-reference baseline merge (P2).
- Mode A clone pipeline (P3).
- Critic loop (P2 / P4).
- Figma export, 3D primitives, multi-LLM routing (P4-P5).

These are stubbed but the seams are in place.

## Quick start (outside this sandbox)

```bash
cd ui-ux-agent
cp .env.example .env             # fill OLLAMA_API_KEY, POSTGRES_PASSWORD
docker compose up -d
curl -fsS http://localhost:3000/healthz
# Open n8n at http://localhost:5678, import n8n/workflows/uiux-p1-modeB.json
# Trigger via the chat webhook.
```

## Offline smoke test (works in this sandbox)

```bash
node --test scraper/test/smoke.test.mjs
```

This runs the extractor end-to-end against a deterministic HTML fixture.
No Docker, no Ollama, no network.
