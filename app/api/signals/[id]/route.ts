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

const VALID_STATUSES = ['NEW', 'SAVED', 'CONVERTED', 'DISMISSED']

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
    status?:          string
    assignedToId?:    string | null
    isRead?:          boolean
    jobType?:         string | null
    productCategory?: string | null
    estimatedValue?:  number | null
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (body.jobType !== undefined && body.jobType !== null && !VALID_JOB_TYPES.includes(body.jobType)) {
    return NextResponse.json({ error: 'Invalid jobType' }, { status: 400 })
  }
  if (body.productCategory !== undefined && body.productCategory !== null && !VALID_PRODUCT_CATEGORIES.includes(body.productCategory)) {
    return NextResponse.json({ error: 'Invalid productCategory' }, { status: 400 })
  }

  const updated = await db.signal.update({
    where: { id },
    data: {
      ...(body.status          !== undefined && { status:          body.status as never }),
      ...(body.assignedToId    !== undefined && { assignedToId:    body.assignedToId }),
      ...(body.isRead          !== undefined && { isRead:          body.isRead }),
      ...(body.jobType         !== undefined && { jobType:         (body.jobType ?? null) as never }),
      ...(body.productCategory !== undefined && { productCategory: (body.productCategory ?? null) as never }),
      ...(body.estimatedValue  !== undefined && { estimatedValue:  body.estimatedValue ?? null }),
    },
    select: { id: true, status: true, assignedToId: true, isRead: true, jobType: true, productCategory: true, estimatedValue: true },
  })

  return NextResponse.json(updated)
}
