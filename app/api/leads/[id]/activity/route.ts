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

const VALID_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'FOLLOW_UP', 'OTHER']

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const lead = await db.lead.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    type:        string
    description: string
    date?:       string
  }

  const type = VALID_TYPES.includes(body.type) ? body.type : 'NOTE'
  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  const action = `[${type}] ${body.description.trim()}`
  const date   = body.date ? new Date(body.date) : new Date()

  const log = await db.leadLog.create({
    data: {
      leadId: id,
      userId: auth.session.user.id,
      date,
      action,
    },
    select: {
      id: true, date: true, action: true,
      user: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ ...log, date: log.date.toISOString() }, { status: 201 })
}
