'use client'

import { useState, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useTenant } from '@/lib/tenant/context'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapPin {
  id: string
  pinType: 'opportunity' | 'lead'
  label: string
  company: string | null
  stage: string | null
  estimatedValue: number | null
  jobType: string | null
  productCategory: string | null
  lat: number
  lng: number
  city: string | null
  state: string | null
  repId: string | null
  repName: string | null
}

export interface MapRep {
  id: string
  name: string
}

// ─── Dynamic import (mapbox-gl accesses browser globals) ──────────────────────

const MapCanvas = dynamic(
  () => import('./MapCanvas').then((m) => ({ default: m.MapCanvas })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 13, color: '#64748b' }}>Loading map…</span>
      </div>
    ),
  },
)

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

const STAGE_COLOR_LEGEND = [
  { label: 'Signal',        color: '#94a3b8' },
  { label: 'Prospect',      color: '#93c5fd' },
  { label: 'Outreach Sent', color: '#fbbf24' },
  { label: 'Engaged',       color: '#fb923c' },
  { label: 'Qualified',     color: '#a78bfa' },
  { label: 'Proposal',      color: '#f9a8d4' },
  { label: 'Proposal Sent', color: '#f97316' },
  { label: 'Negotiation',   color: '#ef4444' },
  { label: 'Won',           color: '#22c55e' },
  { label: 'Lost',          color: '#475569' },
  { label: 'Nurture',       color: '#2dd4bf' },
]

const JOB_TYPE_LABEL: Record<string, string> = {
  NEW_CONSTRUCTION:   'New Construction',
  MAC:                'MAC',
  INSTALL:            'Install',
  BOX_SALE:           'Box Sale',
  UPGRADE_REFRESH:    'Upgrade / Refresh',
  RFP_BID:            'RFP / Bid',
  SERVICE_ON_DEMAND:  'Service (On-Demand)',
  SERVICE_CONTRACTED: 'Service (Contracted)',
}

const PRODUCT_CATEGORY_LABEL: Record<string, string> = {
  ACCESS_CONTROL:            'Access Control',
  VIDEO_SURVEILLANCE:        'Video Surveillance',
  INTRUSION_ALARM:           'Intrusion Alarm',
  INTERCOM_AUDIO:            'Intercom / Audio',
  NETWORKING_INFRASTRUCTURE: 'Networking Infrastructure',
  FIRE_LIFE_SAFETY:          'Fire / Life Safety',
  STRUCTURED_CABLING:        'Structured Cabling',
  AUTO_DOOR_SLIDING:         'Auto Door — Sliding',
  AUTO_DOOR_ROTATING:        'Auto Door — Rotating',
  AUTO_DOOR_OVERHEAD:        'Auto Door — Overhead',
  AUTO_DOOR_SWING:           'Auto Door — Swing',
  AUTO_DOOR_FOLDING:         'Auto Door — Folding',
  MANUAL_DOOR_SLIDING:       'Manual Door — Sliding',
  MANUAL_DOOR_ROTATING:      'Manual Door — Rotating',
  MANUAL_DOOR_OVERHEAD:      'Manual Door — Overhead',
  MANUAL_DOOR_SWING:         'Manual Door — Swing',
  MANUAL_DOOR_FOLDING:       'Manual Door — Folding',
  INTEGRATED_SYSTEMS:        'Integrated Systems',
  SYSTEMS_OTHER:             'Other',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmt$(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n.toLocaleString()}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text3)',
        display: 'block',
        marginBottom: 3,
      }}
    >
      {children}
    </span>
  )
}

