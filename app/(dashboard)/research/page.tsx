import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ResearchClient } from './_components/ResearchClient'
import type { SavedSearchRow } from './_components/ResearchClient'

export const metadata = { title: 'Research' }

export default async function ResearchPage() {
  await requireAuth()
  const tenant = await getTenant()
  if (!tenant) redirect('/login')

  const savedSearches = await db.savedSearch.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, query: true, isActive: true, frequency: true, createdAt: true },
  })

  const rows: SavedSearchRow[] = savedSearches.map((s) => ({
    id:          s.id,
    name:        s.name,
    query:       s.query,
    isActive:    s.isActive,
    frequency:   s.frequency,
    createdAtMs: s.createdAt.getTime(),
  }))

  return <ResearchClient initialSavedSearches={rows} />
}
