'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  kind:     'OUTREACH' | 'LOG' | 'FOLLOWUP'
  type?:    string       // OutreachType string for OUTREACH
  company:  string
  contact?: string | null
  rep?:     string | null
  text?:    string | null  // subject, action, or notes
  time:     Date
  overdue?: boolean
}

export interface DayActivity {
  calls:      number
  emails:     number
  sms:        number
  followUps:  { company: string; contact: string | null; overdue: boolean }[]
  activities: ActivityEntry[]
}

// key = day-of-month as string ('1' … '31')
export type CalendarData = Record<string, DayActivity>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const ENTRY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  COLD_CALL:  { label: 'Call',     color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)' },
  FOLLOW_UP:  { label: 'Call',     color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)' },
  COLD_EMAIL: { label: 'Email',    color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  POST_QUOTE: { label: 'Email',    color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  CONTRACT:   { label: 'Email',    color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  RFP_COVER:  { label: 'Email',    color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  LINKEDIN:   { label: 'LinkedIn', color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
  SMS:        { label: 'SMS',      color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
}

function getEntryStyle(entry: ActivityEntry): { label: string; color: string; bg: string } {
  if (entry.kind === 'FOLLOWUP') {
    return entry.overdue
      ? { label: 'Overdue',    color: '#f87171', bg: 'rgba(239,68,68,0.15)' }
      : { label: 'Follow-up',  color: '#818cf8', bg: 'rgba(129,140,248,0.15)' }
  }
  if (entry.kind === 'LOG') {
    return { label: 'Activity', color: '#94a3b8', bg: 'rgba(100,116,139,0.15)' }
  }
  return ENTRY_STYLE[entry.type ?? ''] ?? { label: 'Outreach', color: '#94a3b8', bg: 'rgba(100,116,139,0.15)' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityCalendar({
  year,
  month,
  today,
  data,
}: {
  year:  number
  month: number  // 0-based
  today: number  // day of month, or 0 if not current month
  data:  CalendarData
}) {
  const [selected, setSelected] = useState<number | null>(null)

  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  })

  const selectedActivity = selected ? (data[String(selected)] ?? null) : null

  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text3)' }}>
        {monthLabel}
      </p>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs py-0.5" style={{ color: 'var(--text3)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />

          const act        = data[String(day)]
          const hasCalls   = (act?.calls  ?? 0) > 0
          const hasEmails  = (act?.emails ?? 0) > 0
          const hasSms     = (act?.sms    ?? 0) > 0
          const hasOverdue = act?.followUps.some((f) => f.overdue)  ?? false
          const hasFuture  = act?.followUps.some((f) => !f.overdue) ?? false
          const hasLogs    = (act?.activities.filter((a) => a.kind === 'LOG').length ?? 0) > 0
          const isPast     = today > 0 && day < today
          const isToday    = day === today
          const isSelected = day === selected

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(isSelected ? null : day)}
              className="flex flex-col items-center justify-start py-1 rounded text-xs cursor-pointer"
              style={{
                background: isSelected ? 'var(--bg4)' : isToday ? 'rgba(59,130,246,0.15)' : 'transparent',
                color:      isToday    ? 'var(--text)'  : isPast ? 'var(--text3)' : 'var(--text2)',
                fontWeight: isToday    ? 700 : 400,
                minHeight: '2.25rem',
              }}
            >
              <span>{day}</span>
              <div className="flex gap-px mt-0.5 flex-wrap justify-center">
                {(hasCalls || hasSms) && (
                  <span className="w-1 h-1 rounded-full" style={{ background: '#2dd4bf' }} />
                )}
                {hasEmails && (
                  <span className="w-1 h-1 rounded-full" style={{ background: '#60a5fa' }} />
                )}
                {hasLogs && (
                  <span className="w-1 h-1 rounded-full" style={{ background: '#94a3b8' }} />
                )}
                {hasOverdue && (
                  <span className="w-1 h-1 rounded-full" style={{ background: '#f87171' }} />
                )}
                {hasFuture && !hasOverdue && (
                  <span className="w-1 h-1 rounded-full" style={{ background: '#818cf8' }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {[
          { color: '#2dd4bf', label: 'Calls/SMS' },
          { color: '#60a5fa', label: 'Emails' },
          { color: '#818cf8', label: 'Scheduled' },
          { color: '#f87171', label: 'Overdue' },
          { color: '#94a3b8', label: 'Activity' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text3)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Day detail popup */}
      {selected && (
        <div
          className="mt-2 rounded-lg overflow-hidden"
          style={{ background: 'var(--bg3)', border: '1px solid var(--bg4)' }}
        >
          <p
            className="text-xs font-semibold px-3 py-2"
            style={{ color: 'var(--text)', borderBottom: '1px solid var(--bg4)' }}
          >
            {new Date(year, month, selected).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
            {selectedActivity && (
              <span className="font-normal ml-2" style={{ color: 'var(--text3)' }}>
                {selectedActivity.activities.length} activit{selectedActivity.activities.length !== 1 ? 'ies' : 'y'}
              </span>
            )}
          </p>

          {!selectedActivity || selectedActivity.activities.length === 0 ? (
            <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--text3)' }}>
              No activity recorded
            </p>
          ) : (
            <div
              className="overflow-y-auto divide-y"
              style={{ maxHeight: '16rem', borderColor: 'var(--bg4)' }}
            >
              {[...selectedActivity.activities]
                .sort((a, b) => a.time.getTime() - b.time.getTime())
                .map((entry, i) => {
                  const style = getEntryStyle(entry)
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5"
                        style={{ background: style.bg, color: style.color }}
                      >
                        {style.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-tight" style={{ color: 'var(--text)' }}>
                          {entry.company}
                          {entry.contact && (
                            <span style={{ color: 'var(--text2)', fontWeight: 400 }}> · {entry.contact}</span>
                          )}
                        </p>
                        {entry.rep && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                            by {entry.rep}
                          </p>
                        )}
                        {entry.text && (
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text2)' }}>
                            {entry.text}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-xs shrink-0 tabular-nums mt-0.5"
                        style={{ color: 'var(--text3)' }}
                      >
                        {entry.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
