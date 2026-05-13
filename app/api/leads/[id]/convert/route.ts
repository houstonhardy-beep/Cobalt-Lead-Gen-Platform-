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
  'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION',
]

export async function POST(
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
    select: { id: true, company: true, leadSource: true, jobType: true, productCategory: true },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await db.opportunity.findFirst({ where: { leadId: id }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: 'Already has an opportunity', opportunityId: existing.id }, { status: 409 })
  }

  const body = await request.json() as {
    stage?:             string
    estimatedRevenue?:  number
    jobType?:           string
    productCategory?:   string
    expectedCloseDate?: string
  }

  const stage = (body.stage && VALID_STAGES.includes(body.stage)) ? body.stage : 'PROSPECT'
  const now = new Date()
  const weightedValue = body.estimatedRevenue ? body.estimatedRevenue * 0.1 : undefined

  const opportunity = await db.opportunity.create({
    data: {
      tenantId,
      leadId:             lead.id,
      title:              lead.company,
      type:               'BID',
      source:             'MANUAL',
      status:             'OPEN',
      stage:              stage as never,
      stageChangedAt:     now,
      estimatedRevenue:   body.estimatedRevenue    ?? undefined,
      probabilityPercent: 10,
      weightedValue,
      jobType:            (body.jobType         ?? lead.jobType)         as never ?? undefined,
      productCategory:    (body.productCategory ?? lead.productCategory) as never ?? undefined,
      leadSource:         lead.leadSource        ?? undefined,
      expectedCloseDate:  body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
    },
    select: { id: true },
  })

  return NextResponse.json({ opportunityId: opportunity.id }, { status: 201 })
}
