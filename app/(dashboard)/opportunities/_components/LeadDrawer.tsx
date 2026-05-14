'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { LeadRow } from './OpportunitiesClient'

interface Contact {
  id:    string
  name:  string
  title: string | null
  phone: string | null
  email: string | null
}

interface LeadDetail {
  id:           string
  company:      string
  contact:      string | null
  contactTitle: string | null
  phone:        string | null
  email:        string | null
  heat:         string
  leadSource:   string | null
  value:        number | null
  city:         string | null
  state:        string | null
  notes:        string | null
  stage:        string
  createdAt:    string
  assignedTo:   { id: string; name: string | null } | null
  logs: {
    id: string; date: string; action: string
    user: { id: string; name: string | null } | null
  }[]
  convertedFrom: {
    id: string; type: string; title: string; description: string
    sourceName: string | null; sourceUrl: string | null
    detectedAt: string; estimatedValue: number | null
  }[]
}

const LEAD_SOURCE_OPTIONS = [
  { value: 'REFERRAL',          label: 'Referral' },
  { value: 'SAM_GOV',           label: 'SAM.gov' },
  { value: 'RFP_BID_BOARD',     label: 'RFP / Bid Board' },
  { value: 'DODGE_DATA',        label: 'Dodge Data' },
  { value: 'COLD_OUTREACH',     label: 'Cold Outreach' },
  { value: 'INBOUND_WEB',       label: 'Inbound Web' },
  { value: 'EXISTING_CUSTOMER', label: 'Existing Customer' },
  { value: 'PARTNER_VENDOR',    label: 'Partner / Vendor' },
]

const LEAD_SOURCE_LABEL = Object.fromEntries(LEAD_SOURCE_OPTIONS.map((o) => [o.value, o.label]))

const HEAT_COLOR: Record<string, string> = {
  HOT:  '#dc2626',
  WARM: '#f59e0b',
  COLD: '#6b7280',
}

