'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamUser {
  id:     string
  name:   string
  email:  string
  role:   string
  active: boolean
}

export interface RepTargetRow {
  userId:                  string
  monthlyLeadGoal:         number | null
  monthlyRevenueTarget:    number | null
  quarterlyRevenueTarget:  number | null
  annualRevenueTarget:     number | null
  weeklyOutreachTarget:    number | null
  monthlyOutreachTarget:   number | null
  quarterlyOutreachTarget: number | null
  annualOutreachTarget:    number | null
}

export interface SettingsClientProps {
  tenantId:   string
  tenantName: string
  userRole:   string

  // Branding
  accentColor: string
  logoUrl:     string

  // Integrations
  mapboxTokenMasked:  string
  anthropicKeyMasked: string
  apolloKeyMasked:    string
  mapboxTokenSet:     boolean
  anthropicKeySet:    boolean
  apolloKeySet:       boolean

  // Team
  users: TeamUser[]

  // Targets
  monthlyLeadGoal:         number | null
  monthlyRevenueTarget:    number | null
  quarterlyRevenueTarget:  number | null
  annualRevenueTarget:     number | null
  monthlyOutreachTarget:   number | null
  quarterlyOutreachTarget: number | null
  annualOutreachTarget:    number | null

  // Rep targets
  repTargets: RepTargetRow[]
}

type Tab = 'branding' | 'integrations' | 'team' | 'signal-preferences' | 'targets'

const TABS: { id: Tab; label: string }[] = [
  { id: 'branding',            label: 'Branding' },
  { id: 'integrations',        label: 'Integrations' },
  { id: 'team',                label: 'Team' },
  { id: 'signal-preferences',  label: 'Signal Preferences' },
  { id: 'targets',             label: 'Targets' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numOrNull(v: string): number | null {
  const n = parseFloat(v.replace(/[,$]/g, ''))
  return isNaN(n) ? null : n
}

function intOrNull(v: string): number | null {
  const n = parseInt(v.replace(/[,$]/g, ''), 10)
  return isNaN(n) ? null : n
}

function fmtNum(v: number | null): string {
  return v == null ? '' : String(v)
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--bg4)',
        borderRadius: 10,
        padding: '20px 24px',
        marginBottom: 20,
      }}
    >
      {title && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--bg4)',
          }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text2)',
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '8px 10px',
        background: 'var(--bg)',
        border: '1px solid var(--bg4)',
        borderRadius: 6,
        color: 'var(--text)',
        fontSize: 13,
        outline: 'none',
      }}
    />
  )
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
      style={{
        width: '100%',
        padding: '6px 8px',
        background: 'var(--bg)',
        border: '1px solid var(--bg4)',
        borderRadius: 6,
        color: 'var(--text)',
        fontSize: 12,
        outline: 'none',
      }}
    />
  )
}

function SaveButton({
  onClick,
  saving,
  saved,
}: {
  onClick: () => void
  saving: boolean
  saved: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      style={{
        padding: '8px 20px',
        borderRadius: 6,
        border: 'none',
        background: saved ? '#16a34a' : 'var(--accent)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.6 : 1,
        minWidth: 100,
      }}
    >
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
    </button>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 100,
        background: active ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.12)',
        color: active ? '#16a34a' : 'var(--text3)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: active ? '#16a34a' : 'var(--bg4)',
          display: 'inline-block',
        }}
      />
      {active ? 'Connected' : 'Not configured'}
    </span>
  )
}

function ComingSoonCard({ name, description }: { name: string; description: string }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        border: '1px dashed var(--bg4)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        opacity: 0.6,
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{name}</p>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>{description}</p>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          background: 'var(--bg4)',
          padding: '3px 8px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
        }}
      >
        Coming soon
      </span>
    </div>
  )
}

// ─── Branding tab ─────────────────────────────────────────────────────────────

