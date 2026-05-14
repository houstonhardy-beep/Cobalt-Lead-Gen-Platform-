'use client'

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryRow {
  id:               string
  companyName:      string
  channel:          'EMAIL' | 'CALL_SCRIPT'
  tone:             string
  generatedContent: string
  feedback:         string | null
  createdAtMs:      number
}

interface Props {
  initialHistory:  HistoryRow[]
  initialCompany:  string
  initialResearch: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TONES = [
  'Professional',
  'Conversational',
  'Direct & Brief',
  'Consultative',
  'Bold & Challenger',
] as const

// ── Main Component ────────────────────────────────────────────────────────────

export function OutreachClient({ initialHistory, initialCompany, initialResearch }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>(initialHistory)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Outreach</h1>
        <p className="text-sm" style={{ color: 'var(--text2)' }}>Generate emails and call scripts using AI, tailored to your prospects.</p>
      </div>

      <GeneratorSection
        initialCompany={initialCompany}
        initialResearch={initialResearch}
        onGenerated={(row) => setHistory((prev) => [row, ...prev])}
        onFeedback={(id, feedback) =>
          setHistory((prev) => prev.map((r) => r.id === id ? { ...r, feedback } : r))
        }
      />

      <HistorySection history={history} />
    </div>
  )
}

// ── Generator Section ─────────────────────────────────────────────────────────

