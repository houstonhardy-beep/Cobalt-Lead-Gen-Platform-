import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'
import { apolloEnrichOrg } from '@/lib/apollo'

async function resolveTenant(request: NextRequest) {
  const slug = getTenantSlug(request)
  if (!slug) return null
  return db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true, apolloKey: true },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenant = await resolveTenant(request)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const body = await request.json() as {
    company:       string
    contact?:      string
    contactTitle?: string
    phone?:        string
    email?:        string
    leadSource?:   string
    heat?:         string
    assignedToId?: string
    value?:        number
    notes?:        string
    city?:         string
    state?:        string
  }

  if (!body.company?.trim()) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }

  const lead = await db.lead.create({
    data: {
      tenantId:     tenant.id,
      company:      body.company.trim(),
      contact:      body.contact      || undefined,
      contactTitle: body.contactTitle || undefined,
      phone:        body.phone        || undefined,
      email:        body.email        || undefined,
      leadSource:   body.leadSource as never || undefined,
      heat:         body.heat as never || 'COLD',
      stage:        'PROSPECT',
      assignedToId: body.assignedToId || auth.session.user.id,
      value:        body.value        ?? undefined,
      notes:        body.notes        || undefined,
      city:         body.city         || undefined,
      state:        body.state        || undefined,
    },
    select: {
      id: true, company: true, contact: true, contactTitle: true,
      leadSource: true, heat: true, city: true, state: true, createdAt: true,
      assignedTo: { select: { id: true, name: true } },
    },
  })

  // Fire-and-forget Apollo enrichment
  console.log('[apollo] apolloKey present:', !!tenant.apolloKey)
  if (tenant.apolloKey) {
    void apolloEnrichOrg(tenant.apolloKey, body.company.trim()).then(async (org) => {
      console.log('[apollo] enrichOrg result for', body.company.trim(), ':', JSON.stringify(org))
      if (!org) return
      const patch = {
        ...(org.employeeCount      != null ? { employeeCount:      org.employeeCount }      : {}),
        ...(org.estimatedRevenue   != null ? { estimatedRevenue:   org.estimatedRevenue }   : {}),
        ...(org.industry           != null ? { industry:           org.industry }           : {}),
        ...(org.website            != null ? { website:            org.website }            : {}),
        ...(org.foundedYear        != null ? { foundedYear:        org.foundedYear }        : {}),
        ...(org.companyLinkedinUrl != null ? { companyLinkedinUrl: org.companyLinkedinUrl } : {}),
        ...(org.companyPhone       != null ? { companyPhone:       org.companyPhone }       : {}),
        ...(org.technologies.length        ? { technologies:       org.technologies }       : {}),
        ...(!body.city  && org.city  ? { city:  org.city }  : {}),
        ...(!body.state && org.state ? { state: org.state } : {}),
      }
      console.log('[apollo] updating lead', lead.id, 'with patch:', JSON.stringify(patch))
      await db.lead.update({ where: { id: lead.id }, data: patch })
      console.log('[apollo] lead update succeeded')
    }).catch((err) => {
      console.error('[apollo] enrichment error:', err)
    })
  }

  return NextResponse.json({ ...lead, createdAt: lead.createdAt.toISOString() }, { status: 201 })
}
