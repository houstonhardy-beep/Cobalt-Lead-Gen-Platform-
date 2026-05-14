import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuthApi(['TENANT_ADMIN', 'COBALT_SUPER_ADMIN'])
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { userId } = await params

  const user = await db.user.findFirst({
    where: { id: userId, tenantId: tenant.id },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await request.json() as {
    monthlyLeadGoal?:         number | null
    monthlyRevenueTarget?:    number | null
    quarterlyRevenueTarget?:  number | null
    annualRevenueTarget?:     number | null
    weeklyOutreachTarget?:    number | null
    monthlyOutreachTarget?:   number | null
    quarterlyOutreachTarget?: number | null
    annualOutreachTarget?:    number | null
  }

  const target = await db.repTarget.upsert({
    where: { userId },
    create: {
      tenantId:                tenant.id,
      userId,
      monthlyLeadGoal:         body.monthlyLeadGoal         ?? null,
      monthlyRevenueTarget:    body.monthlyRevenueTarget    ?? null,
      quarterlyRevenueTarget:  body.quarterlyRevenueTarget  ?? null,
      annualRevenueTarget:     body.annualRevenueTarget     ?? null,
      weeklyOutreachTarget:    body.weeklyOutreachTarget    ?? null,
      monthlyOutreachTarget:   body.monthlyOutreachTarget   ?? null,
      quarterlyOutreachTarget: body.quarterlyOutreachTarget ?? null,
      annualOutreachTarget:    body.annualOutreachTarget    ?? null,
    },
    update: {
      monthlyLeadGoal:         body.monthlyLeadGoal         !== undefined ? body.monthlyLeadGoal         : undefined,
      monthlyRevenueTarget:    body.monthlyRevenueTarget    !== undefined ? body.monthlyRevenueTarget    : undefined,
      quarterlyRevenueTarget:  body.quarterlyRevenueTarget  !== undefined ? body.quarterlyRevenueTarget  : undefined,
      annualRevenueTarget:     body.annualRevenueTarget     !== undefined ? body.annualRevenueTarget     : undefined,
      weeklyOutreachTarget:    body.weeklyOutreachTarget    !== undefined ? body.weeklyOutreachTarget    : undefined,
      monthlyOutreachTarget:   body.monthlyOutreachTarget   !== undefined ? body.monthlyOutreachTarget   : undefined,
      quarterlyOutreachTarget: body.quarterlyOutreachTarget !== undefined ? body.quarterlyOutreachTarget : undefined,
      annualOutreachTarget:    body.annualOutreachTarget    !== undefined ? body.annualOutreachTarget    : undefined,
    },
  })

  return NextResponse.json(target)
}
