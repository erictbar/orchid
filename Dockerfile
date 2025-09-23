FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build stage
FROM base AS build
COPY . .
RUN npm run build

# Runtime stage (production deps only)
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /app/build ./build
COPY --from=build /app/assets ./assets
COPY --from=build /app/README.md ./README.md

EXPOSE 3000
CMD ["node", "build/index.js"]