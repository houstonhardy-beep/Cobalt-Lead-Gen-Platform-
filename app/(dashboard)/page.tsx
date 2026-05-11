import { db } from '@/lib/db'
import { getTenant } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import type { LeadHeat, LeadStage, OutreachType } from '@/app/generated/prisma/client'
import { FilterBar } from './_components/FilterBar'
import { ActivityCalendar, type CalendarData } from './_components/ActivityCalendar'
import { daysInCurrentStage, stallColor } from '@/lib/pipeline/aging'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function daysAgo(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
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

function getPeriodTarget(period: string): number {
  const monthly = 500_000
  if (period === 'week')    return Math.round(monthly * 12 / 52)
  if (period === 'quarter') return monthly * 3
  return monthly
}

// ─── Display config ───────────────────────────────────────────────────────────

const HEAT_ORDER: Record<LeadHeat, number> = {
  HOT: 0, WARM: 1, FOLLOWUP: 2, CONTACTED: 3, COLD: 4, NURTURE: 5,
}

const HEAT_STYLE: Record<LeadHeat, { bg: string; color: string; label: string }> = {
  HOT:       { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'Hot' },
  WARM:      { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Warm' },
  FOLLOWUP:  { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'Follow-up' },
  CONTACTED: { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf', label: 'Contacted' },
  COLD:      { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8', label: 'Cold' },
  NURTURE:   { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', label: 'Nurture' },
}

const STAGE_STYLE: Record<LeadStage, { bg: string; color: string; label: string }> = {
  SIGNAL:        { bg: 'rgba(20,184,166,0.15)',  color: '#2dd4bf', label: 'Signal' },
  PROSPECT:      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Prospect' },
  OUTREACH_SENT: { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'Outreach Sent' },
  ENGAGED:       { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8', label: 'Engaged' },
  QUALIFIED:     { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', label: 'Qualified' },
  PROPOSAL:      { bg: 'rgba(249,115,22,0.15)',  color: '#fb923c', label: 'Proposal' },
  PROPOSAL_SENT: { bg: 'rgba(234,88,12,0.15)',   color: '#ea580c', label: 'Proposal Sent' },
  NEGOTIATION:   { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa', label: 'Negotiation' },
  CLOSED_WON:    { bg: 'rgba(16,185,129,0.15)',  color: '#34d399', label: 'Won' },
  CLOSED_LOST:   { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', label: 'Lost' },
  NURTURE:       { bg: 'rgba(71,85,105,0.15)',   color: '#64748b', label: 'Nurture' },
}

const CALL_TYPES  = new Set<OutreachType>(['COLD_CALL', 'FOLLOW_UP'])
const EMAIL_TYPES = new Set<OutreachType>(['COLD_EMAIL', 'POST_QUOTE', 'CONTRACT', 'RFP_COVER', 'LINKEDIN'])

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params    = await searchParams
  const period    = (Array.isArray(params.period) ? params.period[0] : params.period) ?? 'month'
  const repFilter = (Array.isArray(params.rep)    ? params.rep[0]    : params.rep)    ?? 'all'

  const [, tenant] = await Promise.all([requireAuth(), getTenant()])

  if (!tenant) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Command Center</h1>
        <p style={{ color: 'var(--text2)' }}>Navigate to a tenant workspace to view its data.</p>
      </div>
    )
  }

  const tenantId    = tenant.id
  const now         = new Date()
  const periodStart = getPeriodStart(period, now)
  const endOfToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const calStart    = new Date(now.getFullYear(), now.getMonth(), 1)
  const calEnd      = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

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
  const calRepWhere   = repFilter !== 'all' ? { userId: repFilter } : {}

  const [leads, followUps, openOpps, wonAgg, outreachThisPeriod, calOutreach, calFollowUpLeads, calLeadLogs] =
    await Promise.all([
      // Active lead feed
      db.lead.findMany({
        where: { tenantId, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] }, ...repWhere },
        include: {
          assignedTo: { select: { id: true, name: true } },
          opportunities: {
            where:  { status: { in: ['OPEN', 'PURSUING'] } },
            select: { estimatedRevenue: true, weightedValue: true, stageChangedAt: true, createdAt: true },
          },
        },
      }),
      // Follow-up queue (today)
      db.lead.findMany({
        where: {
          tenantId,
          nextFollowUp: { lte: endOfToday },
          stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
          ...repWhere,
        },
        select: {
          id: true, company: true, contact: true, contactTitle: true,
          nextFollowUp: true, signal: true, heat: true, stage: true,
        },
        orderBy: { nextFollowUp: 'asc' },
        take: 5,
      }),
      // Open opportunities
      db.opportunity.findMany({
        where:  { tenantId, status: { in: ['OPEN', 'PURSUING'] }, ...oppRepWhere },
        select: {
          estimatedRevenue: true, weightedValue: true, value: true,
          title: true, stageChangedAt: true, createdAt: true,
          lead: { select: { company: true, stage: true } },
        },
      }),
      // Won in period
      db.opportunity.aggregate({
        where: { tenantId, status: 'WON', updatedAt: { gte: periodStart }, ...oppRepWhere },
        _sum:  { estimatedRevenue: true, value: true },
      }),
      // Outreach this period (for rep perf)
      db.outreachLog.findMany({
        where:  { tenantId, createdAt: { gte: periodStart }, ...calRepWhere },
        select: { userId: true },
      }),
      // Calendar outreach — full detail for popup
      db.outreachLog.findMany({
        where:  { tenantId, createdAt: { gte: calStart, lte: calEnd }, ...calRepWhere },
        select: {
          type: true, createdAt: true, subject: true, content: true,
          lead: { select: { company: true, contact: true } },
          user: { select: { name: true } },
        },
      }),
      // Calendar follow-ups
      db.lead.findMany({
        where: { tenantId, nextFollowUp: { gte: calStart, lte: calEnd }, ...repWhere },
        select: {
          company: true, contact: true, nextFollowUp: true,
          assignedTo: { select: { name: true } },
        },
      }),
      // Calendar lead logs
      db.leadLog.findMany({
        where: {
          lead: { tenantId },
          date: { gte: calStart, lte: calEnd },
          ...(repFilter !== 'all' ? { userId: repFilter } : {}),
        },
        select: {
          action: true, date: true,
          lead: { select: { company: true, contact: true } },
          user: { select: { name: true } },
        },
      }),
    ])

  // ── Metrics ──────────────────────────────────────────────────────────────

  const hotCount         = leads.filter((l) => l.heat === 'HOT').length
  const followUpCount    = leads.filter((l) => l.nextFollowUp && l.nextFollowUp <= endOfToday).length
  const totalPipeline    = openOpps.reduce((s, o) => s + (o.estimatedRevenue ?? o.value ?? 0), 0)
  const weightedPipeline = openOpps.reduce((s, o) => s + (o.weightedValue ?? 0), 0)
  const wonThisMonth     = wonAgg._sum.estimatedRevenue ?? wonAgg._sum.value ?? 0
  const target           = getPeriodTarget(period)
  const forecastCoverage = target > 0 ? (weightedPipeline / target) * 100 : 0

  const agingList = [...openOpps]
    .map((o) => ({
      title:          o.title,
      company:        o.lead?.company ?? null,
      stage:          o.lead?.stage   ?? null,
      daysInStage:    daysInCurrentStage(o.stageChangedAt, o.createdAt, now),
      daysInPipeline: Math.floor((now.getTime() - o.createdAt.getTime()) / 86_400_000),
      value:          o.estimatedRevenue ?? o.value ?? null,
    }))
    .sort((a, b) => b.daysInPipeline - a.daysInPipeline)

  // ── Lead feed ─────────────────────────────────────────────────────────────

  const sortedLeads = [...leads].sort((a, b) => HEAT_ORDER[a.heat] - HEAT_ORDER[b.heat])

  // ── Rep performance ───────────────────────────────────────────────────────

  const repStats = new Map<string, { leads: number; pipeline: number; outreach: number }>()
  for (const rep of allReps) repStats.set(rep.id, { leads: 0, pipeline: 0, outreach: 0 })
  for (const lead of leads) {
    if (!lead.assignedToId) continue
    const r = repStats.get(lead.assignedToId)
    if (r) { r.leads++; r.pipeline += lead.value ?? 0 }
  }
  for (const log of outreachThisPeriod) {
    if (!log.userId) continue
    const r = repStats.get(log.userId)
    if (r) r.outreach++
  }

  // ── Activity calendar ─────────────────────────────────────────────────────

  const calData: CalendarData = {}

  function ensureDay(key: string) {
    if (!calData[key]) calData[key] = { calls: 0, emails: 0, sms: 0, followUps: [], activities: [] }
  }

  for (const o of calOutreach) {
    const key = String(o.createdAt.getDate())
    ensureDay(key)
    if (CALL_TYPES.has(o.type))       calData[key].calls++
    else if (EMAIL_TYPES.has(o.type)) calData[key].emails++
    else if (o.type === 'SMS')        calData[key].sms++

    calData[key].activities.push({
      kind:    'OUTREACH',
      type:    o.type,
      company: o.lead?.company ?? 'Unknown',
      contact: o.lead?.contact,
      rep:     o.user?.name,
      text:    o.subject ?? (o.content?.slice(0, 100)),
      time:    o.createdAt,
    })
  }

  for (const log of calLeadLogs) {
    const key = String(log.date.getDate())
    ensureDay(key)
    calData[key].activities.push({
      kind:    'LOG',
      company: log.lead.company,
      contact: log.lead.contact,
      rep:     log.user?.name,
      text:    log.action,
      time:    log.date,
    })
  }

  for (const lead of calFollowUpLeads) {
    if (!lead.nextFollowUp) continue
    const key    = String(lead.nextFollowUp.getDate())
    const overdue = lead.nextFollowUp < now
    ensureDay(key)
    calData[key].followUps.push({ company: lead.company, contact: lead.contact, overdue })
    calData[key].activities.push({
      kind:    'FOLLOWUP',
      company: lead.company,
      contact: lead.contact,
      rep:     lead.assignedTo?.name,
      time:    lead.nextFollowUp,
      overdue,
    })
  }

  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-5">

      {/* Header + filters */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Command Center</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            {tenant.name} · {dateLabel}
          </p>
        </div>
        <FilterBar reps={allReps} />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Pipeline"    value={fmt$(totalPipeline)}      sub={`${openOpps.length} open opp${openOpps.length !== 1 ? 's' : ''}`} />
        <MetricCard label="Weighted Pipeline" value={fmt$(weightedPipeline)}   sub="by probability" />
        <MetricCard label="Hot Leads"         value={String(hotCount)}         valueColor="#f87171" />
        <MetricCard label="Follow-ups Due"    value={String(followUpCount)}    valueColor={followUpCount > 0 ? '#fbbf24' : undefined} />
        <MetricCard label="Won This Period"   value={fmt$(wonThisMonth)}       valueColor="#34d399" />
        <MetricCard
          label="Forecast"
          value={`${Math.round(forecastCoverage)}%`}
          sub={`of ${fmt$(target)} target`}
          valueColor={forecastCoverage >= 100 ? '#34d399' : forecastCoverage >= 60 ? '#fbbf24' : '#f87171'}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="space-y-6">

          {/* Action Queue */}
          <div>
            <SectionHeader title="Action Queue" href="/pipeline" linkLabel="View all" />
            <div className="space-y-2 mt-3">
              {followUps.length === 0 ? (
                <Empty message="No follow-ups due today" />
              ) : followUps.map((lead) => {
                const days    = lead.nextFollowUp ? daysAgo(lead.nextFollowUp, now) : 0
                const overdue = days > 0
                const heat    = HEAT_STYLE[lead.heat]
                const stage   = STAGE_STYLE[lead.stage]
                return (
                  <div
                    key={lead.id}
                    className="rounded-lg p-3"
                    style={{
                      background: 'var(--bg2)',
                      border: `1px solid ${overdue ? 'rgba(239,68,68,0.35)' : 'var(--bg4)'}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                          {lead.company}
                        </p>
                        {lead.contact && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>
                            {lead.contact}{lead.contactTitle ? ` · ${lead.contactTitle}` : ''}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-xs shrink-0 font-semibold tabular-nums"
                        style={{ color: overdue ? '#f87171' : '#fbbf24' }}
                      >
                        {overdue ? `${days}d overdue` : 'Today'}
                      </span>
                    </div>
                    {lead.signal && (
                      <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text3)' }}>
                        {lead.signal}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <Badge bg={heat.bg} color={heat.color}>{heat.label}</Badge>
                      <Badge bg={stage.bg} color={stage.color}>{stage.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity Calendar */}
          <div>
            <SectionHeader title="Activity Calendar" />
            <div
              className="rounded-lg p-3 mt-3"
              style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}
            >
              <ActivityCalendar
                year={now.getFullYear()}
                month={now.getMonth()}
                today={now.getDate()}
                data={calData}
              />
            </div>
          </div>

        </div>

        {/* Lead Feed */}
        <div className="lg:col-span-2">
          <SectionHeader title="Lead Feed" href="/pipeline" linkLabel="View pipeline" />
          <div className="space-y-2 mt-3">
            {sortedLeads.length === 0 ? (
              <Empty message="No active leads" />
            ) : sortedLeads.map((lead) => {
              const heat         = HEAT_STYLE[lead.heat]
              const stage        = STAGE_STYLE[lead.stage]
              const oppRevenue   = lead.opportunities.reduce((s, o) => s + (o.estimatedRevenue ?? 0), 0)
              const oppWeighted  = lead.opportunities.reduce((s, o) => s + (o.weightedValue    ?? 0), 0)
              const estValue     = oppRevenue  > 0 ? oppRevenue  : (lead.value ?? null)
              const wgtValue     = oppWeighted > 0 ? oppWeighted : null

              // Stage duration — use highest-value open opp
              const primaryOpp   = lead.opportunities.length > 0
                ? lead.opportunities.reduce((best, o) =>
                    (o.estimatedRevenue ?? 0) >= (best.estimatedRevenue ?? 0) ? o : best)
                : null
              const stageDays    = primaryOpp
                ? daysInCurrentStage(primaryOpp.stageChangedAt, primaryOpp.createdAt, now)
                : null
              const stageStall   = stageDays !== null ? stallColor(stageDays) : undefined

              return (
                <div
                  key={lead.id}
                  className="rounded-lg p-3.5"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          {lead.company}
                        </p>
                        <Badge bg={heat.bg} color={heat.color}>{heat.label}</Badge>
                        <Badge bg={stage.bg} color={stageStall ?? stage.color}>
                          {stage.label}
                          {stageDays !== null ? (
                            <> · {stageDays}d{stageStall ? ' ⚠' : ''}</>
                          ) : null}
                        </Badge>
                      </div>
                      {(lead.contact || lead.assignedTo) && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                          {lead.contact}
                          {lead.contactTitle ? ` · ${lead.contactTitle}` : ''}
                          {lead.assignedTo && (
                            <span style={{ color: 'var(--text3)' }}>
                              {lead.contact ? ' · ' : ''}
                              {lead.assignedTo.name}
                            </span>
                          )}
                        </p>
                      )}
                      {lead.signal && (
                        <p
                          className="text-xs mt-1.5 leading-relaxed"
                          style={{
                            color: 'var(--text3)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as const,
                            overflow: 'hidden',
                          }}
                        >
                          {lead.signal}
                        </p>
                      )}
                    </div>
                    {estValue != null && (
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                          {fmt$(estValue)}
                        </p>
                        {wgtValue != null && (
                          <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text3)' }}>
                            {fmt$(wgtValue)} wtd
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-2 mt-3 pt-2.5"
                    style={{ borderTop: '1px solid var(--bg4)' }}
                  >
                    <ActionBtn>AI Draft</ActionBtn>
                    <ActionBtn>Research</ActionBtn>
                    <ActionBtn>Log Activity</ActionBtn>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top 5 Stalled Deals */}
      {agingList.length > 0 && (
        <div>
          <SectionHeader title="Top 5 Stalled Deals" sub="Open opportunities, oldest in pipeline first" />
          <div className="space-y-2 mt-3">
            {agingList.slice(0, 5).map((opp, i) => {
              const stageStyle = opp.stage ? STAGE_STYLE[opp.stage] : null
              const sc         = stallColor(opp.daysInStage)
              return (
                <div
                  key={i}
                  className="rounded-lg px-3 py-2.5 flex items-center gap-3"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{opp.title}</p>
                    {opp.company && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{opp.company}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {stageStyle && (
                      <Badge bg={stageStyle.bg} color={stageStyle.color}>{stageStyle.label}</Badge>
                    )}
                    <span
                      className="text-xs tabular-nums font-semibold"
                      style={{ color: sc ?? 'var(--text2)' }}
                    >
                      {opp.daysInPipeline}d
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text3)' }}>
                      {fmt$(opp.value)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rep Performance */}
      {allReps.length > 0 && (
        <div>
          <SectionHeader
            title="Rep Performance"
            sub={period === 'week' ? 'This week' : period === 'quarter' ? 'This quarter' : 'This month'}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {allReps.map((rep) => {
              const stats = repStats.get(rep.id) ?? { leads: 0, pipeline: 0, outreach: 0 }
              return (
                <div
                  key={rep.id}
                  className="rounded-lg p-4"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}
                >
                  <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
                    {rep.name ?? rep.email}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <RepStat value={String(stats.leads)}    label="Leads" />
                    <RepStat value={fmt$(stats.pipeline)}   label="Pipeline" />
                    <RepStat value={String(stats.outreach)} label="Outreach" />
                  </div>
                </div>
              )
            })}
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

function SectionHeader({ title, sub, href, linkLabel }: {
  title: string; sub?: string; href?: string; linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
          {title}
        </h2>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{sub}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="text-xs" style={{ color: 'var(--cobalt3)' }}>
          {linkLabel} →
        </Link>
      )}
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

function ActionBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="text-xs px-2.5 py-1 rounded"
      style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--bg4)' }}
    >
      {children}
    </button>
  )
}

function RepStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: 'var(--text)' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{label}</p>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg px-4 py-8 text-center text-sm"
      style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)', color: 'var(--text3)' }}
    >
      {message}
    </div>
  )
}
