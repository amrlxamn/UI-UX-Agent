// screenshot.js - Playwright capture. P1 keeps the surface minimal:
//   capture({ url, outPath, viewport, fullPage }) -> { path, width, height }
//
// Live awwwards URLs go through this. Fixtures and offline runs do
// not. The Dockerfile installs Chromium; tests in CI never run this.

import { chromium } from 'playwright';

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

export async function capture({
  url,
  outPath,
  viewport = DEFAULT_VIEWPORT,
  fullPage = true,
  timeoutMs = 30000,
} = {}) {
  if (!url) throw new Error('url is required');
  if (!outPath) throw new Error('outPath is required');
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
    await page.screenshot({ path: outPath, fullPage });
    const dim = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    return { path: outPath, width: dim.width, height: dim.height };
  } finally {
    await browser.close();
  }
}
