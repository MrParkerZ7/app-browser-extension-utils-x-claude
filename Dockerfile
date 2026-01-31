# Dockerfile for building the browser extension
# Used primarily for CI/CD pipeline scanning

FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Run linting and formatting checks
RUN npm run code:check

# Build the extension
RUN npm run build

# Production stage - minimal image with just the built extension
FROM alpine:3.21 AS production

WORKDIR /extension

# Copy built extension from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Add metadata
LABEL org.opencontainers.image.title="Browser Extension"
LABEL org.opencontainers.image.description="Chrome browser extension build artifact"
