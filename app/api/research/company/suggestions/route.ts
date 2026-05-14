import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuthApi } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTenantSlug } from '@/lib/tenant'
import type { TenantConfig } from '@/lib/tenant/types'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a sales intelligence assistant for a physical security integrator. When given a company name and a target territory, suggest 1-3 similar companies the sales rep should also research as prospects.

Suggestions must be headquartered in or have significant operations in the target territory (the specified state and its neighboring states). Geography is a hard filter, not a tiebreaker — do not suggest companies with no presence in that region.

Among geographically eligible companies, prioritize similarity in this order:
1. Industry / vertical (strongest signal)
2. Physical footprint type — multi-site retail or branch network, single large HQ campus, distributed offices, industrial facilities, etc.
3. Size range (employee count and revenue tier)

Return valid JSON with a single key "suggestions" containing an array of objects. Each object must have:
- companyName: string — the name of the suggested company
- reason: string — exactly one sentence explaining why they are similar and confirming their regional presence

Return 1 to 3 suggestions. Only suggest real, well-known companies. No markdown. Plain text only in string values.`

interface Suggestion {
  companyName: string
  reason:      string
}

async function resolveTerritoryState(request: NextRequest): Promise<string | null> {
  const slug = getTenantSlug(request)
  if (!slug) return null

  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { config: true },
  })
  if (!tenant) return null

  const config = tenant.config as unknown as TenantConfig
  const geo = config?.geography

  // Prefer primaryStates, fall back to HQ state
  const state = geo?.primaryStates?.[0] ?? geo?.hq?.state ?? null
  return state ?? null
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const body = await request.json() as { company?: string }
  const company = body.company?.trim()
  if (!company) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

  const territoryState = await resolveTerritoryState(request)

  const territoryLine = territoryState
    ? `Target territory: ${territoryState} and neighboring states. Only suggest companies headquartered in or with significant operations there.`
    : `Target territory: use the searched company's home state and neighboring states as the territory.`

  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Suggest similar companies to research after looking at: "${company}"\n\n${territoryLine}`,
        },
      ],
    })
  } catch (err) {
    console.error('[research/company/suggestions] Anthropic API error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Anthropic API error: ${msg}` }, { status: 502 })
  }

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
  }

  try {
    const raw = textContent.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(raw) as { suggestions: Suggestion[] }
    return NextResponse.json({ suggestions: parsed.suggestions ?? [] })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
