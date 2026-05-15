import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuthApi } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTenantSlug } from '@/lib/tenant'

async function resolveAnthropicClient(request: NextRequest): Promise<Anthropic> {
  const slug = getTenantSlug(request)
  if (!slug) return new Anthropic()
  const tenant = await db.tenant.findFirst({
    where: { slug, active: true },
    select: { anthropicKey: true },
  })
  return new Anthropic({ apiKey: tenant?.anthropicKey ?? undefined })
}

const SYSTEM_PROMPT = `You are a senior sales development representative at a physical security integration company. Your company sells and installs IP cameras and video surveillance, electronic access control, intercoms, intrusion alarms, and integrated security platforms.

Write targeted, specific outreach that references real details about the prospect. No generic boilerplate. Every sentence should earn its place. Be concise and compelling.`

const TONE_DESCRIPTIONS: Record<string, string> = {
  'Professional':      'Professional and authoritative. Use formal language. Focus on expertise and credibility.',
  'Conversational':    'Conversational and friendly. Casual language, approachable, like a peer reaching out.',
  'Direct & Brief':    'Direct and brief. Cut immediately to the point. No filler. Aim for half the length of a typical message.',
  'Consultative':      'Consultative and thoughtful. Lead with curiosity and insight. Position as a trusted advisor, not a vendor pitching product.',
  'Bold & Challenger': 'Bold and challenging. Open with a provocative insight or uncomfortable truth about their security posture or industry. Challenge their current thinking. Confident and assertive.',
}

function formatResearchContext(ctx: Record<string, unknown>): string {
  const lines: string[] = []
  const s1 = ctx.stage1 as Record<string, string> | undefined
  const s2 = ctx.stage2 as Record<string, string> | undefined

  if (s1) {
    if (s1.whatTheyDo)            lines.push(`What they do: ${s1.whatTheyDo}`)
    if (s1.sizeAndLocations)      lines.push(`Size & locations: ${s1.sizeAndLocations}`)
    if (s1.physicalSecurityNeeds) lines.push(`Physical security needs: ${s1.physicalSecurityNeeds}`)
    if (s1.recentSignals)         lines.push(`Recent signals: ${s1.recentSignals}`)
  }
  if (s2) {
    if (s2.physicalFootprint)  lines.push(`Physical footprint: ${s2.physicalFootprint}`)
    if (s2.technologyAndOEM)   lines.push(`Current technology: ${s2.technologyAndOEM}`)
    if (s2.budgetIntelligence) lines.push(`Budget intelligence: ${s2.budgetIntelligence}`)
    if (s2.buyingProcess)      lines.push(`Buying process: ${s2.buyingProcess}`)
    if (s2.whoToTarget)        lines.push(`Who to target: ${s2.whoToTarget}`)
    if (s2.suggestedApproach)  lines.push(`Suggested approach: ${s2.suggestedApproach}`)
  }
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth.ok) return auth.response

  const body = await request.json() as {
    companyName?:     string
    channel?:         string
    tone?:            string
    researchContext?: Record<string, unknown>
    contactName?:     string
    contactTitle?:    string
    contactEmail?:    string
  }

  const companyName = body.companyName?.trim()
  if (!companyName) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

  const channel      = body.channel === 'CALL_SCRIPT' ? 'CALL_SCRIPT' : 'EMAIL'
  const tone         = body.tone ?? 'Professional'
  const toneDesc     = TONE_DESCRIPTIONS[tone] ?? TONE_DESCRIPTIONS['Professional']
  const contactName  = body.contactName?.trim()
  const contactTitle = body.contactTitle?.trim()
  const contactEmail = body.contactEmail?.trim()

  const contactParts = [contactName, contactTitle, contactEmail].filter(Boolean)
  const contactLine  = contactParts.length ? `Contact: ${contactParts.join(', ')}` : ''

  const researchSection = body.researchContext
    ? `\nResearch context for ${companyName}:\n${formatResearchContext(body.researchContext)}\n`
    : ''

  let userContent: string

  if (channel === 'EMAIL') {
    const addressee = contactName
      ? `${contactName}${contactTitle ? ` (${contactTitle})` : ''} at ${companyName}`
      : `a prospect at ${companyName}`
    userContent = `Write a cold outreach email to ${addressee}.

Tone: ${toneDesc}
${contactLine ? contactLine + '\n' : ''}${researchSection}
Address the contact by first name in the greeting if a name is provided. Do not use placeholders like [Customer Name] or [Email].${contactEmail ? ` The recipient's email address is ${contactEmail} — include it in the To: line at the top of the email.` : ''}

Format your response exactly as:
${contactEmail ? `To: ${contactEmail}\n` : ''}Subject: [subject line]

[email body]`
  } else {
    const addressee = contactName
      ? `${contactName}${contactTitle ? ` (${contactTitle})` : ''} at ${companyName}`
      : `a prospect at ${companyName}`
    userContent = `Write a cold call script for reaching out to ${addressee}.

Tone: ${toneDesc}
${contactLine ? contactLine + '\n' : ''}${researchSection}
Use the contact's first name where natural if a name is provided.

Format your response exactly as:

OPENER
[10-15 second opener]

DISCOVERY QUESTIONS
1. [question tailored to ${companyName}]
2. [question tailored to ${companyName}]
3. [question tailored to ${companyName}]

VALUE PROPOSITION
[1-2 sentence value prop]

CLOSE / NEXT STEP
[suggested next step]`
  }

  const client = await resolveAnthropicClient(request)

  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })
  } catch (err) {
    console.error('[outreach/generate] Anthropic API error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Anthropic API error: ${msg}` }, { status: 502 })
  }

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
  }

  return NextResponse.json({ generatedContent: textContent.text })
}
