# Scraper service image. Pinned to node 20-bookworm-slim (Debian)
# because Playwright's `--with-deps` on Alpine hits `apt-get: not
# found` (Alpine uses apk). Bookworm gives us a working apt-based
# deps install while keeping the image small enough for P1.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk1.0-0 \
      libatk-bridge2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 \
      libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 \
      libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 \
      libxfixes3 libxkbcommon0 libxrandr2 xvfb \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
RUN npx --yes playwright install chromium
EXPOSE 3000
CMD ["node", "src/serve.js"]
