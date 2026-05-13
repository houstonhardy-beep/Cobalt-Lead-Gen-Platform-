import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { SignalQueueClient } from './_components/SignalQueueClient'

export const metadata = { title: 'Signal Queue' }

export default async function SignalQueuePage() {
  const session = await requireAuth()
  const tenant  = await getTenant()
  if (!tenant) redirect('/login')

  const [signals, reps] = await Promise.all([
    db.signal.findMany({
      where: { tenantId: tenant.id },
      orderBy: [
        { status: 'asc' },
        { priority: 'asc' },
        { detectedAt: 'desc' },
      ],
      select: {
        id:             true,
        type:           true,
        priority:       true,
        title:          true,
        company:        true,
        location:       true,
        estimatedValue: true,
        description:    true,
        sourceName:     true,
        sourceUrl:      true,
        detectedAt:     true,
        status:         true,
        assignedToId:   true,
        isRead:         true,
        contactName:    true,
        contactTitle:   true,
        convertedLeadId: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const serialized = signals.map((s) => ({
    ...s,
    detectedAt: s.detectedAt.toISOString(),
  }))

  return (
    <SignalQueueClient
      signals={serialized}
      reps={reps as { id: string; name: string | null }[]}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  )
}
