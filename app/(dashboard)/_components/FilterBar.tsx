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
] as const

export function FilterBar({ reps }: { reps: FilterRep[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const period = searchParams.get('period') ?? 'month'
  const rep    = searchParams.get('rep')    ?? 'all'

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`)
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
            onClick={() => update('period', p.value)}
            className="px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: period === p.value ? 'var(--cobalt)' : 'var(--bg2)',
              color:      period === p.value ? '#fff'          : 'var(--text2)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Rep filter — only shown when there are multiple reps */}
      {reps.length > 1 && (
        <select
          value={rep}
          onChange={(e) => update('rep', e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
          style={{
            background: 'var(--bg2)',
            color: 'var(--text)',
            border: '1px solid var(--bg4)',
            outline: 'none',
          }}
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
