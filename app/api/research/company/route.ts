import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuthApi } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTenantSlug } from '@/lib/tenant'
import { apolloEnrichOrg, type ApolloOrgData } from '@/lib/apollo'

const BASE_SYSTEM_PROMPT = `You are a sales intelligence assistant for a physical security integrator. When given a company name, return a structured brief in JSON format. Be specific and practical — this is for a sales rep preparing for an outreach call.

Return valid JSON with exactly these keys:
- whatTheyDo: string — 2-3 sentences on what the company does, their industry, and core business
- sizeAndLocations: string — approximate headcount, revenue range if known, HQ location, notable offices or facilities
- physicalSecurityNeeds: string — specific physical security systems they likely need based on their industry and size (cameras, access control, intercoms, alarms, etc.). Be specific about why.
- recentSignals: string — any recent news, expansions, new construction, leadership changes, or other signals relevant to a security sale. If nothing notable, say so briefly.
- suggestedOpener: string — a specific, personalized cold outreach opener a sales rep could use. Reference something real about the company and tie it to a concrete security need.

No markdown in the values. Plain prose only.`

function buildVerifiedFacts(org: ApolloOrgData): string {
  const lines: string[] = []
  if (org.employeeCount)    lines.push(`- Employee count: ${org.employeeCount.toLocaleString()}`)
  if (org.estimatedRevenue) lines.push(`- Annual revenue: ${org.estimatedRevenue}`)
  if (org.industry)         lines.push(`- Industry: ${org.industry}`)
  if (org.city || org.state) {
    const loc = [org.city, org.state].filter(Boolean).join(', ')
    lines.push(`- Headquarters: ${loc}`)
  }
  if (org.website)          lines.push(`- Website: ${org.website}`)
  return lines.join('\n')
}

async function resolveTenant(request: NextRequest) {
  const slug = getTenantSlug(request)
  if (!slug) return null
  return db.tenant.findFirst({
    where: { slug, active: true },
    select: { anthropicKey: true, apolloKey: true },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const body = await request.json() as { company?: string }
  const company = body.company?.trim()
  if (!company) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

  const tenant = await resolveTenant(request)

  // Pre-enrich with Apollo if key is available
  let apolloData: ApolloOrgData | null = null
  if (tenant?.apolloKey) {
    apolloData = await apolloEnrichOrg(tenant.apolloKey, company)
  }

  // Build system prompt — inject verified Apollo facts when available
  let systemPrompt = BASE_SYSTEM_PROMPT
  if (apolloData) {
    const facts = buildVerifiedFacts(apolloData)
    systemPrompt += `\n\nThe following firmographic data has been VERIFIED via Apollo.io — treat these as confirmed facts, not estimates. Use them directly in your sizeAndLocations field rather than guessing:\n${facts}`
  }

  const client = new Anthropic({ apiKey: tenant?.anthropicKey ?? undefined })

  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Research this company for a security integrator sales rep: "${company}"`,
        },
      ],
    })
  } catch (err) {
    console.error('[research/company] Anthropic API error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Anthropic API error: ${msg}` }, { status: 502 })
  }

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
  }

  try {
    const raw = textContent.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const brief = JSON.parse(raw)
    return NextResponse.json({ company, brief, apolloVerified: apolloData != null })
  } catch {
    return NextResponse.json({ company, brief: { raw: textContent.text }, apolloVerified: false })
  }
}
