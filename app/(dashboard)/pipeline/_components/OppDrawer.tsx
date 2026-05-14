'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { PipelineRow } from './PipelineClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id:    string
  name:  string
  title: string | null
  phone: string | null
  email: string | null
}

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
  expectedCloseDate: string | null
  notes: string | null
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

interface EditFields {
  jobType:           string
  productCategory:   string
  leadSource:        string
  estimatedRevenue:  string
  expectedCloseDate: string
  notes:             string
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

const JOB_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '',                  label: '— None —' },
  { value: 'NEW_CONSTRUCTION',  label: 'New Construction' },
  { value: 'MAC',               label: 'MAC' },
  { value: 'INSTALL',           label: 'Install' },
  { value: 'BOX_SALE',          label: 'Box Sale' },
  { value: 'UPGRADE_REFRESH',   label: 'Upgrade / Refresh' },
  { value: 'RFP_BID',           label: 'RFP / Bid' },
  { value: 'SERVICE_ON_DEMAND', label: 'Service (On Demand)' },
  { value: 'SERVICE_CONTRACTED',label: 'Service (Contracted)' },
]

const PRODUCT_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '',                          label: '— None —' },
  { value: 'ACCESS_CONTROL',            label: 'Access Control' },
  { value: 'VIDEO_SURVEILLANCE',        label: 'Video Surveillance' },
  { value: 'INTRUSION_ALARM',           label: 'Intrusion Alarm' },
  { value: 'INTERCOM_AUDIO',            label: 'Intercom / Audio' },
  { value: 'NETWORKING_INFRASTRUCTURE', label: 'Networking' },
  { value: 'FIRE_LIFE_SAFETY',          label: 'Fire / Life Safety' },
  { value: 'STRUCTURED_CABLING',        label: 'Structured Cabling' },
  { value: 'AUTO_DOOR_SLIDING',         label: 'Auto Door – Sliding' },
  { value: 'AUTO_DOOR_ROTATING',        label: 'Auto Door – Rotating' },
  { value: 'AUTO_DOOR_OVERHEAD',        label: 'Auto Door – Overhead' },
  { value: 'AUTO_DOOR_SWING',           label: 'Auto Door – Swing' },
  { value: 'AUTO_DOOR_FOLDING',         label: 'Auto Door – Folding' },
  { value: 'MANUAL_DOOR_SLIDING',       label: 'Manual Door – Sliding' },
  { value: 'MANUAL_DOOR_ROTATING',      label: 'Manual Door – Rotating' },
  { value: 'MANUAL_DOOR_OVERHEAD',      label: 'Manual Door – Overhead' },
  { value: 'MANUAL_DOOR_SWING',         label: 'Manual Door – Swing' },
  { value: 'MANUAL_DOOR_FOLDING',       label: 'Manual Door – Folding' },
  { value: 'INTEGRATED_SYSTEMS',        label: 'Integrated Systems' },
  { value: 'SYSTEMS_OTHER',             label: 'Systems (Other)' },
]

const LEAD_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '',                  label: '— None —' },
  { value: 'REFERRAL',          label: 'Referral' },
  { value: 'SAM_GOV',           label: 'SAM.gov' },
  { value: 'RFP_BID_BOARD',     label: 'RFP / Bid Board' },
  { value: 'DODGE_DATA',        label: 'Dodge Data' },
  { value: 'COLD_OUTREACH',     label: 'Cold Outreach' },
  { value: 'INBOUND_WEB',       label: 'Inbound Web' },
  { value: 'EXISTING_CUSTOMER', label: 'Existing Customer' },
  { value: 'PARTNER_VENDOR',    label: 'Partner / Vendor' },
]

const JOB_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  JOB_TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
)
const PRODUCT_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORY_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
)
const LEAD_SOURCE_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_SOURCE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
)

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

