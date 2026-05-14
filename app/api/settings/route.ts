import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: {
      id: true,
      name: true,
      accentColor: true,
      logoUrl: true,
      mapboxToken: true,
      anthropicKey: true,
      monthlyLeadGoal: true,
      monthlyRevenueTarget: true,
      quarterlyRevenueTarget: true,
      annualRevenueTarget: true,
      monthlyOutreachTarget: true,
      quarterlyOutreachTarget: true,
      annualOutreachTarget: true,
    },
  })

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  return NextResponse.json({
    ...tenant,
    mapboxToken:  tenant.mapboxToken  ? maskToken(tenant.mapboxToken)  : null,
    anthropicKey: tenant.anthropicKey ? maskToken(tenant.anthropicKey) : null,
  })
}

function maskToken(token: string): string {
  if (token.length <= 8) return '••••••••'
  return token.slice(0, 4) + '••••••••' + token.slice(-4)
}
