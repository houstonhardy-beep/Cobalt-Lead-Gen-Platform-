'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type SignalType     = 'CONSTRUCTION_PERMIT' | 'GOVERNMENT_RFP' | 'CUSTOMER_SIGNAL' | 'NEWS' | 'PERSONNEL_CHANGE'
type SignalPriority = 'HOT' | 'WARM' | 'COLD'
type SignalStatus   = 'NEW' | 'SAVED' | 'CONVERTED' | 'DISMISSED'
type StatusFilter   = 'ACTIVE' | SignalStatus | 'ALL'

interface Signal {
  id:              string
  type:            SignalType
  priority:        SignalPriority
  title:           string
  company:         string | null
  location:        string | null
  estimatedValue:  number | null
  description:     string
  sourceName:      string | null
  sourceUrl:       string | null
  detectedAt:      string
  status:          SignalStatus
  assignedToId:    string | null
  isRead:          boolean
  contactName:     string | null
  contactTitle:    string | null
  convertedLeadId: string | null
  assignedTo:      { id: string; name: string | null } | null
  jobType:         string | null
  productCategory: string | null
}

interface ConvertedMeta {
  company:       string
  opportunityId: string
}

interface Props {
  signals:         Signal[]
  reps:            { id: string; name: string | null }[]
  currentUserId:   string
  currentUserRole: string
}

// ── Label maps ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<SignalType, string> = {
  CONSTRUCTION_PERMIT: 'Construction Permit',
  GOVERNMENT_RFP:      'Government RFP',
  CUSTOMER_SIGNAL:     'Customer Signal',
  NEWS:                'News',
  PERSONNEL_CHANGE:    'Personnel Change',
}

const TYPE_COLOR: Record<SignalType, string> = {
  CONSTRUCTION_PERMIT: '#f59e0b',
  GOVERNMENT_RFP:      '#3b82f6',
  CUSTOMER_SIGNAL:     '#8b5cf6',
  NEWS:                '#6b7280',
  PERSONNEL_CHANGE:    '#10b981',
}

const PRIORITY_COLOR: Record<SignalPriority, string> = {
  HOT:  '#dc2626',
  WARM: '#f59e0b',
  COLD: '#6b7280',
}

const PRIORITY_ORDER: Record<SignalPriority, number> = { HOT: 0, WARM: 1, COLD: 2 }
const STATUS_ORDER:   Record<SignalStatus, number>   = { NEW: 0, SAVED: 1, CONVERTED: 2, DISMISSED: 3 }

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
  { value: 'INTEGRATED_SYSTEMS',        label: 'Integrated Systems' },
  { value: 'SYSTEMS_OTHER',             label: 'Systems (Other)' },
]

