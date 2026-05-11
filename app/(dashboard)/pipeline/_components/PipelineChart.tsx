'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const stageRows = payload
    .filter((p) => p.name !== 'trend' && p.value > 0)
    .reverse() // top of stack first in tooltip
  const total = stageRows.reduce((s, p) => s + p.value, 0)

  return (
    <div style={{
      background: '#1e2433',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      minWidth: 180,
    }}>
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

// ─── PipelineChart ────────────────────────────────────────────────────────────

interface Props {
  data: ChartDataPoint[]
  activeStages: string[] // stages that have at least one non-zero month
}

export function PipelineChart({ data, activeStages }: Props) {
  // Flatten stages into Recharts data format
  const chartData = data.map((d) => ({
    monthLabel: d.monthLabel,
    total: d.total,
    trend: Math.round(d.trend),
    ...Object.fromEntries(activeStages.map((s) => [s, d.stages[s] ?? 0])),
  }))

  const orderedStages = CHART_STAGE_ORDER.filter((s) => activeStages.includes(s))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt$}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

        {orderedStages.map((stage) => (
          <Bar
            key={stage}
            dataKey={stage}
            stackId="stack"
            fill={STAGE_META[stage]?.color ?? '#94a3b8'}
            isAnimationActive={false}
          />
        ))}

        <Line
          dataKey="trend"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
