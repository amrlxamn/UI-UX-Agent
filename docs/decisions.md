# Decisions: UI/UX Designer AI Agent

**Status:** All 10 open questions resolved.
**Date:** 2026-06-04 (originally 2026-06-05; mirrored from `.claude/plans/DECISIONS.md`).
**Source plan:** `ui-ux-designer-agent.md` at `../.claude/plans/`.
**Model inventory source:** `ollama list` on user Mac, verified 2026-06-04.

| # | Topic | Decision |
|---|---|---|
| 1 | Mode A scope | Visual **pixel-perfect clone** (with legal disclaimer) **+ agent-generated modifications**. |
| 2 | Default target stack | **React + Vite** by default. If the user names another framework, build in that framework. |
| 3 | 3D handling | Treat Three.js sites as **"rebuild with R3F primitives"** (no asset copy). **Asset placeholders allowed.** |
| 4 | LLM provider | **Ollama** — cloud primary ($20/mo plan) + local fallback. See **Model Roster** below. |
| 5 | n8n hosting | **Self-host on Mac via Docker.** |
| 6 | Vector DB | **Qdrant.** |
| 7 | Chat UI | **n8n built-in chat.** |
| 8 | Compliance posture | **"Structural inspiration only"** disclaimer accepted. |
| 9 | MVP output formats | **Code + Figma JSON + screenshot.** |
| 10 | Budget | **Minimize cost** — Ollama cloud plan ($20/mo flat) + local-only infra (n8n, Qdrant, Postgres, sandbox). |

## Model Roster (Decision #4)

Source: `ollama list` on user Mac, 2026-06-04. Endpoint: `https://ollama.com/v1` (OpenAI-compatible) for cloud; `http://host.docker.internal:11434/v1` for local fallback.

| Role | Model | Why |
|---|---|---|
| **Coder (primary)** | `minimax-m3:cloud` | Freshest cloud tag; used for code generation, Figma JSON, R3F primitives, multi-file React/Vite. |
| **Planner / router** | `glm-5.1:cloud` | Strong structured-JSON + tool-use; routes the brief, picks the 3 references, frames critic loop. |
| **Critic (code, CoT)** | `deepseek-r1:latest` | Local 5.2 GB; chain-of-thought scoring against baseline. Zero token cost. |
| **Local backup / fast path** | `huihui_ai/qwen3.5-abliterated:2b` | 1.9 GB local; runs offline if cloud is down. Not a coder-specialist but capable for quick tasks. |
| **Extractor (palette, fingerprint JSON)** | `glm-5.1:cloud` (reuse) | Cheap structured extraction; no need for a second model. |

**Routing rules (n8n workflow):**

- `quality=fast` -> local `qwen3.5-abliterated:2b` only.
- `quality=balanced` (default) -> cloud `minimax-m3:cloud` (coder) + cloud `glm-5.1:cloud` (planner) + local `deepseek-r1:latest` (critic).
- `quality=best` -> same as balanced but with a 2-pass critic loop and larger context windows.

## Implications for build phases

P1 (this repo) ships:
- Mode B happy path with 1 reference (no critic loop, no 3-merge).
- Coder = `minimax-m3:cloud`. Planner = `glm-5.1:cloud`.
- n8n + Postgres + Qdrant + scraper on the host.
- "Structural inspiration only" disclaimer in the workflow output.
- Cost posture: $20/mo flat for Ollama cloud; critic stays local in P2 to protect cloud tokens.

## Cost posture (Decision #10)

- Compute: $20/mo flat for Ollama cloud (effectively uncapped for our workload).
- Infra: all containers local on Mac (n8n, Qdrant, Postgres, generator sandbox).
- Critic model: local `deepseek-r1:latest` to keep cloud tokens for code + planning where they pay off.
- Caching: aggressive fingerprint cache in Qdrant to avoid re-scraping awwwards.
- Fallback: local `qwen3.5-abliterated:2b` if cloud is unreachable.
