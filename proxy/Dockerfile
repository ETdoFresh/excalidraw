FROM --platform=${BUILDPLATFORM} node:18-alpine AS deps

WORKDIR /opt/node_app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM --platform=${TARGETPLATFORM} node:18-alpine

WORKDIR /opt/node_app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=deps /opt/node_app/node_modules ./node_modules
COPY . .

EXPOSE 3000

HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3000 || exit 1

CMD ["node", "server.js"]

