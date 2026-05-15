import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

type ApolloPersonResponse = {
  person?: {
    name?: string | null
    title?: string | null
    organization?: { name?: string | null } | null
    organization_name?: string | null
    email?: string | null
    linkedin_url?: string | null
  } | null
  error?: string
  message?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi(['TENANT_ADMIN', 'COBALT_SUPER_ADMIN'])
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true, apolloKey: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  if (!tenant.apolloKey) {
    return NextResponse.json({ error: 'Apollo key not configured' }, { status: 400 })
  }

  let apolloRes: Response
  try {
    apolloRes = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': tenant.apolloKey,
      },
      body: JSON.stringify({
        name: 'Tim Zheng',
        organization_name: 'Apollo.io',
        reveal_personal_emails: true,
      }),
      cache: 'no-store',
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach Apollo API: ${String(err)}` },
      { status: 502 },
    )
  }

  const raw = await apolloRes.json() as ApolloPersonResponse

  if (!apolloRes.ok) {
    const msg = raw.error ?? raw.message ?? `Apollo returned ${apolloRes.status}`
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const person = raw.person
  if (!person) {
    return NextResponse.json({ error: 'Apollo returned no person data' }, { status: 404 })
  }

  return NextResponse.json({
    name:        person.name        ?? null,
    title:       person.title       ?? null,
    company:     person.organization?.name ?? person.organization_name ?? null,
    email:       person.email       ?? null,
    linkedinUrl: person.linkedin_url ?? null,
  })
}
