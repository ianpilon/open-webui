FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs worker.mjs ./
ENV EARS_MODELS=/models EARS_PORT=8132
CMD ["node", "server.mjs"]
