import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

type MatchResponse = {
  person?: {
    name?:          string | null
    first_name?:    string | null
    last_name?:     string | null
    title?:         string | null
    email?:         string | null
    linkedin_url?:  string | null
    phone_numbers?: { sanitized_number?: string | null }[] | null
  } | null
  error?:   string
  message?: string
}

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

  const body = await request.json() as { apolloId?: string; companyName?: string }
  if (!body.apolloId) return NextResponse.json({ error: 'apolloId is required' }, { status: 400 })

  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': tenant.apolloKey },
    body: JSON.stringify({
      id:                     body.apolloId,
      reveal_personal_emails: true,
    }),
    cache: 'no-store',
  })

  const rawText = await res.text().catch(() => '(unreadable)')
  console.log('[apollo] reveal HTTP', res.status, 'for id', body.apolloId, '— body:', rawText.slice(0, 500))

  if (!res.ok) {
    let msg = 'Apollo reveal failed'
    try {
      const d = JSON.parse(rawText) as { error?: string; message?: string }
      msg = d.error ?? d.message ?? msg
    } catch { /* ignore */ }
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  let data: MatchResponse
  try {
    data = JSON.parse(rawText) as MatchResponse
  } catch {
    return NextResponse.json({ error: 'Failed to parse Apollo response' }, { status: 500 })
  }

  const person = data.person
  if (!person) {
    return NextResponse.json({ error: 'Person not found in Apollo response' }, { status: 404 })
  }

  const name = person.name
    ?? ([person.first_name, person.last_name].filter(Boolean).join(' ') || null)

  return NextResponse.json({
    name,
    email:       person.email                                 ?? null,
    phone:       person.phone_numbers?.[0]?.sanitized_number ?? null,
    title:       person.title                                 ?? null,
    linkedinUrl: person.linkedin_url                         ?? null,
  })
}
