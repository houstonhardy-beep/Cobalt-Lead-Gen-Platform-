import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

const TEST_EMAILS = [
  'admin@leksystems.com',
  'rep@leksystems.com',
  'houston.hardy@cobaltsp.com',
]

const TEST_PASSWORDS: Record<string, string> = {
  'admin@leksystems.com':        'lek-admin-2026',
  'rep@leksystems.com':          'lek-rep-2026',
  'houston.hardy@cobaltsp.com':  'cobalt-super-2026',
}

async function main() {
  for (const email of TEST_EMAILS) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      console.log(`  MISSING  ${email}`)
      continue
    }

    const hashSet    = !!user.passwordHash
    const hashPrefix = user.passwordHash?.slice(0, 7) ?? 'null'

    let bcryptOk = false
    if (user.passwordHash) {
      bcryptOk = await bcrypt.compare(TEST_PASSWORDS[email], user.passwordHash)
    }

    const status = !hashSet ? 'NO HASH' : !bcryptOk ? 'HASH MISMATCH' : 'OK'
    console.log(`  ${status.padEnd(14)} ${email}  (hash prefix: ${hashPrefix}, active: ${user.active})`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
