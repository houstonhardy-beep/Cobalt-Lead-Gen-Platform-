'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversionStage {
  stage: string
  entered: number
  avgDays: number | null
  conversionRate: number | null
  isBiggestDropOff?: boolean
  isFastest?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  SIGNAL:        'Signal',
  PROSPECT:      'Prospect',
  OUTREACH_SENT: 'Outreach Sent',
  ENGAGED:       'Engaged',
  QUALIFIED:     'Qualified',
  PROPOSAL:      'Proposal',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATION:   'Negotiation',
  CLOSED_WON:    'Closed Won',
}

const STAGE_COLOR: Record<string, string> = {
  SIGNAL:        '#2dd4bf',
  PROSPECT:      '#94a3b8',
  OUTREACH_SENT: '#60a5fa',
  ENGAGED:       '#818cf8',
  QUALIFIED:     '#fbbf24',
  PROPOSAL:      '#fb923c',
  PROPOSAL_SENT: '#ea580c',
  NEGOTIATION:   '#a78bfa',
  CLOSED_WON:    '#34d399',
}

// ─── ConversionFunnel ─────────────────────────────────────────────────────────

export function ConversionFunnel({ data }: { data: ConversionStage[] }) {
  if (!data.length) return null

  const maxEntered = Math.max(...data.map((d) => d.entered), 1)

  return (
    <div style={{ padding: '16px 16px 12px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--bg4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: 0 }}>
          Stage Conversion — Last 12 Months
        </p>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f87171', display: 'inline-block' }} />
            <span style={{ color: 'var(--text3)' }}>Biggest drop-off</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#34d399', display: 'inline-block' }} />
            <span style={{ color: 'var(--text3)' }}>Fastest moving</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {data.map((s, i) => {
          const color     = STAGE_COLOR[s.stage] ?? '#94a3b8'
          const barWidth  = maxEntered > 0 ? Math.round((s.entered / maxEntered) * 100) : 0
          const isLast    = i === data.length - 1

          return (
            <div key={s.stage}>
              {/* Stage row */}
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 60px 80px', gap: '0 12px', alignItems: 'center', padding: '6px 0' }}>
                {/* Stage name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {STAGE_LABEL[s.stage] ?? s.stage}
                  </span>
                </div>

                {/* Volume bar */}
                <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      borderRadius: 4,
                      background: color,
                      opacity: 0.7,
                    }} />
                  </div>
                  <span style={{
                    position: 'absolute',
                    left: `${barWidth}%`,
                    paddingLeft: 8,
                    fontSize: 11,
                    color: 'var(--text3)',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.entered} {s.entered === 1 ? 'opp' : 'opps'}
                  </span>
                </div>

                {/* Avg days */}
                <div style={{ textAlign: 'right' }}>
                  {s.avgDays !== null ? (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: s.isFastest ? '#34d399' : 'var(--text2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {s.avgDays}d avg
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                  )}
                </div>

                {/* Conversion to next */}
                <div style={{ textAlign: 'right' }}>
                  {s.conversionRate !== null ? (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: s.isBiggestDropOff ? '#f87171' : s.conversionRate >= 50 ? '#34d399' : 'var(--text2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {s.conversionRate}% →
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                  )}
                </div>
              </div>

              {/* Drop-off callout between stages */}
              {!isLast && s.conversionRate !== null && s.isBiggestDropOff && (
                <div style={{
                  marginLeft: 20,
                  padding: '3px 10px',
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#f87171',
                  marginBottom: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span>▼</span>
                  <span>Biggest drop-off — {100 - s.conversionRate}% of deals lost here</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary row */}
      {data[0] && data[data.length - 1] && data[0].entered > 0 && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'var(--bg3)',
          borderRadius: 6,
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Signal → Closed Won: </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              {Math.round((data[data.length - 1].entered / data[0].entered) * 100)}%
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}> overall conversion</span>
          </div>
          {data.some((s) => s.avgDays !== null) && (
            <div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Avg total cycle: </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                {data.reduce((s, d) => s + (d.avgDays ?? 0), 0)}d
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
