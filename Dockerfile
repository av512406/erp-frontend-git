# Stage 1: Builder
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --omit=dev && \
    npm install bcryptjs --legacy-peer-deps

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Expose the port
EXPOSE 5000

# Start the application
CMD ["npm", "run", "start"]
