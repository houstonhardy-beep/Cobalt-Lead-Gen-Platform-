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

// SVG coordinate system. x scales with container width (preserveAspectRatio none),
// y stays pixel-exact so HTML label positions match.
const VB_W      = 400           // viewBox width (virtual units)
const VB_CX     = VB_W / 2     // horizontal centre
const MAX_HALF  = 175           // half-width of widest trapezoid (viewBox units)
const MIN_HALF  = 18            // half-width of narrowest
const STAGE_H   = 33            // trapezoid height in px (1:1 with viewBox y)
const GAP       = 3             // gap between trapezoids in px

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

  const stages = FUNNEL_STAGE_ORDER
    .filter((s) => stageMap.has(s))
    .map((s) => ({ stage: s, ...stageMap.get(s)! }))

  const totalValue = stages.reduce((sum, s) => sum + s.value, 0)
  const maxValue   = stages.length ? Math.max(...stages.map((s) => s.value)) : 1

  function halfWidth(value: number): number {
    return MIN_HALF + (MAX_HALF - MIN_HALF) * (value / maxValue)
  }

  // SVG height in pixels (y is pixel-exact due to preserveAspectRatio="none")
  const svgH = stages.length * STAGE_H + Math.max(0, stages.length - 1) * GAP

  const tooltipStage = tooltip ? stages.find((s) => s.stage === tooltip.stage) : null
  const tooltipMeta  = tooltipStage ? (STAGE_META[tooltipStage.stage] ?? { label: tooltipStage.stage, color: '#94a3b8' }) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: '0 0 14px' }}>
        Pipeline Funnel
      </p>

      {stages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No open opportunities
        </div>
      ) : (
        /* Wrapper fixes pixel height so HTML labels align with SVG y coords */
        <div style={{ position: 'relative', height: svgH, flexShrink: 0 }}>

          {/* SVG — draws trapezoid polygons only, no text */}
          <svg
            viewBox={`0 0 ${VB_W} ${svgH}`}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            style={{ display: 'block' }}
          >
            {stages.map((s, i) => {
              const meta    = STAGE_META[s.stage] ?? { label: s.stage, color: '#94a3b8' }
              const topHalf = halfWidth(s.value)
              const botHalf = i < stages.length - 1 ? halfWidth(stages[i + 1].value) : topHalf * 0.55
              const y       = i * (STAGE_H + GAP)
              const isHov   = tooltip?.stage === s.stage

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
                  opacity={isHov ? 1 : 0.72}
                  style={{ transition: 'opacity 0.14s', cursor: 'default' }}
                  onMouseEnter={(e) => setTooltip({ stage: s.stage, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </svg>

          {/* HTML labels — y coordinate is in CSS pixels (matches SVG since y-scale = 1:1) */}
          {stages.map((s, i) => {
            const meta = STAGE_META[s.stage] ?? { label: s.stage, color: '#94a3b8' }
            const pct  = totalValue > 0 ? Math.round((s.value / totalValue) * 100) : 0
            const y    = i * (STAGE_H + GAP)

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
                <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                  {meta.label} · {s.count} {s.count === 1 ? 'opp' : 'opps'}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' }}>
                  {fmt$(s.value)} ({pct}%)
                </div>
              </div>
            )
          })}
        </div>
      )}

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
      {tooltip && tooltipStage && tooltipMeta && (() => {
        const pct = totalValue > 0 ? Math.round((tooltipStage.value / totalValue) * 100) : 0
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
              ['Opportunities', `${tooltipStage.count}`],
              ['Est. Value',    fmt$(tooltipStage.value)],
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
