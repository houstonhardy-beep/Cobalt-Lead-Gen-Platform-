'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  monthLabel: string
  monthKey: string
  total: number
  trend: number
  stages: Record<string, number>
}

// ─── Constants ────────────────────────────────────────────────────────────────

import { CHART_STAGE_ORDER } from './constants'
export { CHART_STAGE_ORDER }

const STAGE_META: Record<string, { label: string; color: string }> = {
  SIGNAL:        { label: 'Signal',        color: '#2dd4bf' },
  PROSPECT:      { label: 'Prospect',      color: '#94a3b8' },
  OUTREACH_SENT: { label: 'Outreach Sent', color: '#60a5fa' },
  ENGAGED:       { label: 'Engaged',       color: '#818cf8' },
  QUALIFIED:     { label: 'Qualified',     color: '#fbbf24' },
  PROPOSAL:      { label: 'Proposal',      color: '#fb923c' },
  PROPOSAL_SENT: { label: 'Proposal Sent', color: '#ea580c' },
  NEGOTIATION:   { label: 'Negotiation',   color: '#a78bfa' },
  NURTURE:       { label: 'Nurture',       color: '#64748b' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function TotalTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const stageRows = payload.filter((p) => p.name !== 'trend' && p.value > 0).reverse()
  const total = stageRows.reduce((s, p) => s + p.value, 0)
  return (
    <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, minWidth: 180 }}>
      <p style={{ color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {stageRows.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: '#cbd5e1' }}>{STAGE_META[p.name]?.label ?? p.name}</span>
          </div>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{fmt$(p.value)}</span>
        </div>
      ))}
      {stageRows.length > 1 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#94a3b8' }}>Total</span>
          <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{fmt$(total)}</span>
        </div>
      )}
    </div>
  )
}

function StageTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{fmt$(payload[0].value)}</span>
    </div>
  )
}

// ─── PipelineTrendChart ───────────────────────────────────────────────────────

interface Props {
  chartData: ChartDataPoint[]
  quarterChartData: ChartDataPoint[]
  repChartData: Record<string, ChartDataPoint[]>
  repQuarterChartData: Record<string, ChartDataPoint[]>
  chartRep: string
  monthlyTeamTarget: number | null
  quarterlyTeamTarget: number | null
}

export function PipelineTrendChart({
  chartData, quarterChartData,
  repChartData, repQuarterChartData,
  chartRep, monthlyTeamTarget, quarterlyTeamTarget,
}: Props) {
  const [mode, setMode]             = useState<'total' | 'byStage'>('total')
  const [period, setPeriod]         = useState<'monthly' | 'quarterly'>('monthly')
  const [selectedStage, setSelectedStage] = useState<string>(CHART_STAGE_ORDER[0])

  const data = useMemo(() => {
    if (period === 'quarterly') return chartRep !== 'all' ? (repQuarterChartData[chartRep] ?? quarterChartData) : quarterChartData
    return chartRep !== 'all' ? (repChartData[chartRep] ?? chartData) : chartData
  }, [period, chartRep, chartData, quarterChartData, repChartData, repQuarterChartData])

  const activeStages = useMemo(() =>
    CHART_STAGE_ORDER.filter((s) => data.some((d) => (d.stages[s] ?? 0) > 0)),
    [data]
  )

  const orderedStages = useMemo(() =>
    CHART_STAGE_ORDER.filter((s) => activeStages.includes(s)),
    [activeStages]
  )

  const target = period === 'quarterly' ? quarterlyTeamTarget : monthlyTeamTarget

  const totalChartData = useMemo(() =>
    data.map((d) => ({
      label: d.monthLabel,
      trend: Math.round(d.trend),
      ...Object.fromEntries(activeStages.map((s) => [s, d.stages[s] ?? 0])),
    })),
    [data, activeStages]
  )

  const stageChartData = useMemo(() =>
    data.map((d) => ({ label: d.monthLabel, value: d.stages[selectedStage] ?? 0 })),
    [data, selectedStage]
  )

  const stageMeta = STAGE_META[selectedStage] ?? { label: selectedStage, color: '#94a3b8' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: 0 }}>
          Pipeline Trend
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bg4)' }}>
            {(['total', 'byStage'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '3px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: mode === m ? 'var(--cobalt)' : 'var(--bg3)',
                color: mode === m ? '#fff' : 'var(--text3)',
              }}>
                {m === 'total' ? 'Total' : 'By Stage'}
              </button>
            ))}
          </div>
          {/* Period toggle */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bg4)' }}>
            {(['monthly', 'quarterly'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '3px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: period === p ? 'var(--cobalt)' : 'var(--bg3)',
                color: period === p ? '#fff' : 'var(--text3)',
              }}>
                {p === 'monthly' ? 'Mo' : 'Qtr'}
              </button>
            ))}
          </div>
          {/* Stage selector for By Stage mode */}
          {mode === 'byStage' && (
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              style={{ fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--bg4)', borderRadius: 6, color: 'var(--text)', padding: '3px 7px', cursor: 'pointer' }}
            >
              {CHART_STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_META[s]?.label ?? s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Chart */}
      {mode === 'total' ? (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={totalChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt$} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<TotalTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            {orderedStages.map((stage) => (
              <Bar key={stage} dataKey={stage} stackId="stack" fill={STAGE_META[stage]?.color ?? '#94a3b8'} isAnimationActive={false} />
            ))}
            <Line dataKey="trend" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={false} isAnimationActive={false} />
            {target !== null && (
              <ReferenceLine
                y={target}
                stroke="#fbbf24"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: fmt$(target), fill: '#fbbf24', fontSize: 10, position: 'insideTopRight' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={stageChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt$} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<StageTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="value" fill={stageMeta.color} opacity={0.8} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {mode === 'total' && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          {orderedStages.map((s) => {
            const meta = STAGE_META[s] ?? { label: s, color: '#94a3b8' }
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: meta.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{meta.label}</span>
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
            <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Trend</span>
          </div>
          {target !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{period === 'monthly' ? 'Monthly' : 'Qtrly'} Target</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
