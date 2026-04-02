# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Build-time variable so the Vite frontend knows the Railway API URL
ARG VITE_API_BASE_URL=https://veridex-production-6327.up.railway.app

# Install root dependencies (frontend build tools)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build frontend with the correct API base URL
COPY . .
RUN VITE_API_BASE_URL=$VITE_API_BASE_URL npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:24-alpine AS production

WORKDIR /app

# Install backend dependencies only
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --omit=dev

# Copy built frontend and backend source
COPY --from=builder /app/dist ./dist
COPY backend ./backend

# Data directory for SQLite (overridden by DATABASE_URL in production)
RUN mkdir -p /app/backend/data

EXPOSE 3000

ENV NODE_ENV=production
ENV ENABLE_COLLECTOR=true

ENTRYPOINT ["node"]
CMD ["backend/server.js"]
