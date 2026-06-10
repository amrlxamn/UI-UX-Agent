# Runbook: ui-ux-agent P1

This file is the human checklist. Sandbox-restricted shells (no
`docker`, no outbound TCP) cannot complete these steps; an
unrestricted terminal is required.

## 1. Prereqs (one-time, host)

- Docker daemon reachable. On Mac: `colima start --cpu 4 --memory 8`.
  If `colima` says `Broken` and refuses to write its config, the host
  needs `sudo chown -R "$USER" ~/.colima` or a reinstall.
- Ollama running. Cloud key in `OLLAMA_API_KEY`; local daemon at
  `host.docker.internal:11434`.
- Postgres client (`psql`) optional; only needed for direct DB
  inspection.

## 2. Bring up the stack

```bash
cd ui-ux-agent
cp .env.example .env
# Edit .env: POSTGRES_PASSWORD, N8N_ENCRYPTION_KEY, N8N_CHAT_WEBHOOK_SECRET.
# Set OLLAMA_API_KEY for cloud routing. Leave blank to force local.
docker compose up -d
docker compose ps
docker compose logs -f n8n | head
```

Health:
- `curl -fsS http://localhost:3000/healthz` -> `{"ok":true,"version":"0.1.0"}`
- `curl -fsS http://localhost:6333/healthz` -> qdrant ok
- n8n UI: <http://localhost:5678> (first run creates the owner)

## 3. Import the workflow

1. Open n8n UI.
2. Workflows -> Import from File -> `n8n/workflows/uiux-p1-modeB.json`.
3. Open the workflow. n8n will warn that the `Ollama` HTTP node uses
   expressions; they resolve at runtime via `$env.*`.
4. Activate the workflow.

## 4. Smoke test the P1 path

```bash
# 1. Scrape an awwwards URL directly
curl -sS -X POST http://localhost:3000/scrape \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.awwwards.com/sites/studio-null"}' | jq .fingerprint

# 2. Trigger the n8n chat webhook with a brief and a reference
curl -sS -X POST "$WEBHOOK_URL/uiux-p1-modeb" \
  -H 'content-type: application/json' \
  -d '{
    "mode": "B",
    "brief": "A premium Berlin studio brand site. Editorial type, 12-col grid, monochrome with a single accent.",
    "referenceUrl": "https://www.awwwards.com/sites/studio-null"
  }' | jq .
```

Expected: a JSON object with `ok: true`, `files: [...]` (React + Vite
single page), and `notes` (short critique-style summary).

## 5. Offline smoke test (no Docker, no Ollama)

```bash
cd ui-ux-agent
node --test scraper/test/
```

Runs against `scraper/fixtures/awwwards-1.html`. Validates extractor
output, palette, motion, grid, and the awwwards stub. This is the
gate for CI.

## 6. P1 acceptance gate (per the original plan)

A run is "P1 done" when:

1. Brief + 1 reference URL -> n8n workflow -> 1 fingerprint + 1 stub
   design bundle, returned in under 60 seconds on a cold start.
2. The stub uses only the colors, fonts, and components from the
   baseline (manual eyeball check on the rendered screenshot).
3. `node --test scraper/test/` is green.
4. The Qdrant `fingerprints` collection holds the fingerprint with the
   same `sourceUrl` as the input (manual: `curl http://localhost:6333/collections/fingerprints`).

## 7. Common failures

- `scraper` 502 with code `awwwards.fetch.timeout`: awwwards blocked
  the IP. Wait, or use a curated URL pool.
- `n8n` HTTP 500 on the Ollama node: `OLLAMA_API_KEY` is empty AND the
  local daemon is down. Set the key, or start Ollama locally.
- Postgres healthcheck failing: `docker compose logs postgres` for
  password or volume errors. Re-set `POSTGRES_PASSWORD`.

## 8. Cleanup

```bash
docker compose down -v    # nukes volumes (postgres data, qdrant, n8n)
```


## 9. Qdrant cold-start quirk on Colima

`qdrant/qdrant:v1.12.x` does NOT ship a native aarch64 binary and
crashes on Apple Silicon. The compose file pins `v1.11.4` for that
reason.

Even with the right image, the first boot of qdrant on a Colima
virtiofs volume can take 30-60s to bind port 6333. The compose
service has its Docker healthcheck disabled in P1 and uses
`restart: on-failure` so a clean restart is allowed during the
race. To verify qdrant is actually up after `docker compose up -d`:

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://localhost:6333/healthz >/dev/null; then
    echo "qdrant up after ${i} attempt(s)"
    break
  fi
  sleep 5
done
docker compose logs --no-color qdrant | tail -20
```

If `docker compose logs qdrant` shows
`no binary for aarch64-linux-gnu`, the wrong image tag is being
pulled. Run `docker pull qdrant/qdrant:v1.11.4` explicitly and
rebuild.
