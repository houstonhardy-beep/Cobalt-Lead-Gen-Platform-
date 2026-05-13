'use client'

import { useState, useMemo } from 'react'
import { OppDrawer } from '../../pipeline/_components/OppDrawer'
import { LeadDrawer } from './LeadDrawer'
import type { PipelineRow } from '../../pipeline/_components/PipelineClient'

// ── Exported types (consumed by server page) ──────────────────────────────────

export type OppRow = PipelineRow

export interface LeadRow {
  id:           string
  company:      string
  contact:      string | null
  contactTitle: string | null
  leadSource:   string | null
  heat:         string
  repId:        string | null
  repName:      string | null
  city:         string | null
  state:        string | null
  createdAtMs:  number
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const ALL_STAGES = [...OPEN_STAGES, 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE']

const JOB_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '',                   label: '— None —' },
  { value: 'NEW_CONSTRUCTION',   label: 'New Construction' },
  { value: 'MAC',                label: 'MAC' },
  { value: 'INSTALL',            label: 'Install' },
  { value: 'BOX_SALE',           label: 'Box Sale' },
  { value: 'UPGRADE_REFRESH',    label: 'Upgrade / Refresh' },
  { value: 'RFP_BID',            label: 'RFP / Bid' },
  { value: 'SERVICE_ON_DEMAND',  label: 'Service (On Demand)' },
  { value: 'SERVICE_CONTRACTED', label: 'Service (Contracted)' },
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

const HEAT_COLOR: Record<string, string> = {
  HOT:  '#dc2626',
  WARM: '#f59e0b',
  COLD: '#6b7280',
}

const JOB_TYPE_LABEL    = Object.fromEntries(JOB_TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]))
const PRODUCT_LABEL     = Object.fromEntries(PRODUCT_CATEGORY_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]))
const LEAD_SOURCE_LABEL = Object.fromEntries(LEAD_SOURCE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]))

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function relDays(ms: number): string {
  const d = Math.floor((Date.now() - ms) / 86_400_000)
  if (d === 0)  return 'Today'
  if (d === 1)  return '1d ago'
  if (d < 30)   return `${d}d ago`
  if (d < 365)  return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
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

function dateRangeMs(filter: string): number | null {
  const now = Date.now()
  if (filter === '30')  return now - 30 * 86_400_000
  if (filter === '60')  return now - 60 * 86_400_000
  if (filter === '90')  return now - 90 * 86_400_000
  if (filter === 'YTD') return new Date(new Date().getFullYear(), 0, 1).getTime()
  return null
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  background: 'var(--bg2)',
  border: '1px solid var(--bg4)',
  borderRadius: 6,
  color: 'var(--text)',
  padding: '5px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const selStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

const filterSelStyle: React.CSSProperties = {
  fontSize: 13,
  background: 'var(--bg2)',
  border: '1px solid var(--bg4)',
  borderRadius: 6,
  color: 'var(--text)',
  padding: '5px 10px',
  cursor: 'pointer',
  outline: 'none',
  flexShrink: 0,
}

// ── Main component ────────────────────────────────────────────────────────────

export function OpportunitiesClient({
  initialLeads, initialOpps, reps, currentUserId,
}: {
  initialLeads:    LeadRow[]
  initialOpps:     OppRow[]
  reps:            { id: string; name: string | null }[]
  currentUserId:   string
  currentUserRole: string
}) {
  const [activeTab,   setActiveTab]   = useState<'leads' | 'opps'>('leads')
  const [leads, setLeads]             = useState<LeadRow[]>(initialLeads)
  const [opps,  setOpps]              = useState<OppRow[]>(initialOpps)

  const [search,       setSearch]       = useState('')
  const [repFilter,    setRepFilter]    = useState('ALL')
  const [dateFilter,   setDateFilter]   = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [heatFilter,   setHeatFilter]   = useState('ALL')
  const [stageFilter,  setStageFilter]  = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [selectedOppId,     setSelectedOppId]     = useState<string | null>(null)
  const [selectedLeadId,    setSelectedLeadId]    = useState<string | null>(null)
  const [showNewLeadDrawer, setShowNewLeadDrawer] = useState(false)
  const [showNewOppDrawer,  setShowNewOppDrawer]  = useState(false)
  const [convertingLead,    setConvertingLead]    = useState<LeadRow | null>(null)

  // ── Mutations ───────────────────────────────────────────────────────────────

  async function handleDismissLead(id: string) {
    setLeads((prev) => prev.filter((l) => l.id !== id))
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'CLOSED_LOST' }),
    })
  }

  async function handleAssignLead(id: string, repId: string | null) {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId: repId }),
    })
    if (res.ok) {
      const rep = repId ? reps.find((r) => r.id === repId) : null
      setLeads((prev) => prev.map((l) =>
        l.id === id ? { ...l, repId: rep?.id ?? null, repName: rep?.name ?? null } : l
      ))
    }
  }

  async function handleConvert(leadId: string, body: {
    stage?: string; estimatedRevenue?: number; jobType?: string;
    productCategory?: string; expectedCloseDate?: string;
  }) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    const res = await fetch(`/api/leads/${leadId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return

    const data = await res.json() as { opportunityId: string }

    setLeads((prev) => prev.filter((l) => l.id !== leadId))

    const newOpp: OppRow = {
      id:                 data.opportunityId,
      title:              lead.company,
      company:            lead.company,
      stage:              body.stage ?? 'PROSPECT',
      type:               'BID',
      jobType:            body.jobType         ?? null,
      productCategory:    body.productCategory ?? null,
      leadSource:         lead.leadSource,
      status:             'OPEN',
      estimatedRevenue:   body.estimatedRevenue ?? null,
      weightedValue:      body.estimatedRevenue ? body.estimatedRevenue * 0.1 : null,
      probabilityPercent: 10,
      repName:            lead.repName,
      repId:              lead.repId,
      daysInStage:        0,
      daysInPipeline:     0,
      needsAttention:     false,
      createdAtMs:        Date.now(),
      updatedAtMs:        Date.now(),
    }

    setOpps((prev) => [newOpp, ...prev])
    setConvertingLead(null)
    setActiveTab('opps')
  }

  async function handleNewLead(body: object): Promise<string | null> {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      return data.error ?? 'Failed to create lead'
    }
    const lead = await res.json() as {
      id: string; company: string; contact: string | null; contactTitle: string | null;
      leadSource: string | null; heat: string; city: string | null; state: string | null;
      createdAt: string; assignedTo: { id: string; name: string | null } | null;
    }
    const newLead: LeadRow = {
      id:           lead.id,
      company:      lead.company,
      contact:      lead.contact,
      contactTitle: lead.contactTitle,
      leadSource:   lead.leadSource,
      heat:         lead.heat,
      repId:        lead.assignedTo?.id   ?? null,
      repName:      lead.assignedTo?.name ?? null,
      city:         lead.city,
      state:        lead.state,
      createdAtMs:  new Date(lead.createdAt).getTime(),
    }
    setLeads((prev) => [newLead, ...prev])
    setShowNewLeadDrawer(false)
    return null
  }

  async function handleNewOpp(body: object): Promise<string | null> {
    const res = await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      return data.error ?? 'Failed to create opportunity'
    }
    const data = await res.json() as { opportunityId: string }
    const b = body as {
      title: string; company: string; stage?: string; estimatedRevenue?: number;
      jobType?: string; productCategory?: string; leadSource?: string;
      assignedToId?: string;
    }
    const rep = b.assignedToId ? reps.find((r) => r.id === b.assignedToId) : null

    const newOpp: OppRow = {
      id:                 data.opportunityId,
      title:              b.title,
      company:            b.company,
      stage:              b.stage ?? 'PROSPECT',
      type:               'BID',
      jobType:            b.jobType         ?? null,
      productCategory:    b.productCategory ?? null,
      leadSource:         b.leadSource      ?? null,
      status:             'OPEN',
      estimatedRevenue:   b.estimatedRevenue ?? null,
      weightedValue:      b.estimatedRevenue ? b.estimatedRevenue * 0.1 : null,
      probabilityPercent: 10,
      repName:            rep?.name ?? null,
      repId:              rep?.id   ?? null,
      daysInStage:        0,
      daysInPipeline:     0,
      needsAttention:     false,
      createdAtMs:        Date.now(),
      updatedAtMs:        Date.now(),
    }

    setOpps((prev) => [newOpp, ...prev])
    setShowNewOppDrawer(false)
    return null
  }

  function handleRowPatch(id: string, patch: Partial<OppRow>) {
    setOpps((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o))
  }

  function handleLeadUpdate(id: string, patch: Partial<LeadRow>) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l))
  }

  function handleConvertFromDrawer(leadId: string) {
    setSelectedLeadId(null)
    const lead = leads.find((l) => l.id === leadId)
    if (lead) setConvertingLead(lead)
  }

  // ── Filtered data ───────────────────────────────────────────────────────────

  const minDateMs = dateRangeMs(dateFilter)

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter((l) => {
      if (q && ![l.company, l.contact, l.contactTitle].some((v) => v?.toLowerCase().includes(q))) return false
      if (repFilter    !== 'ALL' && l.repId      !== repFilter)    return false
      if (sourceFilter !== 'ALL' && l.leadSource !== sourceFilter) return false
      if (heatFilter   !== 'ALL' && l.heat       !== heatFilter)   return false
      if (minDateMs && l.createdAtMs < minDateMs) return false
      return true
    })
  }, [leads, search, repFilter, sourceFilter, heatFilter, minDateMs])

  const filteredOpps = useMemo(() => {
    const q = search.toLowerCase()
    return opps.filter((o) => {
      if (q && ![o.title, o.company].some((v) => v?.toLowerCase().includes(q))) return false
      if (repFilter    !== 'ALL' && o.repId   !== repFilter)    return false
      if (stageFilter  !== 'ALL' && o.stage   !== stageFilter)  return false
      if (statusFilter !== 'ALL' && o.status  !== statusFilter) return false
      if (minDateMs && o.createdAtMs < minDateMs) return false
      return true
    })
  }, [opps, search, repFilter, stageFilter, statusFilter, minDateMs])

  // Reps visible in current data (for filter dropdown)
  const filterReps = useMemo(() => {
    const src = activeTab === 'leads' ? leads : opps
    const seen = new Set<string>()
    const result: { id: string; name: string | null }[] = []
    for (const row of src) {
      const repId   = 'repId'   in row ? row.repId   : null
      const repName = 'repName' in row ? row.repName : null
      if (repId && !seen.has(repId)) {
        seen.add(repId)
        result.push({ id: repId, name: repName })
      }
    }
    return result.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [activeTab, leads, opps])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Opportunities</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Manage leads and deals from prospect to close.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowNewLeadDrawer(true)}
            style={{
              fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 7,
              border: '1px solid var(--bg4)', background: 'var(--bg2)',
              color: 'var(--text2)', cursor: 'pointer',
            }}
          >
            + New Lead
          </button>
          <button
            onClick={() => setShowNewOppDrawer(true)}
            style={{
              fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 7,
              border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer',
            }}
          >
            + New Opportunity
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--bg4)', gap: 0 }}>
        {(['leads', 'opps'] as const).map((tab) => {
          const label  = tab === 'leads' ? `Leads (${leads.length})` : `Opportunities (${opps.length})`
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: 14, fontWeight: active ? 600 : 400,
                padding: '10px 20px', background: 'none', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                color: active ? 'var(--accent)' : 'var(--text3)',
                cursor: 'pointer', transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder={activeTab === 'leads' ? 'Search company or contact…' : 'Search opportunity or company…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...filterSelStyle, background: 'var(--bg2)', cursor: 'text', width: 230 }}
        />
        <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} style={filterSelStyle}>
          <option value="ALL">All Reps</option>
          {filterReps.map((r) => <option key={r.id} value={r.id}>{r.name ?? r.id}</option>)}
        </select>

        {activeTab === 'leads' ? (
          <>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={filterSelStyle}>
              <option value="ALL">All Sources</option>
              {LEAD_SOURCE_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select value={heatFilter} onChange={(e) => setHeatFilter(e.target.value)} style={filterSelStyle}>
              <option value="ALL">All Heat</option>
              <option value="HOT">Hot</option>
              <option value="WARM">Warm</option>
              <option value="COLD">Cold</option>
            </select>
          </>
        ) : (
          <>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={filterSelStyle}>
              <option value="ALL">All Stages</option>
              {ALL_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_META[s]?.label ?? s}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterSelStyle}>
              <option value="ALL">All Status</option>
              <option value="OPEN">Open</option>
              <option value="PURSUING">Pursuing</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
          </>
        )}

        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={filterSelStyle}>
          <option value="ALL">All Time</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
          <option value="YTD">Year to date</option>
        </select>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
          {activeTab === 'leads'
            ? `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''}`
            : `${filteredOpps.length} opportunit${filteredOpps.length !== 1 ? 'ies' : 'y'}`}
        </span>
      </div>

      {/* List */}
      {activeTab === 'leads' ? (
        <LeadList
          leads={filteredLeads}
          reps={reps}
          onOpen={(id) => setSelectedLeadId(id)}
          onDismiss={handleDismissLead}
          onAssign={handleAssignLead}
          onConvert={(lead) => setConvertingLead(lead)}
        />
      ) : (
        <OppList opps={filteredOpps} onSelect={(id) => setSelectedOppId(id)} />
      )}

      {/* Drawers + modals */}
      <NewLeadDrawer
        open={showNewLeadDrawer}
        reps={reps}
        currentUserId={currentUserId}
        onClose={() => setShowNewLeadDrawer(false)}
        onSubmit={handleNewLead}
      />

      <NewOppDrawer
        open={showNewOppDrawer}
        reps={reps}
        currentUserId={currentUserId}
        onClose={() => setShowNewOppDrawer(false)}
        onSubmit={handleNewOpp}
      />

      {convertingLead && (
        <ConvertModal
          lead={convertingLead}
          onClose={() => setConvertingLead(null)}
          onConvert={(body) => handleConvert(convertingLead.id, body)}
        />
      )}

      <OppDrawer
        oppId={selectedOppId}
        onClose={() => setSelectedOppId(null)}
        onRowPatch={handleRowPatch}
      />

      <LeadDrawer
        leadId={selectedLeadId}
        reps={reps}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdate={handleLeadUpdate}
        onConvert={handleConvertFromDrawer}
      />
    </div>
  )
}

// ── LeadList ──────────────────────────────────────────────────────────────────

function LeadList({ leads, reps, onOpen, onDismiss, onAssign, onConvert }: {
  leads:     LeadRow[]
  reps:      { id: string; name: string | null }[]
  onOpen:    (id: string) => void
  onDismiss: (id: string) => void
  onAssign:  (id: string, repId: string | null) => void
  onConvert: (lead: LeadRow) => void
}) {
  if (leads.length === 0) {
    return (
      <div style={{ borderRadius: 10, padding: '48px 24px', textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>No leads match your filters.</p>
      </div>
    )
  }

  const colTemplate = '2fr 130px 70px 150px 70px auto'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: colTemplate, gap: '0 12px',
        padding: '4px 16px',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text3)',
      }}>
        <span>Company / Contact</span>
        <span>Source</span>
        <span>Heat</span>
        <span>Rep</span>
        <span>Age</span>
        <span>Actions</span>
      </div>

      {leads.map((lead) => (
        <div
          key={lead.id}
          onClick={() => onOpen(lead.id)}
          style={{
            display: 'grid', gridTemplateColumns: colTemplate, gap: '0 12px',
            alignItems: 'center', padding: '12px 16px',
            borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--bg4)',
            cursor: 'pointer', transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bg4)' }}
        >
          {/* Company / Contact */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>
              {lead.company}
            </p>
            {(lead.contact || lead.city) && (
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                {[
                  lead.contact,
                  lead.contactTitle,
                  [lead.city, lead.state].filter(Boolean).join(', ') || null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Source */}
          <div>
            {lead.leadSource ? (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--bg4)',
                whiteSpace: 'nowrap',
              }}>
                {LEAD_SOURCE_LABEL[lead.leadSource] ?? lead.leadSource}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
            )}
          </div>

          {/* Heat */}
          <div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: `${HEAT_COLOR[lead.heat] ?? '#6b7280'}20`,
              color: HEAT_COLOR[lead.heat] ?? '#6b7280',
            }}>
              {lead.heat}
            </span>
          </div>

          {/* Rep (inline assign dropdown) */}
          <select
            value={lead.repId ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onAssign(lead.id, e.target.value || null) }}
            style={{
              fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--bg4)',
              borderRadius: 5, color: 'var(--text)', padding: '3px 6px',
              cursor: 'pointer', width: '100%',
            }}
          >
            <option value="">Unassigned</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name ?? r.id}</option>)}
          </select>

          {/* Age */}
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{relDays(lead.createdAtMs)}</div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onConvert(lead) }}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
                border: 'none', background: 'var(--accent)', color: '#fff',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Convert
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(lead.id) }}
              style={{
                fontSize: 12, padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--bg4)', background: 'transparent',
                color: 'var(--text3)', cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── OppList ───────────────────────────────────────────────────────────────────

function OppList({ opps, onSelect }: { opps: OppRow[]; onSelect: (id: string) => void }) {
  if (opps.length === 0) {
    return (
      <div style={{ borderRadius: 10, padding: '48px 24px', textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>No opportunities match your filters.</p>
      </div>
    )
  }

  const colTemplate = '2fr 140px 120px 110px 120px 60px 70px 90px 90px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: colTemplate, gap: '0 10px',
        padding: '4px 16px',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text3)',
      }}>
        <span>Opportunity</span>
        <span>Stage</span>
        <span>Rep</span>
        <span>Job Type</span>
        <span>Product</span>
        <span>Stage Age</span>
        <span>Pipeline</span>
        <span>Est. Value</span>
        <span>Weighted</span>
      </div>

      {opps.map((opp) => {
        const meta = STAGE_META[opp.stage ?? ''] ?? { label: opp.stage ?? '—', color: '#94a3b8' }
        return (
          <button
            key={opp.id}
            onClick={() => onSelect(opp.id)}
            style={{
              display: 'grid', gridTemplateColumns: colTemplate, gap: '0 10px',
              alignItems: 'center', padding: '12px 16px',
              borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--bg4)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bg4)' }}
          >
            {/* Opportunity / Company */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{opp.title}</span>
                {opp.needsAttention && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
                  }}>
                    Needs Attention
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{opp.company}</p>
            </div>

            {/* Stage */}
            <div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44`,
                whiteSpace: 'nowrap',
              }}>
                {meta.label}
              </span>
            </div>

            {/* Rep */}
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{opp.repName ?? '—'}</div>

            {/* Job Type */}
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {opp.jobType ? (JOB_TYPE_LABEL[opp.jobType] ?? opp.jobType) : '—'}
            </div>

            {/* Product */}
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {opp.productCategory ? (PRODUCT_LABEL[opp.productCategory] ?? opp.productCategory) : '—'}
            </div>

            {/* Stage Age */}
            <div style={{ fontSize: 12, color: opp.daysInStage > 45 ? '#fbbf24' : 'var(--text3)' }}>
              {opp.daysInStage}d
            </div>

            {/* Pipeline Age */}
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{opp.daysInPipeline}d</div>

            {/* Est. Value */}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {fmt$(opp.estimatedRevenue)}
            </div>

            {/* Weighted */}
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {fmt$(opp.weightedValue)}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── ConvertModal ──────────────────────────────────────────────────────────────

