'use client'

import { useState, useCallback } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox'
import type { MapPin } from './TerritoryMapClient'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  SIGNAL: 'Signal',
  PROSPECT: 'Prospect',
  OUTREACH_SENT: 'Outreach Sent',
  ENGAGED: 'Engaged',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Won',
  CLOSED_LOST: 'Lost',
  NURTURE: 'Nurture',
}

export const STAGE_COLOR: Record<string, string> = {
  SIGNAL:        '#94a3b8',
  PROSPECT:      '#93c5fd',
  OUTREACH_SENT: '#fbbf24',
  ENGAGED:       '#fb923c',
  QUALIFIED:     '#a78bfa',
  PROPOSAL:      '#f9a8d4',
  PROPOSAL_SENT: '#f97316',
  NEGOTIATION:   '#ef4444',
  CLOSED_WON:    '#22c55e',
  CLOSED_LOST:   '#475569',
  NURTURE:       '#2dd4bf',
}

function pinColor(pin: MapPin, colorMode: 'type' | 'stage'): string {
  if (colorMode === 'stage') {
    return STAGE_COLOR[pin.stage ?? ''] ?? '#94a3b8'
  }
  if (pin.pinType === 'lead') return '#f97316'
  if (pin.stage === 'CLOSED_WON') return '#22c55e'
  return '#3b82f6'
}

function fmt$(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n.toLocaleString()}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapCanvasProps {
  pins: MapPin[]
  totalPins: number
  mapboxToken: string
  currentUserId: string
  colorMode: 'type' | 'stage'
  userLocation: { lat: number; lng: number } | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapCanvas({
  pins,
  totalPins,
  mapboxToken,
  currentUserId,
  colorMode,
  userLocation,
}: MapCanvasProps) {
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)

  // Computed once from pins at mount — Map ignores subsequent changes to initialViewState.
  const lngs = pins.map((p) => p.lng)
  const lats = pins.map((p) => p.lat)
  const initialViewState =
    pins.length > 0
      ? {
          bounds: [
            [Math.min(...lngs) - 0.5, Math.min(...lats) - 0.5],
            [Math.max(...lngs) + 0.5, Math.max(...lats) + 0.5],
          ] as [[number, number], [number, number]],
          fitBoundsOptions: { padding: 60, maxZoom: 13 },
        }
      : { longitude: -86.6 as number, latitude: 32.8 as number, zoom: 6.5 as number }

  const handleMarkerClick = useCallback(
    (pin: MapPin, e: { originalEvent: { stopPropagation: () => void } }) => {
      e.originalEvent.stopPropagation()
      setSelectedPin((prev) => (prev?.id === pin.id ? null : pin))
    },
    [],
  )

  return (
    <Map
      mapboxAccessToken={mapboxToken}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%' }}
      onClick={() => setSelectedPin(null)}
    >
      <NavigationControl position="top-right" />

      {/* Markers */}
      {pins.map((pin) => {
        const color = pinColor(pin, colorMode)
        const isMe = pin.repId === currentUserId
        return (
          <Marker
            key={pin.id}
            longitude={pin.lng}
            latitude={pin.lat}
            anchor="center"
            onClick={(e) => handleMarkerClick(pin, e)}
          >
            <div
              style={{
                width: isMe ? 14 : 10,
                height: isMe ? 14 : 10,
                borderRadius: '50%',
                background: color,
                border: isMe ? '2.5px solid #fff' : '1.5px solid rgba(0,0,0,0.3)',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
              }}
            />
          </Marker>
        )
      })}

      {/* Popup */}
      {selectedPin && (
        <Popup
          longitude={selectedPin.lng}
          latitude={selectedPin.lat}
          anchor="bottom"
          closeOnClick={false}
          onClose={() => setSelectedPin(null)}
          maxWidth="260px"
        >
          <div
            style={{
              background: '#1e2433',
              borderRadius: 8,
              padding: '12px 14px',
              color: '#f0f4ff',
              minWidth: 200,
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              {selectedPin.label}
            </p>
            {selectedPin.company && selectedPin.pinType === 'opportunity' && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                {selectedPin.company}
              </p>
            )}
            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 4,
                  fontWeight: 600,
                  background:
                    selectedPin.pinType === 'lead'
                      ? 'rgba(249,115,22,0.2)'
                      : selectedPin.stage === 'CLOSED_WON'
                        ? 'rgba(34,197,94,0.2)'
                        : 'rgba(59,130,246,0.2)',
                  color:
                    selectedPin.pinType === 'lead'
                      ? '#f97316'
                      : selectedPin.stage === 'CLOSED_WON'
                        ? '#22c55e'
                        : '#60a5fa',
                }}
              >
                {selectedPin.pinType === 'lead'
                  ? `Lead · ${STAGE_LABEL[selectedPin.stage ?? ''] ?? selectedPin.stage ?? 'Lead'}`
                  : (STAGE_LABEL[selectedPin.stage ?? ''] ?? selectedPin.stage ?? '—')}
              </span>
            </div>
            {selectedPin.estimatedValue != null && (
              <p style={{ fontSize: 12, color: '#94a3b8' }}>
                Value:{' '}
                <span style={{ color: '#f0f4ff', fontWeight: 600 }}>
                  {fmt$(selectedPin.estimatedValue)}
                </span>
              </p>
            )}
            {selectedPin.city && (
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {[selectedPin.city, selectedPin.state].filter(Boolean).join(', ')}
              </p>
            )}
            {selectedPin.repName && (
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {selectedPin.repName}
              </p>
            )}
          </div>
        </Popup>
      )}

      {/* User location — pulsing blue dot; rendered last so it sits on top */}
      {userLocation && (
        <Marker
          longitude={userLocation.lng}
          latitude={userLocation.lat}
          anchor="center"
        >
          <div
            style={{
              position: 'relative',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(59,130,246,0.45)',
                animation: 'cobalt-location-pulse 2s ease-out infinite',
              }}
            />
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#3b82f6',
                border: '2.5px solid #fff',
                boxShadow: '0 0 8px rgba(59,130,246,0.6)',
                position: 'relative',
                zIndex: 1,
                flexShrink: 0,
              }}
            />
          </div>
        </Marker>
      )}

      {/* Empty state overlay */}
      {pins.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(30,36,51,0.92)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '24px 36px',
              textAlign: 'center',
              maxWidth: 360,
            }}
          >
            <p
              style={{ fontSize: 14, fontWeight: 600, color: '#f0f4ff', marginBottom: 6 }}
            >
              {totalPins === 0 ? 'No locations yet' : 'No locations match your filters'}
            </p>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              {totalPins === 0
                ? 'Add addresses to your leads and opportunities to see them plotted here'
                : 'Try adjusting the filters above'}
            </p>
          </div>
        </div>
      )}
    </Map>
  )
}
