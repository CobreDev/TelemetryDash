# syntax=docker/dockerfile:1
# Build natively on the build machine: the output is plain JavaScript and runs on any CPU,
# so only the runtime stage needs the target platform (e.g. linux/amd64 for Intel Unraid).
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

# Runtime: the server is bundled into one file, so no node_modules are shipped.
FROM node:22-alpine
LABEL org.opencontainers.image.title="TelemetryDash" \
      org.opencontainers.image.description="Live NASCAR race-stats dashboard and JSON API" \
      net.unraid.docker.webui="http://[IP]:[PORT:8080]/" \
      net.unraid.docker.icon="http://127.0.0.1:8099/icon.png"
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
