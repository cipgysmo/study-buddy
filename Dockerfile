# syntax=docker/dockerfile:1

# ---- 1. Install dependencies ----
FROM node:24-slim AS deps
WORKDIR /app
# better-sqlite3 is a native module compiled at install time (node-gyp),
# which needs a C++ toolchain + Python. Only this stage needs them.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. Build the app ----
FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 3. Runtime ----
FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/app/data \
    PORT=3000
# Standalone server + its pruned node_modules (includes better-sqlite3)
COPY --from=build /app/.next/standalone ./
# @napi-rs/canvas ships its native binding as a platform-specific optional
# package (e.g. @napi-rs/canvas-linux-x64-gnu) that Next.js standalone tracing
# can miss, which makes pdf-parse fail to load (DOMMatrix is not defined).
# Copy the whole @napi-rs scope from the deps stage so the right binding is present.
COPY --from=deps /app/node_modules/@napi-rs /app/node_modules/@napi-rs
# Static assets + public (not copied by standalone by default)
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Run as the unprivileged 'node' user (uid 1000). The mounted data volume
# must be writable by uid 1000 (see README / TrueNAS dataset permissions).
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://localhost:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Docker sets HOSTNAME to the container id; Next.js standalone would bind to it
# (which /etc/hosts resolves to 127.0.1.1), making the app unreachable. Force 0.0.0.0.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
