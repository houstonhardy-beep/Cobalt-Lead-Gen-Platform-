// Typed overlays for the Tenant model's Json columns.
// Cast with (tenant.config as TenantConfig) after fetching from DB.

// LeadVertical lives in the Prisma schema — re-export here so tenant configs
// can import from @/lib/tenant/types without coupling to the generated path.
export type { LeadVertical, LeadStage } from '@/app/generated/prisma/client'
import type { LeadVertical, LeadStage } from '@/app/generated/prisma/client'

// ─── Geography ────────────────────────────────────────────────────────────────

// A named sub-territory within a tenant's coverage area.
// Define a region using any combination of the boundary methods below —
// they are OR'd together when checking whether a lead falls within the region.
export interface TerritoryRegion {
  id: string             // slug, e.g. "alabama", "fl-panhandle", "greater-montgomery"
  name: string           // display name shown in the UI
  color?: string         // optional hex color for map pins / filter chips

  // ── Boundary methods (use one or more) ───────────────────────────────────
  states?: string[]      // ISO 3166-2 state codes, e.g. ['AL']
  counties?: string[]    // "County Name, ST" format, e.g. ['Escambia County, FL']
  radiusFromHqMiles?: number   // circle of N miles centered on hq.lat/hq.lng
  boundingBox?: {        // axis-aligned rectangle — good for panhandle shapes
    north: number
    south: number
    east: number
    west: number
  }
}

export interface TenantHq {
  address: string
  city: string
  state: string
  zipCode: string
  lat: number
  lng: number
}

export interface TenantGeography {
  hq: TenantHq
  primaryStates: string[]     // drives default filters and AI prompts, e.g. ['AL']
  secondaryStates?: string[]  // secondary coverage, e.g. ['FL']
  displayLabel: string        // human-readable territory, e.g. "Alabama and Florida Panhandle"
  defaultRadiusMiles?: number // default map zoom radius on territory view
  regions: TerritoryRegion[]  // named sub-territories — reps are assigned to these
}

// ─── AI Prompt Context ────────────────────────────────────────────────────────

export interface TenantPromptContext {
  companyDescription: string   // injected into every AI call
  territory: string            // plain-English territory description
  differentiators: string[]    // selling points used in outreach prompts
  references: string[]         // past project/client references for credibility
  certifications?: string[]    // e.g. ['Verkada-certified', 'SAM.gov registered']
}

// ─── Stage Probability ────────────────────────────────────────────────────────
// Default win-probability % per pipeline stage. Tenants can override in config.

export const DEFAULT_STAGE_PROBABILITY: Record<LeadStage, number> = {
  SIGNAL:        5,
  PROSPECT:      10,
  OUTREACH_SENT: 20,
  ENGAGED:       35,
  QUALIFIED:     50,
  PROPOSAL:      65,
  PROPOSAL_SENT: 75,
  NEGOTIATION:   85,
  CLOSED_WON:    100,
  CLOSED_LOST:   0,
  NURTURE:       10,
}

export const STAGE_META: Record<LeadStage, { probability: number; isClosedStage: boolean; description: string }> = {
  SIGNAL:        { probability: 5,   isClosedStage: false, description: 'Market signal identified, not yet contacted' },
  PROSPECT:      { probability: 10,  isClosedStage: false, description: 'Identified as a target, research in progress' },
  OUTREACH_SENT: { probability: 20,  isClosedStage: false, description: 'Initial outreach sent, awaiting response' },
  ENGAGED:       { probability: 35,  isClosedStage: false, description: 'Prospect is engaged and in active conversation' },
  QUALIFIED:     { probability: 50,  isClosedStage: false, description: 'Need and fit confirmed, opportunity qualified' },
  PROPOSAL:      { probability: 65,  isClosedStage: false, description: 'Proposal being prepared or under review' },
  PROPOSAL_SENT: { probability: 75,  isClosedStage: false, description: 'Proposal delivered, awaiting decision' },
  NEGOTIATION:   { probability: 85,  isClosedStage: false, description: 'Terms and pricing under negotiation' },
  CLOSED_WON:    { probability: 100, isClosedStage: true,  description: 'Deal won and contract signed' },
  CLOSED_LOST:   { probability: 0,   isClosedStage: true,  description: 'Deal lost or disqualified' },
  NURTURE:       { probability: 10,  isClosedStage: false, description: 'Long-term nurture — not active pipeline' },
}

// ─── Tenant Config ────────────────────────────────────────────────────────────

export interface PipelineTargets {
  weightedTarget?: number    // total weighted pipeline $ goal
  monthlyAddsTarget?: number // new opp $ value to add each month
}

export interface TenantConfig {
  geography: TenantGeography
  verticals: LeadVertical[]   // which verticals this tenant tracks
  prompts: TenantPromptContext
  stageProbability?: Record<LeadStage, number>  // falls back to DEFAULT_STAGE_PROBABILITY
  pipeline?: PipelineTargets
}

// ─── Tenant Branding ──────────────────────────────────────────────────────────

export interface TenantBranding {
  companyName: string
  tagline?: string
  primaryColor: string        // hex, e.g. "#1d4ed8" — sets --brand
  accentColor?: string
  tenantAccentColor?: string  // hex — sets --accent (nav active, buttons, progress bars)
  logoUrl?: string            // served from /public/
  faviconUrl?: string
}

// ─── Resolved Tenant ──────────────────────────────────────────────────────────

// Prisma Tenant row with Json columns cast to their typed shapes.
export interface ResolvedTenant {
  id: string
  slug: string
  name: string
  active: boolean
  config: TenantConfig
  branding: TenantBranding
  createdAt: Date
  updatedAt: Date

  // Integrations
  mapboxToken:  string | null
  anthropicKey: string | null

  // Branding overrides
  accentColor: string | null
  logoUrl:     string | null

  // Team targets
  monthlyLeadGoal:          number | null
  monthlyRevenueTarget:     number | null
  quarterlyRevenueTarget:   number | null
  annualRevenueTarget:      number | null
  monthlyOutreachTarget:    number | null
  quarterlyOutreachTarget:  number | null
  annualOutreachTarget:     number | null
}
