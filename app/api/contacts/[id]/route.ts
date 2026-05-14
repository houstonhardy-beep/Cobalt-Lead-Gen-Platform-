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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { id } = await params
  const existing = await db.contact.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    name?:  string
    title?: string | null
    phone?: string | null
    email?: string | null
  }

  const updated = await db.contact.update({
    where: { id },
    data: {
      ...(body.name  !== undefined ? { name:  body.name?.trim() ?? '' } : {}),
      ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
      ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
    },
    select: { id: true, name: true, title: true, phone: true, email: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { id } = await params
  const existing = await db.contact.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.contact.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
