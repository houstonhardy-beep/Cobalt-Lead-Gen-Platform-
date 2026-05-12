'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PipelineRow } from './PipelineClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StageHistoryEntry {
  id: string
  fromStage: string | null
  toStage: string
  changedAt: string
  daysInPreviousStage: number | null
  changedByName: string | null
}

interface ActivityEntry {
  id: string
  date: string
  action: string
  userName: string | null
}

interface OutreachEntry {
  id: string
  type: string
  subject: string | null
  content: string
  createdAt: string
  response: string
  userName: string | null
}

interface OppDetail {
  id: string
  title: string
  type: string
  jobType: string | null
  productCategory: string | null
  leadSource: string | null
  status: string
  stage: string | null
  estimatedRevenue: number | null
  weightedValue: number | null
  probabilityPercent: number | null
  jobSiteCity: string | null
  jobSiteState: string | null
  createdAt: string
  updatedAt: string
  company: string
  repName: string | null
  leadId: string | null
  daysInStage: number
  daysInPipeline: number
  stageHistory: StageHistoryEntry[]
  activities: ActivityEntry[]
  outreach: OutreachEntry[]
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

const OPEN_STAGES = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED',
  'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION',
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

const OUTREACH_TYPE_LABEL: Record<string, string> = {
  COLD_EMAIL: 'Email',
  COLD_CALL:  'Call',
  LINKEDIN:   'LinkedIn',
  FOLLOW_UP:  'Follow-up',
  POST_QUOTE: 'Post-Quote',
  CONTRACT:   'Contract',
  RFP_COVER:  'RFP Cover',
  SMS:        'SMS',
}

const ACTIVITY_TYPES = [
  { value: 'CALL',       label: 'Call' },
  { value: 'EMAIL',      label: 'Email' },
  { value: 'MEETING',    label: 'Meeting' },
  { value: 'SITE_VISIT', label: 'Site Visit' },
  { value: 'DEMO',       label: 'Demo' },
  { value: 'PROPOSAL',   label: 'Proposal' },
  { value: 'FOLLOW_UP',  label: 'Follow-up' },
  { value: 'NOTE',       label: 'Note' },
]

const ACTIVITY_COLOR: Record<string, string> = {
  CALL:       '#60a5fa',
  EMAIL:      '#818cf8',
  MEETING:    '#fbbf24',
  SITE_VISIT: '#2dd4bf',
  DEMO:       '#fb923c',
  PROPOSAL:   '#a78bfa',
  FOLLOW_UP:  '#94a3b8',
  NOTE:       '#64748b',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (n === null || n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseActivityType(action: string): { type: string; description: string } {
  const m = action.match(/^\[([A-Z_]+)\]\s?(.*)$/)
  if (m) return { type: m[1], description: m[2] }
  return { type: 'NOTE', description: action }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg4)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 12 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function StageBadge({ stage }: { stage: string | null }) {
  const meta = STAGE_META[stage ?? ''] ?? { label: stage ?? '—', color: '#94a3b8' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
      background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44`,
    }}>
      {meta.label}
    </span>
  )
}

// ─── OppDrawer ────────────────────────────────────────────────────────────────

interface Props {
  oppId: string | null
  onClose: () => void
  onRowPatch: (id: string, patch: Partial<PipelineRow>) => void
}

export function OppDrawer({ oppId, onClose, onRowPatch }: Props) {
  const [detail, setDetail]         = useState<OppDetail | null>(null)
  const [loading, setLoading]       = useState(false)
  const [stageChanging, setStageChanging] = useState(false)

  // Activity form state
  const [actType, setActType]       = useState('CALL')
  const [actDesc, setActDesc]       = useState('')
  const [actDate, setActDate]       = useState(todayIso())
  const [actSubmitting, setActSubmitting] = useState(false)
  const [actError, setActError]     = useState('')

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/opportunities/${id}`)
      if (res.ok) setDetail(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (oppId) {
      setDetail(null)
      setActDesc('')
      setActError('')
      fetchDetail(oppId)
    }
  }, [oppId, fetchDetail])

  async function handleStageChange(newStage: string) {
    if (!detail || newStage === detail.stage) return
    setStageChanging(true)
    try {
      const res = await fetch(`/api/opportunities/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (res.ok) {
        onRowPatch(detail.id, { stage: newStage, daysInStage: 0, needsAttention: false })
        await fetchDetail(detail.id)
      }
    } finally {
      setStageChanging(false)
    }
  }

  async function handleLogActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!detail || !actDesc.trim()) return
    setActSubmitting(true)
    setActError('')
    try {
      const res = await fetch(`/api/opportunities/${detail.id}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType: actType, description: actDesc.trim(), date: actDate }),
      })
      if (res.ok) {
        setActDesc('')
        setActDate(todayIso())
        await fetchDetail(detail.id)
      } else {
        const data = await res.json() as { error?: string }
        setActError(data.error ?? 'Failed to log activity')
      }
    } finally {
      setActSubmitting(false)
    }
  }

  const open = oppId !== null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 50,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
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
          width: 480,
          background: 'var(--bg2)',
          borderLeft: '1px solid var(--bg4)',
          zIndex: 51,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {open && (
          loading || !detail ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Loading…</p>
            </div>
          ) : (
            <DrawerBody
              detail={detail}
              stageChanging={stageChanging}
              actType={actType}
              actDesc={actDesc}
              actDate={actDate}
              actSubmitting={actSubmitting}
              actError={actError}
              onClose={onClose}
              onStageChange={handleStageChange}
              onActTypeChange={setActType}
              onActDescChange={setActDesc}
              onActDateChange={setActDate}
              onLogActivity={handleLogActivity}
            />
          )
        )}
      </div>
    </>
  )
}

