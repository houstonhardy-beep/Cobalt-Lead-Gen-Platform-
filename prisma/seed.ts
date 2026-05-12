/**
 * Prisma seed — run with: npx prisma db seed
 *
 * Wipes all LEK tenant data and recreates:
 *   - LEK Technologies tenant + 3 users
 *   - 23 leads across all pipeline stages (AL + FL Panhandle territory)
 *   - 10 open opportunities + 3 WON (for bookings comparison)
 *   - 8 StageHistory records (triggers velocity alerts)
 *   - 4 existing customers
 *   - ~23 outreach logs (May 1–7, populates activity calendar)
 *   - 10 lead logs (activity history)
 *
 * Designed to trigger all 5 alert types:
 *   1. Stage velocity: OUTREACH_SENT ↓50% faster, ENGAGED ↓46% faster
 *   2. Stalled pipeline: $430K hasn't moved in 35–42 days
 *   3. Overdue follow-ups: lekRep has 3 overdue (Dothan, Jefferson Co., Pell City)
 *   4. New logo bookings: $280K current vs $95K last period (2.9x)
 *
 * Passwords below are development defaults ONLY.
 * Rotate all credentials before any staging or production use.
 */

import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { LEK_CONFIG, LEK_BRANDING } from '../tenants/lek/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function hash(pw: string) {
  return bcrypt.hash(pw, 12)
}

