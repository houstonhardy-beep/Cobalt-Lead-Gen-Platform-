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

  const body = await request.json() as { accentColor?: string; logoUrl?: string }

  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      accentColor: body.accentColor ?? undefined,
      logoUrl:     body.logoUrl     ?? undefined,
    },
  })

  return NextResponse.json({ ok: true })
}
