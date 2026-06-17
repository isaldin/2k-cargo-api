# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: runtime
FROM node:20-alpine AS runtime

WORKDIR /app

RUN mkdir -p /app/data && chown -R node:node /app

USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /app/dist ./dist

ENV NODE_ENV=production

EXPOSE ${APP_PORT}

CMD ["node", "dist/main"]
