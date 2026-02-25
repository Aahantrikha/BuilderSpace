# Backend Dockerfile for GCP Cloud Run
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (Cloud Run uses PORT env var)
EXPOSE 8080

# Start server
CMD ["node", "dist/server.js"]
