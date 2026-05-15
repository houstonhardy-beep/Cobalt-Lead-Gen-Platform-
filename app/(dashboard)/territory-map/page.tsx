import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { TerritoryMapClient } from './_components/TerritoryMapClient'
import type { MapPin, MapRep } from './_components/TerritoryMapClient'

export default async function TerritoryMapPage() {
  const [session, tenant] = await Promise.all([requireAuth(), getTenant()])
  if (!tenant) return null

  const [oppsRaw, leadsRaw, repsRaw] = await Promise.all([
    db.opportunity.findMany({
      where: {
        tenantId: tenant.id,
        jobSiteLat: { not: null },
        jobSiteLng: { not: null },
        status: { in: ['OPEN', 'PURSUING', 'WON'] },
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
    db.lead.findMany({
      where: {
        tenantId: tenant.id,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        company: true,
        city: true,
        state: true,
        lat: true,
        lng: true,
        stage: true,
        value: true,
        jobType: true,
        productCategory: true,
        assignedTo: {
          select: { id: true, name: true },
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

  const oppPins: MapPin[] = oppsRaw
    .filter(
      (o): o is typeof o & { jobSiteLat: number; jobSiteLng: number } =>
        o.jobSiteLat != null && o.jobSiteLng != null,
    )
    .map((o) => ({
      id: o.id,
      pinType: 'opportunity' as const,
      label: o.title,
      company: o.lead?.company ?? null,
      stage: o.stage ?? null,
      estimatedValue: o.estimatedRevenue ?? null,
      jobType: o.jobType ?? null,
      productCategory: o.productCategory ?? null,
      lat: o.jobSiteLat,
      lng: o.jobSiteLng,
      city: o.jobSiteCity ?? null,
      state: o.jobSiteState ?? null,
      repId: o.lead?.assignedTo?.id ?? null,
      repName: o.lead?.assignedTo?.name ?? null,
    }))

  const leadPins: MapPin[] = leadsRaw
    .filter((l): l is typeof l & { lat: number; lng: number } => l.lat != null && l.lng != null)
    .map((l) => ({
      id: `lead-${l.id}`,
      pinType: 'lead' as const,
      label: l.company,
      company: l.company,
      stage: l.stage ?? null,
      estimatedValue: l.value ?? null,
      jobType: l.jobType ?? null,
      productCategory: l.productCategory ?? null,
      lat: l.lat,
      lng: l.lng,
      city: l.city ?? null,
      state: l.state ?? null,
      repId: l.assignedTo?.id ?? null,
      repName: l.assignedTo?.name ?? null,
    }))

  const pins: MapPin[] = [...oppPins, ...leadPins]

  const reps: MapRep[] = repsRaw.map((r) => ({
    id: r.id,
    name: r.name ?? 'Unknown',
  }))

  return (
    <TerritoryMapClient
      pins={pins}
      reps={reps}
      currentUserId={session.user.id}
      mapboxToken={tenant.mapboxToken ?? null}
    />
  )
}
