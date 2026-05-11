import { z } from 'zod'

// .env files commonly leave optional vars as empty strings. Treat "" as absent.
function opt<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional())
}

// Required at startup — app will not boot without these
const requiredSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate: openssl rand -hex 32'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().default('localhost:3000'),
})

// Optional — validated at point of use in integration modules
const optionalSchema = z.object({
  ANTHROPIC_API_KEY:        opt(z.string()),
  NEXT_PUBLIC_MAPBOX_TOKEN: opt(z.string()),
  SENDGRID_API_KEY:         opt(z.string()),
  SENDGRID_FROM_EMAIL:      opt(z.string().email()),
  TWILIO_ACCOUNT_SID:       opt(z.string()),
  TWILIO_AUTH_TOKEN:        opt(z.string()),
  TWILIO_FROM_NUMBER:       opt(z.string()),
  CONNECTWISE_BASE_URL:     opt(z.string().url()),
  CONNECTWISE_COMPANY_ID:   opt(z.string()),
  CONNECTWISE_PUBLIC_KEY:   opt(z.string()),
  CONNECTWISE_PRIVATE_KEY:  opt(z.string()),
  CONNECTWISE_CLIENT_ID:    opt(z.string()),
  HUBSPOT_ACCESS_TOKEN:     opt(z.string()),
  APOLLO_API_KEY:           opt(z.string()),
  DODGE_API_KEY:            opt(z.string()),
  SAM_GOV_API_KEY:          opt(z.string()),
  VERKADA_API_KEY:          opt(z.string()),
})

function parseEnv() {
  const required = requiredSchema.safeParse(process.env)
  if (!required.success) {
    const missing = required.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Missing or invalid environment variables:\n${missing.join('\n')}`)
  }
  const optional = optionalSchema.parse(process.env)
  return { ...required.data, ...optional }
}

// Import this in lib/db/index.ts and auth.ts to validate at startup.
// Do NOT import in client components — process.env is server-only.
export const env = parseEnv()
