import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 uses driver adapters instead of reading DATABASE_URL from the schema.
// Swap PrismaPg for @prisma/adapter-neon (Neon) or @prisma/adapter-supabase
// once the database provider is chosen.
function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

// In dev, Next.js hot-reload destroys and recreates modules which would
// exhaust the Postgres connection pool. Stash the client on globalThis so
// it survives across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
