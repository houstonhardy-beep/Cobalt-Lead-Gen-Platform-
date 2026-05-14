import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthApi(['TENANT_ADMIN', 'COBALT_SUPER_ADMIN'])
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const body = await request.json() as { mapboxToken?: string; anthropicKey?: string }

  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      mapboxToken:  body.mapboxToken  !== undefined ? (body.mapboxToken.trim()  || null) : undefined,
      anthropicKey: body.anthropicKey !== undefined ? (body.anthropicKey.trim() || null) : undefined,
    },
  })

  return NextResponse.json({ ok: true })
}