const ACTIVITY_TYPES = [
  { value: 'CALL',      label: 'Call' },
  { value: 'EMAIL',     label: 'Email' },
  { value: 'MEETING',   label: 'Meeting' },
  { value: 'NOTE',      label: 'Note' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'OTHER',     label: 'Other' },
]

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function parseActivityAction(action: string): { type: string; description: string } {
  const match = action.match(/^\[([A-Z_]+)\]\s*([\s\S]*)$/)
  if (match) return { type: match[1], description: match[2] }
  return { type: 'NOTE', description: action }
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--bg4)',
  borderRadius: 6, color: 'var(--text)', padding: '5px 10px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const selStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text3)',
  textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const ghostBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--accent)',
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeadDrawer({ leadId, reps, onClose, onLeadUpdate, onConvert }: {
  leadId:       string | null
  reps:         { id: string; name: string | null }[]
  onClose:      () => void
  onLeadUpdate: (id: string, patch: Partial<LeadRow>) => void
  onConvert:    (leadId: string) => void
}) {
  const [detail,   setDetail]   = useState<LeadDetail | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [saveErr,  setSaveErr]  = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const router = useRouter()

  const [eCompany,      setECompany]      = useState('')
  const [eContact,      setEContact]      = useState('')
  const [eContactTitle, setEContactTitle] = useState('')
  const [ePhone,        setEPhone]        = useState('')
  const [eEmail,        setEEmail]        = useState('')
  const [eHeat,         setEHeat]         = useState('WARM')
  const [eLeadSource,   setELeadSource]   = useState('')
  const [eValue,        setEValue]        = useState('')
  const [eCity,         setECity]         = useState('')
  const [eState,        setEState]        = useState('')
  const [eNotes,        setENotes]        = useState('')
  const [eAssignedToId, setEAssignedToId] = useState('')

  const [logExpanded,   setLogExpanded]   = useState(false)
  const [logType,       setLogType]       = useState('CALL')
  const [logDesc,       setLogDesc]       = useState('')
  const [logDate,       setLogDate]       = useState(todayIso())
  const [logSubmitting, setLogSubmitting] = useState(false)

  useEffect(() => {
    if (!leadId) { setDetail(null); setEditing(false); setContacts([]); return }
    setLoading(true)
    setEditing(false)
    setLogExpanded(false)
    setLogDesc('')
    setContacts([])
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((d: LeadDetail) => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
    fetch(`/api/contacts?leadId=${leadId}`)
      .then((r) => r.json())
      .then((data: Contact[]) => setContacts(data))
      .catch(() => {})
  }, [leadId])

  function handleGenerateOutreach() {
    if (!detail) return
    const first = contacts[0]
    const p = new URLSearchParams({ company: detail.company })
    if (first?.name)  p.set('contactName',  first.name)
    if (first?.title) p.set('contactTitle', first.title)
    if (first?.email) p.set('contactEmail', first.email)
    router.push(`/outreach?${p.toString()}`)
  }

  function enterEdit() {
    if (!detail) return
    setECompany(detail.company)
    setEContact(detail.contact ?? '')
    setEContactTitle(detail.contactTitle ?? '')
    setEPhone(detail.phone ?? '')
    setEEmail(detail.email ?? '')
    setEHeat(detail.heat)
    setELeadSource(detail.leadSource ?? '')
    setEValue(detail.value ? fmtUSD(String(detail.value)) : '')
    setECity(detail.city ?? '')
    setEState(detail.state ?? '')
    setENotes(detail.notes ?? '')
    setEAssignedToId(detail.assignedTo?.id ?? '')
    setSaveErr('')
    setEditing(true)
  }

  async function saveEdit() {
    if (!detail) return
    if (!eCompany.trim()) { setSaveErr('Company is required'); return }
    setSaveErr('')

    const res = await fetch(`/api/leads/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company:      eCompany.trim(),
        contact:      eContact      || null,
        contactTitle: eContactTitle || null,
        phone:        ePhone        || null,
        email:        eEmail        || null,
        heat:         eHeat,
        leadSource:   eLeadSource   || null,
        value:        eValue ? parseFloat(stripFmt(eValue)) : null,
        city:         eCity  || null,
        state:        eState || null,
        notes:        eNotes || null,
        assignedToId: eAssignedToId || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setSaveErr(data.error ?? 'Save failed')
      return
    }

    const rep = eAssignedToId ? reps.find((r) => r.id === eAssignedToId) : null
    const updated: LeadDetail = {
      ...detail,
      company:      eCompany.trim(),
      contact:      eContact      || null,
      contactTitle: eContactTitle || null,
      phone:        ePhone        || null,
      email:        eEmail        || null,
      heat:         eHeat,
      leadSource:   eLeadSource   || null,
      value:        eValue ? parseFloat(stripFmt(eValue)) : null,
      city:         eCity  || null,
      state:        eState || null,
      notes:        eNotes || null,
      assignedTo:   rep ? { id: rep.id, name: rep.name } : null,
    }
    setDetail(updated)
    setEditing(false)

    onLeadUpdate(detail.id, {
      company:      updated.company,
      contact:      updated.contact,
      contactTitle: updated.contactTitle,
      leadSource:   updated.leadSource,
      heat:         updated.heat,
      repId:        rep?.id   ?? null,
      repName:      rep?.name ?? null,
      city:         updated.city,
      state:        updated.state,
    })
  }

  async function submitLog() {
    if (!detail || !logDesc.trim()) return
    setLogSubmitting(true)
    const res = await fetch(`/api/leads/${detail.id}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: logType, description: logDesc.trim(), date: logDate || undefined }),
    })
    if (res.ok) {
      const entry = await res.json() as { id: string; date: string; action: string; user: { id: string; name: string | null } | null }
      setDetail((d) => d ? { ...d, logs: [entry, ...d.logs] } : d)
      setLogDesc('')
      setLogDate(todayIso())
      setLogExpanded(false)
    }
    setLogSubmitting(false)
  }

  const open = !!leadId

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
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: 'var(--bg2)', borderLeft: '1px solid var(--bg4)',
        zIndex: 51,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {open && (
          <>
            {/* Header */}
            <div style={{
              padding: '18px 20px 16px', borderBottom: '1px solid var(--bg4)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>
                  {detail?.company ?? 'Lead'}
                </h2>
                {detail && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                    Added {fmtDate(detail.createdAt)}
                    {detail.assignedTo?.name ? ` · ${detail.assignedTo.name}` : ''}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {detail && (
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
                )}
                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {loading && (
                <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Loading…</p>
              )}

              {!loading && detail && (
                <>
                  {/* ── Overview ── */}
                  <Section
                    title="Overview"
                    action={!editing ? (
                      <button onClick={enterEdit} style={ghostBtn}>Edit</button>
                    ) : undefined}
                  >
                    {editing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <Field label="Company *">
                          <input value={eCompany} onChange={(e) => setECompany(e.target.value)} style={inputStyle} />
                        </Field>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Field label="Contact">
                            <input value={eContact} onChange={(e) => setEContact(e.target.value)}
                              placeholder="Jane Doe" style={inputStyle} />
                          </Field>
                          <Field label="Title">
                            <input value={eContactTitle} onChange={(e) => setEContactTitle(e.target.value)}
                              placeholder="VP Ops" style={inputStyle} />
                          </Field>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Field label="Phone">
                            <input type="tel" value={ePhone} onChange={(e) => setEPhone(e.target.value)} style={inputStyle} />
                          </Field>
                          <Field label="Email">
                            <input type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} style={inputStyle} />
                          </Field>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Field label="Heat">
                            <select value={eHeat} onChange={(e) => setEHeat(e.target.value)} style={selStyle}>
                              <option value="HOT">Hot</option>
                              <option value="WARM">Warm</option>
                              <option value="COLD">Cold</option>
                            </select>
                          </Field>
                          <Field label="Lead Source">
                            <select value={eLeadSource} onChange={(e) => setELeadSource(e.target.value)} style={selStyle}>
                              <option value="">— None —</option>
                              {LEAD_SOURCE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
                          <Field label="City">
                            <input value={eCity} onChange={(e) => setECity(e.target.value)} style={inputStyle} />
                          </Field>
                          <Field label="State">
                            <input value={eState} onChange={(e) => setEState(e.target.value)}
                              maxLength={2} style={inputStyle} />
                          </Field>
                        </div>
                        <Field label="Estimated Value">
                          <input
                            type="text" inputMode="numeric" value={eValue}
                            onChange={(e) => setEValue(e.target.value)}
                            onFocus={() => setEValue((v) => stripFmt(v))}
                            onBlur={() => setEValue((v) => fmtUSD(v))}
                            placeholder="$0" style={inputStyle}
                          />
                        </Field>
                        <Field label="Assigned Rep">
                          <select value={eAssignedToId} onChange={(e) => setEAssignedToId(e.target.value)} style={selStyle}>
                            <option value="">Unassigned</option>
                            {reps.map((r) => <option key={r.id} value={r.id}>{r.name ?? r.id}</option>)}
                          </select>
                        </Field>
                        <Field label="Notes">
                          <textarea value={eNotes} onChange={(e) => setENotes(e.target.value)}
                            rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        </Field>
                        {saveErr && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{saveErr}</p>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={saveEdit}
                            style={{
                              flex: 1, fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 7,
                              border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                            }}
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditing(false)}
                            style={{
                              fontSize: 13, padding: '8px 14px', borderRadius: 7,
                              border: '1px solid var(--bg4)', background: 'var(--bg3)',
                              color: 'var(--text2)', cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                        <DetailRow label="Contact" value={[detail.contact, detail.contactTitle].filter(Boolean).join(', ') || null} />
                        <DetailRow label="Phone"   value={detail.phone} />
                        <DetailRow label="Email"   value={detail.email} />
                        <DetailRow label="Heat"    value={
                          <span style={{ color: HEAT_COLOR[detail.heat] ?? 'var(--text)', fontWeight: 600 }}>{detail.heat}</span>
                        } />
                        <DetailRow label="Source"   value={detail.leadSource ? (LEAD_SOURCE_LABEL[detail.leadSource] ?? detail.leadSource) : null} />
                        <DetailRow label="Location" value={[detail.city, detail.state].filter(Boolean).join(', ') || null} />
                        <DetailRow label="Value"    value={
                          detail.value
                            ? detail.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                            : null
                        } />
                        <DetailRow label="Rep"      value={detail.assignedTo?.name ?? null} />
                        {detail.notes && (
                          <div style={{ gridColumn: '1/-1', marginTop: 4 }}>
                            <p style={labelStyle}>Notes</p>
                            <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                              {detail.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Section>

                  {/* ── Contacts ── */}
                  <ContactsSection
                    linkField="leadId"
                    entityId={detail.id}
                    contacts={contacts}
                    setContacts={setContacts}
                  />

                  {/* ── Linked Signal ── */}
                  {detail.convertedFrom.length > 0 && (
                    <Section title="Linked Signal">
                      {detail.convertedFrom.slice(0, 1).map((sig) => (
                        <div key={sig.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{sig.title}</p>
                          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{sig.description}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 2 }}>
                            {sig.sourceName && (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Source: {sig.sourceName}</span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                              Detected: {fmtDate(sig.detectedAt)}
                            </span>
                            {sig.estimatedValue != null && (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                                Est: {sig.estimatedValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>
                          {sig.sourceUrl && (
                            <a
                              href={sig.sourceUrl} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                            >
                              View Source →
                            </a>
                          )}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* ── Log Activity ── */}
                  <Section
                    title="Log Activity"
                    action={
                      <button onClick={() => setLogExpanded((v) => !v)} style={ghostBtn}>
                        {logExpanded ? 'Cancel' : '+ Log'}
                      </button>
                    }
                  >
                    {logExpanded ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Field label="Type">
                            <select value={logType} onChange={(e) => setLogType(e.target.value)} style={selStyle}>
                              {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Date">
                            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={inputStyle} />
                          </Field>
                        </div>
                        <Field label="Description">
                          <textarea
                            value={logDesc} onChange={(e) => setLogDesc(e.target.value)}
                            placeholder="Notes about this activity…" rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                          />
                        </Field>
                        <button
                          onClick={submitLog}
                          disabled={logSubmitting || !logDesc.trim()}
                          style={{
                            alignSelf: 'flex-start', fontSize: 13, fontWeight: 700,
                            padding: '7px 14px', borderRadius: 7,
                            border: 'none', background: 'var(--accent)', color: '#fff',
                            cursor: (logSubmitting || !logDesc.trim()) ? 'not-allowed' : 'pointer',
                            opacity: (logSubmitting || !logDesc.trim()) ? 0.6 : 1,
                          }}
                        >
                          {logSubmitting ? 'Saving…' : 'Save Activity'}
                        </button>
                      </div>
                    ) : (
                      detail.logs.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No activity logged yet.</p>
                      )
                    )}
                  </Section>

                  {/* ── Activity History ── */}
                  {detail.logs.length > 0 && (
                    <Section title="Activity History">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detail.logs.map((log) => {
                          const { type, description } = parseActivityAction(log.action)
                          const typeLabel = ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type
                          return (
                            <div
                              key={log.id}
                              style={{
                                padding: '10px 12px', borderRadius: 7,
                                background: 'var(--bg3)', border: '1px solid var(--bg4)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                                  {typeLabel}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                                  {fmtDateTime(log.date)}
                                  {log.user?.name ? ` · ${log.user.name}` : ''}
                                </span>
                              </div>
                              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, whiteSpace: 'pre-wrap' }}>
                                {description}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </Section>
                  )}

                  {/* ── Convert to Opportunity ── */}
                  <Section title="Convert to Opportunity">
                    <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 12px' }}>
                      Ready to move this lead into the active pipeline?
                    </p>
                    <button
                      onClick={() => onConvert(detail.id)}
                      style={{
                        fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 7,
                        border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                      }}
                    >
                      Convert to Opportunity
                    </button>
                  </Section>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Contacts ──────────────────────────────────────────────────────────────────

function ContactsSection({
  linkField, entityId, contacts, setContacts,
}: {
  linkField:   'leadId' | 'opportunityId'
  entityId:    string
  contacts:    Contact[]
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>
}) {
  const [showAdd,     setShowAdd]     = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null)
  const [fname,       setFname]       = useState('')
  const [ftitle,      setFtitle]      = useState('')
  const [fphone,      setFphone]      = useState('')
  const [femail,      setFemail]      = useState('')
  const [fsaving,     setFsaving]     = useState(false)
  const [formError,   setFormError]   = useState('')

  function resetForm() { setFname(''); setFtitle(''); setFphone(''); setFemail('') }

  function beginAdd() { setEditingId(null); resetForm(); setShowAdd(true) }

  function beginEdit(c: Contact) {
    setShowAdd(false)
    setFname(c.name); setFtitle(c.title ?? ''); setFphone(c.phone ?? ''); setFemail(c.email ?? '')
    setEditingId(c.id)
  }

  function cancelForm() { setShowAdd(false); setEditingId(null); resetForm(); setFormError('') }

  async function handleAdd() {
    if (!fname.trim() || fsaving) return
    setFsaving(true)
    setFormError('')
    const payload = { [linkField]: entityId, name: fname.trim(), title: ftitle.trim() || null, phone: fphone.trim() || null, email: femail.trim() || null }
    console.log('[contacts] POST payload:', payload)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const newContact = await res.json() as Contact
        setContacts((p) => [...p, newContact])
        setShowAdd(false); resetForm()
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        const msg = data.error ?? `Save failed (${res.status})`
        console.error('[contacts] POST failed:', res.status, data)
        setFormError(msg)
      }
    } catch (e) {
      console.error('[contacts] POST error:', e)
      setFormError('Network error — please try again')
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
    if (res.ok || res.status === 204) {
      setContacts((p) => p.filter((c) => c.id !== id))
      setConfirmDel(null)
    }
  }

  function contactForm(onSave: () => void, label: string) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg3)', border: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Field label="Name *">
          <input value={fname} onChange={(e) => setFname(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
        </Field>
        <Field label="Title">
          <input value={ftitle} onChange={(e) => setFtitle(e.target.value)} placeholder="VP Operations" style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Phone">
            <input type="tel" value={fphone} onChange={(e) => setFphone(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input type="email" value={femail} onChange={(e) => setFemail(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        {formError && (
          <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{formError}</p>
        )}
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
        <button onClick={beginAdd} style={ghostBtn}>+ Add</button>
      ) : undefined}
    >
      {contacts.length === 0 && !showAdd && (
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No contacts yet.</p>
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
                      <button onClick={() => beginEdit(c)} style={{ ...ghostBtn, fontSize: 11 }}>Edit</button>
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

// ── Primitives ────────────────────────────────────────────────────────────────

function Section({ title, action, children }: {
  title:    string
  action?:  React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0,
        }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ ...labelStyle, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--text)', margin: '3px 0 0' }}>
        {value ?? <span style={{ color: 'var(--text3)' }}>—</span>}
      </p>
    </div>
  )
}
