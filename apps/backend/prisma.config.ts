import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // This tells the Prisma CLI to prioritize the Direct URL for schema pushes,
    // safely falling back to the standard database pooler URL if necessary.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});