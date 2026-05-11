import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { TerritoryMapClient } from './_components/TerritoryMapClient'
import type { MapPin, MapRep } from './_components/TerritoryMapClient'

export default async function TerritoryMapPage() {
  const [session, tenant] = await Promise.all([requireAuth(), getTenant()])
  if (!tenant) return null

  const [oppsRaw, repsRaw] = await Promise.all([
    db.opportunity.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['OPEN', 'PURSUING'] },
        jobSiteLat: { not: null },
        jobSiteLng: { not: null },
      },
      select: {
        id: true,
        title: true,
        stage: true,
        estimatedRevenue: true,
        jobType: true,
        productCategory: true,
        jobSiteCity: true,
        jobSiteState: true,
        jobSiteLat: true,
        jobSiteLng: true,
        lead: {
          select: {
            company: true,
            assignedTo: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        role: { in: ['REP', 'TENANT_ADMIN'] },
      },
      select: { id: true, name: true },
    }),
  ])

  const pins: MapPin[] = oppsRaw
    .filter(
      (o): o is typeof o & { jobSiteLat: number; jobSiteLng: number } =>
        o.jobSiteLat != null && o.jobSiteLng != null,
    )
    .map((o) => ({
      id: o.id,
      title: o.title,
      company: o.lead?.company ?? null,
      stage: o.stage ?? null,
      estimatedValue: o.estimatedRevenue ?? null,
      jobType: o.jobType ?? null,
      productCategory: o.productCategory ?? null,
      lat: o.jobSiteLat,
      lng: o.jobSiteLng,
      jobSiteCity: o.jobSiteCity ?? null,
      jobSiteState: o.jobSiteState ?? null,
      repId: o.lead?.assignedTo?.id ?? null,
      repName: o.lead?.assignedTo?.name ?? null,
    }))

  const reps: MapRep[] = repsRaw.map((r) => ({
    id: r.id,
    name: r.name ?? 'Unknown',
  }))

  return <TerritoryMapClient pins={pins} reps={reps} currentUserId={session.user.id} />
}