function FilterSelect({
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
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--bg4)',
          color: 'var(--text)',
          padding: '5px 8px',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
          minWidth: 110,
        }}
      >
        {children}
      </select>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TerritoryMapClient({
  pins,
  reps,
  currentUserId,
  mapboxToken,
}: {
  pins: MapPin[]
  reps: MapRep[]
  currentUserId: string
  mapboxToken: string | null
}) {
  const { config } = useTenant()

  // Kick off geocoding on mount so any city/state-only records get coords
  useEffect(() => {
    if (!mapboxToken) return
    fetch('/api/geocode', { method: 'POST' }).catch(() => {})
  }, [mapboxToken])

  // User geolocation — used as radius center when available
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // denied / error → stay on tenant HQ / Alabama fallback
      { timeout: 8000, maximumAge: 300_000 },
    )
  }, [])

  // Filter state
  const [view, setView] = useState<'all' | 'mine'>('all')
  const [colorMode, setColorMode] = useState<'type' | 'stage'>('type')
  const [repFilter, setRepFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'opportunity' | 'lead'>('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [jobTypeFilter, setJobTypeFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')

  // Radius state
  const [radiusInput, setRadiusInput] = useState('50')
  const [activeMiles, setActiveMiles] = useState<number | null>(null)

  // Radius center: user location → tenant HQ → centroid of all pins → Alabama center
  const radiusCenter = useMemo(() => {
    if (userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng, label: 'your location' }
    }
    const hq = config.geography?.hq
    if (hq?.lat && hq?.lng && (hq.lat !== 0 || hq.lng !== 0)) {
      return {
        lat: hq.lat,
        lng: hq.lng,
        label: hq.city ? `${hq.city}, ${hq.state}` : 'company HQ',
      }
    }
    if (pins.length > 0) {
      const lat = pins.reduce((s, p) => s + p.lat, 0) / pins.length
      const lng = pins.reduce((s, p) => s + p.lng, 0) / pins.length
      return { lat, lng, label: 'territory centroid' }
    }
    return { lat: 32.8, lng: -86.6, label: 'Alabama center' }
  }, [userLocation, config, pins])

  // Unique dropdown options derived from pin data
  const uniqueStages = useMemo(
    () => [...new Set(pins.map((p) => p.stage).filter(Boolean))] as string[],
    [pins],
  )
  const uniqueJobTypes = useMemo(
    () => [...new Set(pins.map((p) => p.jobType).filter(Boolean))].sort() as string[],
    [pins],
  )
  const uniqueProducts = useMemo(
    () => [...new Set(pins.map((p) => p.productCategory).filter(Boolean))].sort() as string[],
    [pins],
  )
  const uniqueCompanies = useMemo(
    () => [...new Set(pins.map((p) => p.company).filter(Boolean))].sort() as string[],
    [pins],
  )

  // Apply view + dropdown filters
  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (view === 'mine' && p.repId !== currentUserId) return false
      if (view === 'all' && repFilter !== 'all' && p.repId !== repFilter) return false
      if (typeFilter !== 'all' && p.pinType !== typeFilter) return false
      if (stageFilter !== 'all' && p.stage !== stageFilter) return false
      if (jobTypeFilter !== 'all' && p.jobType !== jobTypeFilter) return false
      if (productFilter !== 'all' && p.productCategory !== productFilter) return false
      if (companyFilter !== 'all' && p.company !== companyFilter) return false
      return true
    })
  }, [pins, view, repFilter, typeFilter, stageFilter, jobTypeFilter, productFilter, companyFilter, currentUserId])

  // Apply radius filter on top
  const radiusPins = useMemo(() => {
    if (!activeMiles) return filteredPins
    return filteredPins.filter(
      (p) =>
        haversineDistance(radiusCenter.lat, radiusCenter.lng, p.lat, p.lng) <= activeMiles,
    )
  }, [filteredPins, activeMiles, radiusCenter])

  const visiblePins = activeMiles ? radiusPins : filteredPins

  // Breakdown grouped by pin type for radius panel
  const typeBreakdown = useMemo(() => {
    if (!activeMiles) return []
    const groups: Record<string, { count: number; value: number; color: string; label: string }> = {
      lead:        { count: 0, value: 0, color: '#f97316', label: 'Lead' },
      opportunity: { count: 0, value: 0, color: '#3b82f6', label: 'Opportunity' },
      won:         { count: 0, value: 0, color: '#22c55e', label: 'Won' },
    }
    for (const p of radiusPins) {
      if (p.pinType === 'lead') {
        groups.lead.count++
        groups.lead.value += p.estimatedValue ?? 0
      } else if (p.stage === 'CLOSED_WON') {
        groups.won.count++
        groups.won.value += p.estimatedValue ?? 0
      } else {
        groups.opportunity.count++
        groups.opportunity.value += p.estimatedValue ?? 0
      }
    }
    return Object.values(groups).filter((g) => g.count > 0)
  }, [radiusPins, activeMiles])

  const radiusTotalValue = radiusPins.reduce((s, p) => s + (p.estimatedValue ?? 0), 0)

  function handleSetRadius() {
    const n = parseFloat(radiusInput)
    if (!isNaN(n) && n > 0) setActiveMiles(n)
  }

  function handleClearRadius() {
    setActiveMiles(null)
    setRadiusInput('50')
  }

  const oppCount = visiblePins.filter((p) => p.pinType === 'opportunity').length
  const leadCount = visiblePins.filter((p) => p.pinType === 'lead').length

  return (
    <div
      style={{
        margin: '-1.5rem',
        height: 'calc(100vh - var(--topbar-h))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          padding: '10px 20px',
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--bg4)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* View toggle */}
        <div>
          <FieldLabel>View</FieldLabel>
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--bg4)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {(['all', 'mine'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setView(v)
                  if (v === 'mine') setRepFilter('all')
                }}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: view === v ? 600 : 400,
                  background: view === v ? 'var(--brand)' : 'var(--bg3)',
                  color: view === v ? '#fff' : 'var(--text2)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {v === 'all' ? 'All' : 'Mine'}
              </button>
            ))}
          </div>
        </div>

        {/* Color mode toggle */}
        <div>
          <FieldLabel>Colors</FieldLabel>
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--bg4)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {(['type', 'stage'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setColorMode(v)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: colorMode === v ? 600 : 400,
                  background: colorMode === v ? 'var(--brand)' : 'var(--bg3)',
                  color: colorMode === v ? '#fff' : 'var(--text2)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {v === 'type' ? 'Type' : 'Stage'}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: 'var(--bg4)', alignSelf: 'center' }} />

        {/* Rep — hidden in My mode */}
        {view === 'all' && (
          <FilterSelect label="Rep" value={repFilter} onChange={setRepFilter}>
            <option value="all">All Reps</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </FilterSelect>
        )}

        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as 'all' | 'opportunity' | 'lead')}
        >
          <option value="all">All Types</option>
          <option value="opportunity">Opportunities</option>
          <option value="lead">Leads</option>
        </FilterSelect>

        <FilterSelect label="Stage" value={stageFilter} onChange={setStageFilter}>
          <option value="all">All Stages</option>
          {uniqueStages.map((s) => (
            <option key={s} value={s}>
              {STAGE_META[s]?.label ?? s}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Job Type" value={jobTypeFilter} onChange={setJobTypeFilter}>
          <option value="all">All Types</option>
          {uniqueJobTypes.map((t) => (
            <option key={t} value={t}>
              {JOB_TYPE_LABEL[t] ?? t}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Product" value={productFilter} onChange={setProductFilter}>
          <option value="all">All Products</option>
          {uniqueProducts.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_CATEGORY_LABEL[p] ?? p}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Customer" value={companyFilter} onChange={setCompanyFilter}>
          <option value="all">All Companies</option>
          {uniqueCompanies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </FilterSelect>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: 'var(--bg4)', alignSelf: 'center' }} />

        {/* Radius tool */}
        <div>
          <FieldLabel>Radius</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              min={1}
              max={500}
              value={radiusInput}
              onChange={(e) => setRadiusInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetRadius()}
              style={{
                width: 60,
                padding: '5px 8px',
                background: 'var(--bg3)',
                border: '1px solid var(--bg4)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 12,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>mi</span>
            <button
              type="button"
              onClick={handleSetRadius}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: `1px solid var(--brand)`,
                background: activeMiles ? 'var(--brand)' : 'transparent',
                color: activeMiles ? '#fff' : 'var(--brand)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {activeMiles ? `${activeMiles} mi ✓` : 'Set Radius'}
            </button>
            {activeMiles && (
              <button
                type="button"
                onClick={handleClearRadius}
                style={{
                  padding: '5px 8px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--bg4)',
                  background: 'transparent',
                  color: 'var(--text3)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Pin count */}
        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {visiblePins.length} location{visiblePins.length !== 1 ? 's' : ''}
            {oppCount > 0 || leadCount > 0
              ? ` · ${oppCount} opp${oppCount !== 1 ? 's' : ''}, ${leadCount} lead${leadCount !== 1 ? 's' : ''}`
              : ''}
            {activeMiles ? ` within ${activeMiles} mi of ${radiusCenter.label}` : ''}
          </span>
        </div>
      </div>

      {/* ── Map area ────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: '#111827',
        }}
      >
        {mapboxToken ? (
          /* Live Mapbox map */
          <MapCanvas
            pins={visiblePins}
            totalPins={pins.length}
            mapboxToken={mapboxToken}
            currentUserId={currentUserId}
            colorMode={colorMode}
            userLocation={userLocation}
          />
        ) : (
          /* No token — prompt to configure */
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                padding: '36px 52px',
                background: 'var(--bg2)',
                border: '1px solid var(--bg4)',
                borderRadius: 12,
                maxWidth: 400,
                textAlign: 'center',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text3)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 44, height: 44 }}
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              <div>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: 6,
                  }}
                >
                  Territory Map
                </p>
                <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                  Add your Mapbox API key in{' '}
                  <span style={{ color: 'var(--text2)' }}>Settings → Integrations</span> to
                  activate the map.
                </p>
              </div>
              {pins.length > 0 && (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text3)',
                    borderTop: '1px solid var(--bg4)',
                    paddingTop: 12,
                    width: '100%',
                    marginTop: 2,
                  }}
                >
                  {pins.length} geocoded location{pins.length !== 1 ? 's' : ''} ready to display
                </p>
              )}
            </div>
          </div>
        )}

        {/* Radius summary panel — overlays map (top-left) when active */}
        {activeMiles && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              width: 252,
              background: 'var(--bg2)',
              border: '1px solid var(--bg4)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
              zIndex: 10,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--bg4)',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Within {activeMiles} mi
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>of {radiusCenter.label}</span>
            </div>

            <div style={{ padding: '12px 14px' }}>
              <p
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'var(--text)',
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {radiusPins.length}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                location{radiusPins.length !== 1 ? 's' : ''} · {fmt$(radiusTotalValue)} pipeline
              </p>

              {typeBreakdown.length > 0 ? (
                <div
                  style={{
                    borderTop: '1px solid var(--bg4)',
                    paddingTop: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {typeBreakdown.map(({ label, count, value, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {count} · {fmt$(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text3)',
                    textAlign: 'center',
                    paddingTop: 4,
                  }}
                >
                  No locations in this radius
                </p>
              )}
            </div>
          </div>
        )}

        {/* Legend — switches between type and stage mode */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            background: 'var(--bg2)',
            border: '1px solid var(--bg4)',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            zIndex: 10,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 2,
            }}
          >
            {colorMode === 'stage' ? 'Stage' : 'Type'}
          </p>
          {(colorMode === 'stage' ? STAGE_COLOR_LEGEND : [
            { label: 'Lead',        color: '#f97316' },
            { label: 'Opportunity', color: '#3b82f6' },
            { label: 'Won',         color: '#22c55e' },
          ]).map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{label}</span>
            </div>
          ))}
          {userLocation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  border: '1.5px solid #fff',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>You</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