function GeneratorSection({
  initialCompany,
  initialResearch,
  onGenerated,
  onFeedback,
}: {
  initialCompany:  string
  initialResearch: string
  onGenerated:     (row: HistoryRow) => void
  onFeedback:      (id: string, feedback: string) => void
}) {
  const [company, setCompany]   = useState(initialCompany)
  const [channel, setChannel]   = useState<'EMAIL' | 'CALL_SCRIPT'>('EMAIL')
  const [tone, setTone]         = useState<string>('Professional')
  const [researchContext, setResearchContext] = useState<Record<string, unknown> | null>(null)

  const [generating, setGenerating]       = useState(false)
  const [generatedContent, setGenContent] = useState<string | null>(null)
  const [logId, setLogId]                 = useState<string | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [copied, setCopied]               = useState(false)
  const [saving, setSaving]               = useState(false)

  const [feedback, setFeedback]             = useState('')
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [feedbackSaved, setFeedbackSaved]   = useState(false)

  // Parse research context from base64 URL param
  useEffect(() => {
    if (!initialResearch) return
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(initialResearch)))) as Record<string, unknown>
      setResearchContext(decoded)
    } catch { /* ignore malformed param */ }
  }, [initialResearch])

  async function handleGenerate() {
    if (!company.trim()) return
    setGenerating(true)
    setError(null)
    setGenContent(null)
    setLogId(null)
    setFeedback('')
    setFeedbackSaved(false)

    try {
      // 1. Generate
      const genRes = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName:     company.trim(),
          channel,
          tone,
          researchContext: researchContext ?? undefined,
        }),
      })
      if (!genRes.ok) {
        const d = await genRes.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Generation failed')
      }
      const { generatedContent: content } = await genRes.json() as { generatedContent: string }
      setGenContent(content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!generatedContent || saving) return
    setSaving(true)
    try {
      const logRes = await fetch('/api/outreach/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName:      company.trim(),
          channel,
          tone,
          researchContext:  researchContext ?? undefined,
          generatedContent,
        }),
      })
      if (logRes.ok) {
        const { id } = await logRes.json() as { id: string }
        setLogId(id)
        onGenerated({
          id,
          companyName:      company.trim(),
          channel,
          tone,
          generatedContent,
          feedback:         null,
          createdAtMs:      Date.now(),
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveFeedback() {
    if (!logId || !feedback.trim()) return
    setSavingFeedback(true)
    try {
      const res = await fetch(`/api/outreach/log/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      })
      if (res.ok) {
        setFeedbackSaved(true)
        onFeedback(logId, feedback.trim())
      }
    } finally {
      setSavingFeedback(false)
    }
  }

  function handleCopy() {
    if (!generatedContent) return
    navigator.clipboard.writeText(generatedContent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const canGenerate = company.trim().length > 0 && !generating

  return (
    <section>
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Outreach Generator</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>
        {/* Company input */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text3)' }}>Company</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Enter company name…"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--bg4)', background: 'var(--bg2)',
                color: 'var(--text)', fontSize: 14, outline: 'none',
              }}
            />
            {researchContext && (
              <span
                className="text-xs font-medium"
                style={{
                  padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                  background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
              >
                Research loaded
              </span>
            )}
          </div>
        </div>

        {/* Channel selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text3)' }}>Channel</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['EMAIL', 'CALL_SCRIPT'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                style={{
                  padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  border: channel === ch ? '1px solid var(--accent)' : '1px solid var(--bg4)',
                  background: channel === ch ? 'rgba(99,102,241,0.12)' : 'var(--bg2)',
                  color: channel === ch ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer',
                }}
              >
                {ch === 'EMAIL' ? 'Email' : 'Call Script'}
              </button>
            ))}
            {/* Coming soon */}
            {(['SMS', 'LinkedIn'] as const).map((ch) => (
              <span
                key={ch}
                style={{
                  padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  border: '1px solid var(--bg4)', background: 'transparent',
                  color: 'var(--text3)', cursor: 'not-allowed', opacity: 0.5,
                }}
              >
                {ch} <span style={{ fontSize: 10 }}>Coming Soon</span>
              </span>
            ))}
          </div>
        </div>

        {/* Tone selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text3)' }}>Tone</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: tone === t ? '1px solid var(--accent)' : '1px solid var(--bg4)',
                  background: tone === t ? 'rgba(99,102,241,0.12)' : 'var(--bg2)',
                  color: tone === t ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <div>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 22px', borderRadius: 6, border: 'none',
              background: canGenerate ? 'var(--accent)' : 'var(--bg4)',
              color: canGenerate ? '#fff' : 'var(--text3)',
              fontSize: 14, fontWeight: 600, cursor: canGenerate ? 'pointer' : 'not-allowed',
            }}
          >
            {generating ? <Spinner /> : <IconSparkle />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
      </div>

      {/* Output card */}
      {generatedContent && !generating && (
        <div className="rounded-lg mt-6" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)', overflow: 'hidden', maxWidth: 680 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg4)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text3)', flex: 1 }}>
              {channel === 'EMAIL' ? 'Email' : 'Call Script'} — {tone}
            </span>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 5, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--bg4)', background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
                color: copied ? '#34d399' : 'var(--text2)', cursor: 'pointer',
              }}
            >
              {copied ? <IconCheck /> : <IconCopy />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre
            style={{
              margin: 0, padding: '16px 20px',
              fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65,
              color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 480, overflowY: 'auto',
            }}
          >
            {generatedContent}
          </pre>

          {/* Save actions — shown until saved */}
          {!logId && (
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--bg4)', display: 'flex', gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  border: '1px solid var(--bg4)',
                  background: saving ? 'var(--bg4)' : 'var(--bg)',
                  color: saving ? 'var(--text3)' : 'var(--text)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  border: 'none',
                  background: saving ? 'var(--bg4)' : '#16a34a',
                  color: saving ? 'var(--text3)' : '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Mark as Sent
              </button>
            </div>
          )}

          {/* Feedback — shown after saved */}
          {logId && (
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--bg4)' }}>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text3)' }}>
                How was this? Any adjustments for next time?
              </label>
              {feedbackSaved ? (
                <p className="text-sm" style={{ color: '#34d399' }}>Feedback saved. Thanks!</p>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="e.g. Make it shorter, lead with the camera angle…"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFeedback() }}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 6,
                      border: '1px solid var(--bg4)', background: 'var(--bg)',
                      color: 'var(--text)', fontSize: 13, outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSaveFeedback}
                    disabled={savingFeedback || !feedback.trim()}
                    style={{
                      padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                      border: 'none',
                      background: !feedback.trim() ? 'var(--bg4)' : 'var(--accent)',
                      color: !feedback.trim() ? 'var(--text3)' : '#fff',
                      cursor: !feedback.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {savingFeedback ? 'Saving…' : 'Save Feedback'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── History Section ───────────────────────────────────────────────────────────

function HistorySection({ history }: { history: HistoryRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function fmt(ms: number) {
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Outreach History</h2>

      {history.length === 0 ? (
        <div className="rounded-lg p-8 text-center" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>No outreach generated yet. Use the generator above to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)', overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 90px 130px 1fr 40px',
              gap: 12,
              padding: '8px 16px',
              borderBottom: '1px solid var(--bg4)',
            }}
          >
            {['Date', 'Company', 'Channel', 'Tone', 'Preview', ''].map((h) => (
              <span key={h} className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {history.map((row, i) => (
            <div key={row.id} style={{ borderBottom: i < history.length - 1 ? '1px solid var(--bg4)' : 'none' }}>
              {/* Summary row */}
              <div
                onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 90px 130px 1fr 40px',
                  gap: 12,
                  padding: '11px 16px',
                  cursor: 'pointer',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
              >
                <span className="text-xs" style={{ color: 'var(--text3)' }}>{fmt(row.createdAtMs)}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.companyName}</span>
                <ChannelBadge channel={row.channel} />
                <span className="text-xs" style={{ color: 'var(--text2)' }}>{row.tone}</span>
                <span className="text-xs" style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.generatedContent.slice(0, 80)}{row.generatedContent.length > 80 ? '…' : ''}
                </span>
                <span style={{ textAlign: 'center' }}>
                  {row.feedback ? <span style={{ color: '#34d399', fontSize: 14 }}>✓</span> : null}
                </span>
              </div>

              {/* Expanded row */}
              {expandedId === row.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--bg4)' }}>
                  <pre
                    style={{
                      margin: '12px 0 0', padding: '14px 16px', borderRadius: 6,
                      background: 'var(--bg)', border: '1px solid var(--bg4)',
                      fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65,
                      color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      maxHeight: 360, overflowY: 'auto',
                    }}
                  >
                    {row.generatedContent}
                  </pre>
                  {row.feedback && (
                    <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 6, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#34d399' }}>Feedback</p>
                      <p className="text-sm" style={{ color: 'var(--text2)' }}>{row.feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Small Components ──────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: 'EMAIL' | 'CALL_SCRIPT' }) {
  return (
    <span
      className="text-xs font-medium"
      style={{
        padding: '2px 8px', borderRadius: 4,
        background: channel === 'EMAIL' ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.12)',
        color: channel === 'EMAIL' ? 'var(--accent)' : '#f59e0b',
      }}
    >
      {channel === 'EMAIL' ? 'Email' : 'Call Script'}
    </span>
  )
}

// ── Icons & Helpers ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconSparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" strokeLinecap="round" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8l4 4 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