// ─── DrawerBody ───────────────────────────────────────────────────────────────

interface DrawerBodyProps {
  detail: OppDetail
  stageChanging: boolean
  actType: string
  actDesc: string
  actDate: string
  actSubmitting: boolean
  actError: string
  onClose: () => void
  onStageChange: (stage: string) => void
  onActTypeChange: (v: string) => void
  onActDescChange: (v: string) => void
  onActDateChange: (v: string) => void
  onLogActivity: (e: React.FormEvent) => void
}

function DrawerBody({
  detail, stageChanging,
  actType, actDesc, actDate, actSubmitting, actError,
  onClose, onStageChange, onActTypeChange, onActDescChange, onActDateChange, onLogActivity,
}: DrawerBodyProps) {
  const needsAttention = detail.daysInStage > 45
  const [pendingStage, setPendingStage] = useState(detail.stage ?? '')
  const [stageSaved, setStageSaved]     = useState(false)
  const prevChanging = useRef(false)

  useEffect(() => { setPendingStage(detail.stage ?? '') }, [detail.stage])

  useEffect(() => {
    if (prevChanging.current && !stageChanging) {
      setStageSaved(true)
      const t = setTimeout(() => setStageSaved(false), 2500)
      return () => clearTimeout(t)
    }
    prevChanging.current = stageChanging
  }, [stageChanging])

  const sel: React.CSSProperties = {
    fontSize: 13,
    background: 'var(--bg3)',
    border: '1px solid var(--bg4)',
    borderRadius: 6,
    color: 'var(--text)',
    padding: '4px 8px',
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        padding: '18px 20px 16px', borderBottom: '1px solid var(--bg4)', flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 3 }}>
            {detail.title}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{detail.company}</p>
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--bg4)',
            background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Section 1: Overview ── */}
        <Section title="Overview">
          {/* Stage + inline selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StageBadge stage={detail.stage} />
              {needsAttention && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
                }}>
                  Needs Attention
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Move to:</span>
              <select
                value={pendingStage}
                onChange={(e) => { setPendingStage(e.target.value); setStageSaved(false) }}
                disabled={stageChanging}
                style={{ ...sel, opacity: stageChanging ? 0.6 : 1 }}
              >
                {OPEN_STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_META[s]?.label ?? s}</option>
                ))}
              </select>
              {pendingStage !== (detail.stage ?? '') && !stageChanging && (
                <button
                  onClick={() => onStageChange(pendingStage)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                    border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                  }}
                >
                  Update Stage
                </button>
              )}
              {stageSaved && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>✓ Saved</span>
              )}
            </div>
          </div>

          <Field label="Est. Value">{fmt$(detail.estimatedRevenue)}</Field>
          <Field label="Weighted">
            {fmt$(detail.weightedValue)}
            {detail.probabilityPercent !== null && (
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>({detail.probabilityPercent}%)</span>
            )}
          </Field>
          <Field label="Days in Stage">
            <span style={{ color: needsAttention ? '#fbbf24' : 'var(--text)' }}>{detail.daysInStage}d</span>
          </Field>
          <Field label="Days in Pipeline">{detail.daysInPipeline}d</Field>
          {detail.jobType        && <Field label="Job Type">{JOB_TYPE_LABEL[detail.jobType] ?? detail.jobType}</Field>}
          {detail.productCategory && <Field label="Product">{PRODUCT_CATEGORY_LABEL[detail.productCategory] ?? detail.productCategory}</Field>}
          {detail.leadSource     && <Field label="Lead Source">{LEAD_SOURCE_LABEL[detail.leadSource] ?? detail.leadSource}</Field>}
          {detail.repName        && <Field label="Rep">{detail.repName}</Field>}
          {(detail.jobSiteCity || detail.jobSiteState) && (
            <Field label="Job Site">{[detail.jobSiteCity, detail.jobSiteState].filter(Boolean).join(', ')}</Field>
          )}
          <Field label="Created">{fmtDate(detail.createdAt)}</Field>
          <Field label="Updated">{fmtDate(detail.updatedAt)}</Field>
        </Section>

        {/* ── Section 2: Stage History ── */}
        <Section title={`Stage History (${detail.stageHistory.length})`}>
          {detail.stageHistory.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No stage transitions recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {detail.stageHistory.map((s, i) => {
                const meta = STAGE_META[s.toStage] ?? { label: s.toStage, color: '#94a3b8' }
                const isLast = i === detail.stageHistory.length - 1
                return (
                  <div key={s.id} style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 10 }}>
                    {/* Timeline dot + line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0, marginTop: 3 }} />
                      {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--bg4)', marginTop: 4 }} />}
                    </div>
                    {/* Content */}
                    <div style={{ paddingBottom: isLast ? 0 : 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                        {s.fromStage && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            from {STAGE_META[s.fromStage]?.label ?? s.fromStage}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text3)', margin: '2px 0 0' }}>
                        {fmtDate(s.changedAt)}
                        {s.daysInPreviousStage !== null && ` · ${s.daysInPreviousStage}d in prior stage`}
                        {s.changedByName && ` · ${s.changedByName}`}
                      </p>
                    </div>
                  </div>
                )
              })}
              {/* Current stage tail */}
              <div style={{ display: 'flex', gap: 12, paddingTop: detail.stageHistory.length > 0 ? 10 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                    background: STAGE_META[detail.stage ?? '']?.color ?? '#94a3b8',
                    boxShadow: `0 0 0 3px ${(STAGE_META[detail.stage ?? '']?.color ?? '#94a3b8')}33`,
                  }} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: STAGE_META[detail.stage ?? '']?.color ?? '#94a3b8' }}>
                    {STAGE_META[detail.stage ?? '']?.label ?? detail.stage ?? '—'}
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: '2px 0 0' }}>
                    {detail.daysInStage}d · current stage
                  </p>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Section 3: Log Activity ── */}
        <Section title="Log Activity">
          {!detail.leadId ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Activity logging is available for lead-linked opportunities.</p>
          ) : (
            <form onSubmit={onLogActivity} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Type</label>
                  <select
                    value={actType}
                    onChange={(e) => onActTypeChange(e.target.value)}
                    style={{ ...sel, width: '100%' }}
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Date</label>
                  <input
                    type="date"
                    value={actDate}
                    onChange={(e) => onActDateChange(e.target.value)}
                    style={{ ...sel, minWidth: 130 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea
                  value={actDesc}
                  onChange={(e) => onActDescChange(e.target.value)}
                  placeholder="Describe the activity…"
                  rows={3}
                  style={{
                    width: '100%', resize: 'vertical', fontSize: 13,
                    background: 'var(--bg3)', border: '1px solid var(--bg4)', borderRadius: 6,
                    color: 'var(--text)', padding: '6px 10px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {actError && (
                <p style={{ fontSize: 12, color: '#f87171' }}>{actError}</p>
              )}
              <button
                type="submit"
                disabled={actSubmitting || !actDesc.trim()}
                style={{
                  fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 6, border: 'none',
                  background: 'var(--cobalt)', color: '#fff', cursor: actSubmitting ? 'not-allowed' : 'pointer',
                  opacity: actSubmitting || !actDesc.trim() ? 0.6 : 1, alignSelf: 'flex-start',
                }}
              >
                {actSubmitting ? 'Logging…' : 'Log Activity'}
              </button>
            </form>
          )}
        </Section>

        {/* ── Section 4: Activity History ── */}
        <Section title={`Activity History (${detail.activities.length})`}>
          {detail.activities.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No activity logged yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detail.activities.map((a) => {
                const { type, description } = parseActivityType(a.action)
                const color = ACTIVITY_COLOR[type] ?? '#94a3b8'
                return (
                  <div key={a.id} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg3)', border: '1px solid var(--bg4)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: `${color}1a`, color, border: `1px solid ${color}33`,
                      }}>
                        {ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {fmtDate(a.date)}{a.userName ? ` · ${a.userName}` : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>{description}</p>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* ── Section 5: Outreach History ── */}
        <Section title={`Outreach History (${detail.outreach.length})`}>
          {detail.outreach.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>
              {detail.leadId ? 'No outreach logged yet.' : 'Outreach is available for lead-linked opportunities.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detail.outreach.map((o) => (
                <div key={o.id} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--bg3)', border: '1px solid var(--bg4)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)',
                    }}>
                      {OUTREACH_TYPE_LABEL[o.type] ?? o.type}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {fmtDate(o.createdAt)}{o.userName ? ` · ${o.userName}` : ''}
                    </span>
                    {o.response !== 'PENDING' && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                        background: o.response === 'YES' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                        color: o.response === 'YES' ? '#34d399' : '#f87171',
                        border: `1px solid ${o.response === 'YES' ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                      }}>
                        {o.response}
                      </span>
                    )}
                  </div>
                  {o.subject && (
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '0 0 4px' }}>{o.subject}</p>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {o.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}
