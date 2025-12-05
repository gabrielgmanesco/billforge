FROM node:22.12.0-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN npx prisma generate --schema=src/prisma/schema.prisma

RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
