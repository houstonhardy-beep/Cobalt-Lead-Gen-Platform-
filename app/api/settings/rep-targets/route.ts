import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  const auth = await requireAuthApi(['TENANT_ADMIN', 'COBALT_SUPER_ADMIN'])
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const targets = await db.repTarget.findMany({
    where: { tenantId: tenant.id },
    select: {
      userId: true,
      monthlyLeadGoal: true,
      monthlyRevenueTarget: true,
      quarterlyRevenueTarget: true,
      annualRevenueTarget: true,
      weeklyOutreachTarget: true,
      monthlyOutreachTarget: true,
      quarterlyOutreachTarget: true,
      annualOutreachTarget: true,
    },
  })

  return NextResponse.json(targets)
}
