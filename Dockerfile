# Abhängigkeiten (auch für scripts/test.sh: Lint und Tests ohne lokales Node)
FROM node:26-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 ab v13 wird immer aus dem Quellcode gebaut → Build-Werkzeuge (nur in diesen Stufen)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Lint und Tests laufen beim Bauen mit – schlägt einer fehl, entsteht kein Image.
RUN npm run build && npm run lint && npm test && npm prune --omit=dev

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/classroom.db \
    BODY_SIZE_LIMIT=50M
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
VOLUME /app/data
CMD ["node", "build"]
