FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY server/app-server.mjs ./server/app-server.mjs

EXPOSE 8080

CMD ["node", "server/app-server.mjs"]
