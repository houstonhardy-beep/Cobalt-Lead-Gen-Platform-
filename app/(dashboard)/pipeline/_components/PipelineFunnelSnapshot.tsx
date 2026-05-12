'use client'

import { useState } from 'react'
import type { PipelineRow } from './PipelineClient'

// ─── Constants ────────────────────────────────────────────────────────────────

const FUNNEL_STAGE_ORDER = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED',
  'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION',
] as const

const STAGE_META: Record<string, { label: string; color: string }> = {
  SIGNAL:        { label: 'Signal',        color: '#2dd4bf' },
  PROSPECT:      { label: 'Prospect',      color: '#94a3b8' },
  OUTREACH_SENT: { label: 'Outreach Sent', color: '#60a5fa' },
  ENGAGED:       { label: 'Engaged',       color: '#818cf8' },
  QUALIFIED:     { label: 'Qualified',     color: '#fbbf24' },
  PROPOSAL:      { label: 'Proposal',      color: '#fb923c' },
  PROPOSAL_SENT: { label: 'Proposal Sent', color: '#ea580c' },
  NEGOTIATION:   { label: 'Negotiation',   color: '#a78bfa' },
}

const FUNNEL_STAGES = new Set<string>(FUNNEL_STAGE_ORDER)

// Fixed half-width fractions for each stage edge, top to bottom.
// Index 0 = top of stage 1 (widest), index 8 = bottom of stage 8 (narrowest).
// Guarantees a clean narrowing funnel regardless of dollar values.
const EDGE_WIDTHS = [1.0, 0.88, 0.76, 0.64, 0.52, 0.42, 0.34, 0.28, 0.20]

// SVG layout constants. x scales with container width (preserveAspectRatio="none"),
// y is pixel-exact so HTML label positions match without calculation.
const VB_W    = 400
const VB_CX   = VB_W / 2
const MAX_HALF = 178   // half-width of widest stage in viewBox units
const STAGE_H  = 27   // trapezoid height in px (1:1 with viewBox y)
const GAP      = 3    // gap between trapezoids in px

// Fixed SVG height: always 8 stages
const SVG_H = FUNNEL_STAGE_ORDER.length * STAGE_H + (FUNNEL_STAGE_ORDER.length - 1) * GAP

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

// ─── PipelineFunnelSnapshot ───────────────────────────────────────────────────

interface TooltipState { stage: string; x: number; y: number }

export function PipelineFunnelSnapshot({ rows }: { rows: PipelineRow[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Aggregate by stage
  const stageMap = new Map<string, { count: number; value: number }>()
  for (const r of rows) {
    if (!r.stage || !FUNNEL_STAGES.has(r.stage)) continue
    const cur = stageMap.get(r.stage) ?? { count: 0, value: 0 }
    stageMap.set(r.stage, { count: cur.count + 1, value: cur.value + (r.estimatedRevenue ?? 0) })
  }

  // Always show every stage in order, using 0 for missing stages
  const stages = FUNNEL_STAGE_ORDER.map((s) => ({
    stage: s,
    ...(stageMap.get(s) ?? { count: 0, value: 0 }),
  }))

  const totalValue = stages.reduce((sum, s) => sum + s.value, 0)

  const tooltipData = tooltip ? stages.find((s) => s.stage === tooltip.stage) ?? null : null
  const tooltipMeta = tooltipData ? (STAGE_META[tooltipData.stage] ?? { label: tooltipData.stage, color: '#94a3b8' }) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: '0 0 14px' }}>
        Pipeline Funnel
      </p>

      {/* Funnel — always renders all 8 stages */}
      <div style={{ position: 'relative', height: SVG_H, flexShrink: 0 }}>

        {/* SVG draws only polygon shapes; x scales with container, y is pixel-exact */}
        <svg
          viewBox={`0 0 ${VB_W} ${SVG_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          {stages.map((s, i) => {
            const meta    = STAGE_META[s.stage] ?? { label: s.stage, color: '#94a3b8' }
            const topHalf = MAX_HALF * (EDGE_WIDTHS[i]     ?? 0.20)
            const botHalf = MAX_HALF * (EDGE_WIDTHS[i + 1] ?? 0.15)
            const y       = i * (STAGE_H + GAP)
            const isHov   = tooltip?.stage === s.stage
            const isEmpty = s.count === 0

            return (
              <polygon
                key={s.stage}
                points={[
                  `${VB_CX - topHalf},${y}`,
                  `${VB_CX + topHalf},${y}`,
                  `${VB_CX + botHalf},${y + STAGE_H}`,
                  `${VB_CX - botHalf},${y + STAGE_H}`,
                ].join(' ')}
                fill={meta.color}
                opacity={isEmpty ? 0.22 : isHov ? 1 : 0.72}
                style={{ transition: 'opacity 0.14s', cursor: 'default' }}
                onMouseEnter={(e) => setTooltip({ stage: s.stage, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </svg>

        {/* HTML labels — positioned in CSS pixels; y aligns 1:1 with SVG y */}
        {stages.map((s, i) => {
          const meta   = STAGE_META[s.stage] ?? { label: s.stage, color: '#94a3b8' }
          const pct    = totalValue > 0 ? Math.round((s.value / totalValue) * 100) : 0
          const y      = i * (STAGE_H + GAP)
          const isEmpty = s.count === 0

          return (
            <div
              key={s.stage}
              style={{
                position: 'absolute',
                left: '50%',
                top: y + STAGE_H / 2,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                textAlign: 'center',
                lineHeight: 1.25,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: isEmpty ? 'rgba(255,255,255,0.45)' : '#fff', whiteSpace: 'nowrap' }}>
                {meta.label} · {s.count} {s.count === 1 ? 'opp' : 'opps'}
              </div>
              {!isEmpty && (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' }}>
                  {fmt$(s.value)} ({pct}%)
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--bg4)', display: 'flex', gap: 20, fontSize: 12, flexShrink: 0 }}>
        <span style={{ color: 'var(--text3)' }}>
          Open: <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            {stages.reduce((n, s) => n + s.count, 0)} opps
          </span>
        </span>
        <span style={{ color: 'var(--text3)' }}>
          Pipeline: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt$(totalValue)}</span>
        </span>
      </div>

      {/* Tooltip — fixed position tracks mouse */}
      {tooltip && tooltipData && tooltipMeta && (() => {
        const pct = totalValue > 0 ? Math.round((tooltipData.value / totalValue) * 100) : 0
        return (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x + 16,
              top: tooltip.y - 8,
              zIndex: 100,
              background: '#1e2433',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              pointerEvents: 'none',
              minWidth: 164,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: tooltipMeta.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{tooltipMeta.label}</span>
            </div>
            {[
              ['Opportunities', `${tooltipData.count}`],
              ['Est. Value',    fmt$(tooltipData.value)],
              ['% of pipeline', `${pct}%`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
                <span style={{ color: '#94a3b8' }}>{label}</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
