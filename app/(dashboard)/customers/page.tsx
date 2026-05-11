import { db } from '@/lib/db'
import { getTenant } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth'
import { daysInCurrentStage } from '@/lib/pipeline/aging'
import { CustomersClient } from './_components/CustomersClient'
import type { CustomerRow } from './_components/CustomersClient'

export default async function CustomersPage() {
  const [, tenant] = await Promise.all([requireAuth(), getTenant()])

  if (!tenant) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Customers</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Navigate to a tenant workspace to view customers.</p>
      </div>
    )
  }

  const now = new Date()

  const customers = await db.customer.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: {
      id:             true,
      name:           true,
      hqCity:         true,
      hqState:        true,
      vertical:       true,
      contractValue:  true,
      renewalDate:    true,
      verkadaCustomer: true,
      contact:        true,
      phone:          true,
      email:          true,
      locations: { select: { id: true } },
      opportunities: {
        select: {
          id:              true,
          title:           true,
          stage:           true,
          status:          true,
          estimatedRevenue: true,
          weightedValue:   true,
          stageChangedAt:  true,
          createdAt:       true,
          updatedAt:       true,
        },
      },
    },
  })

  const rows: CustomerRow[] = customers.map((c) => {
    const openOpps = c.opportunities.filter(
      (o) => o.status === 'OPEN' || o.status === 'PURSUING',
    )

    // Latest updatedAt across all opportunities — proxy for recent activity
    let latestActivityMs: number | null = null
    for (const o of c.opportunities) {
      const ms = o.updatedAt.getTime()
      if (latestActivityMs === null || ms > latestActivityMs) latestActivityMs = ms
    }

    // Needs attention: open opps with no activity in 30 days, or any open opp stalled 45+ days
    const hasOpenOpps = openOpps.length > 0
    const daysSinceActivity =
      latestActivityMs !== null
        ? Math.floor((now.getTime() - latestActivityMs) / 86_400_000)
        : Infinity
    const noRecentActivity = hasOpenOpps && daysSinceActivity > 30
    const anyStalled = openOpps.some(
      (o) => daysInCurrentStage(o.stageChangedAt, o.createdAt, now) > 45,
    )

    return {
      id:              c.id,
      name:            c.name,
      hqCity:          c.hqCity ?? null,
      hqState:         c.hqState ?? null,
      vertical:        c.vertical ?? null,
      contractValue:   c.contractValue ?? null,
      renewalDateMs:   c.renewalDate?.getTime() ?? null,
      verkadaCustomer: c.verkadaCustomer,
      contact:         c.contact ?? null,
      phone:           c.phone ?? null,
      email:           c.email ?? null,
      locationCount:   c.locations.length,
      openOpps: openOpps.map((o) => ({
        id:              o.id,
        title:           o.title,
        stage:           o.stage ?? null,
        estimatedRevenue: o.estimatedRevenue ?? null,
        weightedValue:   o.weightedValue ?? null,
        createdAtMs:     o.createdAt.getTime(),
      })),
      totalOppCount:   c.opportunities.length,
      latestActivityMs,
      needsAttention:  noRecentActivity || anyStalled,
    }
  })

  return <CustomersClient rows={rows} totalCount={customers.length} />
}
