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

  const body = await request.json() as {
    monthlyLeadGoal?:         number | null
    monthlyRevenueTarget?:    number | null
    quarterlyRevenueTarget?:  number | null
    annualRevenueTarget?:     number | null
    monthlyOutreachTarget?:   number | null
    quarterlyOutreachTarget?: number | null
    annualOutreachTarget?:    number | null
  }

  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      monthlyLeadGoal:         body.monthlyLeadGoal         ?? undefined,
      monthlyRevenueTarget:    body.monthlyRevenueTarget    ?? undefined,
      quarterlyRevenueTarget:  body.quarterlyRevenueTarget  ?? undefined,
      annualRevenueTarget:     body.annualRevenueTarget     ?? undefined,
      monthlyOutreachTarget:   body.monthlyOutreachTarget   ?? undefined,
      quarterlyOutreachTarget: body.quarterlyOutreachTarget ?? undefined,
      annualOutreachTarget:    body.annualOutreachTarget    ?? undefined,
    },
  })

  return NextResponse.json({ ok: true })
}
