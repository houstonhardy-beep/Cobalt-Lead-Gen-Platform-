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

const SIGNAL_TYPE_TO_OPP_TYPE: Record<string, string> = {
  CONSTRUCTION_PERMIT: 'PERMIT',
  GOVERNMENT_RFP:      'RFP',
  CUSTOMER_SIGNAL:     'BID',
  NEWS:                'BID',
  PERSONNEL_CHANGE:    'BID',
}

const SIGNAL_TYPE_TO_OPP_SOURCE: Record<string, string> = {
  CONSTRUCTION_PERMIT: 'DODGE',
  GOVERNMENT_RFP:      'SAM_GOV',
  CUSTOMER_SIGNAL:     'MANUAL',
  NEWS:                'MANUAL',
  PERSONNEL_CHANGE:    'MANUAL',
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
    select: { id: true, company: true },
  })

  const weightedValue = signal.estimatedValue ? signal.estimatedValue * 0.1 : undefined

  const opportunity = await db.opportunity.create({
    data: {
      tenantId,
      leadId:            lead.id,
      title:             signal.title,
      type:              SIGNAL_TYPE_TO_OPP_TYPE[signal.type] as never ?? 'BID',
      source:            SIGNAL_TYPE_TO_OPP_SOURCE[signal.type] as never ?? 'MANUAL',
      status:            'OPEN',
      stage:             'SIGNAL',
      stageChangedAt:    new Date(),
      estimatedRevenue:  signal.estimatedValue ?? undefined,
      probabilityPercent: 10,
      weightedValue:     weightedValue,
    },
    select: { id: true },
  })

  await db.signal.update({
    where: { id },
    data: { status: 'CONVERTED', convertedLeadId: lead.id, isRead: true },
  })

  return NextResponse.json({ leadId: lead.id, opportunityId: opportunity.id, company: lead.company })
}
