import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { SettingsClient } from './_components/SettingsClient'
import type { SettingsClientProps } from './_components/SettingsClient'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await requireAuth(['TENANT_ADMIN', 'COBALT_SUPER_ADMIN'])
  const tenant  = await getTenant()
  if (!tenant) redirect('/login')

  const users = await db.user.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  const repTargets = await db.repTarget.findMany({
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

  function maskToken(token: string): string {
    if (token.length <= 8) return '••••••••'
    return token.slice(0, 4) + '••••••••' + token.slice(-4)
  }

  const props: SettingsClientProps = {
    tenantId:   tenant.id,
    tenantName: tenant.name,
    userRole:   session.user.role,

    // Branding
    accentColor: tenant.accentColor ?? '',
    logoUrl:     tenant.logoUrl     ?? '',

    // Integrations (masked)
    mapboxTokenMasked:  tenant.mapboxToken  ? maskToken(tenant.mapboxToken)  : '',
    anthropicKeyMasked: tenant.anthropicKey ? maskToken(tenant.anthropicKey) : '',
    mapboxTokenSet:     !!tenant.mapboxToken,
    anthropicKeySet:    !!tenant.anthropicKey,

    // Team
    users: users.map((u) => ({
      id:     u.id,
      name:   u.name ?? '—',
      email:  u.email,
      role:   u.role,
      active: u.active,
    })),

    // Targets
    monthlyLeadGoal:         tenant.monthlyLeadGoal         ?? null,
    monthlyRevenueTarget:    tenant.monthlyRevenueTarget    ?? null,
    quarterlyRevenueTarget:  tenant.quarterlyRevenueTarget  ?? null,
    annualRevenueTarget:     tenant.annualRevenueTarget     ?? null,
    monthlyOutreachTarget:   tenant.monthlyOutreachTarget   ?? null,
    quarterlyOutreachTarget: tenant.quarterlyOutreachTarget ?? null,
    annualOutreachTarget:    tenant.annualOutreachTarget    ?? null,

    // Rep targets (keyed by userId)
    repTargets: repTargets.map((r) => ({
      userId:                  r.userId,
      monthlyLeadGoal:         r.monthlyLeadGoal         ?? null,
      monthlyRevenueTarget:    r.monthlyRevenueTarget    ?? null,
      quarterlyRevenueTarget:  r.quarterlyRevenueTarget  ?? null,
      annualRevenueTarget:     r.annualRevenueTarget     ?? null,
      weeklyOutreachTarget:    r.weeklyOutreachTarget    ?? null,
      monthlyOutreachTarget:   r.monthlyOutreachTarget   ?? null,
      quarterlyOutreachTarget: r.quarterlyOutreachTarget ?? null,
      annualOutreachTarget:    r.annualOutreachTarget    ?? null,
    })),
  }

  return <SettingsClient {...props} />
}
