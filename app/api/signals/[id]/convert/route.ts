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

const SIGNAL_TYPE_TO_LEAD_SOURCE: Record<string, string> = {
  CONSTRUCTION_PERMIT: 'DODGE_DATA',
  GOVERNMENT_RFP:      'RFP_BID_BOARD',
  CUSTOMER_SIGNAL:     'EXISTING_CUSTOMER',
  NEWS:                'COLD_OUTREACH',
  PERSONNEL_CHANGE:    'COLD_OUTREACH',
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const signal = await db.signal.findFirst({
    where: { id, tenantId },
    select: {
      id: true, type: true, title: true, company: true,
      location: true, estimatedValue: true, description: true,
      assignedToId: true, contactName: true, contactTitle: true,
      status: true,
    },
  })
  if (!signal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (signal.status === 'CONVERTED') {
    return NextResponse.json({ error: 'Already converted' }, { status: 409 })
  }

  const city  = signal.location?.split(',')[0]?.trim() ?? undefined
  const state = signal.location?.split(',')[1]?.trim() ?? undefined

  const lead = await db.lead.create({
    data: {
      tenantId,
      company:      signal.company ?? signal.title,
      contact:      signal.contactName  ?? undefined,
      contactTitle: signal.contactTitle ?? undefined,
      stage:        'SIGNAL',
      heat:         'WARM',
      value:        signal.estimatedValue ?? undefined,
      city,
      state,
      signal:       signal.description,
      signalSource: signal.title,
      leadSource:   SIGNAL_TYPE_TO_LEAD_SOURCE[signal.type] as never ?? 'COLD_OUTREACH',
      assignedToId: signal.assignedToId ?? auth.session.user.id,
    },
    select: { id: true },
  })

  await db.signal.update({
    where: { id },
    data: { status: 'CONVERTED', convertedLeadId: lead.id, isRead: true },
  })

  return NextResponse.json({ leadId: lead.id })
}
