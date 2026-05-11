export const AGE_BUCKETS = [
  { label: '0–30 days',  color: '#34d399' },
  { label: '31–60 days', color: '#fbbf24' },
  { label: '61–90 days', color: '#fb923c' },
  { label: '90+ days',   color: '#f87171' },
] as const

export interface AgeBucket {
  label: string
  color: string
  value: number
  count: number
}

export interface OppAgeEntry {
  estimatedRevenue: number | null
  stageChangedAt:   Date | null
  createdAt:        Date
}

export function daysInCurrentStage(
  stageChangedAt: Date | null | undefined,
  createdAt: Date,
  now: Date,
): number {
  const since = stageChangedAt ?? createdAt
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000))
}

export function bucketIndex(days: number): 0 | 1 | 2 | 3 {
  if (days <= 30) return 0
  if (days <= 60) return 1
  if (days <= 90) return 2
  return 3
}

export function stallColor(days: number): string | undefined {
  if (days >= 60) return '#f87171'
  if (days >= 30) return '#fb923c'
  return undefined
}

export function bucketByAge(opps: OppAgeEntry[], now: Date): AgeBucket[] {
  const buckets: AgeBucket[] = AGE_BUCKETS.map((b) => ({ ...b, value: 0, count: 0 }))
  for (const opp of opps) {
    const bi = bucketIndex(daysInCurrentStage(opp.stageChangedAt, opp.createdAt, now))
    buckets[bi].value += opp.estimatedRevenue ?? 0
    buckets[bi].count++
  }
  return buckets
}
