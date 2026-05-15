import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'
import { apolloEnrichOrg } from '@/lib/apollo'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi(['TENANT_ADMIN', 'COBALT_SUPER_ADMIN'])
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true, apolloKey: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  if (!tenant.apolloKey) return NextResponse.json({ error: 'Apollo key not configured' }, { status: 400 })

  // Leads missing all enrichment fields
  const leads = await db.lead.findMany({
    where: {
      tenantId:        tenant.id,
      employeeCount:   null,
      estimatedRevenue: null,
      industry:        null,
      website:         null,
    },
    select: { id: true, company: true, city: true, state: true },
  })

  let enriched = 0
  let skipped  = 0
  let failed   = 0

  for (const lead of leads) {
    try {
      const org = await apolloEnrichOrg(tenant.apolloKey, lead.company)
      if (!org) { skipped++; await sleep(500); continue }

      const patch = {
        ...(org.employeeCount      != null ? { employeeCount:      org.employeeCount }      : {}),
        ...(org.estimatedRevenue   != null ? { estimatedRevenue:   org.estimatedRevenue }   : {}),
        ...(org.industry           != null ? { industry:           org.industry }           : {}),
        ...(org.website            != null ? { website:            org.website }            : {}),
        ...(org.foundedYear        != null ? { foundedYear:        org.foundedYear }        : {}),
        ...(org.companyLinkedinUrl != null ? { companyLinkedinUrl: org.companyLinkedinUrl } : {}),
        ...(org.companyPhone       != null ? { companyPhone:       org.companyPhone }       : {}),
        ...(org.technologies.length        ? { technologies:       org.technologies }       : {}),
        ...(!lead.city  && org.city  ? { city:  org.city }  : {}),
        ...(!lead.state && org.state ? { state: org.state } : {}),
      }

      if (Object.keys(patch).length === 0) { skipped++; await sleep(500); continue }

      await db.lead.update({ where: { id: lead.id }, data: patch })
      enriched++
    } catch {
      failed++
    }
    await sleep(500)
  }

  return NextResponse.json({ enriched, skipped, failed })
}
