FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies inside Linux container
RUN npm install

# Copy source and tsconfig
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npx tsc || true

# If dist was pre-built, ensure dist is present
COPY dist/ ./dist/

ENV PORT=8090
ENV NODE_ENV=production

EXPOSE 8090

CMD ["node", "dist/runner.js"]
