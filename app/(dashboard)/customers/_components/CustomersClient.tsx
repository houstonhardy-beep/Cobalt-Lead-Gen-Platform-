'use client'

import { useState, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpenOpp {
  id: string
  title: string
  stage: string | null
  estimatedRevenue: number | null
  weightedValue: number | null
  createdAtMs: number
}

export interface CustomerRow {
  id: string
  name: string
  hqCity: string | null
  hqState: string | null
  vertical: string | null
  contractValue: number | null
  renewalDateMs: number | null
  verkadaCustomer: boolean
  contact: string | null
  phone: string | null
  email: string | null
  locationCount: number
  openOpps: OpenOpp[]
  totalOppCount: number
  latestActivityMs: number | null
  needsAttention: boolean
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

const VERTICAL_LABEL: Record<string, string> = {
  EDUCATION:   'Education',
  GOVERNMENT:  'Government',
  COMMERCIAL:  'Commercial',
  HEALTHCARE:  'Healthcare',
  INDUSTRIAL:  'Industrial',
}

const PERIOD_LABEL: Record<string, string> = {
  '30':  'last 30 days',
  '60':  'last 60 days',
  '90':  'last 90 days',
  'ytd': 'year to date',
  'all': 'all time',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getPeriodStartMs(period: string): number {
  const now = Date.now()
  switch (period) {
    case '30':  return now - 30 * 86_400_000
    case '60':  return now - 60 * 86_400_000
    case '90':  return now - 90 * 86_400_000
    case 'ytd': return new Date(new Date().getFullYear(), 0, 1).getTime()
    default:    return 0
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SelectControl({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--bg4)',
          color: 'var(--text)',
          padding: '5px 8px',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {children}
      </select>
    </div>
  )
}

function Th({ children, right, title }: { children: ReactNode; right?: boolean; title?: string }) {
  return (
    <th
      title={title}
      style={{
        padding: '9px 14px',
        textAlign: right ? 'right' : 'left',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text3)',
        whiteSpace: 'nowrap',
        background: 'var(--bg2)',
      }}
    >
      {children}
    </th>
  )
}

function StagePills({ stageCounts }: { stageCounts: Record<string, number> }) {
  const active = STAGE_ORDER.filter((s) => stageCounts[s] > 0)
  if (active.length === 0) {
    return <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
  }
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {active.map((s) => {
        const meta = STAGE_META[s] ?? { label: s, color: '#94a3b8' }
        return (
          <span
            key={s}
            title={`${meta.label}: ${stageCounts[s]}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              background: meta.color + '1a',
              border: `1px solid ${meta.color}33`,
              color: meta.color,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: meta.color,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            {stageCounts[s]}
          </span>
        )
      })}
    </div>
  )
}

// ─── Customer drawer ──────────────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg4)' }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text3)',
          marginBottom: 10,
        }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 7 }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function CustomerDrawer({ row, onClose }: { row: CustomerRow; onClose: () => void }) {
  const totalPipeline = row.openOpps.reduce((s, o) => s + (o.estimatedRevenue ?? 0), 0)
  const totalWeighted = row.openOpps.reduce((s, o) => s + (o.weightedValue ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '18px 20px 16px',
          borderBottom: '1px solid var(--bg4)',
          flexShrink: 0,
        }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>
            {row.name}
          </p>
          {(row.hqCity || row.hqState) && (
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>
              {[row.hqCity, row.hqState].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--bg4)',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Account details */}
        <DrawerSection title="Account">
          {row.vertical && (
            <DrawerField label="Vertical">
              {VERTICAL_LABEL[row.vertical] ?? row.vertical}
            </DrawerField>
          )}
          <DrawerField label="Contract value">{fmt$(row.contractValue ?? 0)}</DrawerField>
          <DrawerField label="Renewal">{fmtDate(row.renewalDateMs)}</DrawerField>
          <DrawerField label="Locations">
            {row.locationCount > 0 ? row.locationCount : '—'}
          </DrawerField>
          {row.verkadaCustomer && (
            <DrawerField label="Platform">
              <span
                style={{
                  display: 'inline-block',
                  padding: '1px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'rgba(37,99,235,0.12)',
                  border: '1px solid rgba(37,99,235,0.25)',
                  color: '#60a5fa',
                }}
              >
                Verkada
              </span>
            </DrawerField>
          )}
        </DrawerSection>

        {/* Contact */}
        {(row.contact || row.phone || row.email) && (
          <DrawerSection title="Contact">
            {row.contact && <DrawerField label="Name">{row.contact}</DrawerField>}
            {row.phone   && <DrawerField label="Phone">{row.phone}</DrawerField>}
            {row.email   && (
              <DrawerField label="Email">
                <a
                  href={`mailto:${row.email}`}
                  style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 13 }}
                >
                  {row.email}
                </a>
              </DrawerField>
            )}
          </DrawerSection>
        )}

        {/* Pipeline summary */}
        <DrawerSection title={`Open Opportunities (${row.openOpps.length})`}>
          {row.openOpps.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No open opportunities.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {row.openOpps.map((o) => {
                  const meta = o.stage ? (STAGE_META[o.stage] ?? { label: o.stage, color: '#94a3b8' }) : null
                  return (
                    <div
                      key={o.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--bg3)',
                        border: '1px solid var(--bg4)',
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>
                        {o.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        {meta && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 500,
                              background: meta.color + '1a',
                              border: `1px solid ${meta.color}33`,
                              color: meta.color,
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
                            {meta.label}
                          </span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginLeft: 'auto' }}>
                          {fmt$(o.estimatedRevenue ?? 0)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pipeline totals */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--bg)',
                  border: '1px solid var(--bg4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Total pipeline</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmt$(totalPipeline)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Weighted</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{fmt$(totalWeighted)}</span>
                </div>
              </div>
            </>
          )}
        </DrawerSection>

        {/* All-time count */}
        <div style={{ padding: '12px 20px' }}>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            {row.totalOppCount} total {row.totalOppCount === 1 ? 'opportunity' : 'opportunities'} (all time)
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CustomersClient({
  rows,
  totalCount,
}: {
  rows: CustomerRow[]
  totalCount: number
}) {
  const [period, setPeriod]         = useState('all')
  const [sort, setSort]             = useState('pipeline')
  const [search, setSearch]         = useState('')
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Close drawer on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const displayRows = useMemo(() => {
    const startMs = getPeriodStartMs(period)
    const q = search.trim().toLowerCase()

    const withValues = rows
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .map((row) => {
        const periodOpps =
          period === 'all'
            ? row.openOpps
            : row.openOpps.filter((o) => o.createdAtMs >= startMs)

        const pipeline = periodOpps.reduce((s, o) => s + (o.estimatedRevenue ?? 0), 0)
        const weighted = periodOpps.reduce((s, o) => s + (o.weightedValue ?? 0), 0)

        // stageCounts always reflects all open opps — only pipeline/weighted are period-filtered
        const stageCounts: Record<string, number> = {}
        for (const o of row.openOpps) {
          if (o.stage) stageCounts[o.stage] = (stageCounts[o.stage] ?? 0) + 1
        }

        return { ...row, pipeline, weighted, stageCounts }
      })

    switch (sort) {
      case 'alpha':
        return [...withValues].sort((a, b) => a.name.localeCompare(b.name))
      case 'activity':
        return [...withValues].sort(
          (a, b) => (b.latestActivityMs ?? 0) - (a.latestActivityMs ?? 0),
        )
      case 'attention':
        return [...withValues].sort((a, b) => {
          if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1
          return b.pipeline - a.pipeline
        })
      default:
        return [...withValues].sort((a, b) => b.pipeline - a.pipeline)
    }
  }, [rows, period, sort, search])

  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null

  return (
    <>
      <div>
        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)', marginBottom: 4 }}>
            Customers
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            {totalCount} customer{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Controls bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <SelectControl label="Period" value={period} onChange={setPeriod}>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
            <option value="ytd">YTD</option>
            <option value="all">All Time</option>
          </SelectControl>

          <input
            type="search"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 140,
              maxWidth: 260,
              background: 'var(--bg2)',
              border: '1px solid var(--bg4)',
              color: 'var(--text)',
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 12,
            }}
          />

          <div style={{ marginLeft: 'auto' }}>
            <SelectControl label="Sort by" value={sort} onChange={setSort}>
              <option value="pipeline">Total Pipeline</option>
              <option value="alpha">Alphabetical</option>
              <option value="activity">Recent Activity</option>
              <option value="attention">Needs Attention</option>
            </SelectControl>
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--bg4)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {displayRows.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>No customers yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bg4)' }}>
                    <Th>Customer</Th>
                    <Th>HQ</Th>
                    <Th right>Locs</Th>
                    <Th right>Open</Th>
                    <Th right>Total</Th>
                    <Th right title={`Pipeline value of opportunities created in the ${PERIOD_LABEL[period]}`}>Pipeline *</Th>
                    <Th right title={`Weighted value of opportunities created in the ${PERIOD_LABEL[period]}`}>Weighted *</Th>
                    <Th>Stages</Th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const isHovered  = hoveredId === row.id
                    const isSelected = selectedId === row.id
                    return (
                      <tr
                        key={row.id}
                        onMouseEnter={() => setHoveredId(row.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{
                          borderBottom: '1px solid var(--bg4)',
                          background: isSelected
                            ? 'var(--bg3)'
                            : isHovered
                            ? 'var(--bg3)'
                            : 'transparent',
                          transition: 'background 0.1s',
                        }}
                      >
                        {/* Customer name */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {row.needsAttention && (
                              <span
                                title="Needs attention — no recent activity or stalled opportunity"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  flexShrink: 0,
                                  background: 'rgba(217,119,6,0.1)',
                                  border: '1px solid rgba(217,119,6,0.35)',
                                  color: '#d97706',
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                !
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                color: isSelected ? 'var(--brand)' : 'var(--text)',
                                fontWeight: 600,
                                fontSize: 13,
                                textAlign: 'left',
                              }}
                            >
                              {row.name}
                            </button>
                          </div>
                        </td>

                        {/* HQ */}
                        <td style={{ padding: '12px 14px', color: 'var(--text2)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {[row.hqCity, row.hqState].filter(Boolean).join(', ') || '—'}
                        </td>

                        {/* Locations */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text2)', verticalAlign: 'middle' }}>
                          {row.locationCount > 0 ? row.locationCount : '—'}
                        </td>

                        {/* Open count */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)', verticalAlign: 'middle' }}>
                          {row.openOpps.length}
                        </td>

                        {/* Total count */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text2)', verticalAlign: 'middle' }}>
                          {row.totalOppCount}
                        </td>

                        {/* Pipeline */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)', fontWeight: 500, verticalAlign: 'middle' }}>
                          {fmt$(row.pipeline)}
                        </td>

                        {/* Weighted */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text2)', verticalAlign: 'middle' }}>
                          {fmt$(row.weighted)}
                        </td>

                        {/* Stage pills */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <StagePills stageCounts={row.stageCounts} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Slide-over drawer ─────────────────────────────────────────────────── */}

      {/* Backdrop */}
      <div
        onClick={() => setSelectedId(null)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 50,
          opacity: selectedRow ? 1 : 0,
          pointerEvents: selectedRow ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          background: 'var(--bg2)',
          borderLeft: '1px solid var(--bg4)',
          zIndex: 51,
          transform: selectedRow ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {selectedRow && <CustomerDrawer row={selectedRow} onClose={() => setSelectedId(null)} />}
      </div>
    </>
  )
}
