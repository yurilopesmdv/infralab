FROM node:24.13.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24.13.0-bookworm-slim AS runtime
ENV NODE_ENV=production DATABASE_PATH=/app/data/tasks.db
WORKDIR /app
RUN mkdir data && chown node:node data
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]

FROM runtime AS test
COPY --chown=node:node tests ./tests
CMD ["node", "--test", "--test-concurrency=1", "tests/app.test.mjs", "tests/postgres.test.mjs", "tests/sqlite.test.mjs"]