function BrandingTab({
  initialAccentColor,
  initialLogoUrl,
}: {
  initialAccentColor: string
  initialLogoUrl:     string
}) {
  const router = useRouter()
  // Always keep a valid hex so the color picker and preview are in sync from the start.
  const [accentColor, setAccentColor] = useState(initialAccentColor || '#1a56ff')
  const [logoUrl, setLogoUrl]         = useState(initialLogoUrl)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState('')

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accentColor: accentColor || null, logoUrl: logoUrl || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? `Save failed (${res.status})`)
      } else {
        setSaved(true)
        // Re-fetch server components so the layout picks up the new --accent CSS variable.
        router.refresh()
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionCard title="Brand Colors">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <Label>Accent Color</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{
                  width: 40,
                  height: 36,
                  border: '1px solid var(--bg4)',
                  borderRadius: 6,
                  padding: 2,
                  background: 'var(--bg)',
                  cursor: 'pointer',
                }}
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#1A56FF"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--bg4)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>

          <div>
            <Label>Preview</Label>
            <div
              style={{
                height: 36,
                borderRadius: 6,
                background: accentColor,
                border: '1px solid var(--bg4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>Button preview</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Logo">
        <div style={{ marginBottom: 16 }}>
          <Label>Logo URL</Label>
          <TextInput value={logoUrl} onChange={setLogoUrl} placeholder="https://example.com/logo.png" />
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
            Publicly accessible image URL. Recommended: 200×50px PNG with transparent background.
          </p>
        </div>
        {logoUrl && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg)',
              border: '1px solid var(--bg4)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <img
              src={logoUrl}
              alt="Logo preview"
              style={{ height: 40, maxWidth: 200, objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Preview</span>
          </div>
        )}
      </SectionCard>

      {error && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{error}</p>}
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </div>
  )
}

// ─── Integrations tab ─────────────────────────────────────────────────────────

