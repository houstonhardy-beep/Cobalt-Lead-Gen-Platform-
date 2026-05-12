'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export interface FilterRep {
  id: string
  name: string | null
  email: string
}

const PERIODS = [
  { value: 'week',    label: 'This Week' },
  { value: 'month',   label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom',  label: 'Custom' },
] as const

export function ReportsFilters({ reps }: { reps: FilterRep[] }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const period = searchParams.get('period') ?? 'month'
  const rep    = searchParams.get('rep')    ?? 'all'
  const from   = searchParams.get('from')   ?? ''
  const to     = searchParams.get('to')     ?? ''

  function set(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`)
  }

  function setPeriod(value: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('period', value)
    if (value !== 'custom') {
      next.delete('from')
      next.delete('to')
    }
    router.replace(`${pathname}?${next.toString()}`)
  }

  const inputStyle = {
    background: 'var(--bg2)',
    color: 'var(--text)',
    border: '1px solid var(--bg4)',
    outline: 'none',
    colorScheme: 'light' as const,
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Period toggle */}
      <div
        className="flex rounded-lg overflow-hidden shrink-0"
        style={{ border: '1px solid var(--bg4)' }}
      >
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className="px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: period === p.value ? 'var(--accent)' : 'var(--bg2)',
              color:      period === p.value ? '#fff'          : 'var(--text2)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => set('from', e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg"
            style={inputStyle}
          />
          <span className="text-xs" style={{ color: 'var(--text3)' }}>to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => set('to', e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg"
            style={inputStyle}
          />
        </div>
      )}

      {/* Rep filter */}
      {reps.length > 1 && (
        <select
          value={rep}
          onChange={(e) => set('rep', e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
          style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--bg4)', outline: 'none' }}
        >
          <option value="all">All Reps</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name ?? r.email}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
