'use client'

import type { PipelineRow } from './PipelineClient'
import { CHART_STAGE_ORDER } from './constants'

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
  NURTURE:       { label: 'Nurture',       color: '#64748b' },
}

const FUNNEL_STAGES = new Set<string>(CHART_STAGE_ORDER)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

// ─── PipelineFunnelSnapshot ───────────────────────────────────────────────────

interface Props {
  rows: PipelineRow[]
}

export function PipelineFunnelSnapshot({ rows }: Props) {
  const stageMap = new Map<string, { count: number; value: number }>()
  for (const r of rows) {
    if (!r.stage || !FUNNEL_STAGES.has(r.stage)) continue
    const cur = stageMap.get(r.stage) ?? { count: 0, value: 0 }
    stageMap.set(r.stage, { count: cur.count + 1, value: cur.value + (r.estimatedRevenue ?? 0) })
  }

  const stages = CHART_STAGE_ORDER
    .filter((s) => stageMap.has(s))
    .map((s) => ({ stage: s, ...stageMap.get(s)! }))

  const maxValue = Math.max(...stages.map((s) => s.value), 1)

  const totalValue = rows.reduce((s, r) => s + (r.estimatedRevenue ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: '0 0 14px' }}>
        Pipeline Snapshot
      </p>

      {stages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No open opportunities
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {stages.map(({ stage, count, value }) => {
            const meta   = STAGE_META[stage] ?? { label: stage, color: '#94a3b8' }
            const barPct = Math.round((value / maxValue) * 100)
            return (
              <div key={stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: meta.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{meta.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{count} {count === 1 ? 'opp' : 'opps'}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt$(value)}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: meta.color, borderRadius: 3, opacity: 0.75 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--bg4)', display: 'flex', gap: 16, fontSize: 12 }}>
        <span style={{ color: 'var(--text3)' }}>
          Total: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{rows.length} {rows.length === 1 ? 'opp' : 'opps'}</span>
        </span>
        <span style={{ color: 'var(--text3)' }}>
          Est. value: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt$(totalValue)}</span>
        </span>
      </div>
    </div>
  )
}
