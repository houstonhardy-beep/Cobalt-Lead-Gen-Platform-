import { db } from '@/lib/db'
import { getTenant } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth'
import type { LeadStage } from '@/app/generated/prisma/client'
import { ReportsFilters } from './_components/ReportsFilters'
import { daysInCurrentStage, stallColor } from '@/lib/pipeline/aging'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function getPeriodStart(period: string, now: Date): Date {
  switch (period) {
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay())
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3)
      return new Date(now.getFullYear(), q * 3, 1)
    }
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1)
  }
}

function getPeriodRange(period: string, from: string, to: string, now: Date): { start: Date; end: Date } {
  if (period === 'custom' && from) {
    const start = new Date(from + 'T00:00:00')
    const end   = to
      ? new Date(to + 'T23:59:59.999')
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { start, end }
  }
  return {
    start: getPeriodStart(period, now),
    end:   new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  }
}

function getPreviousPeriodRange(periodStart: Date, periodEnd: Date): { start: Date; end: Date } {
  const duration = periodEnd.getTime() - periodStart.getTime()
  return {
    start: new Date(periodStart.getTime() - duration),
    end:   new Date(periodEnd.getTime()   - duration),
  }
}

function getPeriodLabel(period: string, from: string, to: string): string {
  if (period === 'custom') {
    if (from && to) return `${from} – ${to}`
    if (from)       return `From ${from}`
    return 'Custom period'
  }
  return { week: 'This week', month: 'This month', quarter: 'This quarter' }[period] ?? 'This month'
}

function getPeriodTarget(period: string): number {
  const monthly = 500_000
  if (period === 'week')    return Math.round(monthly * 12 / 52)
  if (period === 'quarter') return monthly * 3
  return monthly
}

function avgByGroup(
  rows: { fromStage: LeadStage | null; daysInPreviousStage: number | null }[],
): Map<string, number> {
  const acc = new Map<string, { total: number; count: number }>()
  for (const r of rows) {
    if (!r.fromStage || r.daysInPreviousStage === null) continue
    const e = acc.get(r.fromStage) ?? { total: 0, count: 0 }
    e.total += r.daysInPreviousStage
    e.count++
    acc.set(r.fromStage, e)
  }
  const result = new Map<string, number>()
  for (const [k, { total, count }] of acc) {
    result.set(k, count > 0 ? Math.round(total / count) : 0)
  }
  return result
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const ACTIVE_STAGES: LeadStage[] = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED', 'QUALIFIED',
  'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'NURTURE',
]

