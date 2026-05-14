import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuthApi } from '@/lib/auth'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a senior sales intelligence analyst for a physical security integrator. When given a company name, return a deep-research brief in JSON format. Your goal is to help a sales rep walk into a first meeting fully prepared.

Be specific. Where data is inferred or unavailable, prefix the statement with "Estimated:" or "Likely:" so the rep knows what is confirmed vs. assumed. For public entities (government, schools, municipalities) note that budget and procurement data may be available via public records.

Return valid JSON with exactly these keys:

- physicalFootprint: string — number of locations or branches, facility types (office, warehouse, campus, retail, etc.), estimated square footage, and any known or recent construction or renovation activity. Prefix estimates with "Estimated:".

- technologyAndOEM: string — known or likely installed security systems, access control brands, camera OEMs, video management software, and estimated technology refresh cycle. Prefix inferred items with "Likely:".

- budgetIntelligence: string — funding sources (private, PE-backed, publicly traded, government/tax-funded), capital budget indicators, fiscal year timing, and budget cycle notes. Note if this is a public entity where procurement records are available. Prefix unconfirmed items with "Estimated:" or "Likely:".

- buyingProcess: string — how this type of organization likely makes purchasing decisions, who holds budget authority, whether they tend toward RFP-driven or relationship-driven procurement, and an estimated sales cycle timeline (e.g. "3–6 months"). Identify the typical decision maker, influencer, and champion roles.

- whoToTarget: string — specific job titles to pursue at this organization. Return each role on its own line in the format "Role Type: Title — one sentence on why". Identify at minimum: economic buyer (holds budget), technical influencer (evaluates solutions), and internal champion (wants the problem solved). Be specific to their industry.

- suggestedApproach: string — recommended sales angle based on all of the above. What to lead with, what pain point to address first, what proof points or case studies would resonate, and how to position against a likely incumbent.

No markdown in the values. Plain prose only.`

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const body = await request.json() as { company?: string }
  const company = body.company?.trim()
  if (!company) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
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
          content: `Run deep sales research on this company for a physical security integrator: "${company}"`,
        },
      ],
    })
  } catch (err) {
    console.error('[research/company/deep] Anthropic API error:', err)
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
    return NextResponse.json({ company, brief })
  } catch {
    return NextResponse.json({ company, brief: { raw: textContent.text } })
  }
}
