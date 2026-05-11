import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Supabase connection setup:
//
//   DATABASE_URL  — Supabase connection pooler URL (Session Mode, port 5432).
//                   Used by the app at runtime via @prisma/adapter-pg.
//                   Get from: Supabase Dashboard → Project → Connect → Session Mode
//
//   DIRECT_URL    — Supabase direct (non-pooled) connection URL (port 5432, IPv6).
//                   Used here for `prisma migrate` and `prisma db push`.
//                   Get from: Supabase Dashboard → Project → Connect → Direct connection
//
// Use Session Mode pooler (not Transaction Mode) for DATABASE_URL.
// Transaction Mode (port 6543) does not support all Prisma query features.

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations use the direct connection to bypass the pooler.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
