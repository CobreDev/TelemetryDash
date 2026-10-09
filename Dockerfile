# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

# Runtime: the server is bundled into one file, so no node_modules are shipped.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/client \
    DATA_DIR=/data \
    ATTRIBUTION_HANDLE=@yourhandle
WORKDIR /app
COPY --from=build /app/dist/server ./server
COPY --from=build /app/dist/client ./client
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" || exit 1
CMD ["node", "server/index.mjs"]
