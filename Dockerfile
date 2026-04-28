# syntax=docker/dockerfile:1.6

# ---- deps: install deps (cached) ----
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: next build + drizzle-kit (generates any missing migrations) ----
FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime: minimal ----
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DB_PATH=/app/data/binder.sqlite

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next standalone output
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Drizzle migrations & password-hash helper
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts

# Native deps (better-sqlite3, argon2) live outside the traced standalone bundle;
# copy them explicitly so runtime can load them.
COPY --from=build --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=build --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=build --chown=nextjs:nodejs /app/node_modules/argon2 ./node_modules/argon2
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@phc ./node_modules/@phc
COPY --from=build --chown=nextjs:nodejs /app/node_modules/node-addon-api ./node_modules/node-addon-api
COPY --from=build --chown=nextjs:nodejs /app/node_modules/node-gyp-build ./node_modules/node-gyp-build
# scripts/users.mjs uses ulid for new user IDs; standalone bundle doesn't trace it
COPY --from=build --chown=nextjs:nodejs /app/node_modules/ulid ./node_modules/ulid

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs

EXPOSE 3000

# Use tini so SIGTERM is forwarded to node → SQLite closes cleanly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
