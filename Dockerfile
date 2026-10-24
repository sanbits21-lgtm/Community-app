# syntax=docker/dockerfile:1
# One image: builds the website, then runs the API, which serves it. Caddy (see docker-compose.yml) sits in front for HTTPS.
FROM node:24-slim

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NODE_ENV=development
RUN npm install -g pnpm@12.4.1
WORKDIR /app

# Dependency layer first, so code-only changes rebuild in seconds.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @sangha/web build

# Website photos (/data/uploads) and private payment screenshots (/data/private) live here; docker-compose mounts a named volume over /data.
RUN mkdir -p /data/uploads /data/private && chown -R node:node /data /app
USER node

ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/uploads PRIVATE_DIR=/data/private
WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tsx runs the TypeScript directly (no separate compile step to keep in sync).
CMD ["node_modules/.bin/tsx", "src/server.ts"]
