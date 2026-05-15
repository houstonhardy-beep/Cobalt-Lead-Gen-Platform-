import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

async function geocodeQuery(
  query: string,
  token: string,
): Promise<{ lat: number; lng: number } | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?access_token=${token}&limit=1&country=US&types=place,address,locality,district`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as { features?: Array<{ center: [number, number] }> }
    const center = data.features?.[0]?.center
    if (!center) return null
    return { lng: center[0], lat: center[1] }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true, mapboxToken: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  if (!tenant.mapboxToken) return NextResponse.json({ geocoded: 0 })

  const token = tenant.mapboxToken

  // Leads with city/state or address but no coordinates (limit 50 per call)
  const leadsToGeocode = await db.lead.findMany({
    where: {
      tenantId: tenant.id,
      lat: null,
      OR: [
        { city: { not: null } },
        { address: { not: null } },
      ],
    },
    select: { id: true, address: true, city: true, state: true },
    take: 50,
  })

  // Opportunities with job site city/state but no coordinates
  const oppsToGeocode = await db.opportunity.findMany({
    where: {
      tenantId: tenant.id,
      jobSiteLat: null,
      OR: [
        { jobSiteCity: { not: null } },
        { jobSiteAddress: { not: null } },
      ],
    },
    select: { id: true, jobSiteAddress: true, jobSiteCity: true, jobSiteState: true },
    take: 50,
  })

  let geocoded = 0

  for (const lead of leadsToGeocode) {
    const parts = [lead.address, lead.city, lead.state].filter(Boolean)
    if (parts.length === 0) continue
    const coords = await geocodeQuery(parts.join(', '), token)
    if (!coords) continue
    await db.lead.update({ where: { id: lead.id }, data: { lat: coords.lat, lng: coords.lng } })
    geocoded++
  }

  for (const opp of oppsToGeocode) {
    const parts = [opp.jobSiteAddress, opp.jobSiteCity, opp.jobSiteState].filter(Boolean)
    if (parts.length === 0) continue
    const coords = await geocodeQuery(parts.join(', '), token)
    if (!coords) continue
    await db.opportunity.update({
      where: { id: opp.id },
      data: { jobSiteLat: coords.lat, jobSiteLng: coords.lng },
    })
    geocoded++
  }

  return NextResponse.json({ geocoded })
}
