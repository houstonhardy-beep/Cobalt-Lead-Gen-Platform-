import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'
import { apolloSearchPeople, ApolloUpgradeRequired } from '@/lib/apollo'

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { apolloKey: true },
  })
  if (!tenant?.apolloKey) return NextResponse.json({ error: 'Apollo key not configured' }, { status: 400 })

  const body = await request.json() as { company?: string; domain?: string | null }
  const company = body.company?.trim()
  if (!company) return NextResponse.json({ error: 'company is required' }, { status: 400 })

  try {
    const people = await apolloSearchPeople(tenant.apolloKey, company, body.domain ?? null)
    return NextResponse.json({ people })
  } catch (err) {
    if (err instanceof ApolloUpgradeRequired) {
      return NextResponse.json({ error: err.message }, { status: 402 })
    }
    console.error('[apollo] contacts route exception:', err)
    return NextResponse.json({ error: 'Apollo search failed' }, { status: 500 })
  }
}
