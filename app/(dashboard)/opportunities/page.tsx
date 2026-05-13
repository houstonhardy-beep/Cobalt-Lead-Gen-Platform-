import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { daysInCurrentStage } from '@/lib/pipeline/aging'
import { OpportunitiesClient } from './_components/OpportunitiesClient'
import type { LeadRow, OppRow } from './_components/OpportunitiesClient'

export const metadata = { title: 'Opportunities' }

export default async function OpportunitiesPage() {
  const session = await requireAuth()
  const tenant  = await getTenant()
  if (!tenant) redirect('/login')

  const now = new Date()

  const [leads, opps, reps] = await Promise.all([
    db.lead.findMany({
      where: {
        tenantId:      tenant.id,
        opportunities: { none: {} },
        stage:         { notIn: ['CLOSED_LOST'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, company: true, contact: true, contactTitle: true,
        leadSource: true, heat: true, city: true, state: true, createdAt: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    db.opportunity.findMany({
      where:   { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, type: true, jobType: true, productCategory: true,
        leadSource: true, status: true, stage: true, stageChangedAt: true,
        estimatedRevenue: true, weightedValue: true, probabilityPercent: true,
        createdAt: true, updatedAt: true,
        lead:     { select: { company: true, assignedTo: { select: { id: true, name: true } } } },
        customer: { select: { name: true } },
      },
    }),
    db.user.findMany({
      where:   { tenantId: tenant.id, active: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const leadRows: LeadRow[] = leads.map((l) => ({
    id:           l.id,
    company:      l.company,
    contact:      l.contact      ?? null,
    contactTitle: l.contactTitle ?? null,
    leadSource:   l.leadSource   ?? null,
    heat:         l.heat,
    repId:        l.assignedTo?.id   ?? null,
    repName:      l.assignedTo?.name ?? null,
    city:         l.city  ?? null,
    state:        l.state ?? null,
    createdAtMs:  l.createdAt.getTime(),
  }))

  const oppRows: OppRow[] = opps.map((o) => {
    const company        = o.lead?.company ?? o.customer?.name ?? '—'
    const repName        = o.lead?.assignedTo?.name ?? null
    const repId          = o.lead?.assignedTo?.id   ?? null
    const daysInStage    = daysInCurrentStage(o.stageChangedAt, o.createdAt, now)
    const daysInPipeline = Math.max(0, Math.floor((now.getTime() - o.createdAt.getTime()) / 86_400_000))
    return {
      id:                 o.id,
      title:              o.title,
      company,
      stage:              o.stage      ?? null,
      type:               o.type,
      jobType:            o.jobType         ?? null,
      productCategory:    o.productCategory ?? null,
      leadSource:         o.leadSource      ?? null,
      status:             o.status,
      estimatedRevenue:   o.estimatedRevenue   ?? null,
      weightedValue:      o.weightedValue      ?? null,
      probabilityPercent: o.probabilityPercent ?? null,
      repName,
      repId,
      daysInStage,
      daysInPipeline,
      needsAttention: daysInStage > 45,
      createdAtMs:    o.createdAt.getTime(),
      updatedAtMs:    o.updatedAt.getTime(),
    }
  })

  return (
    <OpportunitiesClient
      initialLeads={leadRows}
      initialOpps={oppRows}
      reps={reps as { id: string; name: string | null }[]}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  )
}