async function main() {
  console.log('Seeding database…')

  // ── Tenant ────────────────────────────────────────────────────────────────────
  const lek = await db.tenant.upsert({
    where:  { slug: 'lek' },
    update: { config: LEK_CONFIG as object, branding: LEK_BRANDING as object },
    create: { slug: 'lek', name: 'LEK Technologies', active: true, config: LEK_CONFIG as object, branding: LEK_BRANDING as object },
  })
  console.log(`  ✓ Tenant: ${lek.name}`)

  // ── Users ─────────────────────────────────────────────────────────────────────
  await db.user.upsert({
    where:  { email: 'houston.hardy@cobaltsp.com' },
    update: {},
    create: {
      email: 'houston.hardy@cobaltsp.com', name: 'Houston Hardy',
      role: 'COBALT_SUPER_ADMIN', passwordHash: await hash('cobalt-super-2026'),
      tenantId: null, active: true,
    },
  })

  const lekAdmin = await db.user.upsert({
    where:  { email: 'admin@leksystems.com' },
    update: {},
    create: {
      email: 'admin@leksystems.com', name: 'Alex Carter',
      role: 'TENANT_ADMIN', passwordHash: await hash('lek-admin-2026'),
      tenantId: lek.id, active: true,
    },
  })

  const lekRep = await db.user.upsert({
    where:  { email: 'rep@leksystems.com' },
    update: {},
    create: {
      email: 'rep@leksystems.com', name: 'Jake Morrison',
      role: 'REP', passwordHash: await hash('lek-rep-2026'),
      tenantId: lek.id, assignedRegionIds: ['alabama', 'fl-panhandle'], active: true,
    },
  })
  console.log('  ✓ Users upserted')

  // ── Wipe existing LEK data (in FK-safe order) ─────────────────────────────────
  await db.pipelineTarget.deleteMany({ where: { tenantId: lek.id } })
  await db.outreachLog.deleteMany({ where: { tenantId: lek.id } })
  await db.opportunity.deleteMany({ where: { tenantId: lek.id } })   // cascades → stageHistory, opportunityProduct
  await db.note.deleteMany({ where: { tenantId: lek.id } })
  await db.lead.deleteMany({ where: { tenantId: lek.id } })           // cascades → leadLog
  await db.customerLocation.deleteMany({ where: { tenantId: lek.id } })
  await db.customer.deleteMany({ where: { tenantId: lek.id } })
  console.log('  ✓ Existing LEK data wiped')

  // ── Leads ─────────────────────────────────────────────────────────────────────

  // Admin-monitored SIGNAL leads
  const [gulfShores, tuscaloosaCounty] = await Promise.all([
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekAdmin.id,
      company: 'Gulf Shores Convention Center', contact: 'Director of Events',
      contactTitle: 'Executive Director',
      vertical: 'GOVERNMENT', stage: 'SIGNAL', heat: 'HOT', value: 220000,
      city: 'Gulf Shores', state: 'AL', zip: '36542', lat: 30.2460, lng: -87.7008,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'NEW_CONSTRUCTION', leadSource: 'DODGE_DATA',
      signal: 'City council approved $45M Gulf Shores Convention Center expansion. Security, access control, and AV scope estimated $180–220K. Design phase begins Q3.',
      signalSource: 'City Council Resolution',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekAdmin.id,
      company: 'Tuscaloosa County Commission', contact: 'Randy Lovelady',
      contactTitle: 'County Administrator', phone: '205-349-3870',
      vertical: 'GOVERNMENT', stage: 'SIGNAL', heat: 'WARM', value: 175000,
      city: 'Tuscaloosa', state: 'AL', zip: '35401', lat: 33.2098, lng: -87.5692,
      productCategory: 'ACCESS_CONTROL', jobType: 'UPGRADE_REFRESH', leadSource: 'RFP_BID_BOARD',
      signal: 'County commission approved $2.1M judicial complex security upgrade. Access control, IP cameras, and intercom across all 4 buildings.',
      signalSource: 'County Commission Agenda',
    }}),
  ])

  // Stalled pipeline leads (>30d in current stage → triggers aging alert)
  const [alabamaPower, shelbyCounty, fortPayne] = await Promise.all([
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Alabama Power HQ', contact: 'Marcus Reed', contactTitle: 'Security Manager',
      phone: '205-257-1000', email: 'm.reed@alabamapower.com',
      vertical: 'COMMERCIAL', stage: 'PROPOSAL', heat: 'HOT', value: 150000,
      city: 'Birmingham', state: 'AL', zip: '35203', lat: 33.5154, lng: -86.8073,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'RFP_BID_BOARD',
      signal: 'Security manager issued RFP for IP camera replacement at 3 downtown Birmingham facilities.',
      notes: 'Large scope — 200+ cameras across HQ, ops center, and maintenance facility. Waiting on procurement committee.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Shelby County Courthouse', contact: 'Janet Fulton', contactTitle: 'Facilities Director',
      phone: '205-669-3760', email: 'jfulton@shelbycounty.org',
      vertical: 'GOVERNMENT', stage: 'PROPOSAL_SENT', heat: 'WARM', value: 185000,
      city: 'Columbiana', state: 'AL', zip: '35051', lat: 33.1762, lng: -86.6080,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'NEW_CONSTRUCTION', leadSource: 'RFP_BID_BOARD',
      notes: 'Full security system for new justice center. Sent proposal March 30. No response yet.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Fort Payne City Schools', contact: 'Superintendent Office',
      contactTitle: 'Superintendent', phone: '256-845-0743',
      vertical: 'EDUCATION', stage: 'NEGOTIATION', heat: 'HOT', value: 95000,
      city: 'Fort Payne', state: 'AL', zip: '35967', lat: 34.4443, lng: -85.7196,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'RFP_BID_BOARD',
      notes: 'Camera + access across 5 schools. Contract in attorney review — delays adding up.',
    }}),
  ])

  // Overdue follow-up leads (nextFollowUp in the past → triggers follow-up alert)
  const [dothanCityHall, jeffersonCounty, pellCity] = await Promise.all([
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Dothan City Hall', contact: 'Brian Stokes', contactTitle: 'Procurement Manager',
      phone: '334-615-3000', email: 'b.stokes@dothan.gov',
      vertical: 'GOVERNMENT', stage: 'OUTREACH_SENT', heat: 'HOT', value: 55000,
      city: 'Dothan', state: 'AL', zip: '36303', lat: 31.2232, lng: -85.3905,
      productCategory: 'ACCESS_CONTROL', jobType: 'NEW_CONSTRUCTION', leadSource: 'DODGE_DATA',
      signal: 'City hall expansion permit filed — $4.2M renovation includes security system upgrade.',
      nextFollowUp: new Date('2026-05-03'),
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Jefferson County Schools', contact: 'David Pugh', contactTitle: 'Director of Facilities',
      phone: '205-379-2000', email: 'd.pugh@jefcoed.com',
      vertical: 'EDUCATION', stage: 'ENGAGED', heat: 'WARM', value: 145000,
      city: 'Birmingham', state: 'AL', zip: '35203', lat: 33.5186, lng: -86.8104,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'SAM_GOV',
      signal: 'Bond referendum passed — $48M for safety and security across 12 campuses.',
      notes: 'Site walk April 28. Very positive. Need to schedule proposal meeting.',
      nextFollowUp: new Date('2026-05-04'),
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Pell City Medical Center', contact: 'Kim Hutchins', contactTitle: 'VP Operations',
      phone: '205-338-3301', email: 'khutchins@pcmedical.org',
      vertical: 'HEALTHCARE', stage: 'QUALIFIED', heat: 'WARM', value: 88000,
      city: 'Pell City', state: 'AL', zip: '35125', lat: 33.5862, lng: -86.2869,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'INSTALL', leadSource: 'EXISTING_CUSTOMER',
      notes: 'New ED expansion needs camera coverage and access control. Budget approved. Demo scheduled May 13.',
      nextFollowUp: new Date('2026-05-05'),
    }}),
  ])

  // Active pipeline — diverse stages
  const [huntsvilleHospital, mobilePD, escambiaFL, auburnUniv, baldwinCourt, gadsdenIndustrial] = await Promise.all([
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Huntsville Hospital System', contact: 'Tom Lester', contactTitle: 'Director of Security',
      phone: '256-265-1000', email: 't.lester@huntsvillehospital.org',
      vertical: 'HEALTHCARE', stage: 'OUTREACH_SENT', heat: 'WARM', value: 275000,
      city: 'Huntsville', state: 'AL', zip: '35801', lat: 34.7304, lng: -86.5861,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
      signal: 'System-wide security modernization — replacing analog CCTV across 5 campuses.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Mobile Police Department', contact: 'Deputy Chief Ramirez', contactTitle: 'Deputy Chief',
      phone: '251-208-7211', email: 'j.ramirez@mobilepd.gov',
      vertical: 'GOVERNMENT', stage: 'ENGAGED', heat: 'HOT', value: 320000,
      city: 'Mobile', state: 'AL', zip: '36606', lat: 30.6954, lng: -88.0399,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'SAM_GOV',
      signal: 'MPD awarded $800K federal grant for integrated surveillance network across 15 precinct locations.',
      notes: 'Chief of staff engaged — proposal meeting scheduled May 12.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Escambia County Schools', contact: 'Facilities Dept', contactTitle: 'Director of Facilities',
      phone: '850-469-5551',
      vertical: 'EDUCATION', stage: 'QUALIFIED', heat: 'WARM', value: 195000,
      city: 'Pensacola', state: 'FL', zip: '32502', lat: 30.4214, lng: -87.2169,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'RFP_BID', leadSource: 'RFP_BID_BOARD',
      signal: 'BidNet RFP #ECS-2026-0119 — Campus Security Upgrade, 8 schools. Closes June 14.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Auburn University Athletics', contact: 'Sam Wicklund', contactTitle: 'Facilities Manager',
      phone: '334-844-4750', email: 's.wicklund@auburn.edu',
      vertical: 'EDUCATION', stage: 'PROPOSAL', heat: 'WARM', value: 450000,
      city: 'Auburn', state: 'AL', zip: '36849', lat: 32.6099, lng: -85.4808,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
      notes: 'Jordan-Hare Stadium, basketball arena, and athletic complex. Verkada preferred vendor. Proposal under committee review.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Baldwin County Circuit Court', contact: 'Court Administrator',
      contactTitle: 'Court Administrator', phone: '251-937-0399',
      vertical: 'GOVERNMENT', stage: 'PROPOSAL_SENT', heat: 'HOT', value: 68000,
      city: 'Bay Minette', state: 'AL', zip: '36507', lat: 30.8830, lng: -87.7730,
      productCategory: 'ACCESS_CONTROL', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
      notes: 'Proposal sent April 24. Committee votes May 13.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Gadsden Industrial Park', contact: 'Mike Odum', contactTitle: 'Operations Manager',
      phone: '256-547-7423',
      vertical: 'INDUSTRIAL', stage: 'NEGOTIATION', heat: 'HOT', value: 135000,
      city: 'Gadsden', state: 'AL', zip: '35901', lat: 34.0143, lng: -86.0066,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'INSTALL', leadSource: 'COLD_OUTREACH',
      notes: 'Multi-building industrial campus. Scope agreed. Negotiating payment schedule.',
    }}),
  ])

  const [hooverSchools, troyUniv, phenixCity, enterprisePD, cullmanCounty, centralAlabamaElec] = await Promise.all([
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Hoover City Schools', contact: 'Facilities Office',
      vertical: 'EDUCATION', stage: 'PROSPECT', heat: 'COLD', value: 110000,
      city: 'Hoover', state: 'AL', zip: '35244', lat: 33.4050, lng: -86.8114,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
      signal: 'Hoover City Schools 5-year capital plan lists "security technology upgrade" for FY2027.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Troy University', contact: 'Gary Nichols', contactTitle: 'VP Facilities',
      phone: '334-670-3000',
      vertical: 'EDUCATION', stage: 'PROSPECT', heat: 'WARM', value: 95000,
      city: 'Troy', state: 'AL', zip: '36082', lat: 31.8074, lng: -85.9702,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Phenix City Community College', contact: 'Campus Security Director',
      vertical: 'EDUCATION', stage: 'ENGAGED', heat: 'WARM', value: 78000,
      city: 'Phenix City', state: 'AL', zip: '36867', lat: 32.4721, lng: -85.0008,
      productCategory: 'ACCESS_CONTROL', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Enterprise Police Department', contact: 'Chief Harris', contactTitle: 'Chief of Police',
      phone: '334-348-2630',
      vertical: 'GOVERNMENT', stage: 'OUTREACH_SENT', heat: 'COLD', value: 42000,
      city: 'Enterprise', state: 'AL', zip: '36330', lat: 31.3152, lng: -85.8554,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'INSTALL', leadSource: 'COLD_OUTREACH',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Cullman County Schools', contact: 'Dr. Shane Barnette', contactTitle: 'Superintendent',
      phone: '256-734-2933',
      vertical: 'EDUCATION', stage: 'QUALIFIED', heat: 'HOT', value: 165000,
      city: 'Cullman', state: 'AL', zip: '35055', lat: 34.1748, lng: -86.8435,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'RFP_BID_BOARD',
      signal: 'County schools approved $3M safety bond — camera and access control for all 18 schools.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Central Alabama Electric Coop', contact: 'Facilities Manager',
      vertical: 'INDUSTRIAL', stage: 'PROPOSAL', heat: 'WARM', value: 88000,
      city: 'Clanton', state: 'AL', zip: '35045', lat: 32.8360, lng: -86.6297,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'INSTALL', leadSource: 'COLD_OUTREACH',
    }}),
  ])

  // CLOSED_WON leads — for bookings comparison alert
  const [prattvilleSchools, montgomeryDental, birminghamAirport] = await Promise.all([
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Prattville City Schools', contact: 'Carl Weathers', contactTitle: 'Superintendent',
      vertical: 'EDUCATION', stage: 'CLOSED_WON', heat: 'HOT', value: 115000,
      city: 'Prattville', state: 'AL', zip: '36067', lat: 32.4637, lng: -86.4595,
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'REFERRAL',
      notes: 'Closed May 3 — Verkada cameras and access control across 4 elementary schools. Installation begins May 19.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Montgomery Dental Group', contact: 'Office Manager',
      vertical: 'HEALTHCARE', stage: 'CLOSED_WON', heat: 'HOT', value: 165000,
      city: 'Montgomery', state: 'AL', zip: '36111', lat: 32.3668, lng: -86.2999,
      productCategory: 'ACCESS_CONTROL', jobType: 'INSTALL', leadSource: 'REFERRAL',
      notes: 'Closed May 4 — multi-site dental practice, 6 locations. Installation starts May 26.',
    }}),
    db.lead.create({ data: {
      tenantId: lek.id, assignedToId: lekRep.id,
      company: 'Birmingham Airport Authority', contact: 'Security Director',
      vertical: 'GOVERNMENT', stage: 'CLOSED_WON', heat: 'HOT', value: 95000,
      city: 'Birmingham', state: 'AL', zip: '35212', lat: 33.5629, lng: -86.7530,
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'SAM_GOV',
      notes: 'Closed April 28 — terminal security camera upgrade, 85 cameras.',
    }}),
  ])

  console.log('  ✓ Leads created (23)')

  // ── Customers ──────────────────────────────────────────────────────────────────
  const [autaugaCustomer, dothanCustomer, , talladegaCustomer] = await Promise.all([
    db.customer.create({ data: {
      tenantId: lek.id, name: 'Autauga County Board of Education',
      contact: 'Dr. R. Smith', phone: '334-361-3500', email: 'rsmith@autaugak12.org',
      vertical: 'EDUCATION',
      address: '153 W 4th St', city: 'Prattville', state: 'AL', zip: '36067', lat: 32.4640, lng: -86.4590,
      hqAddress: '153 W 4th St', hqCity: 'Prattville', hqState: 'AL', hqZip: '36067', hqLat: 32.4640, hqLng: -86.4590,
      contractValue: 85000, verkadaCustomer: true, customerType: 'EXISTING',
      startDate: new Date('2024-08-01'), renewalDate: new Date('2026-08-01'),
    }}),
    db.customer.create({ data: {
      tenantId: lek.id, name: 'Dothan City Schools',
      contact: 'James Webb', phone: '334-793-1400', email: 'jwebb@dothan.k12.al.us',
      vertical: 'EDUCATION',
      address: '500 Dusy St', city: 'Dothan', state: 'AL', zip: '36303', lat: 31.2232, lng: -85.3905,
      hqAddress: '500 Dusy St', hqCity: 'Dothan', hqState: 'AL', hqZip: '36303', hqLat: 31.2232, hqLng: -85.3905,
      contractValue: 48000, verkadaCustomer: true, customerType: 'EXISTING',
      startDate: new Date('2025-01-15'), renewalDate: new Date('2027-01-15'),
    }}),
    db.customer.create({ data: {
      tenantId: lek.id, name: 'Orange Beach Marina',
      contact: 'Linda Pruitt', phone: '251-981-6773', email: 'linda@obm.com',
      vertical: 'COMMERCIAL',
      address: '4673 Orange Beach Blvd', city: 'Orange Beach', state: 'AL', zip: '36561', lat: 30.2960, lng: -87.5672,
      hqAddress: '4673 Orange Beach Blvd', hqCity: 'Orange Beach', hqState: 'AL', hqZip: '36561', hqLat: 30.2960, hqLng: -87.5672,
      contractValue: 12500, verkadaCustomer: false, customerType: 'EXISTING',
      startDate: new Date('2023-06-01'), renewalDate: new Date('2026-06-01'),
    }}),
    db.customer.create({ data: {
      tenantId: lek.id, name: 'Talladega County Public Schools',
      contact: 'Facilities Dept', phone: '256-761-1336',
      vertical: 'EDUCATION',
      address: '500 South St W', city: 'Talladega', state: 'AL', zip: '35160', lat: 33.4349, lng: -86.1053,
      hqAddress: '500 South St W', hqCity: 'Talladega', hqState: 'AL', hqZip: '35160', hqLat: 33.4349, hqLng: -86.1053,
      contractValue: 62000, verkadaCustomer: true, customerType: 'EXISTING',
      startDate: new Date('2025-03-01'), renewalDate: new Date('2027-03-01'),
    }}),
  ])
  console.log('  ✓ Customers created (4)')

  // Customer renewal/expansion opportunities — linked via customerId so the Customers page shows pipeline
  await Promise.all([
    db.opportunity.create({ data: {
      tenantId: lek.id, customerId: autaugaCustomer.id,
      title: 'Autauga County BOE — Annual Service Renewal',
      type: 'RENEWAL', source: 'MANUAL', status: 'OPEN',
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'SERVICE_CONTRACTED', leadSource: 'EXISTING_CUSTOMER',
      estimatedRevenue: 28500, weightedValue: 25650, probabilityPercent: 90,
      stage: 'PROPOSAL', stageChangedAt: new Date('2026-03-10'),
      expectedCloseDate: new Date('2026-07-15'),
      createdAt: new Date('2026-03-01'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, customerId: dothanCustomer.id,
      title: 'Dothan City Schools — Camera Expansion Phase 2',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'INSTALL', leadSource: 'EXISTING_CUSTOMER',
      estimatedRevenue: 35000, weightedValue: 24500, probabilityPercent: 70,
      stage: 'QUALIFIED', stageChangedAt: new Date('2026-04-20'),
      expectedCloseDate: new Date('2026-06-30'),
      createdAt: new Date('2026-04-10'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, customerId: talladegaCustomer.id,
      title: 'Talladega County Schools — Access Control Expansion',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'ACCESS_CONTROL', jobType: 'UPGRADE_REFRESH', leadSource: 'EXISTING_CUSTOMER',
      estimatedRevenue: 42000, weightedValue: 16800, probabilityPercent: 40,
      stage: 'ENGAGED', stageChangedAt: new Date('2026-05-01'),
      expectedCloseDate: new Date('2026-08-01'),
      createdAt: new Date('2026-05-01'),
    }}),
  ])
  console.log('  ✓ Customer opportunities created (3)')

  // ── Opportunities ──────────────────────────────────────────────────────────────

  // Stalled opps — stageChangedAt far in past triggers the aging alert
  const [oppAlabamaPower, oppShelbyCounty, oppFortPayne] = await Promise.all([
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: alabamaPower.id,
      title: 'Alabama Power HQ — IP Camera Refresh (3 Sites)',
      type: 'RFP', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'RFP_BID_BOARD',
      jobSiteAddress: '600 N 18th St', jobSiteCity: 'Birmingham', jobSiteState: 'AL', jobSiteZip: '35203',
      jobSiteLat: 33.5172, jobSiteLng: -86.8092,
      estimatedRevenue: 150000, weightedValue: 97500, probabilityPercent: 65,
      stage: 'PROPOSAL', stageChangedAt: new Date('2026-03-26'),
      expectedCloseDate: new Date('2026-05-30'),
      createdAt: new Date('2026-02-20'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: shelbyCounty.id,
      title: 'Shelby County Justice Center — Full Security System',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'NEW_CONSTRUCTION', leadSource: 'RFP_BID_BOARD',
      jobSiteAddress: '64 Court St', jobSiteCity: 'Columbiana', jobSiteState: 'AL', jobSiteZip: '35051',
      jobSiteLat: 33.1773, jobSiteLng: -86.6073,
      estimatedRevenue: 185000, weightedValue: 138750, probabilityPercent: 75,
      stage: 'PROPOSAL_SENT', stageChangedAt: new Date('2026-03-30'),
      expectedCloseDate: new Date('2026-06-15'),
      createdAt: new Date('2026-02-25'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: fortPayne.id,
      title: 'Fort Payne City Schools — 5-Campus Security',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'RFP_BID_BOARD',
      jobSiteAddress: '104 14th Ave NE', jobSiteCity: 'Fort Payne', jobSiteState: 'AL', jobSiteZip: '35967',
      jobSiteLat: 34.4432, jobSiteLng: -85.7181,
      estimatedRevenue: 95000, weightedValue: 80750, probabilityPercent: 85,
      stage: 'NEGOTIATION', stageChangedAt: new Date('2026-04-02'),
      expectedCloseDate: new Date('2026-05-20'),
      createdAt: new Date('2026-03-01'),
    }}),
  ])

  // Active pipeline opps — linked to stage history for velocity data
  const [oppJeffersonCounty, oppPellCity, oppMobilePD, oppAuburnUniv, oppCullman, oppGadsden, oppBaldwin] = await Promise.all([
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: jeffersonCounty.id,
      title: 'Jefferson County Schools — 12-Campus Safety Initiative',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'SAM_GOV',
      jobSiteAddress: '2100 18th St N', jobSiteCity: 'Birmingham', jobSiteState: 'AL', jobSiteZip: '35203',
      jobSiteLat: 33.5148, jobSiteLng: -86.8103,
      estimatedRevenue: 145000, weightedValue: 50750, probabilityPercent: 35,
      stage: 'ENGAGED', stageChangedAt: new Date('2026-04-25'),
      expectedCloseDate: new Date('2026-07-01'),
      createdAt: new Date('2026-03-20'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: pellCity.id,
      title: 'Pell City Medical Center — ED Expansion Security',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'INSTALL', leadSource: 'EXISTING_CUSTOMER',
      jobSiteAddress: '110 Bankhead Ave', jobSiteCity: 'Pell City', jobSiteState: 'AL', jobSiteZip: '35125',
      jobSiteLat: 33.5859, jobSiteLng: -86.2872,
      estimatedRevenue: 88000, weightedValue: 44000, probabilityPercent: 50,
      stage: 'QUALIFIED', stageChangedAt: new Date('2026-04-20'),
      expectedCloseDate: new Date('2026-06-30'),
      createdAt: new Date('2026-03-25'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: mobilePD.id,
      title: 'Mobile PD — Federal Grant Surveillance Network',
      type: 'GRANT', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'SAM_GOV',
      jobSiteAddress: '2460 Government Blvd', jobSiteCity: 'Mobile', jobSiteState: 'AL', jobSiteZip: '36606',
      jobSiteLat: 30.6804, jobSiteLng: -88.0713,
      estimatedRevenue: 320000, weightedValue: 112000, probabilityPercent: 35,
      stage: 'ENGAGED', stageChangedAt: new Date('2026-04-28'),
      expectedCloseDate: new Date('2026-08-01'),
      createdAt: new Date('2026-04-08'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: auburnUniv.id,
      title: 'Auburn University Athletics — Multi-Venue Security',
      type: 'RFP', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
      jobSiteAddress: '251 S Donahue Dr', jobSiteCity: 'Auburn', jobSiteState: 'AL', jobSiteZip: '36849',
      jobSiteLat: 32.6028, jobSiteLng: -85.4830,
      estimatedRevenue: 450000, weightedValue: 292500, probabilityPercent: 65,
      stage: 'PROPOSAL', stageChangedAt: new Date('2026-04-18'),
      expectedCloseDate: new Date('2026-06-01'),
      createdAt: new Date('2026-03-08'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: cullmanCounty.id,
      title: 'Cullman County Schools — 18-School Safety Bond',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'RFP_BID_BOARD',
      jobSiteAddress: '402 Arnold St NE', jobSiteCity: 'Cullman', jobSiteState: 'AL', jobSiteZip: '35055',
      jobSiteLat: 34.1768, jobSiteLng: -86.8440,
      estimatedRevenue: 165000, weightedValue: 82500, probabilityPercent: 50,
      stage: 'QUALIFIED', stageChangedAt: new Date('2026-04-22'),
      expectedCloseDate: new Date('2026-07-15'),
      createdAt: new Date('2026-03-28'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: gadsdenIndustrial.id,
      title: 'Gadsden Industrial Park — Multi-Building CCTV & Access',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'INSTALL', leadSource: 'COLD_OUTREACH',
      jobSiteAddress: '1501 Industrial Blvd', jobSiteCity: 'Gadsden', jobSiteState: 'AL', jobSiteZip: '35901',
      jobSiteLat: 34.0150, jobSiteLng: -86.0078,
      estimatedRevenue: 135000, weightedValue: 114750, probabilityPercent: 85,
      stage: 'NEGOTIATION', stageChangedAt: new Date('2026-04-15'),
      expectedCloseDate: new Date('2026-05-15'),
      createdAt: new Date('2026-03-18'),
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: baldwinCourt.id,
      title: 'Baldwin County Circuit Court — Security Upgrade',
      type: 'BID', source: 'MANUAL', status: 'PURSUING',
      productCategory: 'ACCESS_CONTROL', jobType: 'UPGRADE_REFRESH', leadSource: 'COLD_OUTREACH',
      jobSiteAddress: '1 Courthouse Sq', jobSiteCity: 'Bay Minette', jobSiteState: 'AL', jobSiteZip: '36507',
      jobSiteLat: 30.8826, jobSiteLng: -87.7731,
      estimatedRevenue: 68000, weightedValue: 51000, probabilityPercent: 75,
      stage: 'PROPOSAL_SENT', stageChangedAt: new Date('2026-04-24'),
      expectedCloseDate: new Date('2026-05-20'),
      createdAt: new Date('2026-04-02'),
    }}),
  ])

  // WON opps — updatedAt backdated via raw SQL after create
  const [oppPrattville, oppMontgomeryDental, oppBirminghamAirport] = await Promise.all([
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: prattvilleSchools.id,
      title: 'Prattville City Schools — Elementary Camera & Access',
      type: 'BID', source: 'MANUAL', status: 'WON',
      productCategory: 'INTEGRATED_SYSTEMS', jobType: 'INSTALL', leadSource: 'REFERRAL',
      jobSiteAddress: '215 W 4th St', jobSiteCity: 'Prattville', jobSiteState: 'AL', jobSiteZip: '36067',
      jobSiteLat: 32.4641, jobSiteLng: -86.4591,
      estimatedRevenue: 115000, probabilityPercent: 100,
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: montgomeryDental.id,
      title: 'Montgomery Dental Group — 6-Site Security System',
      type: 'BID', source: 'MANUAL', status: 'WON',
      productCategory: 'ACCESS_CONTROL', jobType: 'INSTALL', leadSource: 'REFERRAL',
      jobSiteAddress: '3101 Carter Hill Rd', jobSiteCity: 'Montgomery', jobSiteState: 'AL', jobSiteZip: '36111',
      jobSiteLat: 32.3502, jobSiteLng: -86.2968,
      estimatedRevenue: 165000, probabilityPercent: 100,
    }}),
    db.opportunity.create({ data: {
      tenantId: lek.id, leadId: birminghamAirport.id,
      title: 'Birmingham Airport Authority — Terminal Camera Upgrade',
      type: 'RFP', source: 'MANUAL', status: 'WON',
      productCategory: 'VIDEO_SURVEILLANCE', jobType: 'UPGRADE_REFRESH', leadSource: 'SAM_GOV',
      jobSiteAddress: '2600 Messer Airport Hwy', jobSiteCity: 'Birmingham', jobSiteState: 'AL', jobSiteZip: '35212',
      jobSiteLat: 33.5629, jobSiteLng: -86.7530,
      estimatedRevenue: 95000, probabilityPercent: 100,
    }}),
  ])

  // Backdate updatedAt so bookings land in the correct report period
  // Current period (May 1–7): Prattville + Montgomery Dental = $280K
  // Previous period (Apr 25–May 1): Birmingham Airport = $95K → ratio 2.9x alert fires
  await db.$executeRaw`UPDATE "Opportunity" SET "updatedAt" = ${'2026-05-03T14:00:00Z'} WHERE id = ${oppPrattville.id}`
  await db.$executeRaw`UPDATE "Opportunity" SET "updatedAt" = ${'2026-05-04T11:30:00Z'} WHERE id = ${oppMontgomeryDental.id}`
  await db.$executeRaw`UPDATE "Opportunity" SET "updatedAt" = ${'2026-04-28T16:45:00Z'} WHERE id = ${oppBirminghamAirport.id}`

  console.log('  ✓ Opportunities created (13)')

  // ── Stage History ──────────────────────────────────────────────────────────────
  // 8 records: 4 current period (May 1–7) + 4 previous period (Apr 25–May 1)
  //
  // OUTREACH_SENT velocity: current avg 9d vs previous avg 18d → ↓50% → positive alert
  // ENGAGED velocity:       current avg 13d vs previous avg 24d → ↓46% → positive alert

  await Promise.all([
    // Current period — OUTREACH_SENT transitions (avg 9d)
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppJeffersonCounty.id,
      fromStage: 'OUTREACH_SENT', toStage: 'ENGAGED',
      changedAt: new Date('2026-05-02T09:00:00Z'),
      daysInPreviousStage: 8, opportunityValueAtChange: 145000,
    }}),
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppMobilePD.id,
      fromStage: 'OUTREACH_SENT', toStage: 'ENGAGED',
      changedAt: new Date('2026-05-05T14:00:00Z'),
      daysInPreviousStage: 10, opportunityValueAtChange: 320000,
    }}),
    // Current period — ENGAGED transitions (avg 13d)
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppPellCity.id,
      fromStage: 'ENGAGED', toStage: 'QUALIFIED',
      changedAt: new Date('2026-05-03T10:00:00Z'),
      daysInPreviousStage: 12, opportunityValueAtChange: 88000,
    }}),
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppCullman.id,
      fromStage: 'ENGAGED', toStage: 'QUALIFIED',
      changedAt: new Date('2026-05-06T11:00:00Z'),
      daysInPreviousStage: 14, opportunityValueAtChange: 165000,
    }}),
    // Previous period — OUTREACH_SENT transitions (avg 18d)
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppPrattville.id,
      fromStage: 'OUTREACH_SENT', toStage: 'ENGAGED',
      changedAt: new Date('2026-04-27T10:00:00Z'),
      daysInPreviousStage: 17, opportunityValueAtChange: 115000,
    }}),
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppMontgomeryDental.id,
      fromStage: 'OUTREACH_SENT', toStage: 'ENGAGED',
      changedAt: new Date('2026-04-30T09:00:00Z'),
      daysInPreviousStage: 19, opportunityValueAtChange: 165000,
    }}),
    // Previous period — ENGAGED transitions (avg 24d)
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppBirminghamAirport.id,
      fromStage: 'ENGAGED', toStage: 'QUALIFIED',
      changedAt: new Date('2026-04-26T14:00:00Z'),
      daysInPreviousStage: 22, opportunityValueAtChange: 95000,
    }}),
    db.stageHistory.create({ data: {
      tenantId: lek.id, opportunityId: oppGadsden.id,
      fromStage: 'ENGAGED', toStage: 'QUALIFIED',
      changedAt: new Date('2026-04-29T09:00:00Z'),
      daysInPreviousStage: 26, opportunityValueAtChange: 135000,
    }}),
  ])
  console.log('  ✓ Stage history created (8)')

  // ── Outreach logs (~23, May 1–7) ───────────────────────────────────────────────

  const outreach: Parameters<typeof db.outreachLog.create>[0]['data'][] = [
    // May 1
    { tenantId: lek.id, leadId: dothanCityHall.id, userId: lekRep.id, type: 'COLD_CALL', content: 'Left voicemail for Brian Stokes (procurement).', createdAt: new Date('2026-05-01T09:15:00Z') },
    { tenantId: lek.id, leadId: alabamaPower.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'Follow-up on Security Proposal', content: 'Following up on our proposal submitted last month. Happy to schedule a call to walk through the updated scope.', createdAt: new Date('2026-05-01T10:30:00Z') },
    // May 2
    { tenantId: lek.id, leadId: huntsvilleHospital.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'Verkada Platform Overview — Huntsville Hospital', content: 'Sharing our overview of the Verkada platform and how it fits your multi-campus modernization needs.', createdAt: new Date('2026-05-02T08:45:00Z') },
    { tenantId: lek.id, leadId: jeffersonCounty.id, userId: lekRep.id, type: 'COLD_CALL', content: 'Spoke with David Pugh. He wants to schedule a formal walk-through for all 12 schools in June.', createdAt: new Date('2026-05-02T11:00:00Z') },
    { tenantId: lek.id, leadId: fortPayne.id, userId: lekRep.id, type: 'FOLLOW_UP', subject: 'Contract Review — Fort Payne City Schools', content: 'Following up on the contract draft. Is there anything holding up the attorney review?', createdAt: new Date('2026-05-02T14:30:00Z') },
    { tenantId: lek.id, leadId: hooverSchools.id, userId: lekRep.id, type: 'LINKEDIN', content: 'Connected with Hoover City Schools facilities director on LinkedIn.', createdAt: new Date('2026-05-02T16:00:00Z') },
    // May 3
    { tenantId: lek.id, leadId: mobilePD.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'Camera Coverage Proposal — Mobile PD Federal Grant', content: 'Attached is our preliminary coverage proposal for all 15 precinct locations.', createdAt: new Date('2026-05-03T09:00:00Z') },
    { tenantId: lek.id, leadId: shelbyCounty.id, userId: lekRep.id, type: 'COLD_CALL', content: 'Left voicemail for Janet Fulton. Tried her cell too — left message.', createdAt: new Date('2026-05-03T10:30:00Z') },
    { tenantId: lek.id, leadId: gadsdenIndustrial.id, userId: lekRep.id, type: 'SMS', content: 'Hey Mike — can we connect Thursday to finalize the payment schedule?', createdAt: new Date('2026-05-03T13:00:00Z') },
    { tenantId: lek.id, leadId: troyUniv.id, userId: lekRep.id, type: 'COLD_CALL', content: 'No answer. Left voicemail.', createdAt: new Date('2026-05-03T15:00:00Z') },
    // May 4
    { tenantId: lek.id, leadId: alabamaPower.id, userId: lekRep.id, type: 'POST_QUOTE', subject: 'Revised Proposal — Alabama Power Security Refresh', content: 'Per our conversation, attached is the revised proposal with updated camera counts (216) and a phased payment option.', createdAt: new Date('2026-05-04T09:30:00Z') },
    { tenantId: lek.id, leadId: escambiaFL.id, userId: lekRep.id, type: 'COLD_CALL', content: 'Brief intro with facilities coordinator. RFP Q&A session is May 21. Will attend.', createdAt: new Date('2026-05-04T11:00:00Z') },
    { tenantId: lek.id, leadId: cullmanCounty.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'RFP Response — Cullman County Schools Safety Bond', content: 'Full RFP response attached. Happy to present to the board at the June meeting.', createdAt: new Date('2026-05-04T14:00:00Z') },
    // May 5
    { tenantId: lek.id, leadId: auburnUniv.id, userId: lekRep.id, type: 'FOLLOW_UP', subject: 'Check-in on Auburn Athletics Proposal', content: 'Just checking in — has the committee had a chance to review the proposal?', createdAt: new Date('2026-05-05T09:00:00Z') },
    { tenantId: lek.id, leadId: pellCity.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'System Quote — Pell City Medical ED Expansion', content: 'Formal quote for 48 cameras and 12 access control points for the new ED wing.', createdAt: new Date('2026-05-05T10:30:00Z') },
    { tenantId: lek.id, leadId: troyUniv.id, userId: lekRep.id, type: 'COLD_CALL', content: 'Reached Gary Nichols. Good call — he will loop in IT director for a demo next week.', createdAt: new Date('2026-05-05T14:00:00Z') },
    // May 6
    { tenantId: lek.id, leadId: fortPayne.id, userId: lekRep.id, type: 'CONTRACT', subject: 'Contract Redline — Fort Payne City Schools', content: 'Attached is our redlined version. We accepted all changes except sections 4.2 and 7.1.', createdAt: new Date('2026-05-06T09:30:00Z') },
    { tenantId: lek.id, leadId: baldwinCourt.id, userId: lekRep.id, type: 'COLD_CALL', content: 'Confirmed with court administrator — committee votes May 13. She expects a favorable result.', createdAt: new Date('2026-05-06T11:30:00Z') },
    { tenantId: lek.id, leadId: enterprisePD.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'Camera System Introduction — Enterprise Police Dept', content: 'Introducing LEK Technologies and our work with other Alabama municipalities.', createdAt: new Date('2026-05-06T13:00:00Z') },
    { tenantId: lek.id, leadId: hooverSchools.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'School Safety Technology — Hoover City Schools', content: 'Following up on our LinkedIn connection. Happy to share what we did for Autauga County.', createdAt: new Date('2026-05-06T15:00:00Z') },
    // May 7
    { tenantId: lek.id, leadId: jeffersonCounty.id, userId: lekRep.id, type: 'FOLLOW_UP', subject: 'Follow-up: Jefferson County Schools Walk-Through', content: 'David — circling back. Are you still available to schedule the site visit in June?', createdAt: new Date('2026-05-07T09:00:00Z') },
    { tenantId: lek.id, leadId: centralAlabamaElec.id, userId: lekRep.id, type: 'COLD_CALL', content: 'Solid intro call. 4 substations plus main office. Decision maker is the ops manager.', createdAt: new Date('2026-05-07T10:30:00Z') },
    { tenantId: lek.id, leadId: phenixCity.id, userId: lekRep.id, type: 'COLD_EMAIL', subject: 'Campus Security Overview — Phenix City Community College', content: 'Sharing our campus security case studies and work with community colleges across Alabama.', createdAt: new Date('2026-05-07T13:00:00Z') },
  ]

  await Promise.all(outreach.map((data) => db.outreachLog.create({ data })))
  console.log(`  ✓ Outreach logs created (${outreach.length})`)

  // ── Lead logs (~10) ────────────────────────────────────────────────────────────

  const leadLogs: { leadId: string; userId: string; action: string; date: Date }[] = [
    { leadId: shelbyCounty.id,       userId: lekRep.id, action: 'Submitted formal proposal to county administrator.', date: new Date('2026-04-25T10:00:00Z') },
    { leadId: jeffersonCounty.id,    userId: lekRep.id, action: 'Site walk completed — visited 5 of 12 schools. Very positive. Facilities director wants full coverage quote.', date: new Date('2026-04-28T15:00:00Z') },
    { leadId: birminghamAirport.id,  userId: lekRep.id, action: 'Signed contract received. PO issued. Installation planning kickoff scheduled.', date: new Date('2026-04-28T17:00:00Z') },
    { leadId: alabamaPower.id,       userId: lekRep.id, action: 'Sent revised proposal — 216 cameras, phased payment option included.', date: new Date('2026-05-01T10:30:00Z') },
    { leadId: jeffersonCounty.id,    userId: lekRep.id, action: 'Called David Pugh. He needs bond committee sign-off before scheduling our presentation.', date: new Date('2026-05-02T11:15:00Z') },
    { leadId: pellCity.id,           userId: lekRep.id, action: 'Sent formal quote. Kim Hutchins confirmed demo with IT director scheduled May 13.', date: new Date('2026-05-03T10:45:00Z') },
    { leadId: prattvilleSchools.id,  userId: lekRep.id, action: 'Signed contract received. PO issued. Installation begins May 19.', date: new Date('2026-05-03T14:30:00Z') },
    { leadId: montgomeryDental.id,   userId: lekRep.id, action: 'Contract signed — 6 locations. Installation starts May 26.', date: new Date('2026-05-04T11:30:00Z') },
    { leadId: gadsdenIndustrial.id,  userId: lekRep.id, action: 'Final payment terms agreed: 40% upfront, 60% net-30 post-install. Waiting on signed contract.', date: new Date('2026-05-05T09:15:00Z') },
    { leadId: auburnUniv.id,         userId: lekRep.id, action: 'Presentation rescheduled to May 20 — committee member unavailable this week.', date: new Date('2026-05-06T14:00:00Z') },
  ]

  await Promise.all(leadLogs.map(({ leadId, userId, action, date }) =>
    db.leadLog.create({ data: { leadId, userId, action, date } })
  ))
  console.log(`  ✓ Lead logs created (${leadLogs.length})`)

  // ── Pipeline Targets ──────────────────────────────────────────────────────────

  await Promise.all([
    // ── Team annual ──────────────────────────────────────────────────────────
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: null, stage: null, period: '2026',    periodType: 'ANNUAL',    targetValue: 2_000_000 } }),
    // ── Team quarterly ────────────────────────────────────────────────────────
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: null, stage: null, period: '2026-Q2', periodType: 'QUARTERLY', targetValue:   500_000 } }),
    // ── Team monthly ─────────────────────────────────────────────────────────
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: null, stage: null, period: '2026-05', periodType: 'MONTHLY',   targetValue:   165_000 } }),
    // ── Team stage targets (Q2) ──────────────────────────────────────────────
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: null, stage: 'PROPOSAL',  period: '2026-Q2', periodType: 'QUARTERLY', targetValue: 800_000 } }),
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: null, stage: 'QUALIFIED', period: '2026-Q2', periodType: 'QUARTERLY', targetValue: 400_000 } }),
    // ── Rep annual ───────────────────────────────────────────────────────────
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: lekAdmin.id, stage: null, period: '2026',    periodType: 'ANNUAL',    targetValue:   800_000 } }),
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: lekRep.id,   stage: null, period: '2026',    periodType: 'ANNUAL',    targetValue: 1_200_000 } }),
    // ── Rep quarterly ────────────────────────────────────────────────────────
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: lekAdmin.id, stage: null, period: '2026-Q2', periodType: 'QUARTERLY', targetValue: 200_000 } }),
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: lekRep.id,   stage: null, period: '2026-Q2', periodType: 'QUARTERLY', targetValue: 300_000 } }),
    // ── Rep monthly ──────────────────────────────────────────────────────────
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: lekAdmin.id, stage: null, period: '2026-05', periodType: 'MONTHLY',   targetValue:  65_000 } }),
    db.pipelineTarget.create({ data: { tenantId: lek.id, userId: lekRep.id,   stage: null, period: '2026-05', periodType: 'MONTHLY',   targetValue: 100_000 } }),
  ])
  console.log('  ✓ Pipeline targets created (12)')

  console.log('\nSeed complete.')
  console.log('\nDev credentials (rotate before staging/prod):')
  console.log('  Super admin : houston.hardy@cobaltsp.com / cobalt-super-2026')
  console.log('  LEK admin   : admin@leksystems.com       / lek-admin-2026')
  console.log('  LEK rep     : rep@leksystems.com          / lek-rep-2026')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
