'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedSearchRow {
  id:          string
  name:        string
  query:       string
  isActive:    boolean
  frequency:   'DAILY' | 'WEEKLY'
  createdAtMs: number
}

interface CompanyBrief {
  whatTheyDo:            string
  sizeAndLocations:      string
  physicalSecurityNeeds: string
  recentSignals:         string
  suggestedOpener:       string
  raw?:                  string
}

interface DeepBrief {
  physicalFootprint:  string
  technologyAndOEM:   string
  budgetIntelligence: string
  buyingProcess:      string
  whoToTarget:        string
  suggestedApproach:  string
  raw?:               string
}

interface ResearchResult {
  company: string
  brief:   CompanyBrief
}

interface DeepResult {
  company: string
  brief:   DeepBrief
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ResearchClient({ initialSavedSearches }: { initialSavedSearches: SavedSearchRow[] }) {
  const [savedSearches, setSavedSearches] = useState<SavedSearchRow[]>(initialSavedSearches)
  const [showAddModal, setShowAddModal]   = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Research</h1>
        <p className="text-sm" style={{ color: 'var(--text2)' }}>AI-powered account research and saved search tracking.</p>
      </div>

      <CompanyResearchSection />

      <SavedSearchesSection
        savedSearches={savedSearches}
        onUpdate={setSavedSearches}
        onAdd={() => setShowAddModal(true)}
      />

      {showAddModal && (
        <AddSavedSearchModal
          onClose={() => setShowAddModal(false)}
          onCreated={(s) => {
            setSavedSearches((prev) => [s, ...prev])
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Suggestion {
  companyName: string
  reason:      string
}

// ── Section 1: Company Research ───────────────────────────────────────────────

function CompanyResearchSection() {
  const [query, setQuery]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<ResearchResult | null>(null)

  const [deepLoading, setDeepLoading] = useState(false)
  const [deepError, setDeepError]     = useState<string | null>(null)
  const [deepResult, setDeepResult]   = useState<DeepResult | null>(null)

  const [suggestions, setSuggestions]           = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const [toast, setToast] = useState(false)

  async function handleResearch(companyOverride?: string) {
    const company = (companyOverride ?? query).trim()
    if (!company) return
    if (companyOverride) setQuery(companyOverride)
    setLoading(true)
    setError(null)
    setResult(null)
    setDeepResult(null)
    setDeepError(null)
    setSuggestions([])
    try {
      const res = await fetch('/api/research/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Research failed')
      }
      setResult(await res.json() as ResearchResult)
      fetchSuggestions(company)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSuggestions(company: string) {
    setSuggestionsLoading(true)
    try {
      const res = await fetch('/api/research/company/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      })
      if (res.ok) {
        const data = await res.json() as { suggestions: Suggestion[] }
        setSuggestions(data.suggestions ?? [])
      }
    } catch {
      // suggestions are non-critical — fail silently
    } finally {
      setSuggestionsLoading(false)
    }
  }

  async function handleGoDeeper() {
    if (!result) return
    setDeepLoading(true)
    setDeepError(null)
    setDeepResult(null)
    try {
      const res = await fetch('/api/research/company/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: result.company }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Deep research failed')
      }
      setDeepResult(await res.json() as DeepResult)
    } catch (e) {
      setDeepError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setDeepLoading(false)
    }
  }

  function handleGenerateOutreach() {
    setToast(true)
    setTimeout(() => setToast(false), 3000)
  }

  return (
    <section style={{ position: 'relative' }}>
      <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Company Research</h2>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, maxWidth: 560 }}>
        <input
          type="text"
          placeholder="Enter a company name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleResearch() }}
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--bg4)',
            background: 'var(--bg2)',
            color: 'var(--text)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={() => handleResearch()}
          disabled={loading || !query.trim()}
          style={{
            padding: '8px 18px',
            borderRadius: 6,
            border: 'none',
            background: loading || !query.trim() ? 'var(--bg4)' : 'var(--accent)',
            color: loading || !query.trim() ? 'var(--text3)' : '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? <Spinner /> : null}
          {loading ? 'Researching…' : 'Research'}
        </button>
      </div>

      {error && <p className="text-sm mt-3" style={{ color: '#f87171' }}>{error}</p>}

      {/* Stage 1 result */}
      {result && !loading && <BriefCard result={result} />}

      {/* Action buttons — visible once Stage 1 loads */}
      {result && !loading && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {!deepResult && (
            <button
              onClick={handleGoDeeper}
              disabled={deepLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 6,
                border: '1px solid var(--bg4)',
                background: deepLoading ? 'var(--bg4)' : 'var(--bg2)',
                color: deepLoading ? 'var(--text3)' : 'var(--text)',
                fontSize: 13,
                fontWeight: 500,
                cursor: deepLoading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {deepLoading ? <Spinner /> : <IconLayers />}
              {deepLoading ? 'Running deep research…' : 'Go Deeper'}
            </button>
          )}
          <button
            onClick={handleGenerateOutreach}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <IconMail />
            Generate Outreach
          </button>
        </div>
      )}

      {/* Suggested lookups */}
      {(suggestionsLoading || suggestions.length > 0) && result && !loading && (
        <div style={{ marginTop: 16 }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>
            You Might Also Research
          </p>
          {suggestionsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Spinner />
              <span className="text-xs" style={{ color: 'var(--text3)' }}>Finding similar companies…</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((s) => (
                <button
                  key={s.companyName}
                  onClick={() => handleResearch(s.companyName)}
                  disabled={loading}
                  title={s.reason}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: '1px solid var(--bg4)',
                    background: 'var(--bg2)',
                    color: 'var(--text)',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bg4)' }}
                >
                  <IconSearch />
                  <span>{s.companyName}</span>
                  <span className="text-xs" style={{ color: 'var(--text3)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.reason}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {deepError && <p className="text-sm mt-2" style={{ color: '#f87171' }}>{deepError}</p>}

      {/* Stage 2 result */}
      {deepResult && !deepLoading && <DeepBriefCard result={deepResult} />}

      {/* Coming soon toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            zIndex: 100,
            background: '#1e293b',
            border: '1px solid var(--bg4)',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            color: '#fff',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: '#f59e0b' }}>⚡</span>
          Outreach generation coming soon.
        </div>
      )}
    </section>
  )
}

// ── Stage 1 Brief Card ────────────────────────────────────────────────────────

function BriefCard({ result }: { result: ResearchResult }) {
  const { company, brief } = result

  if (brief.raw) {
    return (
      <div className="rounded-lg p-6 mt-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
        <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>{company}</h3>
        <p className="text-sm" style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{brief.raw}</p>
      </div>
    )
  }

  const sections: { label: string; key: keyof CompanyBrief; accent?: string }[] = [
    { label: 'What They Do',            key: 'whatTheyDo' },
    { label: 'Size & Locations',        key: 'sizeAndLocations' },
    { label: 'Physical Security Needs', key: 'physicalSecurityNeeds', accent: 'var(--accent)' },
    { label: 'Recent News & Signals',   key: 'recentSignals' },
    { label: 'Suggested Opener',        key: 'suggestedOpener',       accent: '#34d399' },
  ]

  return (
    <div className="rounded-lg mt-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg4)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--accent)' }}><IconSearch /></span>
        <span className="font-semibold" style={{ color: 'var(--text)', fontSize: 15 }}>{company}</span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text3)' }}>Stage 1 — Overview</span>
      </div>
      <div>
        {sections.map(({ label, key, accent }, i) => (
          <div
            key={key}
            style={{
              padding: '14px 20px',
              borderBottom: i < sections.length - 1 ? '1px solid var(--bg4)' : 'none',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: accent ?? 'var(--text3)' }}>
              {label}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
              {brief[key] as string}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stage 2 Deep Brief Card ───────────────────────────────────────────────────

function DeepBriefCard({ result }: { result: DeepResult }) {
  const { company, brief } = result

  if (brief.raw) {
    return (
      <div className="rounded-lg p-6 mt-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
        <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>{company} — Deep Research</h3>
        <p className="text-sm" style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{brief.raw}</p>
      </div>
    )
  }

  function parseBullets(text: string): string[] {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    return lines.length > 1 ? lines : text.split(/\.\s+(?=[A-Z])/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean)
  }

  // estimated = amber accent + amber left border; actionable = green; neutral = default
  type SectionDef = {
    label: string
    key: keyof DeepBrief
    type: 'estimated' | 'actionable' | 'neutral'
    renderContent?: (text: string) => React.ReactNode
  }
  const sections: SectionDef[] = [
    { label: 'Physical Footprint',  key: 'physicalFootprint',  type: 'estimated'  },
    { label: 'Technology & OEM',    key: 'technologyAndOEM',   type: 'estimated'  },
    { label: 'Budget Intelligence', key: 'budgetIntelligence', type: 'estimated'  },
    { label: 'Buying Process',      key: 'buyingProcess',      type: 'estimated'  },
    {
      label: 'Who to Target',
      key: 'whoToTarget',
      type: 'neutral',
      renderContent: (text) => (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {parseBullets(text).map((item, i) => (
            <li key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</li>
          ))}
        </ul>
      ),
    },
    { label: 'Suggested Approach',  key: 'suggestedApproach',  type: 'actionable' },
  ]

  const labelColor = (type: string) => {
    if (type === 'estimated')  return '#f59e0b'
    if (type === 'actionable') return '#34d399'
    return 'var(--text3)'
  }

  const borderColor = (type: string) => {
    if (type === 'estimated')  return '#f59e0b'
    if (type === 'actionable') return '#34d399'
    return 'transparent'
  }

  return (
    <div className="rounded-lg mt-4" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg4)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#f59e0b' }}><IconLayers /></span>
        <span className="font-semibold" style={{ color: 'var(--text)', fontSize: 15 }}>{company}</span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text3)' }}>Stage 2 — Deep Research</span>
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--bg4)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="text-xs" style={{ color: 'var(--text3)' }}>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>■</span> Estimated / Likely
        </span>
        <span className="text-xs" style={{ color: 'var(--text3)' }}>
          <span style={{ color: '#34d399', fontWeight: 600 }}>■</span> Recommended Action
        </span>
      </div>

      <div>
        {sections.map(({ label, key, type, renderContent }, i) => (
          <div
            key={key}
            style={{
              padding: '14px 20px',
              borderBottom: i < sections.length - 1 ? '1px solid var(--bg4)' : 'none',
              borderLeft: `3px solid ${borderColor(type)}`,
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: labelColor(type) }}>
              {label}
            </p>
            {renderContent
              ? renderContent(brief[key] as string)
              : <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{brief[key] as string}</p>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 2: Saved Searches ─────────────────────────────────────────────────

function SavedSearchesSection({
  savedSearches,
  onUpdate,
  onAdd,
}: {
  savedSearches: SavedSearchRow[]
  onUpdate: (rows: SavedSearchRow[]) => void
  onAdd: () => void
}) {
  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/saved-searches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    if (res.ok) {
      const updated = await res.json() as SavedSearchRow
      onUpdate(savedSearches.map((s) => s.id === id ? { ...s, isActive: updated.isActive } : s))
    }
  }

  async function deleteSearch(id: string) {
    const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      onUpdate(savedSearches.filter((s) => s.id !== id))
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Saved Searches</h2>
        <button
          onClick={onAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--bg4)',
            background: 'var(--bg2)',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <IconPlus />
          Add Saved Search
        </button>
      </div>

      {savedSearches.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text3)' }}>No saved searches yet. Add one to track keywords on a schedule.</p>
        </div>
      ) : (
        <div className="rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)', overflow: 'hidden' }}>
          {savedSearches.map((s, i) => (
            <SavedSearchItem
              key={s.id}
              row={s}
              isLast={i === savedSearches.length - 1}
              onToggle={() => toggleActive(s.id, s.isActive)}
              onDelete={() => deleteSearch(s.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SavedSearchItem({
  row,
  isLast,
  onToggle,
  onDelete,
}: {
  row: SavedSearchRow
  isLast: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--bg4)',
      }}
    >
      <button
        onClick={onToggle}
        title={row.isActive ? 'Disable auto-run' : 'Enable auto-run'}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none',
          background: row.isActive ? 'var(--accent)' : 'var(--bg4)',
          cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: row.isActive ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s',
        }} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{row.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{row.query}</p>
      </div>

      <span className="text-xs font-medium" style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg4)', color: 'var(--text2)', flexShrink: 0 }}>
        {row.frequency === 'DAILY' ? 'Daily' : 'Weekly'}
      </span>

      <span className="text-xs" style={{ color: row.isActive ? '#34d399' : 'var(--text3)', flexShrink: 0, minWidth: 50, textAlign: 'right' }}>
        {row.isActive ? 'Active' : 'Paused'}
      </span>

      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onDelete} style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            Delete
          </button>
          <button onClick={() => setConfirmDelete(false)} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid var(--bg4)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} title="Delete" style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0 }}>
          <IconTrash />
        </button>
      )}
    </div>
  )
}

// ── Add Saved Search Modal ────────────────────────────────────────────────────

function AddSavedSearchModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (row: SavedSearchRow) => void
}) {
  const [name, setName]           = useState('')
  const [query, setQuery]         = useState('')
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY'>('DAILY')
  const [isActive, setIsActive]   = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim() || !query.trim()) { setError('Name and query are required.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), query: query.trim(), frequency, isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to save')
      }
      const created = await res.json() as { id: string; name: string; query: string; isActive: boolean; frequency: string; createdAt: string }
      onCreated({
        id:          created.id,
        name:        created.name,
        query:       created.query,
        isActive:    created.isActive,
        frequency:   created.frequency as 'DAILY' | 'WEEKLY',
        createdAtMs: new Date(created.createdAt).getTime(),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--bg4)', width: '100%', maxWidth: 480, padding: 24 }}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)', fontSize: 15 }}>Add Saved Search</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Name">
            <input type="text" placeholder="e.g. New school construction permits" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Search Query / Keywords">
            <input type="text" placeholder="e.g. school construction permit security" value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Frequency">
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as 'DAILY' | 'WEEKLY')} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setIsActive((v) => !v)}
              style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: isActive ? 'var(--accent)' : 'var(--bg4)', cursor: 'pointer', position: 'relative', transition: 'background 0.15s' }}
            >
              <span style={{ position: 'absolute', top: 2, left: isActive ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
            </button>
            <span className="text-sm" style={{ color: 'var(--text2)' }}>{isActive ? 'Auto-run enabled' : 'Auto-run disabled'}</span>
          </div>
        </div>

        {error && <p className="text-sm mt-3" style={{ color: '#f87171' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--bg4)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: saving ? 'var(--bg4)' : 'var(--accent)', color: saving ? 'var(--text3)' : '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save Search'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid var(--bg4)',
  background: 'var(--bg2)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>{label}</label>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6.5" cy="6.5" r="4" />
      <line x1="9.5" y1="9.5" x2="14" y2="14" strokeLinecap="round" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 5l7 4 7-4-7-4-7 4z" strokeLinejoin="round" />
      <path d="M1 9l7 4 7-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 12.5l7 4 7-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1" />
      <path d="M1.5 4.5L8 9l6.5-4.5" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="7" y1="2" x2="7" y2="12" strokeLinecap="round" />
      <line x1="2" y1="7" x2="12" y2="7" strokeLinecap="round" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 3.5l.5 8M9 3.5l-.5 8" strokeLinecap="round" />
    </svg>
  )
}
