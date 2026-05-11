import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'SITE_VISIT', 'DEMO', 'PROPOSAL', 'FOLLOW_UP', 'NOTE']

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const tenant = await db.tenant.findFirst({ where: { slug, active: true }, select: { id: true } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const opp = await db.opportunity.findFirst({
    where: { id, tenantId: tenant.id },
    select: { leadId: true },
  })
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!opp.leadId) return NextResponse.json({ error: 'Activity logging requires a lead-linked opportunity' }, { status: 422 })

  const body = await request.json() as { activityType?: string; description?: string; date?: string }

  if (!body.activityType || !ACTIVITY_TYPES.includes(body.activityType)) {
    return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 })
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  const date = body.date ? new Date(body.date) : new Date()
  if (isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

  const log = await db.leadLog.create({
    data: {
      leadId: opp.leadId,
      userId: auth.session.user.id,
      date,
      action: `[${body.activityType}] ${body.description.trim()}`,
    },
    select: {
      id:     true,
      date:   true,
      action: true,
      user:   { select: { name: true } },
    },
  })

  return NextResponse.json({
    id:       log.id,
    date:     log.date.toISOString(),
    action:   log.action,
    userName: log.user?.name ?? null,
  }, { status: 201 })
}