const JOB_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  JOB_TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
)
const PRODUCT_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORY_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(v: number | null | undefined) {
  if (!v) return null
  return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toLocaleString()}`
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

// ── Main component ────────────────────────────────────────────────────────────

export function SignalQueueClient({ signals: initialSignals, reps, currentUserId, currentUserRole }: Props) {
  const [signals, setSignals]         = useState<Signal[]>(initialSignals)
  const [convertedMeta, setConvertedMeta] = useState<Record<string, ConvertedMeta>>({})

  const [search,         setSearch]         = useState('')
  const [typeFilter,     setTypeFilter]     = useState<SignalType | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<SignalPriority | 'ALL'>('ALL')
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('ACTIVE')
  const [expandedId,     setExpandedId]     = useState<string | null>(null)
  const [converting,     setConverting]     = useState<string | null>(null)

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = signals.filter((s) => s.status === 'NEW' || s.status === 'SAVED')
    const newS   = signals.filter((s) => s.status === 'NEW')
    const hot    = newS.filter((s) => s.priority === 'HOT')
    const totalValue = newS.reduce((acc, s) => acc + (s.estimatedValue ?? 0), 0)
    return { total: active.length, newCount: newS.length, hotCount: hot.length, totalValue }
  }, [signals])

  // ── Filtered + sorted list ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return signals
      .filter((s) => {
        if (statusFilter === 'ACTIVE' && s.status !== 'NEW' && s.status !== 'SAVED') return false
        if (statusFilter !== 'ACTIVE' && statusFilter !== 'ALL' && s.status !== statusFilter) return false
        if (typeFilter     !== 'ALL' && s.type     !== typeFilter)     return false
        if (priorityFilter !== 'ALL' && s.priority !== priorityFilter) return false
        if (q && ![s.title, s.company, s.location, s.description].some((v) => v?.toLowerCase().includes(q))) return false
        return true
      })
      .sort((a, b) => {
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (statusDiff !== 0) return statusDiff
        const priDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (priDiff !== 0) return priDiff
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
      })
  }, [signals, search, typeFilter, priorityFilter, statusFilter])

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function patch(id: string, body: object) {
    const res = await fetch(`/api/signals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return
    const updated = await res.json() as Partial<Signal>
    setSignals((prev) => prev.map((s) => s.id === id ? { ...s, ...updated } : s))
  }

  async function markRead(id: string) {
    const signal = signals.find((s) => s.id === id)
    if (!signal || signal.isRead) return
    await patch(id, { isRead: true })
  }

  async function saveSignal(id: string) {
    await patch(id, { status: 'SAVED', isRead: true })
  }

  async function dismissSignal(id: string) {
    await patch(id, { status: 'DISMISSED', isRead: true })
  }

  async function restoreSignal(id: string) {
    await patch(id, { status: 'NEW' })
  }

  async function convertToLead(id: string) {
    setConverting(id)
    try {
      const res = await fetch(`/api/signals/${id}/convert`, { method: 'POST' })
      if (!res.ok) { setConverting(null); return }
      const data = await res.json() as { leadId: string; opportunityId: string; company: string }
      setSignals((prev) =>
        prev.map((s) => s.id === id ? { ...s, status: 'CONVERTED', convertedLeadId: data.leadId, isRead: true } : s)
      )
      setConvertedMeta((prev) => ({
        ...prev,
        [id]: { company: data.company, opportunityId: data.opportunityId },
      }))
    } finally {
      setConverting(null)
    }
  }

  function toggleExpand(id: string) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next) markRead(next)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Signal Queue</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
          Inbound market intelligence — permits, RFPs, customer events, and news.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Signals', value: stats.total,                  color: 'var(--text)'    },
          { label: 'New',            value: stats.newCount,               color: 'var(--accent)'  },
          { label: 'Hot',            value: stats.hotCount,               color: '#dc2626'        },
          { label: 'Est. Pipeline',  value: fmt$(stats.totalValue) ?? '—',color: 'var(--success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text3)' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search signals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-md"
          style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--bg4)', minWidth: 180 }}
        />
        <FilterChips
          label="Status"
          options={['ACTIVE', 'NEW', 'SAVED', 'CONVERTED', 'DISMISSED', 'ALL']}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          labelMap={{ ACTIVE: 'New + Saved', NEW: 'New', SAVED: 'Saved', CONVERTED: 'Converted', DISMISSED: 'Dismissed', ALL: 'All' }}
        />
        <FilterChips
          label="Priority"
          options={['ALL', 'HOT', 'WARM', 'COLD']}
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as SignalPriority | 'ALL')}
          labelMap={{ ALL: 'All Priority', HOT: '🔴 Hot', WARM: '🟡 Warm', COLD: 'Cold' }}
        />
        <FilterChips
          label="Type"
          options={['ALL', 'CONSTRUCTION_PERMIT', 'GOVERNMENT_RFP', 'CUSTOMER_SIGNAL', 'NEWS', 'PERSONNEL_CHANGE']}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as SignalType | 'ALL')}
          labelMap={{ ALL: 'All Types', CONSTRUCTION_PERMIT: 'Permits', GOVERNMENT_RFP: 'RFPs', CUSTOMER_SIGNAL: 'Customers', NEWS: 'News', PERSONNEL_CHANGE: 'Personnel' }}
        />
        <span className="ml-auto text-xs" style={{ color: 'var(--text3)' }}>
          {filtered.length} signal{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Signal list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg p-8 text-center" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
          <p style={{ color: 'var(--text3)' }}>No signals match your filters.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              reps={reps}
              expanded={expandedId === signal.id}
              converting={converting === signal.id}
              convertedMeta={convertedMeta[signal.id] ?? null}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onToggle={() => toggleExpand(signal.id)}
              onSave={() => saveSignal(signal.id)}
              onDismiss={() => dismissSignal(signal.id)}
              onRestore={() => restoreSignal(signal.id)}
              onConvert={() => convertToLead(signal.id)}
              onPatch={(body) => patch(signal.id, body)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── FilterChips ───────────────────────────────────────────────────────────────

function FilterChips({ options, value, onChange, labelMap }: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  labelMap: Record<string, string>
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="text-xs px-2.5 py-1 rounded-md transition-colors"
          style={
            value === opt
              ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
              : { background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--bg4)' }
          }
        >
          {labelMap[opt] ?? opt}
        </button>
      ))}
    </div>
  )
}

