import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { OutreachClient } from './_components/OutreachClient'
import type { HistoryRow, OutreachClientProps } from './_components/OutreachClient'

export const metadata = { title: 'Outreach' }

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const tenant = await getTenant()
  if (!tenant) redirect('/login')

  const params = await searchParams
  const initialCompany      = typeof params.company      === 'string' ? params.company      : ''
  const initialResearch     = typeof params.research     === 'string' ? params.research     : ''
  const initialContactName  = typeof params.contactName  === 'string' ? params.contactName  : ''
  const initialContactTitle = typeof params.contactTitle === 'string' ? params.contactTitle : ''
  const initialContactEmail = typeof params.contactEmail === 'string' ? params.contactEmail : ''

  const drafts = await db.outreachDraft.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    take:    50,
    select: {
      id: true, companyName: true, channel: true, tone: true,
      generatedContent: true, feedback: true, createdAt: true,
    },
  })

  const initialHistory: HistoryRow[] = drafts.map((d) => ({
    id:               d.id,
    companyName:      d.companyName,
    channel:          d.channel as 'EMAIL' | 'CALL_SCRIPT',
    tone:             d.tone,
    generatedContent: d.generatedContent,
    feedback:         d.feedback,
    createdAtMs:      d.createdAt.getTime(),
  }))

  const props: OutreachClientProps = {
    initialHistory,
    initialCompany,
    initialResearch,
    initialContactName,
    initialContactTitle,
    initialContactEmail,
  }

  return <OutreachClient {...props} />
}
