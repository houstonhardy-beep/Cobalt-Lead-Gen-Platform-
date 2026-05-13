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

const VALID_STAGES = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED', 'QUALIFIED',
  'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE',
]

const VALID_HEAT   = ['HOT', 'WARM', 'COLD']

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const lead = await db.lead.findFirst({
    where: { id, tenantId },
    select: {
      id: true, company: true, contact: true, contactTitle: true,
      phone: true, email: true, heat: true, leadSource: true,
      value: true, city: true, state: true, notes: true,
      stage: true, createdAt: true,
      assignedTo: { select: { id: true, name: true } },
      logs: {
        select: {
          id: true, date: true, action: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
      },
      convertedFrom: {
        select: {
          id: true, type: true, title: true, description: true,
          sourceName: true, sourceUrl: true, detectedAt: true, estimatedValue: true,
        },
        take: 1,
      },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...lead,
    createdAt:    lead.createdAt.toISOString(),
    logs:         lead.logs.map((l) => ({ ...l, date: l.date.toISOString() })),
    convertedFrom: lead.convertedFrom.map((s) => ({ ...s, detectedAt: s.detectedAt.toISOString() })),
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const existing = await db.lead.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    assignedToId?:  string | null
    stage?:         string
    company?:       string
    contact?:       string | null
    contactTitle?:  string | null
    phone?:         string | null
    email?:         string | null
    heat?:          string
    leadSource?:    string | null
    value?:         number | null
    city?:          string | null
    state?:         string | null
    notes?:         string | null
    nextFollowUp?:  string | null
  }

  const data: Record<string, unknown> = {}

  if ('assignedToId' in body) data.assignedToId = body.assignedToId ?? null
  if ('stage' in body) {
    if (!VALID_STAGES.includes(body.stage!)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }
    data.stage = body.stage
  }
  if ('company' in body) {
    if (!body.company?.trim()) return NextResponse.json({ error: 'Company is required' }, { status: 400 })
    data.company = body.company.trim()
  }
  if ('contact'      in body) data.contact      = body.contact      ?? null
  if ('contactTitle' in body) data.contactTitle = body.contactTitle ?? null
  if ('phone'        in body) data.phone        = body.phone        ?? null
  if ('email'        in body) data.email        = body.email        ?? null
  if ('heat'         in body) {
    if (!VALID_HEAT.includes(body.heat!)) {
      return NextResponse.json({ error: 'Invalid heat' }, { status: 400 })
    }
    data.heat = body.heat
  }
  if ('leadSource'   in body) data.leadSource   = body.leadSource   ?? null
  if ('value'        in body) data.value        = body.value        ?? null
  if ('city'         in body) data.city         = body.city         ?? null
  if ('state'        in body) data.state        = body.state        ?? null
  if ('notes'        in body) data.notes        = body.notes        ?? null
  if ('nextFollowUp' in body) {
    data.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp) : null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await db.lead.update({ where: { id }, data: data as never, select: { id: true } })
  return NextResponse.json({ ok: true, id: updated.id })
}
