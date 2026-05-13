import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'
import { daysInCurrentStage } from '@/lib/pipeline/aging'

const OPEN_STAGES = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED', 'QUALIFIED',
  'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION',
]

const VALID_JOB_TYPES = [
  'NEW_CONSTRUCTION', 'MAC', 'INSTALL', 'BOX_SALE',
  'UPGRADE_REFRESH', 'RFP_BID', 'SERVICE_ON_DEMAND', 'SERVICE_CONTRACTED',
]

const VALID_PRODUCT_CATEGORIES = [
  'ACCESS_CONTROL', 'VIDEO_SURVEILLANCE', 'INTRUSION_ALARM', 'INTERCOM_AUDIO',
  'NETWORKING_INFRASTRUCTURE', 'FIRE_LIFE_SAFETY', 'STRUCTURED_CABLING',
  'AUTO_DOOR_SLIDING', 'AUTO_DOOR_ROTATING', 'AUTO_DOOR_OVERHEAD',
  'AUTO_DOOR_SWING', 'AUTO_DOOR_FOLDING', 'MANUAL_DOOR_SLIDING',
  'MANUAL_DOOR_ROTATING', 'MANUAL_DOOR_OVERHEAD', 'MANUAL_DOOR_SWING',
  'MANUAL_DOOR_FOLDING', 'INTEGRATED_SYSTEMS', 'SYSTEMS_OTHER',
]

const VALID_LEAD_SOURCES = [
  'REFERRAL', 'SAM_GOV', 'RFP_BID_BOARD', 'DODGE_DATA',
  'COLD_OUTREACH', 'INBOUND_WEB', 'EXISTING_CUSTOMER', 'PARTNER_VENDOR',
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
      expectedCloseDate:  true,
      notes:              true,
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
          id:                  true,
          fromStage:           true,
          toStage:             true,
          changedAt:           true,
          daysInPreviousStage: true,
          changedBy:           { select: { name: true } },
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
    expectedCloseDate:  opp.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
    notes:              opp.notes              ?? null,
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

  const body = await request.json() as {
    stage?:             string
    jobType?:           string | null
    productCategory?:   string | null
    leadSource?:        string | null
    estimatedRevenue?:  number | null
    expectedCloseDate?: string | null
    notes?:             string | null
  }

  const existing = await db.opportunity.findFirst({
    where: { id, tenantId },
    select: { stage: true, stageChangedAt: true, createdAt: true, estimatedRevenue: true, probabilityPercent: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── Build field-level updates (non-stage) ─────────────────────────────────

  const fieldData: Record<string, unknown> = {}

  if ('jobType' in body) {
    if (body.jobType !== null && body.jobType !== undefined && !VALID_JOB_TYPES.includes(body.jobType)) {
      return NextResponse.json({ error: 'Invalid jobType' }, { status: 400 })
    }
    fieldData.jobType = body.jobType ?? null
  }
  if ('productCategory' in body) {
    if (body.productCategory !== null && body.productCategory !== undefined && !VALID_PRODUCT_CATEGORIES.includes(body.productCategory)) {
      return NextResponse.json({ error: 'Invalid productCategory' }, { status: 400 })
    }
    fieldData.productCategory = body.productCategory ?? null
  }
  if ('leadSource' in body) {
    if (body.leadSource !== null && body.leadSource !== undefined && !VALID_LEAD_SOURCES.includes(body.leadSource)) {
      return NextResponse.json({ error: 'Invalid leadSource' }, { status: 400 })
    }
    fieldData.leadSource = body.leadSource ?? null
  }
  if ('estimatedRevenue' in body) {
    const rev = body.estimatedRevenue ?? null
    fieldData.estimatedRevenue = rev
    if (rev !== null) {
      const prob = existing.probabilityPercent ?? 0
      fieldData.weightedValue = rev * (prob / 100)
    }
  }
  if ('expectedCloseDate' in body) {
    fieldData.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null
  }
  if ('notes' in body) {
    fieldData.notes = body.notes ?? null
  }

  // ── Stage change path ─────────────────────────────────────────────────────

  if (body.stage !== undefined) {
    if (!OPEN_STAGES.includes(body.stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    const now  = new Date()
    const days = daysInCurrentStage(existing.stageChangedAt, existing.createdAt, now)

    const updated = await db.opportunity.update({
      where: { id },
      data:  { stage: body.stage as never, stageChangedAt: now, ...fieldData },
      select: { id: true, stage: true, stageChangedAt: true },
    })

    if (existing.stage) {
      await db.stageHistory.create({
        data: {
          tenantId,
          opportunityId:            id,
          fromStage:                existing.stage as never,
          toStage:                  body.stage as never,
          changedAt:                now,
          changedById:              auth.session.user.id,
          daysInPreviousStage:      days,
          opportunityValueAtChange: existing.estimatedRevenue ?? undefined,
        },
      })
    }

    return NextResponse.json({ id: updated.id, stage: updated.stage, stageChangedAt: updated.stageChangedAt?.toISOString() })
  }

  // ── Field-only update path ────────────────────────────────────────────────

  if (Object.keys(fieldData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await db.opportunity.update({ where: { id }, data: fieldData as never })
  return NextResponse.json({ ok: true })
}
