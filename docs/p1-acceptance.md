# P1 Acceptance Gate

The plan's stated P1 success criterion is:

> "Brief -> 1 reference scraped -> stub design returned"

This document makes that testable.

## Inputs

- `brief`: a freeform string describing the desired site. Example:
  "A premium Berlin studio brand site. Editorial type, 12-col grid,
  monochrome with a single accent."
- `referenceUrl`: an awwwards.com site URL.

## Expected outputs (in the n8n response)

| Field | Type | Meaning |
|---|---|---|
| `ok` | bool | `true` if the generator returned parseable JSON |
| `files` | array of `{ path, content }` | The React + Vite single-page bundle |
| `notes` | string | Generator's one-paragraph self-critique |
| `fingerprint` | object | What the scraper extracted from the reference |
| `baseline` | object | The 1-fingerprint baseline (mirrors `baseline.schema.json`) |

## Pass criteria (P1)

- [ ] `node --test scraper/test/` exits 0.
- [ ] The `POST /scrape` response validates against
      `schema/fingerprint.schema.json`.
- [ ] The `POST /scrape/search` response carries the
      `"not implemented in P1"` hint (we want a deterministic stub
      here, not a flaky live call).
- [ ] The n8n workflow imports cleanly on a fresh n8n container with
      only `.env` set. No external credentials beyond `OLLAMA_API_KEY`.
- [ ] The generator response is parseable JSON; `files` is non-empty
      and includes a `package.json` and `src/App.jsx` (or
      `src/App.tsx`).
- [ ] End-to-end latency on a cold start (n8n boot + scraper + Ollama)
      is under 90 seconds p50.

## What's explicitly NOT in P1

- 3-reference baseline merge.
- Mode A (URL clone) pipeline.
- Critic loop, self-scoring, multi-pass retries.
- Figma export, R3F primitives, three.js scaffolding.
- Cost dashboards, rate limiting, observability.

Those land in P2-P5 per `../.claude/plans/ui-ux-designer-agent.md`.

## How to gate CI on this

A simple shell gate:

```bash
node --test scraper/test/ || exit 1
# Then in CI: bring up the stack, run the curl above, and assert:
#   .ok == true
#   (.files | length) > 0
#   (.files[] | select(.path == "package.json")) | length == 1
#   .fingerprint.schemaVersion == 1
```
