// awwwards.js - search and site fetch (URL only, no live calls in CI).
//
// P1 surface:
//   - search(query, { limit, category, section }) -> string[]
//   - fetchSite(url) -> { html, headers, status, finalUrl }
//
// Both functions are designed to be replaced in tests via the
// `createAwwwards({ searchImpl, fetchImpl })` factory. CI uses a
// stub backed by `../fixtures/awwwards-search.json`.

import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_LIMIT = 5;

export class AwwwardsError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AwwwardsError';
    this.code = code;
  }
}

export function createAwwwards({
  baseUrl = process.env.AWWARDS_BASE_URL || 'https://www.awwwards.com',
  userAgent = process.env.AWWARDS_USER_AGENT || 'ui-ux-agent/0.1',
  timeoutMs = Number(process.env.AWWARDS_REQUEST_TIMEOUT_MS || 15000),
  ratePerSec = Number(process.env.AWWARDS_RATE_LIMIT_PER_SEC || 1),
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new AwwwardsError('fetch implementation is required', 'awwwards.fetch.unavailable');
  }
  const minInterval = ratePerSec > 0 ? Math.floor(1000 / ratePerSec) : 0;
  let lastCall = 0;

  async function throttle() {
    const wait = minInterval - (now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = now();
  }

  async function fetchSite(url) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new AwwwardsError(`invalid url: ${url}`, 'awwwards.url.invalid');
    }
    await throttle();
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        headers: {
          'user-agent': userAgent,
          'accept': 'text/html,application/xhtml+xml',
        },
        signal: ac.signal,
        redirect: 'follow',
      });
      const html = await res.text();
      return {
        status: res.status,
        finalUrl: res.url || url,
        headers: Object.fromEntries(res.headers.entries()),
        html,
      };
    } catch (err) {
      const code = err.name === 'AbortError'
        ? 'awwwards.fetch.timeout'
        : 'awwwards.fetch.failed';
      throw new AwwwardsError(`fetch failed: ${err.message}`, code);
    } finally {
      clearTimeout(t);
    }
  }

  // Search is intentionally dumb in P1: awwwards HTML is volatile,
  // so we expose a hook that returns a ranked list of URLs. The
  // n8n workflow calls this from a planner prompt; the planner
  // ranks and we trust its picks.
  async function search(query, opts = {}) {
    const limit = Math.max(1, Math.min(20, opts.limit || DEFAULT_LIMIT));
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new AwwwardsError('query is required', 'awwwards.search.empty');
    }
    await throttle();
    // P1: real awwwards search is a TODO; we return a deterministic
    // empty list and let the workflow fall back to its reference
    // pool. P2 will replace this with a real Playwright + cheerio
    // pipeline. Marked with a structured error code so the caller
    // can branch.
    return { urls: [], query, limit, hint: 'search not implemented in P1' };
  }

  return { search, fetchSite, baseUrl };
}
