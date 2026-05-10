# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

RUN npm ci --include=dev

# Copy application source (excluding sensitive files via .dockerignore)
COPY . .

# Build production bundle
RUN npm run build

# ── Stage 2: Serve via Nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/cerberus.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Use non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /var/cache/nginx /var/log/nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
