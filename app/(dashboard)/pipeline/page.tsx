import { db } from '@/lib/db'
import { getTenant } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth'
import { daysInCurrentStage } from '@/lib/pipeline/aging'
import { PipelineClient } from './_components/PipelineClient'
import type { PipelineRow } from './_components/PipelineClient'

export default async function PipelinePage() {
  const [, tenant] = await Promise.all([requireAuth(), getTenant()])

  if (!tenant) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Pipeline</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Navigate to a tenant workspace to view pipeline.</p>
      </div>
    )
  }

  const now = new Date()

  const opps = await db.opportunity.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ['OPEN', 'PURSUING'] },
    },
    orderBy: { estimatedRevenue: 'desc' },
    select: {
      id:                 true,
      title:              true,
      type:               true,
      jobType:            true,
      productCategory:    true,
      leadSource:         true,
      status:             true,
      stage:              true,
      stageChangedAt:     true,
      estimatedRevenue:   true,
      weightedValue:      true,
      probabilityPercent: true,
      createdAt:          true,
      updatedAt:          true,
      lead: {
        select: {
          company:    true,
          assignedTo: { select: { id: true, name: true } },
        },
      },
      customer: {
        select: { name: true },
      },
    },
  })

  const rows: PipelineRow[] = opps.map((o) => {
    const company        = o.lead?.company ?? o.customer?.name ?? '—'
    const repName        = o.lead?.assignedTo?.name ?? null
    const repId          = o.lead?.assignedTo?.id   ?? null
    const daysInStage    = daysInCurrentStage(o.stageChangedAt, o.createdAt, now)
    const daysInPipeline = Math.max(0, Math.floor((now.getTime() - o.createdAt.getTime()) / 86_400_000))

    return {
      id:                 o.id,
      title:              o.title,
      company,
      stage:              o.stage           ?? null,
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

  return <PipelineClient rows={rows} />
}
