'use client'

import { useState, useMemo, useEffect } from 'react'
import { OppDrawer } from './OppDrawer'
import { PipelineTrendChart } from './PipelineChart'
import { PipelineFunnelSnapshot } from './PipelineFunnelSnapshot'
import type { ChartDataPoint } from './PipelineChart'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineRow {
  id: string
  title: string
  company: string
  stage: string | null
  type: string
  jobType: string | null
  productCategory: string | null
  leadSource: string | null
  status: string
  estimatedRevenue: number | null
  weightedValue: number | null
  probabilityPercent: number | null
  repName: string | null
  repId: string | null
  daysInStage: number
  daysInPipeline: number
  needsAttention: boolean
  createdAtMs: number
  updatedAtMs: number
}

interface RepTargetCard {
  repId: string
  repName: string
  annual: number | null
  quarterly: number | null
  monthly: number | null
  weighted: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_META: Record<string, { label: string; color: string }> = {
  SIGNAL:        { label: 'Signal',        color: '#2dd4bf' },
  PROSPECT:      { label: 'Prospect',      color: '#94a3b8' },
  OUTREACH_SENT: { label: 'Outreach Sent', color: '#60a5fa' },
  ENGAGED:       { label: 'Engaged',       color: '#818cf8' },
  QUALIFIED:     { label: 'Qualified',     color: '#fbbf24' },
  PROPOSAL:      { label: 'Proposal',      color: '#fb923c' },
  PROPOSAL_SENT: { label: 'Proposal Sent', color: '#ea580c' },
  NEGOTIATION:   { label: 'Negotiation',   color: '#a78bfa' },
  CLOSED_WON:    { label: 'Won',           color: '#34d399' },
  CLOSED_LOST:   { label: 'Lost',          color: '#f87171' },
  NURTURE:       { label: 'Nurture',       color: '#64748b' },
}

const STAGE_ORDER = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED', 'QUALIFIED',
  'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE',
]

const JOB_TYPE_LABEL: Record<string, string> = {
  NEW_CONSTRUCTION:   'New Construction',
  MAC:                'MAC',
  INSTALL:            'Install',
  BOX_SALE:           'Box Sale',
  UPGRADE_REFRESH:    'Upgrade / Refresh',
  RFP_BID:            'RFP / Bid',
  SERVICE_ON_DEMAND:  'Service (On Demand)',
  SERVICE_CONTRACTED: 'Service (Contracted)',
}

const PRODUCT_CATEGORY_LABEL: Record<string, string> = {
  ACCESS_CONTROL:            'Access Control',
  VIDEO_SURVEILLANCE:        'Video Surveillance',
  INTRUSION_ALARM:           'Intrusion Alarm',
  INTERCOM_AUDIO:            'Intercom / Audio',
  NETWORKING_INFRASTRUCTURE: 'Networking',
  FIRE_LIFE_SAFETY:          'Fire / Life Safety',
  STRUCTURED_CABLING:        'Structured Cabling',
  AUTO_DOOR_SLIDING:         'Auto Door (Sliding)',
  AUTO_DOOR_ROTATING:        'Auto Door (Rotating)',
  AUTO_DOOR_OVERHEAD:        'Auto Door (Overhead)',
  AUTO_DOOR_SWING:           'Auto Door (Swing)',
  AUTO_DOOR_FOLDING:         'Auto Door (Folding)',
  MANUAL_DOOR_SLIDING:       'Manual Door (Sliding)',
  MANUAL_DOOR_ROTATING:      'Manual Door (Rotating)',
  MANUAL_DOOR_OVERHEAD:      'Manual Door (Overhead)',
  MANUAL_DOOR_SWING:         'Manual Door (Swing)',
  MANUAL_DOOR_FOLDING:       'Manual Door (Folding)',
  INTEGRATED_SYSTEMS:        'Integrated Systems',
  SYSTEMS_OTHER:             'Systems (Other)',
}

