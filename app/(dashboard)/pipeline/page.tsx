import { db } from '@/lib/db'
import { getTenant } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth'
import { daysInCurrentStage } from '@/lib/pipeline/aging'
import { PipelineClient } from './_components/PipelineClient'
import { CHART_STAGE_ORDER } from './_components/constants'
import type { PipelineRow } from './_components/PipelineClient'
import type { ChartDataPoint } from './_components/PipelineChart'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// Linear regression — returns a trend value for each index
function linearTrend(values: number[]): number[] {
  const n = values.length
  if (n < 2) return [...values]
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope     = den === 0 ? 0 : num / den
  const intercept = yMean - slope * xMean
  return values.map((_, i) => Math.max(0, intercept + slope * i))
}

// Last N calendar month keys including current month
function lastNMonthKeys(n: number): string[] {
  const keys: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    keys.push(monthKey(m))
  }
  return keys
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PipelinePage() {
  const [, tenant] = await Promise.all([requireAuth(), getTenant()])

  if (!tenant) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Pipeline</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Navigate to a tenant workspace to view pipeline.</p>
      </div>
    )
  }

  const now          = new Date()
  const months       = lastNMonthKeys(6)
  const chartStart   = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  // ── Parallel queries ────────────────────────────────────────────────────────

  const [opps, chartOpps] = await Promise.all([
    // Active pipeline for the list
    db.opportunity.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['OPEN', 'PURSUING'] },
      },
      orderBy: { estimatedRevenue: 'desc' },
      select: {
        id:                 true,
        title:              true,
        type:               true,
        jobType:            true,
        productCategory:    true,
        leadSource:         true,
        status:             true,
        stage:              true,
        stageChangedAt:     true,
        estimatedRevenue:   true,
        weightedValue:      true,
        probabilityPercent: true,
        createdAt:          true,
        updatedAt:          true,
        lead: {
          select: {
            company:    true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
        customer: { select: { name: true } },
      },
    }),
    // All opps from last 6 months for the chart (any status)
    db.opportunity.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: chartStart },
      },
      select: {
        stage:           true,
        estimatedRevenue: true,
        createdAt:       true,
      },
    }),
  ])

  // ── Build PipelineRow list ──────────────────────────────────────────────────

  const rows: PipelineRow[] = opps.map((o) => {
    const company        = o.lead?.company ?? o.customer?.name ?? '—'
    const repName        = o.lead?.assignedTo?.name ?? null
    const repId          = o.lead?.assignedTo?.id   ?? null
    const daysInStage    = daysInCurrentStage(o.stageChangedAt, o.createdAt, now)
    const daysInPipeline = Math.max(0, Math.floor((now.getTime() - o.createdAt.getTime()) / 86_400_000))

    return {
      id:                 o.id,
      title:              o.title,
      company,
      stage:              o.stage           ?? null,
      type:               o.type,
      jobType:            o.jobType         ?? null,
      productCategory:    o.productCategory ?? null,
      leadSource:         o.leadSource      ?? null,
      status:             o.status,
      estimatedRevenue:   o.estimatedRevenue   ?? null,
      weightedValue:      o.weightedValue      ?? null,
      probabilityPercent: o.probabilityPercent ?? null,
      repName,
      repId,
      daysInStage,
      daysInPipeline,
      needsAttention: daysInStage > 45,
      createdAtMs:    o.createdAt.getTime(),
      updatedAtMs:    o.updatedAt.getTime(),
    }
  })

  // ── Build chart data ────────────────────────────────────────────────────────

  // Group chart opps by month × stage
  const byMonth: Record<string, Record<string, number>> = {}
  for (const mk of months) byMonth[mk] = {}

  for (const o of chartOpps) {
    const mk    = monthKey(o.createdAt)
    const stage = o.stage ?? 'UNKNOWN'
    const val   = o.estimatedRevenue ?? 0
    if (!byMonth[mk]) continue // outside our 6-month window
    byMonth[mk][stage] = (byMonth[mk][stage] ?? 0) + val
  }

  const totals      = months.map((mk) => Object.values(byMonth[mk]).reduce((s, v) => s + v, 0))
  const trendValues = linearTrend(totals)

  // Which stages appear in at least one month
  const activeStages = CHART_STAGE_ORDER.filter((s) =>
    months.some((mk) => (byMonth[mk][s] ?? 0) > 0),
  )

  const chartData: ChartDataPoint[] = months.map((mk, i) => ({
    monthKey:   mk,
    monthLabel: monthLabel(mk),
    total:      totals[i],
    trend:      trendValues[i],
    stages:     byMonth[mk],
  }))

  // ── Targets ─────────────────────────────────────────────────────────────────

  const pipelineCfg  = tenant.config.pipeline ?? {}
  const targets = {
    weightedPipelineTarget: pipelineCfg.weightedTarget    ?? null,
    monthlyAddsTarget:      pipelineCfg.monthlyAddsTarget ?? null,
  }

  // This month's new opp value (any status)
  const currentMonthKey = monthKey(now)
  const thisMonthAdds   = Object.values(byMonth[currentMonthKey] ?? {}).reduce((s, v) => s + v, 0)

  return (
    <PipelineClient
      rows={rows}
      chartData={chartData}
      activeStages={activeStages}
      targets={targets}
      thisMonthAdds={thisMonthAdds}
    />
  )
}
