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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const existing = await db.signal.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    status?: string
    assignedToId?: string | null
    isRead?: boolean
  }

  const VALID_STATUSES = ['NEW', 'SAVED', 'CONVERTED', 'DISMISSED']
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updated = await db.signal.update({
    where: { id },
    data: {
      ...(body.status      !== undefined && { status:      body.status as never }),
      ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
      ...(body.isRead      !== undefined && { isRead:      body.isRead }),
    },
    select: { id: true, status: true, assignedToId: true, isRead: true },
  })

  return NextResponse.json(updated)
}