const LEAD_SOURCE_LABEL: Record<string, string> = {
  REFERRAL:          'Referral',
  SAM_GOV:           'SAM.gov',
  RFP_BID_BOARD:     'RFP / Bid Board',
  DODGE_DATA:        'Dodge Data',
  COLD_OUTREACH:     'Cold Outreach',
  INBOUND_WEB:       'Inbound Web',
  EXISTING_CUSTOMER: 'Existing Customer',
  PARTNER_VENDOR:    'Partner / Vendor',
}

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '30',  label: 'Last 30d' },
  { value: '60',  label: 'Last 60d' },
  { value: '90',  label: 'Last 90d' },
  { value: 'ytd', label: 'YTD' },
]

const SORT_OPTIONS = [
  { value: 'value',     label: 'Est. Value' },
  { value: 'stage',     label: 'Stage' },
  { value: 'pipeline',  label: 'Days in Pipeline' },
  { value: 'stage_age', label: 'Days in Stage' },
  { value: 'rep',       label: 'Rep' },
  { value: 'company',   label: 'Company' },
  { value: 'updated',   label: 'Recently Updated' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (n === null || n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function ytdStart(): number {
  const d = new Date()
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function inDateRange(createdAtMs: number, range: string): boolean {
  if (range === 'all') return true
  if (range === 'ytd') return createdAtMs >= ytdStart()
  const days = parseInt(range, 10)
  return createdAtMs >= Date.now() - days * 86_400_000
}

// ─── SelectControl ────────────────────────────────────────────────────────────

function SelectControl({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 13,
          background: 'var(--bg3)',
          border: '1px solid var(--bg4)',
          borderRadius: 6,
          color: 'var(--text)',
          padding: '5px 8px',
          minWidth: 130,
          cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, target }: { label: string; value: number; target: number | null }) {
  const pct   = target ? Math.min(100, Math.round((value / target) * 100)) : null
  const color = pct === null ? '#94a3b8' : pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--bg4)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', fontVariantNumeric: 'tabular-nums' }}>
        {fmt$(value)}
      </p>
      {target !== null ? (
        <>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
            <span style={{ color, fontWeight: 600 }}>{pct}%</span>
            {' of '}{fmt$(target)} target
          </p>
        </>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>No target set</p>
      )}
    </div>
  )
}

// ─── OppRow ───────────────────────────────────────────────────────────────────

const COLS = '1fr 150px 120px 110px 110px 72px 72px 96px 88px'
const COL_HEADERS = ['Opportunity', 'Stage', 'Rep', 'Job Type', 'Product', 'Stage Age', 'Pipeline', 'Est. Value', 'Weighted']

function OppRow({ row, onSelect }: { row: PipelineRow; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  const stageMeta = STAGE_META[row.stage ?? ''] ?? { label: row.stage ?? '—', color: '#94a3b8' }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: '0 12px',
        padding: '10px 14px',
        borderRadius: 8,
        background: hovered ? 'var(--bg3)' : 'var(--bg2)',
        border: '1px solid var(--bg4)',
        cursor: 'pointer',
        alignItems: 'center',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.title}
          </span>
          {row.needsAttention && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, flexShrink: 0, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
              Needs Attention
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.company}
        </div>
      </div>
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${stageMeta.color}22`, color: stageMeta.color, border: `1px solid ${stageMeta.color}44`, whiteSpace: 'nowrap' }}>
          {stageMeta.label}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.repName ?? '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.jobType ? (JOB_TYPE_LABEL[row.jobType] ?? row.jobType) : '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.productCategory ? (PRODUCT_CATEGORY_LABEL[row.productCategory] ?? row.productCategory) : '—'}</div>
      <div style={{ fontSize: 12, color: row.daysInStage > 45 ? '#fbbf24' : 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{row.daysInStage}d</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{row.daysInPipeline}d</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt$(row.estimatedRevenue)}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{fmt$(row.weightedValue)}</div>
    </div>
  )
}

// ─── PipelineClient ───────────────────────────────────────────────────────────

export function PipelineClient({
  rows,
  chartData,
  quarterChartData,
  repChartData,
  repQuarterChartData,
  chartReps,
  annualTeamTarget,
  quarterlyTeamTarget,
  monthlyTeamTarget,
  repTargetCards,
}: {
  rows: PipelineRow[]
  chartData: ChartDataPoint[]
  quarterChartData: ChartDataPoint[]
  repChartData: Record<string, ChartDataPoint[]>
  repQuarterChartData: Record<string, ChartDataPoint[]>
  chartReps: { id: string; name: string }[]
  annualTeamTarget: number | null
  quarterlyTeamTarget: number | null
  monthlyTeamTarget: number | null
  repTargetCards: RepTargetCard[]
}) {
  const [liveRows, setLiveRows] = useState<PipelineRow[]>(rows)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // List filters
  const [search, setSearch]                               = useState('')
  const [filterRep, setFilterRep]                         = useState('all')
  const [filterStage, setFilterStage]                     = useState('all')
  const [filterJobType, setFilterJobType]                 = useState('all')
  const [filterProductCategory, setFilterProductCategory] = useState('all')
  const [filterLeadSource, setFilterLeadSource]           = useState('all')
  const [filterDateRange, setFilterDateRange]             = useState('all')
  const [sort, setSort]                                   = useState('value')

  // Target period toggle (independent of charts)
  const [targetPeriod, setTargetPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly')

  // Shared chart rep filter (drives both snapshot + trend)
  const [chartRep, setChartRep] = useState('all')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSelectedId(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function patchRow(id: string, patch: Partial<PipelineRow>) {
    setLiveRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))
  }

  // Rows filtered by chart rep for the funnel snapshot
  const funnelRows = useMemo(() =>
    chartRep === 'all' ? liveRows : liveRows.filter((r) => r.repId === chartRep),
    [liveRows, chartRep]
  )

  // ── Filter option lists ────────────────────────────────────────────────────

  const repOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of liveRows) if (r.repId && r.repName) seen.set(r.repId, r.repName)
    const sorted = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
    return [{ value: 'all', label: 'All Reps' }, ...sorted.map(([id, name]) => ({ value: id, label: name }))]
  }, [liveRows])

  const stageOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const r of liveRows) if (r.stage) seen.add(r.stage)
    return [
      { value: 'all', label: 'All Stages' },
      ...STAGE_ORDER.filter((s) => seen.has(s)).map((s) => ({ value: s, label: STAGE_META[s]?.label ?? s })),
    ]
  }, [liveRows])

  const jobTypeOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const r of liveRows) if (r.jobType) seen.add(r.jobType)
    return [{ value: 'all', label: 'All Job Types' }, ...Array.from(seen).map((jt) => ({ value: jt, label: JOB_TYPE_LABEL[jt] ?? jt }))]
  }, [liveRows])

  const productCategoryOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const r of liveRows) if (r.productCategory) seen.add(r.productCategory)
    return [{ value: 'all', label: 'All Categories' }, ...Array.from(seen).map((pc) => ({ value: pc, label: PRODUCT_CATEGORY_LABEL[pc] ?? pc }))]
  }, [liveRows])

  const leadSourceOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const r of liveRows) if (r.leadSource) seen.add(r.leadSource)
    return [{ value: 'all', label: 'All Sources' }, ...Array.from(seen).map((ls) => ({ value: ls, label: LEAD_SOURCE_LABEL[ls] ?? ls }))]
  }, [liveRows])

  // ── Filter + sort ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const result = liveRows.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q) && !r.company.toLowerCase().includes(q)) return false
      if (filterRep !== 'all' && r.repId !== filterRep) return false
      if (filterStage !== 'all' && r.stage !== filterStage) return false
      if (filterJobType !== 'all' && r.jobType !== filterJobType) return false
      if (filterProductCategory !== 'all' && r.productCategory !== filterProductCategory) return false
      if (filterLeadSource !== 'all' && r.leadSource !== filterLeadSource) return false
      if (!inDateRange(r.createdAtMs, filterDateRange)) return false
      return true
    })

    return result.sort((a, b) => {
      switch (sort) {
        case 'value':     return (b.estimatedRevenue ?? 0) - (a.estimatedRevenue ?? 0)
        case 'stage':     return STAGE_ORDER.indexOf(a.stage ?? '') - STAGE_ORDER.indexOf(b.stage ?? '')
        case 'pipeline':  return b.daysInPipeline - a.daysInPipeline
        case 'stage_age': return b.daysInStage - a.daysInStage
        case 'rep':       return (a.repName ?? '').localeCompare(b.repName ?? '')
        case 'company':   return a.company.localeCompare(b.company)
        case 'updated':   return b.updatedAtMs - a.updatedAtMs
        default:          return 0
      }
    })
  }, [liveRows, search, filterRep, filterStage, filterJobType, filterProductCategory, filterLeadSource, filterDateRange, sort])

  // ── Derived totals ─────────────────────────────────────────────────────────

  const allTotal             = liveRows.reduce((s, r) => s + (r.estimatedRevenue ?? 0), 0)
  const currentWeightedTotal = liveRows.reduce((s, r) => s + (r.weightedValue ?? 0), 0)
  const filteredTotal        = filtered.reduce((s, r) => s + (r.estimatedRevenue ?? 0), 0)
  const filteredWeighted     = filtered.reduce((s, r) => s + (r.weightedValue ?? 0), 0)
  const thisMonthLabel       = new Date().toLocaleDateString('en-US', { month: 'short' })

  const stageSummary = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>()
    for (const r of filtered) {
      const key = r.stage ?? 'UNKNOWN'
      const cur = map.get(key) ?? { count: 0, value: 0 }
      map.set(key, { count: cur.count + 1, value: cur.value + (r.estimatedRevenue ?? 0) })
    }
    return STAGE_ORDER.filter((s) => map.has(s)).map((s) => ({
      stage: s,
      count: map.get(s)!.count,
      value: map.get(s)!.value,
      meta:  STAGE_META[s] ?? { label: s, color: '#94a3b8' },
    }))
  }, [filtered])

  const anyFilter = search !== '' || filterRep !== 'all' || filterStage !== 'all' ||
    filterJobType !== 'all' || filterProductCategory !== 'all' ||
    filterLeadSource !== 'all' || filterDateRange !== 'all'

  function clearFilters() {
    setSearch(''); setFilterRep('all'); setFilterStage('all')
    setFilterJobType('all'); setFilterProductCategory('all')
    setFilterLeadSource('all'); setFilterDateRange('all')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Pipeline</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>
          {liveRows.length} open {liveRows.length === 1 ? 'opportunity' : 'opportunities'} · {fmt$(allTotal)} unweighted pipeline
        </p>
      </div>

      {/* Target KPI cards with period toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>
            Targets
          </span>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bg4)' }}>
            {([
              ['monthly',   'Monthly'],
              ['quarterly', 'Quarterly'],
              ['annual',    'Annual'],
            ] as const).map(([p, label]) => (
              <button
                key={p}
                onClick={() => setTargetPeriod(p)}
                style={{
                  padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: targetPeriod === p ? 'var(--cobalt)' : 'var(--bg3)',
                  color: targetPeriod === p ? '#fff' : 'var(--text3)',
                  transition: 'background 0.1s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <KpiCard
            label={
              targetPeriod === 'monthly'   ? `Team — ${thisMonthLabel}` :
              targetPeriod === 'quarterly' ? 'Team — This Quarter' :
                                            'Team — This Year'
            }
            value={currentWeightedTotal}
            target={
              targetPeriod === 'monthly'   ? monthlyTeamTarget :
              targetPeriod === 'quarterly' ? quarterlyTeamTarget :
                                            annualTeamTarget
            }
          />
          {repTargetCards.map((rt) => (
            <KpiCard
              key={rt.repId}
              label={
                targetPeriod === 'monthly'   ? `${rt.repName} — ${thisMonthLabel}` :
                targetPeriod === 'quarterly' ? `${rt.repName} — This Quarter` :
                                              `${rt.repName} — This Year`
              }
              value={rt.weighted}
              target={
                targetPeriod === 'monthly'   ? rt.monthly :
                targetPeriod === 'quarterly' ? rt.quarterly :
                                              rt.annual
              }
            />
          ))}
        </div>
      </div>

      {/* Side-by-side charts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Shared rep filter */}
        {chartReps.length > 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Rep:</span>
            <select
              value={chartRep}
              onChange={(e) => setChartRep(e.target.value)}
              style={{
                fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--bg4)',
                borderRadius: 6, color: 'var(--text)', padding: '3px 8px', cursor: 'pointer',
              }}
            >
              {chartReps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: '16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--bg4)', minHeight: 280 }}>
            <PipelineFunnelSnapshot rows={funnelRows} />
          </div>
          <div style={{ padding: '16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--bg4)', minHeight: 280 }}>
            <PipelineTrendChart
              chartData={chartData}
              quarterChartData={quarterChartData}
              repChartData={repChartData}
              repQuarterChartData={repQuarterChartData}
              chartRep={chartRep}
              monthlyTeamTarget={monthlyTeamTarget}
              quarterlyTeamTarget={quarterlyTeamTarget}
            />
          </div>
        </div>
      </div>

      {/* Stage summary bar */}
      {stageSummary.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {stageSummary.map(({ stage, count, value, meta }) => (
            <button
              key={stage}
              onClick={() => setFilterStage(filterStage === stage ? 'all' : stage)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                padding: '6px 12px', borderRadius: 8,
                border: `1px solid ${filterStage === stage ? meta.color : 'var(--bg4)'}`,
                background: filterStage === stage ? `${meta.color}1a` : 'var(--bg2)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.1s, background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{meta.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 14 }}>
                {count} · {fmt$(value)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <SelectControl label="Rep"              value={filterRep}             onChange={setFilterRep}             options={repOptions} />
          <SelectControl label="Stage"            value={filterStage}           onChange={setFilterStage}           options={stageOptions} />
          <SelectControl label="Job Type"         value={filterJobType}         onChange={setFilterJobType}         options={jobTypeOptions} />
          <SelectControl label="Product Category" value={filterProductCategory} onChange={setFilterProductCategory} options={productCategoryOptions} />
          <SelectControl label="Lead Source"      value={filterLeadSource}      onChange={setFilterLeadSource}      options={leadSourceOptions} />
          <SelectControl label="Created"          value={filterDateRange}       onChange={setFilterDateRange}       options={DATE_RANGE_OPTIONS} />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>Search</label>
            <input
              type="text"
              placeholder="Opportunity or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--bg4)', borderRadius: 6, color: 'var(--text)', padding: '5px 10px', outline: 'none' }}
            />
          </div>
          <SelectControl label="Sort by" value={sort} onChange={setSort} options={SORT_OPTIONS} />
          {anyFilter && (
            <button
              onClick={clearFilters}
              style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', padding: '5px 0', background: 'none', border: 'none', textDecoration: 'underline', alignSelf: 'flex-end' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
          {filtered.length} {filtered.length === 1 ? 'opportunity' : 'opportunities'}{anyFilter ? ' matching filters' : ''}
        </p>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <span style={{ color: 'var(--text3)' }}>Est. value: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt$(filteredTotal)}</span></span>
          <span style={{ color: 'var(--text3)' }}>Weighted: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt$(filteredWeighted)}</span></span>
        </div>
      </div>

      {/* Opportunity list */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          No opportunities match the current filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0 12px', padding: '6px 14px', borderRadius: 6, background: 'var(--bg2)', border: '1px solid transparent' }}>
            {COL_HEADERS.map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)' }}>{h}</span>
            ))}
          </div>
          {filtered.map((row) => <OppRow key={row.id} row={row} onSelect={() => setSelectedId(row.id)} />)}
        </div>
      )}

      <OppDrawer oppId={selectedId} onClose={() => setSelectedId(null)} onRowPatch={patchRow} />
    </div>
  )
}
