import { db } from '@/lib/db'
import { getTenant } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth'
import { daysInCurrentStage } from '@/lib/pipeline/aging'
import { PipelineClient } from './_components/PipelineClient'
import { CHART_STAGE_ORDER } from './_components/constants'
import type { PipelineRow } from './_components/PipelineClient'
import type { ChartDataPoint } from './_components/PipelineChart'
import type { ConversionStage } from './_components/ConversionFunnel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function quarterKey(date: Date): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
}

function quarterLabel(key: string): string {
  return key.replace('-', ' ')
}

function yearKey(date: Date): string {
  return `${date.getFullYear()}`
}

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

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)))
  }
  return keys
}

function lastNQuarterKeys(n: number): string[] {
  const keys: string[] = []
  const d = new Date()
  const year = d.getFullYear()
  const q    = Math.floor(d.getMonth() / 3) + 1
  for (let i = n - 1; i >= 0; i--) {
    let tq = q - i, ty = year
    while (tq <= 0) { tq += 4; ty-- }
    keys.push(`${ty}-Q${tq}`)
  }
  return keys
}

function lastNYearKeys(n: number): string[] {
  const y = new Date().getFullYear()
  return Array.from({ length: n }, (_, i) => `${y - (n - 1) + i}`)
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

  const now         = new Date()
  const months      = lastNMonthKeys(6)
  const quarters    = lastNQuarterKeys(4)
  const years       = lastNYearKeys(3)
  const chartStart  = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const annualStart = new Date(now.getFullYear() - 2, 0, 1)
  const histStart   = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  // Earliest date needed across all three chart periods
  const fetchStart  = new Date(Math.min(chartStart.getTime(), annualStart.getTime()))

  // ── Parallel queries ────────────────────────────────────────────────────────

  const [opps, chartOpps, stageHistoryAll, targets] = await Promise.all([
    db.opportunity.findMany({
      where: { tenantId: tenant.id, status: { in: ['OPEN', 'PURSUING'] } },
      orderBy: { estimatedRevenue: 'desc' },
      select: {
        id: true, title: true, type: true, jobType: true, productCategory: true,
        leadSource: true, status: true, stage: true, stageChangedAt: true,
        estimatedRevenue: true, weightedValue: true, probabilityPercent: true,
        createdAt: true, updatedAt: true,
        lead: { select: { company: true, assignedTo: { select: { id: true, name: true } } } },
        customer: { select: { name: true } },
      },
    }),

    db.opportunity.findMany({
      where: { tenantId: tenant.id, createdAt: { gte: fetchStart } },
      select: {
        stage: true, estimatedRevenue: true, createdAt: true,
        lead: { select: { assignedTo: { select: { id: true, name: true } } } },
      },
    }),

    db.stageHistory.findMany({
      where: { tenantId: tenant.id, changedAt: { gte: histStart } },
      select: { fromStage: true, toStage: true, daysInPreviousStage: true, opportunityId: true },
    }),

    db.pipelineTarget.findMany({
      where: { tenantId: tenant.id },
      include: { user: { select: { id: true, name: true } } },
    }),
  ])

  // ── PipelineRow list ────────────────────────────────────────────────────────

  const rows: PipelineRow[] = opps.map((o) => {
    const company        = o.lead?.company ?? o.customer?.name ?? '—'
    const repName        = o.lead?.assignedTo?.name ?? null
    const repId          = o.lead?.assignedTo?.id   ?? null
    const daysInStage    = daysInCurrentStage(o.stageChangedAt, o.createdAt, now)
    const daysInPipeline = Math.max(0, Math.floor((now.getTime() - o.createdAt.getTime()) / 86_400_000))
    return {
      id: o.id, title: o.title, company,
      stage: o.stage ?? null, type: o.type,
      jobType: o.jobType ?? null, productCategory: o.productCategory ?? null,
      leadSource: o.leadSource ?? null, status: o.status,
      estimatedRevenue: o.estimatedRevenue ?? null,
      weightedValue: o.weightedValue ?? null,
      probabilityPercent: o.probabilityPercent ?? null,
      repName, repId, daysInStage, daysInPipeline,
      needsAttention: daysInStage > 45,
      createdAtMs: o.createdAt.getTime(), updatedAtMs: o.updatedAt.getTime(),
    }
  })

  // ── Rep index ───────────────────────────────────────────────────────────────

  const repIndex = new Map<string, { id: string; name: string }>()
  for (const o of chartOpps) {
    if (o.lead?.assignedTo) {
      const { id, name } = o.lead.assignedTo
      if (!repIndex.has(id)) repIndex.set(id, { id, name: name ?? id })
    }
  }
  const chartReps = [
    { id: 'all', name: 'All Reps' },
    ...[...repIndex.values()].sort((a, b) => a.name.localeCompare(b.name)),
  ]

  // ── Chart data — monthly (last 6 months) ───────────────────────────────────

  const byMonth: Record<string, Record<string, number>> = {}
  for (const mk of months) byMonth[mk] = {}
  for (const o of chartOpps) {
    const mk = monthKey(o.createdAt)
    if (!byMonth[mk]) continue
    const s = o.stage ?? 'UNKNOWN'
    byMonth[mk][s] = (byMonth[mk][s] ?? 0) + (o.estimatedRevenue ?? 0)
  }
  const monthTotals  = months.map((mk) => Object.values(byMonth[mk]).reduce((a, b) => a + b, 0))
  const chartData: ChartDataPoint[] = months.map((mk, i) => ({
    monthKey: mk, monthLabel: monthLabel(mk),
    total: monthTotals[i], trend: linearTrend(monthTotals)[i], stages: byMonth[mk],
  }))

  const activeStages = CHART_STAGE_ORDER.filter((s) =>
    months.some((mk) => (byMonth[mk][s] ?? 0) > 0)
  )

  // ── Chart data — quarterly (last 4 quarters) ───────────────────────────────

  const byQuarter: Record<string, Record<string, number>> = {}
  for (const qk of quarters) byQuarter[qk] = {}
  for (const o of chartOpps) {
    const qk = quarterKey(o.createdAt)
    if (!byQuarter[qk]) continue
    const s = o.stage ?? 'UNKNOWN'
    byQuarter[qk][s] = (byQuarter[qk][s] ?? 0) + (o.estimatedRevenue ?? 0)
  }
  const quarterTotals = quarters.map((qk) => Object.values(byQuarter[qk]).reduce((a, b) => a + b, 0))
  const quarterChartData: ChartDataPoint[] = quarters.map((qk, i) => ({
    monthKey: qk, monthLabel: quarterLabel(qk),
    total: quarterTotals[i], trend: linearTrend(quarterTotals)[i], stages: byQuarter[qk],
  }))

  // ── Chart data — annual (last 3 years) ─────────────────────────────────────

  const byYear: Record<string, Record<string, number>> = {}
  for (const yk of years) byYear[yk] = {}
  for (const o of chartOpps) {
    const yk = yearKey(o.createdAt)
    if (!byYear[yk]) continue
    const s = o.stage ?? 'UNKNOWN'
    byYear[yk][s] = (byYear[yk][s] ?? 0) + (o.estimatedRevenue ?? 0)
  }
  const yearTotals = years.map((yk) => Object.values(byYear[yk]).reduce((a, b) => a + b, 0))
  const annualChartData: ChartDataPoint[] = years.map((yk, i) => ({
    monthKey: yk, monthLabel: yk,
    total: yearTotals[i], trend: linearTrend(yearTotals)[i], stages: byYear[yk],
  }))

  // ── Per-rep chart data ──────────────────────────────────────────────────────

  const byMonthByRep: Record<string, Record<string, Record<string, number>>> = {}
  for (const o of chartOpps) {
    const repId = o.lead?.assignedTo?.id ?? 'unassigned'
    const mk = monthKey(o.createdAt), s = o.stage ?? 'UNKNOWN', v = o.estimatedRevenue ?? 0
    if (!byMonthByRep[repId]) byMonthByRep[repId] = {}
    if (!byMonthByRep[repId][mk]) byMonthByRep[repId][mk] = {}
    byMonthByRep[repId][mk][s] = (byMonthByRep[repId][mk][s] ?? 0) + v
  }

  const repChartData: Record<string, ChartDataPoint[]> = {}
  const repQuarterChartData: Record<string, ChartDataPoint[]> = {}
  const repAnnualChartData: Record<string, ChartDataPoint[]> = {}

  for (const [repId] of repIndex) {
    const rm = byMonthByRep[repId] ?? {}

    // monthly
    const mTotals = months.map((mk) => Object.values(rm[mk] ?? {}).reduce((a, b) => a + b, 0))
    repChartData[repId] = months.map((mk, i) => ({
      monthKey: mk, monthLabel: monthLabel(mk),
      total: mTotals[i], trend: linearTrend(mTotals)[i], stages: rm[mk] ?? {},
    }))

    // quarterly
    const qByRep: Record<string, Record<string, number>> = {}
    for (const qk of quarters) qByRep[qk] = {}
    for (const o of chartOpps) {
      if ((o.lead?.assignedTo?.id ?? 'unassigned') !== repId) continue
      const qk = quarterKey(o.createdAt), s = o.stage ?? 'UNKNOWN', v = o.estimatedRevenue ?? 0
      if (!qByRep[qk]) continue
      qByRep[qk][s] = (qByRep[qk][s] ?? 0) + v
    }
    const qTotals = quarters.map((qk) => Object.values(qByRep[qk]).reduce((a, b) => a + b, 0))
    repQuarterChartData[repId] = quarters.map((qk, i) => ({
      monthKey: qk, monthLabel: quarterLabel(qk),
      total: qTotals[i], trend: linearTrend(qTotals)[i], stages: qByRep[qk],
    }))

    // annual
    const yByRep: Record<string, Record<string, number>> = {}
    for (const yk of years) yByRep[yk] = {}
    for (const o of chartOpps) {
      if ((o.lead?.assignedTo?.id ?? 'unassigned') !== repId) continue
      const yk = yearKey(o.createdAt), s = o.stage ?? 'UNKNOWN', v = o.estimatedRevenue ?? 0
      if (!yByRep[yk]) continue
      yByRep[yk][s] = (yByRep[yk][s] ?? 0) + v
    }
    const yTotals = years.map((yk) => Object.values(yByRep[yk]).reduce((a, b) => a + b, 0))
    repAnnualChartData[repId] = years.map((yk, i) => ({
      monthKey: yk, monthLabel: yk,
      total: yTotals[i], trend: linearTrend(yTotals)[i], stages: yByRep[yk],
    }))
  }

  // ── Targets ─────────────────────────────────────────────────────────────────

  const currentYear     = `${now.getFullYear()}`
  const currentQ        = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
  const currentMonthKey = monthKey(now)

  const find = (userId: string | null, period: string, periodType: string) =>
    targets.find((t) =>
      (userId ? t.userId === userId : !t.userId) &&
      !t.stage && t.period === period && t.periodType === periodType
    )?.targetValue ?? null

  const annualTeamTarget    = find(null, currentYear, 'ANNUAL')
  const quarterlyTeamTarget = find(null, currentQ, 'QUARTERLY')
  const monthlyTeamTarget   = find(null, currentMonthKey, 'MONTHLY')

  // Rep weighted pipeline from active opps
  const repWeightedPipeline = new Map<string, number>()
  for (const r of rows) {
    if (r.repId) repWeightedPipeline.set(r.repId, (repWeightedPipeline.get(r.repId) ?? 0) + (r.weightedValue ?? 0))
  }

  // Collect all reps that have at least one target
  const repTargetMap = new Map<string, { repId: string; repName: string; annual: number | null; quarterly: number | null; monthly: number | null; weighted: number }>()
  for (const t of targets) {
    if (!t.userId || t.stage) continue
    const repId   = t.userId
    const repName = t.user?.name ?? repId
    if (!repTargetMap.has(repId)) {
      repTargetMap.set(repId, { repId, repName, annual: null, quarterly: null, monthly: null, weighted: repWeightedPipeline.get(repId) ?? 0 })
    }
    const entry = repTargetMap.get(repId)!
    if (t.periodType === 'ANNUAL'    && t.period === currentYear)     entry.annual    = t.targetValue
    if (t.periodType === 'QUARTERLY' && t.period === currentQ)        entry.quarterly = t.targetValue
    if (t.periodType === 'MONTHLY'   && t.period === currentMonthKey) entry.monthly   = t.targetValue
  }
  const repTargetCards = [...repTargetMap.values()]

  const thisMonthAdds = Object.values(byMonth[currentMonthKey] ?? {}).reduce((s, v) => s + v, 0)

  // ── Conversion funnel ────────────────────────────────────────────────────────

  const FUNNEL_STAGES = [
    'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED',
    'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON',
  ] as const

  const enteredStage  = new Map<string, Set<string>>()
  const daysInStageMap = new Map<string, number[]>()

  for (const h of stageHistoryAll) {
    if (!enteredStage.has(h.toStage)) enteredStage.set(h.toStage, new Set())
    enteredStage.get(h.toStage)!.add(h.opportunityId)
    if (h.fromStage && h.daysInPreviousStage !== null) {
      if (!daysInStageMap.has(h.fromStage)) daysInStageMap.set(h.fromStage, [])
      daysInStageMap.get(h.fromStage)!.push(h.daysInPreviousStage)
    }
  }

  // Seed SIGNAL with all opps that ever appeared in stage history
  const allOppIds = new Set(stageHistoryAll.map((h) => h.opportunityId))
  if (!enteredStage.has('SIGNAL')) enteredStage.set('SIGNAL', new Set())
  for (const id of allOppIds) enteredStage.get('SIGNAL')!.add(id)

  const conversionStages: ConversionStage[] = FUNNEL_STAGES.map((stage, i) => {
    const entered = enteredStage.get(stage)?.size ?? 0
    const days    = daysInStageMap.get(stage) ?? []
    const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null
    let conversionRate: number | null = null
    if (i < FUNNEL_STAGES.length - 1) {
      const next = enteredStage.get(FUNNEL_STAGES[i + 1])?.size ?? 0
      conversionRate = entered > 0 ? Math.round((next / entered) * 100) : null
    }
    return { stage, entered, avgDays, conversionRate }
  })

  const ratedStages = conversionStages.filter((s) => s.conversionRate !== null)
  const minConv     = ratedStages.length ? Math.min(...ratedStages.map((s) => s.conversionRate!)) : null
  const timedStages = conversionStages.filter((s) => s.avgDays !== null && s.avgDays > 0)
  const minDays     = timedStages.length ? Math.min(...timedStages.map((s) => s.avgDays!)) : null

  const conversionData = conversionStages.map((s) => ({
    ...s,
    isBiggestDropOff: s.conversionRate !== null && s.conversionRate === minConv,
    isFastest:        s.avgDays !== null && s.avgDays === minDays && s.avgDays > 0,
  }))

  return (
    <PipelineClient
      rows={rows}
      chartData={chartData}
      quarterChartData={quarterChartData}
      annualChartData={annualChartData}
      repChartData={repChartData}
      repQuarterChartData={repQuarterChartData}
      repAnnualChartData={repAnnualChartData}
      chartReps={chartReps}
      activeStages={activeStages}
      annualTeamTarget={annualTeamTarget}
      quarterlyTeamTarget={quarterlyTeamTarget}
      monthlyTeamTarget={monthlyTeamTarget}
      repTargetCards={repTargetCards}
      thisMonthAdds={thisMonthAdds}
      conversionData={conversionData}
    />
  )
}
