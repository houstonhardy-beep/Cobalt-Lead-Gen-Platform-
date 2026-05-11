// Shared constants for the Pipeline page — no 'use client' so server components can import freely.

export const CHART_STAGE_ORDER = [
  'SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED',
  'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'NURTURE',
] as const
