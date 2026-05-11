import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'
import { daysInCurrentStage } from '@/lib/pipeline/aging'

const OPEN_STAGES = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED', 'QUALIFIED',
  'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION',
]

async function resolveTenantId(request: NextRequest): Promise<string | null> {
  const slug = getTenantSlug(request)
  if (!slug) return null
  const tenant = await db.tenant.findFirst({ where: { slug, active: true }, select: { id: true } })
  return tenant?.id ?? null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const now = new Date()

  const opp = await db.opportunity.findFirst({
    where: { id, tenantId },
    select: {
      id:                 true,
      title:              true,
      type:               true,
      jobType:            true,
      productCategory:    true,
      leadSource:         true,
      status:             true,
      stage:              true,
      stageChangedAt:     true,
      estimatedRevenue:   true,
      weightedValue:      true,
      probabilityPercent: true,
      jobSiteCity:        true,
      jobSiteState:       true,
      createdAt:          true,
      updatedAt:          true,
      leadId:             true,
      customerId:         true,
      lead: {
        select: {
          company:    true,
          assignedTo: { select: { id: true, name: true } },
          logs: {
            orderBy: { date: 'desc' },
            select: {
              id:     true,
              date:   true,
              action: true,
              user:   { select: { name: true } },
            },
          },
          outreachLog: {
            orderBy: { createdAt: 'desc' },
            select: {
              id:        true,
              type:      true,
              subject:   true,
              content:   true,
              createdAt: true,
              response:  true,
              user:      { select: { name: true } },
            },
          },
        },
      },
      customer: {
        select: { name: true },
      },
      stageHistory: {
        orderBy: { changedAt: 'asc' },
        select: {
          id:                 true,
          fromStage:          true,
          toStage:            true,
          changedAt:          true,
          daysInPreviousStage: true,
          changedBy:          { select: { name: true } },
        },
      },
    },
  })

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const daysInStage    = daysInCurrentStage(opp.stageChangedAt, opp.createdAt, now)
  const daysInPipeline = Math.max(0, Math.floor((now.getTime() - opp.createdAt.getTime()) / 86_400_000))

  return NextResponse.json({
    id:                 opp.id,
    title:              opp.title,
    type:               opp.type,
    jobType:            opp.jobType            ?? null,
    productCategory:    opp.productCategory    ?? null,
    leadSource:         opp.leadSource         ?? null,
    status:             opp.status,
    stage:              opp.stage              ?? null,
    stageChangedAt:     opp.stageChangedAt?.toISOString() ?? null,
    estimatedRevenue:   opp.estimatedRevenue   ?? null,
    weightedValue:      opp.weightedValue      ?? null,
    probabilityPercent: opp.probabilityPercent ?? null,
    jobSiteCity:        opp.jobSiteCity        ?? null,
    jobSiteState:       opp.jobSiteState       ?? null,
    createdAt:          opp.createdAt.toISOString(),
    updatedAt:          opp.updatedAt.toISOString(),
    leadId:             opp.leadId             ?? null,
    customerId:         opp.customerId         ?? null,
    company:            opp.lead?.company ?? opp.customer?.name ?? '—',
    repName:            opp.lead?.assignedTo?.name ?? null,
    daysInStage,
    daysInPipeline,
    stageHistory: opp.stageHistory.map((s) => ({
      id:                  s.id,
      fromStage:           s.fromStage ?? null,
      toStage:             s.toStage,
      changedAt:           s.changedAt.toISOString(),
      daysInPreviousStage: s.daysInPreviousStage ?? null,
      changedByName:       s.changedBy?.name ?? null,
    })),
    activities: (opp.lead?.logs ?? []).map((l) => ({
      id:       l.id,
      date:     l.date.toISOString(),
      action:   l.action,
      userName: l.user?.name ?? null,
    })),
    outreach: (opp.lead?.outreachLog ?? []).map((o) => ({
      id:        o.id,
      type:      o.type,
      subject:   o.subject   ?? null,
      content:   o.content,
      createdAt: o.createdAt.toISOString(),
      response:  o.response,
      userName:  o.user?.name ?? null,
    })),
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

  const body = await request.json() as { stage?: string }
  const newStage = body.stage

  if (!newStage || !OPEN_STAGES.includes(newStage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  const existing = await db.opportunity.findFirst({
    where: { id, tenantId },
    select: { stage: true, stageChangedAt: true, createdAt: true, estimatedRevenue: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now  = new Date()
  const days = daysInCurrentStage(existing.stageChangedAt, existing.createdAt, now)

  const updated = await db.opportunity.update({
    where: { id },
    data:  { stage: newStage as never, stageChangedAt: now },
    select: { id: true, stage: true, stageChangedAt: true },
  })

  if (existing.stage) {
    await db.stageHistory.create({
      data: {
        tenantId,
        opportunityId:            id,
        fromStage:                existing.stage as never,
        toStage:                  newStage as never,
        changedAt:                now,
        changedById:              auth.session.user.id,
        daysInPreviousStage:      days,
        opportunityValueAtChange: existing.estimatedRevenue ?? undefined,
      },
    })
  }

  return NextResponse.json({ id: updated.id, stage: updated.stage, stageChangedAt: updated.stageChangedAt?.toISOString() })
}