function fmtUSD(s: string): string {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  return s && !isNaN(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : ''
}

function stripFmt(s: string): string {
  return s.replace(/[^0-9.]/g, '')
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

function detailToEditFields(d: OppDetail): EditFields {
  return {
    jobType:           d.jobType           ?? '',
    productCategory:   d.productCategory   ?? '',
    leadSource:        d.leadSource        ?? '',
    estimatedRevenue:  d.estimatedRevenue  !== null ? fmtUSD(String(d.estimatedRevenue)) : '',
    expectedCloseDate: d.expectedCloseDate ?? '',
    notes:             d.notes             ?? '',
  }
}

// ─── Contacts Section ─────────────────────────────────────────────────────────

function OppContactsSection({
  opportunityId, contacts, setContacts,
}: {
  opportunityId: string
  contacts:    Contact[]
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>
}) {
  const [showAdd,    setShowAdd]    = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [fname,      setFname]      = useState('')
  const [ftitle,     setFtitle]     = useState('')
  const [fphone,     setFphone]     = useState('')
  const [femail,     setFemail]     = useState('')
  const [fsaving,    setFsaving]    = useState(false)

  function resetForm() { setFname(''); setFtitle(''); setFphone(''); setFemail('') }

  function beginAdd() { setEditingId(null); resetForm(); setShowAdd(true) }

  function beginEdit(c: Contact) {
    setShowAdd(false)
    setFname(c.name); setFtitle(c.title ?? ''); setFphone(c.phone ?? ''); setFemail(c.email ?? '')
    setEditingId(c.id)
  }

  function cancelForm() { setShowAdd(false); setEditingId(null); resetForm() }

  async function handleAdd() {
    if (!fname.trim() || fsaving) return
    setFsaving(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId, name: fname.trim(), title: ftitle.trim() || null, phone: fphone.trim() || null, email: femail.trim() || null }),
      })
      if (res.ok) {
        const newContact = await res.json() as Contact
        setContacts((p) => [...p, newContact])
        setShowAdd(false); resetForm()
      }
    } finally { setFsaving(false) }
  }

  async function handleEdit() {
    if (!editingId || !fname.trim() || fsaving) return
    setFsaving(true)
    try {
      const res = await fetch(`/api/contacts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fname.trim(), title: ftitle.trim() || null, phone: fphone.trim() || null, email: femail.trim() || null }),
      })
      if (res.ok) {
        const u = await res.json() as Contact
        setContacts((p) => p.map((c) => c.id === editingId ? u : c))
        setEditingId(null); resetForm()
      }
    } finally { setFsaving(false) }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) { setContacts((p) => p.filter((c) => c.id !== id)); setConfirmDel(null) }
  }

  function contactForm(onSave: () => void, label: string) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg3)', border: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Name *</label>
          <input value={fname} onChange={(e) => setFname(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Title</label>
          <input value={ftitle} onChange={(e) => setFtitle(e.target.value)} placeholder="VP Operations" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Phone</label>
            <input type="tel" value={fphone} onChange={(e) => setFphone(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={femail} onChange={(e) => setFemail(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onSave}
            disabled={!fname.trim() || fsaving}
            style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 6, border: 'none', background: fname.trim() ? 'var(--accent)' : 'var(--bg4)', color: fname.trim() ? '#fff' : 'var(--text3)', cursor: fname.trim() ? 'pointer' : 'not-allowed' }}
          >
            {fsaving ? 'Saving…' : label}
          </button>
          <button onClick={cancelForm} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--bg4)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <Section
      title="Contacts"
      action={!showAdd && !editingId ? (
        <button
          onClick={beginAdd}
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          + Add
        </button>
      ) : undefined}
    >
      {contacts.length === 0 && !showAdd && (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>No contacts yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contacts.map((c) => (
          <div key={c.id}>
            {editingId === c.id ? contactForm(handleEdit, 'Save') : (
              <div style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg3)', border: '1px solid var(--bg4)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 1px' }}>{c.name}</p>
                    {c.title && <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 6px' }}>{c.title}</p>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: c.title ? 0 : 6 }}>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                          Call {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                          Email {c.email}
                        </a>
                      )}
                    </div>
                  </div>
                  {confirmDel === c.id ? (
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => handleDelete(c.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>Delete</button>
                      <button onClick={() => setConfirmDel(null)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--bg4)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => beginEdit(c)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                      <button onClick={() => setConfirmDel(c.id)} style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {showAdd && contactForm(handleAdd, 'Add Contact')}
      </div>
    </Section>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: 0 }}>
          {title}
        </p>
        {action}
      </div>
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

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  background: 'var(--bg3)',
  border: '1px solid var(--bg4)',
  borderRadius: 5,
  color: 'var(--text)',
  padding: '4px 8px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

const selStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── OppDrawer ────────────────────────────────────────────────────────────────

interface Props {
  oppId: string | null
  onClose: () => void
  onRowPatch: (id: string, patch: Partial<PipelineRow>) => void
}

export function OppDrawer({ oppId, onClose, onRowPatch }: Props) {
  const [detail, setDetail]               = useState<OppDetail | null>(null)
  const [loading, setLoading]             = useState(false)
  const [stageChanging, setStageChanging] = useState(false)

  // Activity form state
  const [actType,       setActType]       = useState('CALL')
  const [actDesc,       setActDesc]       = useState('')
  const [actDate,       setActDate]       = useState(todayIso())
  const [actSubmitting, setActSubmitting] = useState(false)
  const [actError,      setActError]      = useState('')

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/opportunities/${id}`)
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
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 50, opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
          background: 'var(--bg2)', borderLeft: '1px solid var(--bg4)',
          zIndex: 51, transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
              onRefetch={() => fetchDetail(detail.id)}
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
  onRefetch: () => void
}

function DrawerBody({
  detail, stageChanging,
  actType, actDesc, actDate, actSubmitting, actError,
  onClose, onStageChange, onActTypeChange, onActDescChange, onActDateChange, onLogActivity,
  onRefetch,
}: DrawerBodyProps) {
  const router = useRouter()
  const needsAttention = detail.daysInStage > 45
  const [pendingStage, setPendingStage] = useState(detail.stage ?? '')
  const [stageSaved,   setStageSaved]   = useState(false)
  const prevChanging = useRef(false)

  // Edit mode state
  const [editMode,    setEditMode]    = useState(false)
  const [editFields,  setEditFields]  = useState<EditFields>(() => detailToEditFields(detail))
  const [saving,      setSaving]      = useState(false)
  const [editSaved,   setEditSaved]   = useState(false)
  const [editError,   setEditError]   = useState('')

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([])
  useEffect(() => {
    fetch(`/api/contacts?opportunityId=${detail.id}`)
      .then((r) => r.json())
      .then((data: Contact[]) => setContacts(data))
      .catch(() => {})
  }, [detail.id])

  function handleGenerateOutreach() {
    const first = contacts[0]
    const p = new URLSearchParams({ company: detail.company })
    if (first?.name)  p.set('contactName',  first.name)
    if (first?.title) p.set('contactTitle', first.title)
    if (first?.email) p.set('contactEmail', first.email)
    router.push(`/outreach?${p.toString()}`)
  }

  useEffect(() => { setPendingStage(detail.stage ?? '') }, [detail.stage])

  useEffect(() => {
    if (prevChanging.current && !stageChanging) {
      setStageSaved(true)
      const t = setTimeout(() => setStageSaved(false), 2500)
      return () => clearTimeout(t)
    }
    prevChanging.current = stageChanging
  }, [stageChanging])

  function enterEdit() {
    setEditFields(detailToEditFields(detail))
    setEditError('')
    setEditSaved(false)
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditError('')
  }

  async function saveEdit() {
    setSaving(true)
    setEditError('')
    try {
      const body: Record<string, unknown> = {
        jobType:           editFields.jobType           || null,
        productCategory:   editFields.productCategory   || null,
        leadSource:        editFields.leadSource        || null,
        estimatedRevenue:  editFields.estimatedRevenue  ? parseFloat(stripFmt(editFields.estimatedRevenue)) : null,
        expectedCloseDate: editFields.expectedCloseDate || null,
        notes:             editFields.notes             || null,
      }
      const res = await fetch(`/api/opportunities/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEditMode(false)
        setEditSaved(true)
        setTimeout(() => setEditSaved(false), 2500)
        onRefetch()
      } else {
        const data = await res.json() as { error?: string }
        setEditError(data.error ?? 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  function setField<K extends keyof EditFields>(k: K, v: EditFields[K]) {
    setEditFields((prev) => ({ ...prev, [k]: v }))
  }

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
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 3 }}>
            {detail.title}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{detail.company}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {editSaved && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>✓ Saved</span>
          )}
          <button
            onClick={handleGenerateOutreach}
            style={{
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
              border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Generate Outreach
          </button>
          {/* Pencil edit button */}
          <button
            onClick={editMode ? cancelEdit : enterEdit}
            title={editMode ? 'Cancel edit' : 'Edit details'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              border: editMode ? '1px solid var(--accent)' : '1px solid var(--bg4)',
              background: editMode ? 'rgba(var(--accent-rgb,26,86,255),0.08)' : 'transparent',
              color: editMode ? 'var(--accent)' : 'var(--text3)',
              cursor: 'pointer',
            }}
          >
            {editMode ? (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11 2l3 3-9 9H2v-3L11 2z" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6, border: '1px solid var(--bg4)',
              background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Section 1: Overview ── */}
        <Section title="Overview">
          {/* Stage row — always visible */}
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

          {/* Read-only fields */}
          {!editMode && (
            <>
              <Field label="Est. Value">
                {detail.estimatedRevenue !== null ? fmt$(detail.estimatedRevenue) : '—'}
              </Field>
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
              <Field label="Close Date">{detail.expectedCloseDate ? fmtDate(detail.expectedCloseDate) : '—'}</Field>
              <Field label="Job Type">{detail.jobType ? (JOB_TYPE_LABEL[detail.jobType] ?? detail.jobType) : '—'}</Field>
              <Field label="Product">{detail.productCategory ? (PRODUCT_CATEGORY_LABEL[detail.productCategory] ?? detail.productCategory) : '—'}</Field>
              <Field label="Lead Source">{detail.leadSource ? (LEAD_SOURCE_LABEL[detail.leadSource] ?? detail.leadSource) : '—'}</Field>
              {detail.repName && <Field label="Rep">{detail.repName}</Field>}
              {(detail.jobSiteCity || detail.jobSiteState) && (
                <Field label="Job Site">{[detail.jobSiteCity, detail.jobSiteState].filter(Boolean).join(', ')}</Field>
              )}
              <Field label="Created">{fmtDate(detail.createdAt)}</Field>
              <Field label="Updated">{fmtDate(detail.updatedAt)}</Field>
              {detail.notes && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Notes</p>
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, margin: 0 }}>{detail.notes}</p>
                </div>
              )}
            </>
          )}

          {/* Edit form */}
          {editMode && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <EditField label="Job Type">
                  <select value={editFields.jobType} onChange={(e) => setField('jobType', e.target.value)} style={selStyle}>
                    {JOB_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </EditField>
                <EditField label="Product">
                  <select value={editFields.productCategory} onChange={(e) => setField('productCategory', e.target.value)} style={selStyle}>
                    {PRODUCT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </EditField>
                <EditField label="Lead Source">
                  <select value={editFields.leadSource} onChange={(e) => setField('leadSource', e.target.value)} style={selStyle}>
                    {LEAD_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </EditField>
                <EditField label="Est. Value">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editFields.estimatedRevenue}
                    onChange={(e) => setField('estimatedRevenue', e.target.value)}
                    onFocus={() => setField('estimatedRevenue', stripFmt(editFields.estimatedRevenue))}
                    onBlur={() => setField('estimatedRevenue', fmtUSD(editFields.estimatedRevenue))}
                    placeholder="$0"
                    style={inputStyle}
                  />
                </EditField>
              </div>
              <EditField label="Expected Close Date">
                <input
                  type="date"
                  value={editFields.expectedCloseDate}
                  onChange={(e) => setField('expectedCloseDate', e.target.value)}
                  style={inputStyle}
                />
              </EditField>
              <EditField label="Notes">
                <textarea
                  value={editFields.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Add notes about this opportunity…"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </EditField>

              {editError && (
                <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{editError}</p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 6,
                    border: 'none', background: 'var(--accent)', color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    fontSize: 13, padding: '6px 14px', borderRadius: 6,
                    border: '1px solid var(--bg4)', background: 'var(--bg3)',
                    color: 'var(--text2)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Section 2: Contacts ── */}
        <OppContactsSection
          opportunityId={detail.id}
          contacts={contacts}
          setContacts={setContacts}
        />

        {/* ── Section 3: Stage History ── */}
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0, marginTop: 3 }} />
                      {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--bg4)', marginTop: 4 }} />}
                    </div>
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
              {actError && <p style={{ fontSize: 12, color: '#f87171' }}>{actError}</p>}
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
                  <div key={a.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--bg4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${color}1a`, color, border: `1px solid ${color}33` }}>
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
                <div key={o.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--bg4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
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
