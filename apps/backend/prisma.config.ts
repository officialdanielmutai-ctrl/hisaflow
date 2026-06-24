import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,        // pooler (PgBouncer) — used at runtime
    directUrl: process.env.DIRECT_URL,    // direct connection — used for migrations
  },
})