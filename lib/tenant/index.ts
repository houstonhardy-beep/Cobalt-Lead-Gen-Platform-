import { cache } from 'react'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import type { ResolvedTenant } from './types'

// cache() deduplicates the DB call within a single server render pass —
// many components can call getTenant() without issuing multiple queries.
export const getTenant = cache(async (): Promise<ResolvedTenant | null> => {
  const headersList = await headers()
  const slug = headersList.get('x-tenant-slug')

  if (!slug) return null

  // findFirst — findUnique only accepts unique fields in where; active is not unique
  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
  })

  if (!tenant) return null

  // Double-cast: Prisma returns config/branding as JsonValue.
  // We own this data and enforce the shape on write, so this cast is safe.
  return tenant as unknown as ResolvedTenant
})

// For use in API route handlers, which receive a Request object directly
// rather than reading from next/headers.
export function getTenantSlug(request: Request): string | null {
  return request.headers.get('x-tenant-slug')
}

// Throws if the tenant is missing — use in layouts/pages that require one.
export async function requireTenant(): Promise<ResolvedTenant> {
  const tenant = await getTenant()
  if (!tenant) {
    throw new Error('No tenant found for this request.')
  }
  return tenant
}
