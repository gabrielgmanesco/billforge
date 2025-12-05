import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/prisma/schema.prisma",
  migrations: {
    path: "src/prisma/migrations",
    seed: "tsx src/prisma/seed.ts"
  },
  datasource: {
    // Durante o generate, pode usar uma URL dummy - o Prisma não conecta ao banco
    // A URL real será usada em runtime
    url: process.env.DATABASE_URL || "postgresql://dummy:dummy@dummy:5432/dummy",
  },
});

