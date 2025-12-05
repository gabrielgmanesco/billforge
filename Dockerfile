FROM node:22.12.0-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev

COPY . .

# Generate Prisma Client (DATABASE_URL dummy só para passar na validação)
# O Prisma não conecta ao banco durante o generate, só gera os tipos
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN npm run prisma:generate

# Build TypeScript
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