function IntegrationsTab({
  mapboxTokenMasked,
  anthropicKeyMasked,
  apolloKeyMasked,
  mapboxTokenSet,
  anthropicKeySet,
  apolloKeySet,
}: {
  mapboxTokenMasked:  string
  anthropicKeyMasked: string
  apolloKeyMasked:    string
  mapboxTokenSet:     boolean
  anthropicKeySet:    boolean
  apolloKeySet:       boolean
}) {
  const [mapboxToken, setMapboxToken]   = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [apolloKey, setApolloKey]       = useState('')
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState('')

  // Apollo enrichment test
  type ApolloResult = {
    name: string | null
    title: string | null
    company: string | null
    email: string | null
    linkedinUrl: string | null
  }
  const [testLoading, setTestLoading]   = useState(false)
  const [testResult, setTestResult]     = useState<ApolloResult | null>(null)
  const [testError, setTestError]       = useState('')

  // Backfill enrichment
  type BackfillResult = { enriched: number; skipped: number; failed: number }
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [backfillResult,  setBackfillResult]  = useState<BackfillResult | null>(null)
  const [backfillError,   setBackfillError]   = useState('')

  async function handleBackfill() {
    setBackfillLoading(true); setBackfillResult(null); setBackfillError('')
    try {
      const res = await fetch('/api/admin/backfill-enrichment', { method: 'POST' })
      const d = await res.json() as BackfillResult & { error?: string }
      if (!res.ok) { setBackfillError(d.error ?? `Failed (${res.status})`); return }
      setBackfillResult(d)
    } catch { setBackfillError('Network error') }
    finally { setBackfillLoading(false) }
  }

  async function handleTest() {
    setTestLoading(true)
    setTestResult(null)
    setTestError('')
    try {
      const res = await fetch('/api/apollo/test', { method: 'POST' })
      const d = await res.json() as ApolloResult & { error?: string }
      if (!res.ok) {
        setTestError(d.error ?? `Test failed (${res.status})`)
      } else {
        setTestResult(d)
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setTestLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    const body: Record<string, string> = {}
    if (mapboxToken.trim())   body.mapboxToken  = mapboxToken.trim()
    if (anthropicKey.trim())  body.anthropicKey = anthropicKey.trim()
    if (apolloKey.trim())     body.apolloKey    = apolloKey.trim()

    if (Object.keys(body).length === 0) {
      setError('Enter at least one key to save.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? `Save failed (${res.status})`)
      } else {
        setSaved(true)
        setMapboxToken('')
        setAnthropicKey('')
        setApolloKey('')
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SectionCard title="API Keys">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Mapbox */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Mapbox</p>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>Powers the Territory Map with live opportunity pins.</p>
              </div>
              <StatusBadge active={mapboxTokenSet} />
            </div>
            {mapboxTokenSet && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontFamily: 'monospace' }}>
                Current: {mapboxTokenMasked}
              </p>
            )}
            <TextInput
              value={mapboxToken}
              onChange={setMapboxToken}
              placeholder={mapboxTokenSet ? 'Enter new token to replace…' : 'pk.eyJ1…'}
            />
          </div>

          <div style={{ height: 1, background: 'var(--bg4)' }} />

          {/* Anthropic */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Anthropic</p>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>Claude AI for research briefs and outreach generation.</p>
              </div>
              <StatusBadge active={anthropicKeySet} />
            </div>
            {anthropicKeySet && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontFamily: 'monospace' }}>
                Current: {anthropicKeyMasked}
              </p>
            )}
            <TextInput
              value={anthropicKey}
              onChange={setAnthropicKey}
              placeholder={anthropicKeySet ? 'Enter new key to replace…' : 'sk-ant-…'}
            />
          </div>

          <div style={{ height: 1, background: 'var(--bg4)' }} />

          {/* Apollo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Apollo.io</p>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>Contact enrichment and prospect data.</p>
              </div>
              <StatusBadge active={apolloKeySet} />
            </div>
            {apolloKeySet && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontFamily: 'monospace' }}>
                Current: {apolloKeyMasked}
              </p>
            )}
            <TextInput
              value={apolloKey}
              onChange={setApolloKey}
              placeholder={apolloKeySet ? 'Enter new key to replace…' : 'api-key-…'}
            />

            {/* Test Enrichment — only when key is configured */}
            {apolloKeySet && (
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testLoading}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 6,
                    border: '1px solid var(--bg4)',
                    background: 'var(--bg3)',
                    color: 'var(--text2)',
                    cursor: testLoading ? 'not-allowed' : 'pointer',
                    opacity: testLoading ? 0.6 : 1,
                  }}
                >
                  {testLoading ? 'Testing…' : 'Test Enrichment'}
                </button>

                {testError && (
                  <p style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>{testError}</p>
                )}

                {testResult && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '12px 14px',
                      background: 'var(--bg3)',
                      border: '1px solid var(--bg4)',
                      borderRadius: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Enrichment Result
                    </p>
                    {testResult.name && (
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {testResult.name}
                      </p>
                    )}
                    {testResult.title && (
                      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{testResult.title}</p>
                    )}
                    {testResult.company && (
                      <p style={{ fontSize: 12, color: 'var(--text3)' }}>{testResult.company}</p>
                    )}
                    {testResult.email && (
                      <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                        <span style={{ color: 'var(--text3)' }}>Email: </span>
                        {testResult.email}
                      </p>
                    )}
                    {testResult.linkedinUrl && (
                      <p style={{ fontSize: 12, marginTop: 2 }}>
                        <span style={{ color: 'var(--text3)' }}>LinkedIn: </span>
                        <a
                          href={testResult.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--cobalt2)', textDecoration: 'none' }}
                        >
                          {testResult.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </p>
                    )}
                  </div>
                )}

                {/* Backfill enrichment */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bg4)' }}>
                  <button
                    type="button"
                    onClick={handleBackfill}
                    disabled={backfillLoading}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                      border: '1px solid var(--bg4)', background: 'var(--bg3)', color: 'var(--text2)',
                      cursor: backfillLoading ? 'not-allowed' : 'pointer',
                      opacity: backfillLoading ? 0.6 : 1,
                    }}
                  >
                    {backfillLoading ? 'Running…' : 'Backfill Enrichment'}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Enriches existing leads that have no Apollo data yet.
                  </p>
                  {backfillError && <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{backfillError}</p>}
                  {backfillResult && (
                    <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                      Done — {backfillResult.enriched} enriched, {backfillResult.skipped} skipped, {backfillResult.failed} failed.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: '#f87171', marginTop: 12 }}>{error}</p>}
        <div style={{ marginTop: 20 }}>
          <SaveButton onClick={handleSave} saving={saving} saved={saved} />
        </div>
      </SectionCard>

      <SectionCard title="Coming Soon">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ComingSoonCard name="Clearbit" description="Company intelligence and firmographic data." />
          <ComingSoonCard name="SAM.gov" description="Federal procurement and contract opportunity feed." />
          <ComingSoonCard name="SendGrid" description="Transactional email delivery for outreach." />
          <ComingSoonCard name="Twilio" description="SMS and call routing for rep outreach." />
          <ComingSoonCard name="ConnectWise" description="PSA sync for project and service data." />
          <ComingSoonCard name="HubSpot" description="CRM bidirectional sync." />
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Team tab ─────────────────────────────────────────────────────────────────

