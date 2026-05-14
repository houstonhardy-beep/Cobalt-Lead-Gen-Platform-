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

  const searches = await db.savedSearch.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(searches)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const body = await request.json() as {
    name?: string
    query?: string
    frequency?: string
    isActive?: boolean
  }

  if (!body.name?.trim())  return NextResponse.json({ error: 'Name is required' },  { status: 400 })
  if (!body.query?.trim()) return NextResponse.json({ error: 'Query is required' }, { status: 400 })

  const frequency = body.frequency === 'WEEKLY' ? 'WEEKLY' : 'DAILY'

  const search = await db.savedSearch.create({
    data: {
      tenantId,
      name:      body.name.trim(),
      query:     body.query.trim(),
      frequency: frequency as never,
      isActive:  body.isActive ?? true,
    },
  })

  return NextResponse.json(search, { status: 201 })
}