function ConvertModal({ lead, onClose, onConvert }: {
  lead:      LeadRow
  onClose:   () => void
  onConvert: (body: { stage?: string; estimatedRevenue?: number; jobType?: string; productCategory?: string; expectedCloseDate?: string }) => Promise<void>
}) {
  const [stage,             setStage]             = useState('PROSPECT')
  const [estimatedRevenue,  setEstimatedRevenue]  = useState('')
  const [jobType,           setJobType]           = useState('')
  const [productCategory,   setProductCategory]   = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [submitting,        setSubmitting]        = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onConvert({
        stage,
        estimatedRevenue:  estimatedRevenue  ? parseFloat(stripFmt(estimatedRevenue)) : undefined,
        jobType:           jobType           || undefined,
        productCategory:   productCategory   || undefined,
        expectedCloseDate: expectedCloseDate || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 440,
        background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--bg4)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        zIndex: 61, padding: 24,
      }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Convert to Opportunity
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{lead.company}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value)} style={selStyle}>
              {OPEN_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_META[s]?.label ?? s}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Estimated Value">
            <input
              type="text" inputMode="numeric" value={estimatedRevenue}
              onChange={(e) => setEstimatedRevenue(e.target.value)}
              onFocus={() => setEstimatedRevenue((v) => stripFmt(v))}
              onBlur={() => setEstimatedRevenue((v) => fmtUSD(v))}
              placeholder="$0" style={inputStyle}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Job Type">
              <select value={jobType} onChange={(e) => setJobType(e.target.value)} style={selStyle}>
                {JOB_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
            <FormField label="Product Category">
              <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} style={selStyle}>
                {PRODUCT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Expected Close Date">
            <input
              type="date" value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              style={inputStyle}
            />
          </FormField>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="submit" disabled={submitting}
              style={{
                flex: 1, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 7,
                border: 'none', background: 'var(--accent)', color: '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Converting…' : 'Convert to Opportunity'}
            </button>
            <button
              type="button" onClick={onClose}
              style={{
                fontSize: 13, padding: '9px 14px', borderRadius: 7,
                border: '1px solid var(--bg4)', background: 'var(--bg3)',
                color: 'var(--text2)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── NewLeadDrawer ─────────────────────────────────────────────────────────────

function NewLeadDrawer({ open, reps, currentUserId, onClose, onSubmit }: {
  open:          boolean
  reps:          { id: string; name: string | null }[]
  currentUserId: string
  onClose:       () => void
  onSubmit:      (body: object) => Promise<string | null>
}) {
  const [company,      setCompany]      = useState('')
  const [contact,      setContact]      = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [phone,        setPhone]        = useState('')
  const [email,        setEmail]        = useState('')
  const [leadSource,   setLeadSource]   = useState('')
  const [heat,         setHeat]         = useState('WARM')
  const [assignedToId, setAssignedToId] = useState(currentUserId)
  const [city,         setCity]         = useState('')
  const [stateVal,          setStateVal]          = useState('')
  const [estimatedRevenue,  setEstimatedRevenue]  = useState('')
  const [notes,             setNotes]             = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')

  function reset() {
    setCompany(''); setContact(''); setContactTitle(''); setPhone(''); setEmail('')
    setLeadSource(''); setHeat('WARM'); setAssignedToId(currentUserId)
    setCity(''); setStateVal(''); setEstimatedRevenue(''); setNotes(''); setError('')
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!company.trim()) { setError('Company name is required'); return }
    setSubmitting(true)
    setError('')
    try {
      const err = await onSubmit({
        company: company.trim(),
        contact:      contact      || undefined,
        contactTitle: contactTitle || undefined,
        phone:        phone        || undefined,
        email:        email        || undefined,
        leadSource:   leadSource   || undefined,
        heat,
        assignedToId: assignedToId || undefined,
        city:             city             || undefined,
        state:            stateVal         || undefined,
        value:            estimatedRevenue ? parseFloat(stripFmt(estimatedRevenue)) : undefined,
        notes:            notes            || undefined,
      })
      if (err) setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlideOver open={open} onClose={handleClose} title="New Lead">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Company *">
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Corp" required style={inputStyle} />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormField label="Contact Name">
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="Jane Doe" style={inputStyle} />
          </FormField>
          <FormField label="Contact Title">
            <input type="text" value={contactTitle} onChange={(e) => setContactTitle(e.target.value)}
              placeholder="VP Operations" style={inputStyle} />
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormField label="Phone">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000" style={inputStyle} />
          </FormField>
          <FormField label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@acme.com" style={inputStyle} />
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormField label="Lead Source">
            <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} style={selStyle}>
              {LEAD_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Temperature">
            <select value={heat} onChange={(e) => setHeat(e.target.value)} style={selStyle}>
              <option value="HOT">Hot</option>
              <option value="WARM">Warm</option>
              <option value="COLD">Cold</option>
            </select>
          </FormField>
        </div>

        <FormField label="Assigned Rep">
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} style={selStyle}>
            <option value="">Unassigned</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name ?? r.id}</option>)}
          </select>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
          <FormField label="City">
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
              placeholder="Birmingham" style={inputStyle} />
          </FormField>
          <FormField label="State">
            <input type="text" value={stateVal} onChange={(e) => setStateVal(e.target.value)}
              placeholder="AL" maxLength={2} style={inputStyle} />
          </FormField>
        </div>

        <FormField label="Estimated Value">
          <input
            type="text" inputMode="numeric" value={estimatedRevenue}
            onChange={(e) => setEstimatedRevenue(e.target.value)}
            onFocus={() => setEstimatedRevenue((v) => stripFmt(v))}
            onBlur={() => setEstimatedRevenue((v) => fmtUSD(v))}
            placeholder="$0" style={inputStyle}
          />
        </FormField>

        <FormField label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this lead…" rows={3}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </FormField>

        {error && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{error}</p>}

        <DrawerActions submitting={submitting} submitLabel="Create Lead" onCancel={handleClose} />
      </form>
    </SlideOver>
  )
}

