# Cobalt — Product Vision & Architecture

## What Cobalt Is
A sales intelligence platform built specifically for security integrators and CSP portfolio companies. Cobalt is the source of truth for top-of-funnel sales activity — from signal detection through lead qualification and pipeline management.

## Positioning
- NOT a CRM replacement — operates alongside ConnectWise and HubSpot
- Owns top of funnel: signal detection → prospecting → qualification
- Handoff point: Closed Won in Cobalt triggers opportunity creation in ConnectWise
- ConnectWise feeds actuals back to Cobalt for forecast vs actual reporting
- Companies using HubSpot as CRM use Cobalt the same way — top of funnel feeder

## What Cobalt Does That Others Can't
- Signal detection from Dodge Data, SAM.gov, construction permits
- AI-powered outreach tailored to security integrators
- Territory mapping with heat scoring by geography
- Portfolio-level visibility across multiple companies (Cobalt Super Admin)
- National customer intelligence — track customers across multiple tenants
- CSP-specific KPIs: weighted pipeline, stage velocity, pipeline aging alerts
- Intelligent alerts on noteworthy trends (positive and negative)
- Built around how security integrators actually sell

## Competitive Moat
- Industry specificity — works out of the box for security integrators, no configuration needed
- Signal integrations — leaving means losing the Dodge/SAM.gov data feed
- Historical data — stage velocity and aging trends compound in value over time
- CSP relationship — Cobalt manages the tool across the portfolio
- National customer intelligence — impossible in any other tool
- Tailored KPIs — metrics CSP cares about are built in, no custom reporting required

## Pipeline Stages
SIGNAL (5%) → PROSPECT (10%) → OUTREACH_SENT (20%) → ENGAGED (35%) → QUALIFIED (50%) → PROPOSAL (65%) → PROPOSAL_SENT (75%) → NEGOTIATION (85%) → CLOSED_WON (100%) / CLOSED_LOST (0%) / NURTURE (10%)

Each stage has: name, description, probability %, isClosedStage boolean

## Integration Architecture
- Apollo/ZoomInfo: lead and contact enrichment
- Dodge Data: construction permit signals
- SAM.gov: government RFP signals
- Claude AI: outreach generation and prospect research
- Mapbox: territory mapping and geocoding
- ConnectWise Manage: post-sale handoff (push) + actuals feedback (webhook)
- HubSpot: alternative CRM handoff for non-ConnectWise companies
- Sendgrid: email send and open/click tracking
- Twilio: SMS outreach tracking
- Verkada: existing customer health and upsell signals

## Tenant Model
- Rep: works leads, generates outreach, logs activity, sees team notes
- Tenant Admin: manages team, views full pipeline, configures settings and integrations
- Cobalt Super Admin: portfolio dashboard across all tenants, drill-down into any tenant

## Customer Intelligence (Planned)
Track existing customers across all tenants. When a national customer (e.g. Coca-Cola) appears across multiple portfolio companies, Cobalt surfaces this at the Super Admin level showing total relationship value, locations served, whitespace, and renewal risk.

Live news and signal monitoring for existing customers — surface expansion opportunities and relationship risks automatically.

## Product Principles
1. Built for how security integrators actually sell — not generic
2. Reps should spend less than 5 minutes in the tool to know exactly what to do today
3. Managers should get alerts, not dashboards — tell them what matters
4. Every integration should remove friction, not add it
5. Data compounds in value — the longer companies use Cobalt, the more valuable it becomes
