# ============================================================
# mmx-music-studio — Multi-stage build
# ============================================================
# Build stage: compile TypeScript + Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including dev for build)
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig.json tsconfig.tsbuildinfo vite.config.ts index.html ./
COPY src/ src/
COPY server/ server/
COPY packages/ packages/
COPY apps/ apps/

# Build web assets
RUN npm run build

# ============================================================
# Runner stage: production runtime
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S mmx -u 1001

# Install production-only deps (tsx for running TypeScript server)
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx

# Copy built assets
COPY --from=builder /app/dist ./dist

# Copy server (TypeScript source, run via tsx)
COPY server/ server/

# Copy packages (core, adapters, ui-tokens)
COPY packages/ packages/

# Copy app entry points
COPY apps/ apps/

# Copy docs (optional, for embedded documentation server)
COPY docs/ docs/

# Copy public/index.html
COPY index.html ./

# Create storage directory with .gitkeep
RUN mkdir -p /app/storage/tracks && touch /app/storage/tracks/.gitkeep

# Switch to non-root user
USER mmx

# Default: safe mode (no real generation, mock only)
ENV PORT=8787
ENV PUBLIC_DEMO_MODE=true
ENV REAL_GENERATION_ENABLED=false
ENV MOCK_GENERATION_ENABLED=true
ENV MINIMAX_BACKEND=mock
ENV MINIMAX_REGION=cn
ENV MUSIC_OUTPUT_DIR=/app/storage/tracks

EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8787/api/health || exit 1

CMD ["npm", "run", "start"]