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
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { id } = await params

  const existing = await db.savedSearch.findFirst({ where: { id, tenantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    name?: string
    query?: string
    frequency?: string
    isActive?: boolean
  }

  const updated = await db.savedSearch.update({
    where: { id },
    data: {
      name:      body.name?.trim()     ?? undefined,
      query:     body.query?.trim()    ?? undefined,
      frequency: (body.frequency === 'WEEKLY' ? 'WEEKLY' : body.frequency === 'DAILY' ? 'DAILY' : undefined) as never,
      isActive:  body.isActive         ?? undefined,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { id } = await params

  const existing = await db.savedSearch.findFirst({ where: { id, tenantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.savedSearch.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
