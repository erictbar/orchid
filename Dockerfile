FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
# Prefer clean install; fall back to install if lockfile is temporarily out of sync
RUN npm ci || npm install --no-audit --no-fund

# Build stage
FROM base AS build
COPY . .
RUN npm run build

# Runtime stage (production deps only)
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Prefer clean production install; fall back if lockfile is out of sync
RUN npm ci --only=production || npm install --only=production --no-audit --no-fund
COPY --from=build /app/build ./build
COPY --from=build /app/assets ./assets
COPY --from=build /app/README.md ./README.md

EXPOSE 3000
CMD ["node", "build/index.js"]