// ── NewOppDrawer ──────────────────────────────────────────────────────────────

function NewOppDrawer({ open, reps, currentUserId, onClose, onSubmit }: {
  open:          boolean
  reps:          { id: string; name: string | null }[]
  currentUserId: string
  onClose:       () => void
  onSubmit:      (body: object) => Promise<string | null>
}) {
  const [title,             setTitle]             = useState('')
  const [company,           setCompany]           = useState('')
  const [stage,             setStage]             = useState('PROSPECT')
  const [estimatedRevenue,  setEstimatedRevenue]  = useState('')
  const [jobType,           setJobType]           = useState('')
  const [productCategory,   setProductCategory]   = useState('')
  const [leadSource,        setLeadSource]        = useState('')
  const [assignedToId,      setAssignedToId]      = useState(currentUserId)
  const [expectedCloseDate, setExpectedCloseDate] = useState(todayIso())
  const [notes,             setNotes]             = useState('')
  const [submitting,        setSubmitting]        = useState(false)
  const [error,             setError]             = useState('')

  function reset() {
    setTitle(''); setCompany(''); setStage('PROSPECT'); setEstimatedRevenue('')
    setJobType(''); setProductCategory(''); setLeadSource('')
    setAssignedToId(currentUserId); setExpectedCloseDate(todayIso()); setNotes(''); setError('')
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim())   { setError('Title is required');   return }
    if (!company.trim()) { setError('Company is required'); return }
    setSubmitting(true)
    setError('')
    try {
      const err = await onSubmit({
        title:            title.trim(),
        company:          company.trim(),
        stage,
        estimatedRevenue: estimatedRevenue ? parseFloat(stripFmt(estimatedRevenue)) : undefined,
        jobType:          jobType           || undefined,
        productCategory:  productCategory  || undefined,
        leadSource:       leadSource        || undefined,
        assignedToId:     assignedToId      || undefined,
        expectedCloseDate: expectedCloseDate || undefined,
        notes:            notes             || undefined,
      })
      if (err) setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlideOver open={open} onClose={handleClose} title="New Opportunity">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Title *">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="New HQ Security System" required style={inputStyle} />
        </FormField>

        <FormField label="Company *">
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Corp" required style={inputStyle} />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormField label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value)} style={selStyle}>
              {OPEN_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_META[s]?.label ?? s}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Estimated Value">
            <input
              type="text" inputMode="numeric" value={estimatedRevenue}
              onChange={(e) => setEstimatedRevenue(e.target.value)}
              onFocus={() => setEstimatedRevenue((v) => stripFmt(v))}
              onBlur={() => setEstimatedRevenue((v) => fmtUSD(v))}
              placeholder="$0" style={inputStyle} />
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormField label="Job Type">
            <select value={jobType} onChange={(e) => setJobType(e.target.value)} style={selStyle}>
              {JOB_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Product Category">
            <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} style={selStyle}>
              {PRODUCT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormField label="Lead Source">
            <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} style={selStyle}>
              {LEAD_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Assigned Rep">
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} style={selStyle}>
              <option value="">Unassigned</option>
              {reps.map((r) => <option key={r.id} value={r.id}>{r.name ?? r.id}</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="Expected Close Date">
          <input type="date" value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)} style={inputStyle} />
        </FormField>

        <FormField label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this opportunity…" rows={3}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </FormField>

        {error && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{error}</p>}

        <DrawerActions submitting={submitting} submitLabel="Create Opportunity" onCancel={handleClose} />
      </form>
    </SlideOver>
  )
}

// ── Shared drawer primitives ──────────────────────────────────────────────────

function SlideOver({ open, onClose, title, children }: {
  open:     boolean
  onClose:  () => void
  title:    string
  children: React.ReactNode
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 50, opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
        background: 'var(--bg2)', borderLeft: '1px solid var(--bg4)',
        zIndex: 51,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {open && (
          <>
            <div style={{
              padding: '18px 20px 16px', borderBottom: '1px solid var(--bg4)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: 'var(--text3)',
                  fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {children}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function DrawerActions({ submitting, submitLabel, onCancel }: {
  submitting:  boolean
  submitLabel: string
  onCancel:    () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 8, paddingTop: 4 }}>
      <button
        type="submit" disabled={submitting}
        style={{
          flex: 1, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 7,
          border: 'none', background: 'var(--accent)', color: '#fff',
          cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
      <button
        type="button" onClick={onCancel}
        style={{
          fontSize: 13, padding: '9px 14px', borderRadius: 7,
          border: '1px solid var(--bg4)', background: 'var(--bg3)',
          color: 'var(--text2)', cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  )
}
