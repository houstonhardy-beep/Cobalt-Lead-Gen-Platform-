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

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const body = await request.json() as {
    title:              string
    company:            string
    stage?:             string
    estimatedRevenue?:  number
    jobType?:           string
    productCategory?:   string
    leadSource?:        string
    assignedToId?:      string
    expectedCloseDate?: string
    notes?:             string
  }

  if (!body.title?.trim())   return NextResponse.json({ error: 'Title is required' },   { status: 400 })
  if (!body.company?.trim()) return NextResponse.json({ error: 'Company is required' }, { status: 400 })

  const stage = (body.stage && VALID_STAGES.includes(body.stage)) ? body.stage : 'PROSPECT'
  const now   = new Date()
  const weightedValue = body.estimatedRevenue ? body.estimatedRevenue * 0.1 : undefined

  // Create a Lead to hold company name + assignment
  const lead = await db.lead.create({
    data: {
      tenantId,
      company:         body.company.trim(),
      stage:           stage as never,
      heat:            'WARM',
      leadSource:      body.leadSource      as never || undefined,
      jobType:         body.jobType         as never || undefined,
      productCategory: body.productCategory as never || undefined,
      assignedToId:    body.assignedToId || auth.session.user.id,
    },
    select: { id: true },
  })

  const opportunity = await db.opportunity.create({
    data: {
      tenantId,
      leadId:             lead.id,
      title:              body.title.trim(),
      type:               'BID',
      source:             'MANUAL',
      status:             'OPEN',
      stage:              stage as never,
      stageChangedAt:     now,
      estimatedRevenue:   body.estimatedRevenue    ?? undefined,
      probabilityPercent: 10,
      weightedValue,
      jobType:            body.jobType         as never || undefined,
      productCategory:    body.productCategory as never || undefined,
      leadSource:         body.leadSource      as never || undefined,
      notes:              body.notes           || undefined,
      expectedCloseDate:  body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
    },
    select: { id: true },
  })

  return NextResponse.json({ opportunityId: opportunity.id, leadId: lead.id }, { status: 201 })
}