function TeamTab({ users }: { users: TeamUser[] }) {
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const ROLE_LABELS: Record<string, string> = {
    REP:                'Rep',
    TENANT_ADMIN:       'Admin',
    COBALT_SUPER_ADMIN: 'Super Admin',
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {toast && (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--bg2)',
            border: '1px solid var(--bg4)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--text2)',
            marginBottom: 16,
          }}
        >
          {toast}
        </div>
      )}

      <SectionCard title="Team Members">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bg4)' }}>
              {['Name', 'Email', 'Role', 'Status', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '0 0 10px',
                    paddingRight: h === '' ? 0 : 16,
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--bg4)' }}>
                <td style={{ padding: '10px 16px 10px 0', color: 'var(--text)', fontWeight: 500 }}>
                  {u.name}
                </td>
                <td style={{ padding: '10px 16px 10px 0', color: 'var(--text2)' }}>
                  {u.email}
                </td>
                <td style={{ padding: '10px 16px 10px 0', color: 'var(--text2)' }}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </td>
                <td style={{ padding: '10px 16px 10px 0' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 100,
                      background: u.active ? 'rgba(22,163,74,0.12)' : 'rgba(248,113,113,0.12)',
                      color: u.active ? '#16a34a' : '#f87171',
                    }}
                  >
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => showToast('User management coming soon.')}
                    style={{
                      fontSize: 12,
                      color: 'var(--text3)',
                      background: 'none',
                      border: '1px solid var(--bg4)',
                      borderRadius: 5,
                      padding: '3px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={() => showToast('Invite flow coming soon.')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--bg4)',
              background: 'transparent',
              color: 'var(--text2)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            + Invite team member
          </button>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Signal Preferences tab ───────────────────────────────────────────────────

function SignalPreferencesTab() {
  return (
    <div style={{ maxWidth: 560 }}>
      <SectionCard>
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            ICP Configuration
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
            Signal filtering by vertical, geography, job type, and estimated value — coming soon.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Targets tab ──────────────────────────────────────────────────────────────

function TargetsTab({
  users,
  initialTeamTargets,
  initialRepTargets,
}: {
  users: TeamUser[]
  initialTeamTargets: {
    monthlyLeadGoal:         number | null
    monthlyRevenueTarget:    number | null
    quarterlyRevenueTarget:  number | null
    annualRevenueTarget:     number | null
    monthlyOutreachTarget:   number | null
    quarterlyOutreachTarget: number | null
    annualOutreachTarget:    number | null
  }
  initialRepTargets: RepTargetRow[]
}) {
  // Team targets state
  const [teamTargets, setTeamTargets] = useState({
    monthlyLeadGoal:         fmtNum(initialTeamTargets.monthlyLeadGoal),
    monthlyRevenueTarget:    fmtNum(initialTeamTargets.monthlyRevenueTarget),
    quarterlyRevenueTarget:  fmtNum(initialTeamTargets.quarterlyRevenueTarget),
    annualRevenueTarget:     fmtNum(initialTeamTargets.annualRevenueTarget),
    monthlyOutreachTarget:   fmtNum(initialTeamTargets.monthlyOutreachTarget),
    quarterlyOutreachTarget: fmtNum(initialTeamTargets.quarterlyOutreachTarget),
    annualOutreachTarget:    fmtNum(initialTeamTargets.annualOutreachTarget),
  })
  const [teamSaving, setTeamSaving] = useState(false)
  const [teamSaved, setTeamSaved]   = useState(false)
  const [teamError, setTeamError]   = useState('')

  // Rep targets state: userId → field → string value
  const [repTargets, setRepTargets] = useState<Record<string, Record<string, string>>>(() => {
    const map: Record<string, Record<string, string>> = {}
    for (const rt of initialRepTargets) {
      map[rt.userId] = {
        monthlyLeadGoal:         fmtNum(rt.monthlyLeadGoal),
        monthlyRevenueTarget:    fmtNum(rt.monthlyRevenueTarget),
        quarterlyRevenueTarget:  fmtNum(rt.quarterlyRevenueTarget),
        annualRevenueTarget:     fmtNum(rt.annualRevenueTarget),
        weeklyOutreachTarget:    fmtNum(rt.weeklyOutreachTarget),
        monthlyOutreachTarget:   fmtNum(rt.monthlyOutreachTarget),
        quarterlyOutreachTarget: fmtNum(rt.quarterlyOutreachTarget),
        annualOutreachTarget:    fmtNum(rt.annualOutreachTarget),
      }
    }
    return map
  })
  const [repSaving, setRepSaving] = useState<string | null>(null)
  const [repSaved, setRepSaved]   = useState<string | null>(null)
  const [repError, setRepError]   = useState<string | null>(null)

  function setTeamField(field: string, value: string) {
    setTeamTargets((prev) => ({ ...prev, [field]: value }))
  }

  function setRepField(userId: string, field: string, value: string) {
    setRepTargets((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? {}), [field]: value },
    }))
  }

  function getRepField(userId: string, field: string): string {
    return repTargets[userId]?.[field] ?? ''
  }

  async function handleSaveTeam() {
    setTeamSaving(true)
    setTeamSaved(false)
    setTeamError('')
    try {
      const res = await fetch('/api/settings/targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyLeadGoal:         intOrNull(teamTargets.monthlyLeadGoal),
          monthlyRevenueTarget:    numOrNull(teamTargets.monthlyRevenueTarget),
          quarterlyRevenueTarget:  numOrNull(teamTargets.quarterlyRevenueTarget),
          annualRevenueTarget:     numOrNull(teamTargets.annualRevenueTarget),
          monthlyOutreachTarget:   intOrNull(teamTargets.monthlyOutreachTarget),
          quarterlyOutreachTarget: intOrNull(teamTargets.quarterlyOutreachTarget),
          annualOutreachTarget:    intOrNull(teamTargets.annualOutreachTarget),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setTeamError(d.error ?? `Save failed (${res.status})`)
      } else {
        setTeamSaved(true)
        setTimeout(() => setTeamSaved(false), 2500)
      }
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setTeamSaving(false)
    }
  }

  async function handleSaveRep(userId: string) {
    setRepSaving(userId)
    setRepSaved(null)
    setRepError(null)
    const fields = repTargets[userId] ?? {}
    try {
      const res = await fetch(`/api/settings/rep-targets/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyLeadGoal:         intOrNull(fields.monthlyLeadGoal         ?? ''),
          monthlyRevenueTarget:    numOrNull(fields.monthlyRevenueTarget    ?? ''),
          quarterlyRevenueTarget:  numOrNull(fields.quarterlyRevenueTarget  ?? ''),
          annualRevenueTarget:     numOrNull(fields.annualRevenueTarget     ?? ''),
          weeklyOutreachTarget:    intOrNull(fields.weeklyOutreachTarget    ?? ''),
          monthlyOutreachTarget:   intOrNull(fields.monthlyOutreachTarget   ?? ''),
          quarterlyOutreachTarget: intOrNull(fields.quarterlyOutreachTarget ?? ''),
          annualOutreachTarget:    intOrNull(fields.annualOutreachTarget    ?? ''),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setRepError(d.error ?? `Save failed (${res.status})`)
      } else {
        setRepSaved(userId)
        setTimeout(() => setRepSaved(null), 2500)
      }
    } catch (e) {
      setRepError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setRepSaving(null)
    }
  }

  const reps = users.filter((u) => u.role === 'REP' || u.role === 'TENANT_ADMIN')

  const colStyle: React.CSSProperties = {
    padding: '6px 12px 6px 0',
    fontSize: 12,
    color: 'var(--text2)',
    verticalAlign: 'middle',
  }
  const thStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 12px 10px 0',
    textAlign: 'left',
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Team targets */}
      <SectionCard title="Team Targets">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {([
            { key: 'monthlyLeadGoal',         label: 'Monthly Lead Goal',         int: true },
            { key: 'monthlyRevenueTarget',     label: 'Monthly Revenue',           int: false },
            { key: 'quarterlyRevenueTarget',   label: 'Quarterly Revenue',         int: false },
            { key: 'annualRevenueTarget',      label: 'Annual Revenue',            int: false },
            { key: 'monthlyOutreachTarget',    label: 'Monthly Outreach',          int: true },
            { key: 'quarterlyOutreachTarget',  label: 'Quarterly Outreach',        int: true },
            { key: 'annualOutreachTarget',     label: 'Annual Outreach',           int: true },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <Label>{label}</Label>
              <NumInput
                value={(teamTargets as Record<string, string>)[key]}
                onChange={(v) => setTeamField(key, v)}
              />
            </div>
          ))}
        </div>
        {teamError && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{teamError}</p>}
        <SaveButton onClick={handleSaveTeam} saving={teamSaving} saved={teamSaved} />
      </SectionCard>

      {/* Per-rep targets */}
      {reps.length > 0 && (
        <SectionCard title="Per-Rep Targets">
          {repError && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{repError}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg4)' }}>
                  <th style={{ ...thStyle, minWidth: 120 }}>Rep</th>
                  <th style={thStyle}>Mo. Leads</th>
                  <th style={thStyle}>Mo. Revenue</th>
                  <th style={thStyle}>Qtr Revenue</th>
                  <th style={thStyle}>Ann. Revenue</th>
                  <th style={thStyle}>Wk Outreach</th>
                  <th style={thStyle}>Mo. Outreach</th>
                  <th style={thStyle}>Qtr Outreach</th>
                  <th style={thStyle}>Ann. Outreach</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {reps.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--bg4)' }}>
                    <td style={{ ...colStyle, fontWeight: 600, color: 'var(--text)', paddingRight: 12 }}>
                      {u.name}
                    </td>
                    {([
                      'monthlyLeadGoal',
                      'monthlyRevenueTarget',
                      'quarterlyRevenueTarget',
                      'annualRevenueTarget',
                      'weeklyOutreachTarget',
                      'monthlyOutreachTarget',
                      'quarterlyOutreachTarget',
                      'annualOutreachTarget',
                    ] as const).map((field) => (
                      <td key={field} style={{ ...colStyle, minWidth: 90 }}>
                        <NumInput
                          value={getRepField(u.id, field)}
                          onChange={(v) => setRepField(u.id, field, v)}
                        />
                      </td>
                    ))}
                    <td style={{ ...colStyle, paddingRight: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleSaveRep(u.id)}
                        disabled={repSaving === u.id}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 5,
                          border: 'none',
                          background: repSaved === u.id ? '#16a34a' : 'var(--accent)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: repSaving === u.id ? 'not-allowed' : 'pointer',
                          opacity: repSaving === u.id ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {repSaving === u.id ? '…' : repSaved === u.id ? 'Saved' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsClient(props: SettingsClientProps) {
  const [tab, setTab] = useState<Tab>('branding')

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          Manage {props.tenantName} branding, integrations, team, and targets.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          borderBottom: '1px solid var(--bg4)',
          marginBottom: 28,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'branding' && (
        <BrandingTab
          initialAccentColor={props.accentColor}
          initialLogoUrl={props.logoUrl}
        />
      )}
      {tab === 'integrations' && (
        <IntegrationsTab
          mapboxTokenMasked={props.mapboxTokenMasked}
          anthropicKeyMasked={props.anthropicKeyMasked}
          apolloKeyMasked={props.apolloKeyMasked}
          mapboxTokenSet={props.mapboxTokenSet}
          anthropicKeySet={props.anthropicKeySet}
          apolloKeySet={props.apolloKeySet}
        />
      )}
      {tab === 'team' && (
        <TeamTab users={props.users} />
      )}
      {tab === 'signal-preferences' && (
        <SignalPreferencesTab />
      )}
      {tab === 'targets' && (
        <TargetsTab
          users={props.users}
          initialTeamTargets={{
            monthlyLeadGoal:         props.monthlyLeadGoal,
            monthlyRevenueTarget:    props.monthlyRevenueTarget,
            quarterlyRevenueTarget:  props.quarterlyRevenueTarget,
            annualRevenueTarget:     props.annualRevenueTarget,
            monthlyOutreachTarget:   props.monthlyOutreachTarget,
            quarterlyOutreachTarget: props.quarterlyOutreachTarget,
            annualOutreachTarget:    props.annualOutreachTarget,
          }}
          initialRepTargets={props.repTargets}
        />
      )}
    </div>
  )
}
