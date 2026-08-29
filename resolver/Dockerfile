# Production Dockerfile for Video Downloader Self-Hosted Resolver
FROM node:20-alpine

# Install Python 3, ffmpeg, ca-certificates, and yt-dlp
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    ca-certificates \
    curl \
    bash && \
    python3 -m pip install --no-cache-dir --break-system-packages -U yt-dlp

WORKDIR /app

# Copy server code
COPY package.json server.mjs ./

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3210
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3210

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3210/health || exit 1

# Run as node user
USER node

# Start resolver service
CMD ["node", "server.mjs"]
