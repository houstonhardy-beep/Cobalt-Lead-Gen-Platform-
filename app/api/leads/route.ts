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

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const body = await request.json() as {
    company:      string
    contact?:     string
    contactTitle?: string
    phone?:       string
    email?:       string
    leadSource?:  string
    heat?:        string
    assignedToId?: string
    notes?:       string
    city?:        string
    state?:       string
  }

  if (!body.company?.trim()) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }

  const lead = await db.lead.create({
    data: {
      tenantId,
      company:      body.company.trim(),
      contact:      body.contact      || undefined,
      contactTitle: body.contactTitle || undefined,
      phone:        body.phone        || undefined,
      email:        body.email        || undefined,
      leadSource:   body.leadSource as never || undefined,
      heat:         body.heat as never || 'COLD',
      stage:        'PROSPECT',
      assignedToId: body.assignedToId || auth.session.user.id,
      notes:        body.notes        || undefined,
      city:         body.city         || undefined,
      state:        body.state        || undefined,
    },
    select: {
      id: true, company: true, contact: true, contactTitle: true,
      leadSource: true, heat: true, city: true, state: true, createdAt: true,
      assignedTo: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ ...lead, createdAt: lead.createdAt.toISOString() }, { status: 201 })
}
