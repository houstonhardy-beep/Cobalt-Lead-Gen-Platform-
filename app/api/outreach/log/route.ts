import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthApi } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'

async function resolveTenantId(request: NextRequest): Promise<string | null> {
  const slug = getTenantSlug(request)
  if (!slug) return null
  const tenant = await db.tenant.findFirst({ where: { slug, active: true }, select: { id: true } })
  return tenant?.id ?? null
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const drafts = await db.outreachDraft.findMany({
    where:   { tenantId },
    orderBy: { createdAt: 'desc' },
    take:    50,
    select: {
      id: true, companyName: true, channel: true, tone: true,
      generatedContent: true, feedback: true, createdAt: true,
    },
  })

  return NextResponse.json(drafts)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const body = await request.json() as {
    companyName?:     string
    channel?:         string
    tone?:            string
    researchContext?: Record<string, unknown>
    generatedContent?: string
    leadId?:           string
  }

  if (!body.companyName?.trim())     return NextResponse.json({ error: 'Company name is required' },    { status: 400 })
  if (!body.generatedContent?.trim()) return NextResponse.json({ error: 'Generated content required' }, { status: 400 })

  const channel = body.channel === 'CALL_SCRIPT' ? 'CALL_SCRIPT' : 'EMAIL'

  const draft = await db.outreachDraft.create({
    data: {
      tenantId,
      companyName:      body.companyName.trim(),
      channel:          channel as never,
      tone:             body.tone ?? 'Professional',
      researchContext:  body.researchContext ? JSON.parse(JSON.stringify(body.researchContext)) : undefined,
      generatedContent: body.generatedContent.trim(),
      leadId:           body.leadId || undefined,
      createdById:      auth.session.user.id,
    },
    select: { id: true },
  })

  return NextResponse.json({ id: draft.id }, { status: 201 })
}
