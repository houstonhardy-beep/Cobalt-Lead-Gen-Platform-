'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type SignalType     = 'CONSTRUCTION_PERMIT' | 'GOVERNMENT_RFP' | 'CUSTOMER_SIGNAL' | 'NEWS' | 'PERSONNEL_CHANGE'
type SignalPriority = 'HOT' | 'WARM' | 'COLD'
type SignalStatus   = 'NEW' | 'SAVED' | 'CONVERTED' | 'DISMISSED'

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

const STATUS_LABEL: Record<SignalStatus, string> = {
  NEW:       'New',
  SAVED:     'Saved',
  CONVERTED: 'Converted',
  DISMISSED: 'Dismissed',
}

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
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [signals, setSignals]       = useState<Signal[]>(initialSignals)
  const [search,  setSearch]        = useState('')
  const [typeFilter,     setTypeFilter]     = useState<SignalType | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<SignalPriority | 'ALL'>('ALL')
  const [statusFilter,   setStatusFilter]   = useState<SignalStatus | 'ALL'>('NEW')
  const [expandedId,     setExpandedId]     = useState<string | null>(null)
  const [converting,     setConverting]     = useState<string | null>(null)

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const all  = signals.filter((s) => s.status !== 'DISMISSED')
    const newS = signals.filter((s) => s.status === 'NEW')
    const hot  = newS.filter((s) => s.priority === 'HOT')
    const totalValue = newS.reduce((acc, s) => acc + (s.estimatedValue ?? 0), 0)
    return { total: all.length, newCount: newS.length, hotCount: hot.length, totalValue }
  }, [signals])

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return signals.filter((s) => {
      if (typeFilter     !== 'ALL' && s.type     !== typeFilter)     return false
      if (priorityFilter !== 'ALL' && s.priority !== priorityFilter) return false
      if (statusFilter   !== 'ALL' && s.status   !== statusFilter)   return false
      if (q && ![s.title, s.company, s.location, s.description].some((v) => v?.toLowerCase().includes(q))) return false
      return true
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
      const { leadId } = await res.json() as { leadId: string }
      setSignals((prev) =>
        prev.map((s) => s.id === id ? { ...s, status: 'CONVERTED', convertedLeadId: leadId, isRead: true } : s)
      )
      startTransition(() => router.push(`/pipeline`))
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
          { label: 'Total Active',   value: stats.total,                      color: 'var(--text)'    },
          { label: 'New',            value: stats.newCount,                   color: 'var(--accent)'  },
          { label: 'Hot Signals',    value: stats.hotCount,                   color: '#dc2626'        },
          { label: 'Est. Pipeline',  value: fmt$(stats.totalValue) ?? '—',    color: 'var(--success)' },
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
          options={['ALL', 'NEW', 'SAVED', 'CONVERTED', 'DISMISSED']}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as SignalStatus | 'ALL')}
          labelMap={{ ALL: 'All Status', NEW: 'New', SAVED: 'Saved', CONVERTED: 'Converted', DISMISSED: 'Dismissed' }}
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
          labelMap={{
            ALL:                'All Types',
            CONSTRUCTION_PERMIT:'Permits',
            GOVERNMENT_RFP:     'RFPs',
            CUSTOMER_SIGNAL:    'Customers',
            NEWS:               'News',
            PERSONNEL_CHANGE:   'Personnel',
          }}
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
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onToggle={() => toggleExpand(signal.id)}
              onSave={() => saveSignal(signal.id)}
              onDismiss={() => dismissSignal(signal.id)}
              onRestore={() => restoreSignal(signal.id)}
              onConvert={() => convertToLead(signal.id)}
              onAssign={(userId) => patch(signal.id, { assignedToId: userId })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── FilterChips ───────────────────────────────────────────────────────────────

function FilterChips({
  options,
  value,
  onChange,
  labelMap,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  labelMap: Record<string, string>
}) {
  return (
    <div className="flex gap-1">
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
  signal,
  reps,
  expanded,
  converting,
  currentUserId,
  currentUserRole,
  onToggle,
  onSave,
  onDismiss,
  onRestore,
  onConvert,
  onAssign,
}: {
  signal:          Signal
  reps:            { id: string; name: string | null }[]
  expanded:        boolean
  converting:      boolean
  currentUserId:   string
  currentUserRole: string
  onToggle:        () => void
  onSave:          () => void
  onDismiss:       () => void
  onRestore:       () => void
  onConvert:       () => void
  onAssign:        (userId: string) => void
}) {
  const isDismissed  = signal.status === 'DISMISSED'
  const isConverted  = signal.status === 'CONVERTED'
  const isActionable = signal.status === 'NEW' || signal.status === 'SAVED'
  const isAdmin      = currentUserRole === 'TENANT_ADMIN' || currentUserRole === 'COBALT_SUPER_ADMIN'

  return (
    <div
      className="rounded-lg transition-all"
      style={{
        background:  'var(--bg2)',
        border:      `1px solid ${expanded ? 'var(--accent)' : 'var(--bg4)'}`,
        opacity:     isDismissed ? 0.55 : 1,
      }}
    >
      {/* Card header — always visible */}
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={onToggle}
      >
        {/* Unread dot */}
        <div className="flex-none pt-1" style={{ width: 8 }}>
          {!signal.isRead && signal.status === 'NEW' && (
            <span className="block w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
          )}
        </div>

        {/* Priority indicator */}
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
            {signal.status !== 'NEW' && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
                {STATUS_LABEL[signal.status]}
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text3)' }}>{relativeDate(signal.detectedAt)}</span>
          </div>
          <p className="text-sm font-medium mt-1 leading-snug" style={{ color: 'var(--text)' }}>{signal.title}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {signal.company && (
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{signal.company}</span>
            )}
            {signal.location && (
              <span className="text-xs" style={{ color: 'var(--text3)' }}>· {signal.location}</span>
            )}
            {signal.estimatedValue && (
              <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>{fmt$(signal.estimatedValue)}</span>
            )}
          </div>
        </div>

        {/* Assigned rep (compact) */}
        {signal.assignedTo?.name && (
          <div className="flex-none text-xs hidden sm:block" style={{ color: 'var(--text3)' }}>
            {signal.assignedTo.name.split(' ')[0]}
          </div>
        )}

        {/* Chevron */}
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

            {/* Meta row */}
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
              {signal.estimatedValue && (
                <span>Est. value: <strong style={{ color: 'var(--success)' }}>{fmt$(signal.estimatedValue)}</strong></span>
              )}
              {isConverted && signal.convertedLeadId && (
                <span style={{ color: 'var(--success)' }}>Converted to Lead</span>
              )}
            </div>

            {/* Assign rep (admins only) */}
            {isAdmin && !isConverted && (
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: 'var(--text3)' }}>Assign to:</label>
                <select
                  value={signal.assignedToId ?? ''}
                  onChange={(e) => onAssign(e.target.value)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--bg4)' }}
                >
                  <option value="">Unassigned</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>{r.name ?? r.id}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {isActionable && (
                <>
                  <ActionButton
                    primary
                    onClick={onConvert}
                    disabled={converting}
                  >
                    {converting ? 'Converting…' : 'Convert to Lead'}
                  </ActionButton>

                  {signal.status === 'NEW' && (
                    <ActionButton onClick={onSave}>Save</ActionButton>
                  )}

                  <ActionButton onClick={onDismiss} danger>Dismiss</ActionButton>
                </>
              )}

              {isDismissed && (
                <ActionButton onClick={onRestore}>Restore</ActionButton>
              )}

              {isConverted && (
                <span className="text-xs px-3 py-1.5 rounded" style={{ background: 'var(--bg3)', color: 'var(--success)' }}>
                  ✓ Converted to Lead
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────

function ActionButton({
  children,
  onClick,
  primary,
  danger,
  disabled,
}: {
  children: React.ReactNode
  onClick:  () => void
  primary?: boolean
  danger?:  boolean
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
