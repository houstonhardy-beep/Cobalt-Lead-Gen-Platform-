import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'
import { apolloEnrichPerson } from '@/lib/apollo'

async function resolveTenant(request: NextRequest) {
  const slug = getTenantSlug(request)
  if (!slug) return null
  return db.tenant.findFirst({
    where: { slug, active: true },
    select: { id: true, apolloKey: true },
  })
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const slug = getTenantSlug(request)
  if (!slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const tenantRow = await db.tenant.findFirst({ where: { slug, active: true }, select: { id: true } })
  if (!tenantRow) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const tenantId = tenantRow.id

  const { searchParams } = new URL(request.url)
  const leadId        = searchParams.get('leadId')
  const opportunityId = searchParams.get('opportunityId')

  if (!leadId && !opportunityId) {
    return NextResponse.json({ error: 'leadId or opportunityId is required' }, { status: 400 })
  }

  const contacts = await db.contact.findMany({
    where: {
      tenantId,
      ...(leadId ? { leadId } : { opportunityId: opportunityId! }),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, title: true, phone: true, email: true, linkedinUrl: true },
  })

  return NextResponse.json(contacts)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) {
    console.log('[contacts POST] auth failed')
    return auth.response
  }

  const tenant = await resolveTenant(request)
  console.log('[contacts POST] tenantId:', tenant?.id)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  let body: { leadId?: string; opportunityId?: string; name?: string; title?: string; phone?: string; email?: string }
  try {
    body = await request.json()
  } catch (e) {
    console.error('[contacts POST] failed to parse body:', e)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  console.log('[contacts POST] body:', JSON.stringify(body))

  if (!body.name?.trim()) {
    console.log('[contacts POST] rejected: name missing')
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!body.leadId && !body.opportunityId) {
    console.log('[contacts POST] rejected: no leadId or opportunityId')
    return NextResponse.json({ error: 'leadId or opportunityId is required' }, { status: 400 })
  }

  let contact: { id: string; name: string; title: string | null; phone: string | null; email: string | null; linkedinUrl: string | null }
  try {
    contact = await db.contact.create({
      data: {
        tenantId:      tenant.id,
        leadId:        body.leadId        || undefined,
        opportunityId: body.opportunityId || undefined,
        name:          body.name.trim(),
        title:         body.title?.trim()  || null,
        phone:         body.phone?.trim()  || null,
        email:         body.email?.trim()  || null,
      },
      select: { id: true, name: true, title: true, phone: true, email: true, linkedinUrl: true },
    })
    console.log('[contacts POST] created:', contact.id)
  } catch (e) {
    console.error('[contacts POST] db.create error:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Fire-and-forget Apollo person enrichment
  if (tenant.apolloKey) {
    void (async () => {
      try {
        // Resolve company name from linked entity
        let companyName: string | null = null
        if (body.leadId) {
          const lead = await db.lead.findFirst({ where: { id: body.leadId }, select: { company: true } })
          companyName = lead?.company ?? null
        } else if (body.opportunityId) {
          const opp = await db.opportunity.findFirst({
            where: { id: body.opportunityId },
            select: { lead: { select: { company: true } } },
          })
          companyName = opp?.lead?.company ?? null
        }

        if (!companyName) return

        const person = await apolloEnrichPerson(tenant.apolloKey!, contact.name, companyName)
        if (!person) return

        await db.contact.update({
          where: { id: contact.id },
          data: {
            ...(!contact.email && person.email       ? { email:       person.email }       : {}),
            ...(!contact.phone && person.phone       ? { phone:       person.phone }       : {}),
            ...(!contact.title && person.title       ? { title:       person.title }       : {}),
            ...(person.linkedinUrl                   ? { linkedinUrl: person.linkedinUrl } : {}),
          },
        })
      } catch {
        // enrichment is best-effort
      }
    })()
  }

  return NextResponse.json(contact, { status: 201 })
}