const STAGE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  SIGNAL:        { bg: 'rgba(20,184,166,0.15)',  color: '#2dd4bf', label: 'Signal' },
  PROSPECT:      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Prospect' },
  OUTREACH_SENT: { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'Outreach Sent' },
  ENGAGED:       { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8', label: 'Engaged' },
  QUALIFIED:     { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', label: 'Qualified' },
  PROPOSAL:      { bg: 'rgba(249,115,22,0.15)',  color: '#fb923c', label: 'Proposal' },
  PROPOSAL_SENT: { bg: 'rgba(234,88,12,0.15)',   color: '#ea580c', label: 'Proposal Sent' },
  NEGOTIATION:   { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa', label: 'Negotiation' },
  NURTURE:       { bg: 'rgba(71,85,105,0.15)',   color: '#64748b', label: 'Nurture' },
}

// ─── Alert types ──────────────────────────────────────────────────────────────

interface Alert {
  severity: 'warning' | 'positive'
  message:  string
  href?:    string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params    = await searchParams
  const period    = (Array.isArray(params.period) ? params.period[0] : params.period) ?? 'month'
  const repFilter = (Array.isArray(params.rep)    ? params.rep[0]    : params.rep)    ?? 'all'
  const from      = (Array.isArray(params.from)   ? params.from[0]   : params.from)   ?? ''
  const to        = (Array.isArray(params.to)     ? params.to[0]     : params.to)     ?? ''

  const [, tenant] = await Promise.all([requireAuth(), getTenant()])

  if (!tenant) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Reports</h1>
        <p style={{ color: 'var(--text2)' }}>Navigate to a tenant workspace to view reports.</p>
      </div>
    )
  }

  const tenantId = tenant.id
  const now      = new Date()

  const { start: periodStart, end: periodEnd } = getPeriodRange(period, from, to, now)
  const { start: prevStart,   end: prevEnd   } = getPreviousPeriodRange(periodStart, periodEnd)
  const periodLabel = getPeriodLabel(period, from, to)
  const target      = getPeriodTarget(period)

  const allReps = await db.user.findMany({
    where:   { tenantId, active: true },
    select:  { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  const repLeadIds: string[] | null = repFilter !== 'all'
    ? (await db.lead.findMany({
        where:  { tenantId, assignedToId: repFilter },
        select: { id: true },
      })).map((l) => l.id)
    : null

  const repWhere      = repFilter !== 'all' ? { assignedToId: repFilter } : {}
  const oppRepWhere   = repLeadIds ? { leadId: { in: repLeadIds } } : {}
  const outreachWhere = repFilter !== 'all' ? { userId: repFilter } : {}
  const stageRepWhere = repLeadIds ? { opportunity: { leadId: { in: repLeadIds } } } : {}

  const [
    openOpps, wonOpps, lostAgg, createdAgg, outreachInPeriod, activeLeads,
    stageHistCurrent, stageHistPrevious, overdueLeads, wonPreviousAgg, recentPipelineCount,
  ] = await Promise.all([
    // Open pipeline — includes stageChangedAt + createdAt for aging
    db.opportunity.findMany({
      where: { tenantId, status: { in: ['OPEN', 'PURSUING'] }, ...oppRepWhere },
      select: {
        estimatedRevenue: true, weightedValue: true,
        expectedCloseDate: true, leadId: true, customerId: true,
        stageChangedAt: true, createdAt: true, title: true,
        lead: { select: { stage: true, assignedToId: true, company: true } },
      },
    }),
    // Won opps in period
    db.opportunity.findMany({
      where: { tenantId, status: 'WON', updatedAt: { gte: periodStart, lte: periodEnd }, ...oppRepWhere },
      select: {
        estimatedRevenue: true, value: true, leadId: true,
        lead: { select: { assignedToId: true } },
      },
    }),
    // Lost opps in period
    db.opportunity.aggregate({
      where: { tenantId, status: 'LOST', updatedAt: { gte: periodStart, lte: periodEnd }, ...oppRepWhere },
      _count: { _all: true },
      _sum:   { estimatedRevenue: true, value: true },
    }),
    // Created opps in period
    db.opportunity.aggregate({
      where: { tenantId, createdAt: { gte: periodStart, lte: periodEnd }, ...oppRepWhere },
      _count: { _all: true },
      _sum:   { estimatedRevenue: true },
    }),
    // Outreach in period
    db.outreachLog.findMany({
      where:  { tenantId, createdAt: { gte: periodStart, lte: periodEnd }, ...outreachWhere },
      select: { userId: true },
    }),
    // Active leads for rep table
    db.lead.findMany({
      where:  { tenantId, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] }, ...repWhere },
      select: { assignedToId: true },
    }),
    // Stage history — current period
    db.stageHistory.findMany({
      where: {
        tenantId,
        changedAt:          { gte: periodStart, lte: periodEnd },
        fromStage:          { not: null },
        daysInPreviousStage: { not: null },
        ...stageRepWhere,
      },
      select: { fromStage: true, daysInPreviousStage: true },
    }),
    // Stage history — previous period
    db.stageHistory.findMany({
      where: {
        tenantId,
        changedAt:           { gte: prevStart, lte: prevEnd },
        fromStage:           { not: null },
        daysInPreviousStage: { not: null },
        ...stageRepWhere,
      },
      select: { fromStage: true, daysInPreviousStage: true },
    }),
    // Overdue leads for alert
    db.lead.findMany({
      where: {
        tenantId,
        nextFollowUp: { lt: now },
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        ...repWhere,
      },
      select: { assignedToId: true, assignedTo: { select: { name: true } }, value: true },
    }),
    // Won previous period (new logo) for bookings comparison alert
    db.opportunity.aggregate({
      where: {
        tenantId,
        status: 'WON',
        leadId: { not: null },
        updatedAt: { gte: prevStart, lte: prevEnd },
        ...oppRepWhere,
      },
      _count: { _all: true },
      _sum:   { estimatedRevenue: true, value: true },
    }),
    // Pipeline created in last 7 days (for "no new pipeline" alert)
    db.opportunity.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        ...oppRepWhere,
      },
    }),
  ])

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const totalPipeline        = openOpps.reduce((s, o) => s + (o.estimatedRevenue ?? 0), 0)
  const weightedPipeline     = openOpps.reduce((s, o) => s + (o.weightedValue    ?? 0), 0)
  const forecastCoverage     = target > 0 ? (weightedPipeline / target) * 100 : 0
  const bookingsCount        = wonOpps.length
  const bookingsValue        = wonOpps.reduce((s, o) => s + (o.estimatedRevenue ?? o.value ?? 0), 0)
  const pipelineCreatedCount = createdAgg._count._all
  const pipelineCreatedValue = createdAgg._sum.estimatedRevenue ?? 0
  const pipelineLostCount    = lostAgg._count._all
  const pipelineLostValue    = lostAgg._sum.estimatedRevenue ?? lostAgg._sum.value ?? 0

  // ── Pipeline by stage ─────────────────────────────────────────────────────

  const pipelineByStage = new Map<LeadStage, { value: number; count: number }>()
  for (const s of ACTIVE_STAGES) pipelineByStage.set(s, { value: 0, count: 0 })
  for (const opp of openOpps) {
    const stage = opp.lead?.stage
    if (stage && pipelineByStage.has(stage)) {
      const e = pipelineByStage.get(stage)!
      e.value += opp.estimatedRevenue ?? 0
      e.count++
    }
  }
  const maxStageValue = Math.max(...Array.from(pipelineByStage.values()).map((v) => v.value), 1)

  // ── New logo vs existing ──────────────────────────────────────────────────

  let newLogoValue = 0, newLogoCount = 0, existingValue = 0, existingCount = 0
  for (const opp of openOpps) {
    const v = opp.estimatedRevenue ?? 0
    if (opp.customerId) { existingValue += v; existingCount++ }
    else                { newLogoValue  += v; newLogoCount++ }
  }

  // ── 30/60/90 day commit ───────────────────────────────────────────────────

  const now30 = new Date(now.getTime() + 30 * 86_400_000)
  const now60 = new Date(now.getTime() + 60 * 86_400_000)
  const now90 = new Date(now.getTime() + 90 * 86_400_000)
  let commit30 = 0, commit60 = 0, commit90 = 0
  let count30  = 0, count60  = 0, count90  = 0
  for (const opp of openOpps) {
    if (!opp.expectedCloseDate) continue
    const v = opp.estimatedRevenue ?? 0
    const d = opp.expectedCloseDate
    if (d <= now90) { commit90 += v; count90++ }
    if (d <= now60) { commit60 += v; count60++ }
    if (d <= now30) { commit30 += v; count30++ }
  }

  // ── Pipeline aging ────────────────────────────────────────────────────────

  const agingList = [...openOpps]
    .map((o) => ({
      title:          o.title,
      company:        o.lead?.company ?? null,
      stage:          o.lead?.stage   ?? null,
      daysInStage:    daysInCurrentStage(o.stageChangedAt, o.createdAt, now),
      daysInPipeline: Math.floor((now.getTime() - o.createdAt.getTime()) / 86_400_000),
      value:          o.estimatedRevenue ?? null,
    }))
    .sort((a, b) => b.daysInPipeline - a.daysInPipeline)

  // ── Stage velocity ────────────────────────────────────────────────────────

  const velocityCurrent  = avgByGroup(stageHistCurrent  as { fromStage: LeadStage | null; daysInPreviousStage: number | null }[])
  const velocityPrevious = avgByGroup(stageHistPrevious as { fromStage: LeadStage | null; daysInPreviousStage: number | null }[])

  // ── Alerts ────────────────────────────────────────────────────────────────

  const alerts: Alert[] = []

  // Stage velocity changes >20%
  for (const stage of ACTIVE_STAGES) {
    const curr = velocityCurrent.get(stage)
    const prev = velocityPrevious.get(stage)
    if (!curr || !prev || prev === 0) continue
    const pct = (curr - prev) / prev
    if (Math.abs(pct) < 0.2) continue
    const stageLabel = STAGE_STYLE[stage].label
    const $ = fmt$(pipelineByStage.get(stage)?.value)
    if (pct > 0) {
      alerts.push({
        severity: 'warning',
        message: `${stageLabel} stage avg time up ${Math.round(pct * 100)}% vs last period (${prev}d → ${curr}d) — ${$} at risk`,
        href: '/reports#velocity',
      })
    } else {
      alerts.push({
        severity: 'positive',
        message: `${stageLabel} stage moving ${Math.round(Math.abs(pct) * 100)}% faster than last period (${prev}d → ${curr}d)`,
        href: '/reports#velocity',
      })
    }
  }

  // Stalled pipeline >30 days
  const stalledOpps = openOpps.filter((o) => daysInCurrentStage(o.stageChangedAt, o.createdAt, now) >= 30)
  const stalledValue = stalledOpps.reduce((s, o) => s + (o.estimatedRevenue ?? 0), 0)
  if (stalledValue > 0) {
    const maxDays = Math.max(...stalledOpps.map((o) => daysInCurrentStage(o.stageChangedAt, o.createdAt, now)))
    alerts.push({
      severity: 'warning',
      message: `${fmt$(stalledValue)} in pipeline (${stalledOpps.length} opp${stalledOpps.length !== 1 ? 's' : ''}) hasn't moved in 30–${maxDays} days`,
      href: '/reports#aging',
    })
  }

  // No new pipeline in last 7 days
  if (recentPipelineCount === 0) {
    alerts.push({
      severity: 'warning',
      message: 'No new pipeline created in the last 7 days — prospecting activity low',
      href: '/pipeline',
    })
  }

  // Overdue follow-ups per rep >3
  type RepOverdue = { name: string | null; count: number; value: number }
  const repOverdue = new Map<string, RepOverdue>()
  for (const lead of overdueLeads) {
    if (!lead.assignedToId) continue
    const e = repOverdue.get(lead.assignedToId) ?? { name: lead.assignedTo?.name ?? null, count: 0, value: 0 }
    e.count++
    e.value += lead.value ?? 0
    repOverdue.set(lead.assignedToId, e)
  }
  for (const { name, count, value } of repOverdue.values()) {
    if (count >= 3) {
      alerts.push({
        severity: 'warning',
        message: `${name ?? 'A rep'} has ${count} overdue follow-ups${value > 0 ? ` totaling ${fmt$(value)}` : ''}`,
        href: '/pipeline',
      })
    }
  }

  // New logo bookings comparison
  const currentNewLogoCount = wonOpps.filter((o) => o.leadId !== null).length
  const currentNewLogoValue = wonOpps.filter((o) => o.leadId !== null)
    .reduce((s, o) => s + (o.estimatedRevenue ?? o.value ?? 0), 0)
  const prevNewLogoCount = wonPreviousAgg._count._all
  const prevNewLogoValue = wonPreviousAgg._sum.estimatedRevenue ?? wonPreviousAgg._sum.value ?? 0
  if (prevNewLogoCount > 0 && currentNewLogoCount > 0) {
    const ratio = currentNewLogoValue / (prevNewLogoValue || 1)
    if (ratio >= 2) {
      alerts.push({
        severity: 'positive',
        message: `New logo bookings up ${ratio.toFixed(1)}x vs last period (${fmt$(prevNewLogoValue)} → ${fmt$(currentNewLogoValue)})`,
      })
    } else if (ratio < 0.5 && currentNewLogoValue < prevNewLogoValue) {
      alerts.push({
        severity: 'warning',
        message: `New logo bookings down ${Math.round((1 - ratio) * 100)}% vs last period (${fmt$(prevNewLogoValue)} → ${fmt$(currentNewLogoValue)})`,
      })
    }
  }

  // ── Rep performance ───────────────────────────────────────────────────────

  type RepStats = { leadsAssigned: number; pipeline: number; weighted: number; outreach: number; dealsWon: number; revenue: number }
  const repStats = new Map<string, RepStats>()
  for (const rep of allReps) repStats.set(rep.id, { leadsAssigned: 0, pipeline: 0, weighted: 0, outreach: 0, dealsWon: 0, revenue: 0 })
  for (const lead of activeLeads) {
    if (!lead.assignedToId) continue
    const r = repStats.get(lead.assignedToId)
    if (r) r.leadsAssigned++
  }
  for (const opp of openOpps) {
    const repId = opp.lead?.assignedToId
    if (!repId) continue
    const r = repStats.get(repId)
    if (r) { r.pipeline += opp.estimatedRevenue ?? 0; r.weighted += opp.weightedValue ?? 0 }
  }
  for (const log of outreachInPeriod) {
    if (!log.userId) continue
    const r = repStats.get(log.userId)
    if (r) r.outreach++
  }
  for (const opp of wonOpps) {
    const repId = opp.lead?.assignedToId
    if (!repId) continue
    const r = repStats.get(repId)
    if (r) { r.dealsWon++; r.revenue += opp.estimatedRevenue ?? opp.value ?? 0 }
  }

  const tableReps = repFilter !== 'all' ? allReps.filter((r) => r.id === repFilter) : allReps

  return (
    <div className="space-y-5">

      {/* Header + filters */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            {tenant.name} · {periodLabel}
          </p>
        </div>
        <ReportsFilters reps={allReps} />
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div id="alerts">
          <SectionHeader title="Insights & Alerts" sub={`${alerts.length} item${alerts.length !== 1 ? 's' : ''}`} />
          <div className="space-y-2 mt-3">
            {alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Pipeline"    value={fmt$(totalPipeline)}       sub={`${openOpps.length} open opp${openOpps.length !== 1 ? 's' : ''}`} />
        <MetricCard label="Weighted Pipeline" value={fmt$(weightedPipeline)}    sub="by probability" />
        <MetricCard label="Forecast Coverage" value={`${Math.round(forecastCoverage)}%`} sub={`of ${fmt$(target)} target`}
          valueColor={forecastCoverage >= 100 ? '#34d399' : forecastCoverage >= 60 ? '#fbbf24' : '#f87171'} />
        <MetricCard label="Bookings"          value={fmt$(bookingsValue)}        sub={`${bookingsCount} deal${bookingsCount !== 1 ? 's' : ''} won`} valueColor="#34d399" />
        <MetricCard label="Pipeline Created"  value={fmt$(pipelineCreatedValue)} sub={`${pipelineCreatedCount} opp${pipelineCreatedCount !== 1 ? 's' : ''}`} valueColor="#60a5fa" />
        <MetricCard label="Pipeline Lost"     value={fmt$(pipelineLostValue)}    sub={`${pipelineLostCount} lost`}
          valueColor={pipelineLostCount > 0 ? '#f87171' : undefined} />
      </div>

      {/* ── Pipeline breakdown ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pipeline by stage */}
        <div className="lg:col-span-2">
          <SectionHeader title="Pipeline by Stage" />
          <div className="rounded-lg p-4 mt-3" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
            {openOpps.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text3)' }}>No open opportunities</p>
            ) : (
              <div className="space-y-4">
                {ACTIVE_STAGES.map((stage) => {
                  const entry = pipelineByStage.get(stage)!
                  const pct   = (entry.value / maxStageValue) * 100
                  const style = STAGE_STYLE[stage]
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge bg={style.bg} color={style.color}>{style.label}</Badge>
                          <span className="text-xs" style={{ color: 'var(--text3)' }}>
                            {entry.count} opp{entry.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums"
                          style={{ color: entry.value > 0 ? 'var(--text)' : 'var(--text3)' }}>
                          {fmt$(entry.value)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--bg4)' }}>
                        <div className="h-1.5 rounded-full"
                          style={{ width: `${pct}%`, background: style.color, opacity: 0.75 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div>
            <SectionHeader title="New Logo vs Existing" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <MetricCard label="New Logo" value={fmt$(newLogoValue)} sub={`${newLogoCount} opp${newLogoCount !== 1 ? 's' : ''}`} valueColor="#60a5fa" />
              <MetricCard label="Existing" value={fmt$(existingValue)} sub={`${existingCount} opp${existingCount !== 1 ? 's' : ''}`} valueColor="#a78bfa" />
            </div>
          </div>
          <div>
            <SectionHeader title="Expected Close" />
            <div className="space-y-2 mt-3">
              <CommitRow label="Next 30 days" value={commit30} count={count30} color="#34d399" />
              <CommitRow label="Next 60 days" value={commit60} count={count60} color="#fbbf24" />
              <CommitRow label="Next 90 days" value={commit90} count={count90} color="#a78bfa" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline Aging ───────────────────────────────────────────────── */}
      <div id="aging">
        <SectionHeader title="Pipeline Aging" sub="Open opportunities, oldest in pipeline first" />
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--bg4)' }}>
          {agingList.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text3)', background: 'var(--bg2)' }}>
              No open opportunities
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--bg4)' }}>
                    <Th left>Opportunity</Th>
                    <Th>Stage</Th>
                    <Th>In Stage</Th>
                    <Th>In Pipeline</Th>
                    <Th>Value</Th>
                  </tr>
                </thead>
                <tbody>
                  {agingList.map((opp, i) => {
                    const stageStyle = opp.stage ? STAGE_STYLE[opp.stage] : null
                    const sc         = stallColor(opp.daysInStage)
                    return (
                      <tr key={i} style={{
                        background: i % 2 === 0 ? 'var(--bg2)' : 'transparent',
                        borderBottom: '1px solid var(--bg4)',
                      }}>
                        <td className="px-4 py-3" style={{ textAlign: 'left' }}>
                          <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{opp.title}</p>
                          {opp.company && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{opp.company}</p>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                          {stageStyle && (
                            <Badge bg={stageStyle.bg} color={stageStyle.color}>{stageStyle.label}</Badge>
                          )}
                        </td>
                        <Td color={sc ?? undefined}>{opp.daysInStage}d</Td>
                        <Td>{opp.daysInPipeline}d</Td>
                        <Td>{fmt$(opp.value)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Stage Velocity Trends ────────────────────────────────────────── */}
      <div id="velocity">
        <SectionHeader title="Stage Velocity Trends" sub="Avg days deals spend in each stage" />
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--bg4)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--bg4)' }}>
                  <Th left>Stage</Th>
                  <Th>Avg Days Now</Th>
                  <Th>Avg Days Prev</Th>
                  <Th>Trend</Th>
                  <Th>$ in Stage</Th>
                </tr>
              </thead>
              <tbody>
                {ACTIVE_STAGES.map((stage, i) => {
                  const curr  = velocityCurrent.get(stage)
                  const prev  = velocityPrevious.get(stage)
                  const pipelineVal = pipelineByStage.get(stage)?.value ?? 0
                  const style = STAGE_STYLE[stage]

                  let trendLabel = '—'
                  let trendColor = 'var(--text3)'
                  if (curr !== undefined && prev !== undefined && prev > 0) {
                    const pct = (curr - prev) / prev
                    if (pct > 0.05) {
                      trendLabel = `↑ ${Math.round(pct * 100)}%`
                      trendColor = '#f87171'
                    } else if (pct < -0.05) {
                      trendLabel = `↓ ${Math.round(Math.abs(pct) * 100)}%`
                      trendColor = '#34d399'
                    } else {
                      trendLabel = '→ flat'
                      trendColor = 'var(--text3)'
                    }
                  }

                  return (
                    <tr key={stage} style={{
                      background: i % 2 === 0 ? 'var(--bg2)' : 'transparent',
                      borderBottom: '1px solid var(--bg4)',
                    }}>
                      <td className="px-4 py-3" style={{ textAlign: 'left' }}>
                        <Badge bg={style.bg} color={style.color}>{style.label}</Badge>
                      </td>
                      <Td>{curr !== undefined ? `${curr}d` : '—'}</Td>
                      <Td>{prev !== undefined ? `${prev}d` : '—'}</Td>
                      <Td color={trendColor}>{trendLabel}</Td>
                      <Td>{fmt$(pipelineVal)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        {stageHistCurrent.length === 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--text3)' }}>
            Velocity data builds as opportunities move through stages. No transitions recorded yet in this period.
          </p>
        )}
      </div>

      {/* ── Rep Performance Table ────────────────────────────────────────── */}
      {tableReps.length > 0 && (
        <div>
          <SectionHeader title="Rep Performance" sub={periodLabel} />
          <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--bg4)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--bg4)' }}>
                    <Th left>Rep</Th>
                    <Th>Leads</Th>
                    <Th>Pipeline</Th>
                    <Th>Weighted</Th>
                    <Th>Outreach</Th>
                    <Th>Won</Th>
                    <Th>Booked</Th>
                  </tr>
                </thead>
                <tbody>
                  {tableReps.map((rep, i) => {
                    const s = repStats.get(rep.id) ?? { leadsAssigned: 0, pipeline: 0, weighted: 0, outreach: 0, dealsWon: 0, revenue: 0 }
                    return (
                      <tr key={rep.id} style={{
                        background: i % 2 === 0 ? 'var(--bg2)' : 'transparent',
                        borderBottom: '1px solid var(--bg4)',
                      }}>
                        <Td left>
                          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{rep.name ?? rep.email}</span>
                        </Td>
                        <Td>{s.leadsAssigned}</Td>
                        <Td>{fmt$(s.pipeline)}</Td>
                        <Td>{fmt$(s.weighted)}</Td>
                        <Td>{s.outreach}</Td>
                        <Td>{s.dealsWon}</Td>
                        <Td color="#34d399">{fmt$(s.revenue)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, valueColor }: {
  label: string; value: string; sub?: string; valueColor?: string
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
      <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: valueColor ?? 'var(--text)' }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1.5" style={{ color: 'var(--text3)' }}>{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
        {title}
      </h2>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{sub}</p>}
    </div>
  )
}

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: bg, color }}>
      {children}
    </span>
  )
}

function CommitRow({ label, value, count, color }: {
  label: string; value: number; count: number; color: string
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
      style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
      <span className="text-xs" style={{ color: 'var(--text2)' }}>{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>{fmt$(value)}</span>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text3)' }}>
          {count} opp{count !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const isPositive = alert.severity === 'positive'
  const color = isPositive ? '#34d399' : '#fbbf24'
  const bg    = isPositive ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)'
  const border = isPositive ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'
  const icon  = isPositive ? '✓' : '⚠'

  const inner = (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="text-xs font-bold shrink-0 mt-0.5" style={{ color }}>{icon}</span>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{alert.message}</p>
    </div>
  )

  if (alert.href) {
    return (
      <a href={alert.href} className="block hover:opacity-80 transition-opacity">
        {inner}
      </a>
    )
  }
  return inner
}

function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider"
      style={{ color: 'var(--text3)', textAlign: left ? 'left' : 'right' }}>
      {children}
    </th>
  )
}

function Td({ children, left, color }: { children: React.ReactNode; left?: boolean; color?: string }) {
  return (
    <td className="px-4 py-3 text-sm tabular-nums"
      style={{ color: color ?? 'var(--text2)', textAlign: left ? 'left' : 'right' }}>
      {children}
    </td>
  )
}
