import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

async function resolveTenantId(request: NextRequest): Promise<string | null> {
  const slug = getTenantSlug(request)
  if (!slug) return null
  const tenant = await db.tenant.findFirst({ where: { slug, active: true }, select: { id: true } })
  return tenant?.id ?? null
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const leadId        = searchParams.get('leadId')
  const opportunityId = searchParams.get('opportunityId')

  if (!leadId && !opportunityId) {
    return NextResponse.json({ error: 'leadId or opportunityId is required' }, { status: 400 })
  }

  const contacts = await db.contact.findMany({
    where: {
      tenantId,
      ...(leadId ? { leadId } : { opportunityId: opportunityId! }),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, title: true, phone: true, email: true },
  })

  return NextResponse.json(contacts)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) {
    console.log('[contacts POST] auth failed')
    return auth.response
  }

  const tenantId = await resolveTenantId(request)
  console.log('[contacts POST] tenantId:', tenantId)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  let body: { leadId?: string; opportunityId?: string; name?: string; title?: string; phone?: string; email?: string }
  try {
    body = await request.json()
  } catch (e) {
    console.error('[contacts POST] failed to parse body:', e)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  console.log('[contacts POST] body:', JSON.stringify(body))

  if (!body.name?.trim()) {
    console.log('[contacts POST] rejected: name missing')
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!body.leadId && !body.opportunityId) {
    console.log('[contacts POST] rejected: no leadId or opportunityId')
    return NextResponse.json({ error: 'leadId or opportunityId is required' }, { status: 400 })
  }

  try {
    const contact = await db.contact.create({
      data: {
        tenantId,
        leadId:        body.leadId        || undefined,
        opportunityId: body.opportunityId || undefined,
        name:          body.name.trim(),
        title:         body.title?.trim()  || null,
        phone:         body.phone?.trim()  || null,
        email:         body.email?.trim()  || null,
      },
      select: { id: true, name: true, title: true, phone: true, email: true },
    })
    console.log('[contacts POST] created:', contact.id)
    return NextResponse.json(contact, { status: 201 })
  } catch (e) {
    console.error('[contacts POST] db.create error:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