// ── SignalCard ────────────────────────────────────────────────────────────────

function SignalCard({
  signal, reps, expanded, converting, convertedMeta,
  currentUserId, currentUserRole,
  onToggle, onSave, onDismiss, onRestore, onConvert, onPatch,
}: {
  signal:          Signal
  reps:            { id: string; name: string | null }[]
  expanded:        boolean
  converting:      boolean
  convertedMeta:   ConvertedMeta | null
  currentUserId:   string
  currentUserRole: string
  onToggle:        () => void
  onSave:          () => void
  onDismiss:       () => void
  onRestore:       () => void
  onConvert:       () => void
  onPatch:         (body: object) => void
}) {
  const isDismissed  = signal.status === 'DISMISSED'
  const isConverted  = signal.status === 'CONVERTED'
  const isActionable = signal.status === 'NEW' || signal.status === 'SAVED'
  const isAdmin      = currentUserRole === 'TENANT_ADMIN' || currentUserRole === 'COBALT_SUPER_ADMIN'

  // Local state for inline editable fields (mirrors signal, kept in sync via onPatch)
  const [localValue, setLocalValue]     = useState(signal.estimatedValue !== null ? String(signal.estimatedValue) : '')
  const [localJobType, setLocalJobType]           = useState(signal.jobType         ?? '')
  const [localProductCategory, setLocalProductCategory] = useState(signal.productCategory ?? '')

  const inlineInputStyle: React.CSSProperties = {
    fontSize: 12,
    background: 'var(--bg3)',
    border: '1px solid var(--bg4)',
    borderRadius: 5,
    color: 'var(--text)',
    padding: '4px 8px',
    outline: 'none',
  }

  function handleValueBlur() {
    const parsed = localValue === '' ? null : parseFloat(localValue)
    if (parsed === signal.estimatedValue) return
    onPatch({ estimatedValue: parsed })
  }

  function handleJobTypeChange(v: string) {
    setLocalJobType(v)
    onPatch({ jobType: v || null })
  }

  function handleProductCategoryChange(v: string) {
    setLocalProductCategory(v)
    onPatch({ productCategory: v || null })
  }

  return (
    <div
      className="rounded-lg transition-all"
      style={{
        background: 'var(--bg2)',
        border:     `1px solid ${expanded ? 'var(--accent)' : 'var(--bg4)'}`,
        opacity:    isConverted ? 0.75 : isDismissed ? 0.55 : 1,
      }}
    >
      {/* Card header */}
      <button className="w-full text-left p-4 flex items-start gap-3" onClick={onToggle}>
        {/* Unread dot */}
        <div className="flex-none pt-1" style={{ width: 8 }}>
          {!signal.isRead && signal.status === 'NEW' && (
            <span className="block w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
          )}
        </div>

        {/* Priority badge */}
        <div
          className="flex-none rounded text-xs font-bold px-1.5 py-0.5 mt-0.5"
          style={{ background: PRIORITY_COLOR[signal.priority] + '20', color: PRIORITY_COLOR[signal.priority], minWidth: 36, textAlign: 'center' }}
        >
          {signal.priority}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: TYPE_COLOR[signal.type] + '18', color: TYPE_COLOR[signal.type] }}>
              {TYPE_LABEL[signal.type]}
            </span>
            {isConverted && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#16a34a' }}>
                ✓ Converted
              </span>
            )}
            {isDismissed && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
                Dismissed
              </span>
            )}
            {signal.status === 'SAVED' && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                Saved
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text3)' }}>{relativeDate(signal.detectedAt)}</span>
            {isConverted && signal.convertedLeadId && (
              <Link href="/pipeline" onClick={(e) => e.stopPropagation()} className="text-xs" style={{ color: 'var(--accent)' }}>
                View Lead →
              </Link>
            )}
          </div>

          <p className="text-sm font-medium mt-1 leading-snug" style={{ color: 'var(--text)' }}>{signal.title}</p>

          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {signal.company && <span className="text-xs" style={{ color: 'var(--text3)' }}>{signal.company}</span>}
            {signal.location && <span className="text-xs" style={{ color: 'var(--text3)' }}>· {signal.location}</span>}
            {signal.estimatedValue && <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>{fmt$(signal.estimatedValue)}</span>}
            {signal.jobType && <span className="text-xs" style={{ color: 'var(--text3)' }}>· {JOB_TYPE_LABEL[signal.jobType] ?? signal.jobType}</span>}
            {signal.productCategory && <span className="text-xs" style={{ color: 'var(--text3)' }}>· {PRODUCT_CATEGORY_LABEL[signal.productCategory] ?? signal.productCategory}</span>}
          </div>
        </div>

        {signal.assignedTo?.name && (
          <div className="flex-none text-xs hidden sm:block" style={{ color: 'var(--text3)' }}>
            {signal.assignedTo.name.split(' ')[0]}
          </div>
        )}
        <svg
          className="flex-none mt-1 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : '', color: 'var(--text3)' }}
          width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--bg4)' }}>
          <div className="pt-4 flex flex-col gap-4">

            {/* Description */}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{signal.description}</p>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text3)' }}>
              {signal.sourceName && (
                <span>
                  Source:{' '}
                  {signal.sourceUrl
                    ? <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{signal.sourceName}</a>
                    : signal.sourceName}
                </span>
              )}
              {signal.contactName && (
                <span>Contact: <strong style={{ color: 'var(--text2)' }}>{signal.contactName}</strong>{signal.contactTitle ? `, ${signal.contactTitle}` : ''}</span>
              )}
            </div>

            {/* Inline classification fields — editable (active signals) or read-only (converted/dismissed) */}
            <div>
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text3)', letterSpacing: '0.05em' }}>Classification</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {/* Job Type */}
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text3)' }}>Job Type</label>
                  {isActionable ? (
                    <select
                      value={localJobType}
                      onChange={(e) => handleJobTypeChange(e.target.value)}
                      style={{ ...inlineInputStyle, width: '100%', cursor: 'pointer' }}
                    >
                      {JOB_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text)' }}>
                      {signal.jobType ? (JOB_TYPE_LABEL[signal.jobType] ?? signal.jobType) : '—'}
                    </span>
                  )}
                </div>

                {/* Product Category */}
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text3)' }}>Product</label>
                  {isActionable ? (
                    <select
                      value={localProductCategory}
                      onChange={(e) => handleProductCategoryChange(e.target.value)}
                      style={{ ...inlineInputStyle, width: '100%', cursor: 'pointer' }}
                    >
                      {PRODUCT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text)' }}>
                      {signal.productCategory ? (PRODUCT_CATEGORY_LABEL[signal.productCategory] ?? signal.productCategory) : '—'}
                    </span>
                  )}
                </div>

                {/* Estimated Value */}
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text3)' }}>Est. Value ($)</label>
                  {isActionable ? (
                    <input
                      type="number"
                      value={localValue}
                      onChange={(e) => setLocalValue(e.target.value)}
                      onBlur={handleValueBlur}
                      placeholder="0"
                      style={{ ...inlineInputStyle, width: '100%' }}
                    />
                  ) : (
                    <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                      {fmt$(signal.estimatedValue) ?? '—'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Assign rep (admins only) */}
            {isAdmin && !isConverted && (
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: 'var(--text3)' }}>Assign to:</label>
                <select
                  value={signal.assignedToId ?? ''}
                  onChange={(e) => onPatch({ assignedToId: e.target.value || null })}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--bg4)' }}
                >
                  <option value="">Unassigned</option>
                  {reps.map((r) => <option key={r.id} value={r.id}>{r.name ?? r.id}</option>)}
                </select>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isActionable && (
                <>
                  <ActionButton primary onClick={onConvert} disabled={converting}>
                    {converting ? 'Converting…' : 'Convert to Lead'}
                  </ActionButton>
                  {signal.status === 'NEW' && <ActionButton onClick={onSave}>Save</ActionButton>}
                  <ActionButton onClick={onDismiss} danger>Dismiss</ActionButton>
                </>
              )}
              {isDismissed && <ActionButton onClick={onRestore}>Restore</ActionButton>}
              {isConverted && (
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}
                  >
                    ✓ Converted to Lead
                  </span>
                  <Link href="/pipeline" className="text-xs" style={{ color: 'var(--accent)' }}>
                    View in Pipeline →
                  </Link>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────

function ActionButton({ children, onClick, primary, danger, disabled }: {
  children:  React.ReactNode
  onClick:   () => void
  primary?:  boolean
  danger?:   boolean
  disabled?: boolean
}) {
  const baseStyle: React.CSSProperties = primary
    ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
    : danger
    ? { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
    : { background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--bg4)' }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-3 py-1.5 rounded-md transition-colors"
      style={{ ...baseStyle, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  )
}
