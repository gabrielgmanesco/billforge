FROM node:22.12.0-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev

COPY . .

RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
