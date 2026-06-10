// serve.js - Fastify entrypoint. P1 endpoints:
//   GET  /healthz          -> { ok: true, version }
//   POST /scrape           -> { fingerprint }   (body: { url })
//   POST /scrape/search    -> { urls }          (body: { query, limit })
//
// The fingerprint is the only artifact n8n consumes in P1. n8n
// already has the brief, targetStack, and any planner output. The
// scraper stays single-purpose: HTML in, structured fingerprint out.

import Fastify from 'fastify';
import { createAwwwards, AwwwardsError } from './awwwards.js';
import { extractFingerprint, validateFingerprint } from './extract.js';

const PORT = Number(process.env.SCRAPER_PORT || 3000);
const LOG_LEVEL = process.env.SCRAPER_LOG_LEVEL || 'info';
const VERSION = '0.1.0';

const aww = createAwwwards();

const app = Fastify({ logger: { level: LOG_LEVEL } });

app.get('/healthz', async () => ({ ok: true, version: VERSION }));

app.post('/scrape/search', async (req, reply) => {
  const { query, limit } = req.body || {};
  try {
    const out = await aww.search(query, { limit });
    return out;
  } catch (err) {
    req.log.error({ err }, 'search failed');
    reply.code(400);
    return { error: err.message, code: err.code || 'awwwards.search.failed' };
  }
});

app.post('/scrape', async (req, reply) => {
  const { url } = req.body || {};
  if (!url) {
    reply.code(400);
    return { error: 'url is required', code: 'scrape.url.missing' };
  }
  try {
    const site = await aww.fetchSite(url);
    const fp = await extractFingerprint({ html: site.html, sourceUrl: site.finalUrl });
    return {
      fingerprint: fp,
      fetch: { status: site.status, finalUrl: site.finalUrl },
    };
  } catch (err) {
    if (err.code === 'fingerprint.invalid') {
      req.log.warn({ err, url }, 'fingerprint rejected');
      reply.code(422);
      return { error: err.message, code: err.code };
    }
    if (err instanceof AwwwardsError) {
      req.log.error({ err, url }, 'fetch failed');
      reply.code(502);
      return { error: err.message, code: err.code };
    }
    req.log.error({ err, url }, 'scrape crashed');
    reply.code(500);
    return { error: 'internal error', code: 'scrape.crashed' };
  }
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`scraper ready on :${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
