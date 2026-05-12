import type {
  TenantConfig,
  TenantBranding,
  TenantGeography,
} from '@/lib/tenant/types'

// ─── Geography ────────────────────────────────────────────────────────────────

export const LEK_GEOGRAPHY: TenantGeography = {
  hq: {
    address: '100 Cobalt Industrial Dr',
    city: 'Prattville',
    state: 'AL',
    zipCode: '36067',
    lat: 32.4599,
    lng: -86.4597,
  },
  primaryStates: ['AL'],
  secondaryStates: ['FL'],
  displayLabel: 'Alabama and Florida Panhandle',
  defaultRadiusMiles: 200,
  regions: [
    {
      id: 'alabama',
      name: 'Alabama',
      color: '#1d4ed8',
      states: ['AL'],
    },
    {
      id: 'fl-panhandle',
      name: 'Florida Panhandle',
      color: '#0891b2',
      // NW Florida counties from Pensacola to Panama City
      counties: [
        'Escambia County, FL',
        'Santa Rosa County, FL',
        'Okaloosa County, FL',
        'Walton County, FL',
        'Bay County, FL',
        'Washington County, FL',
        'Holmes County, FL',
        'Jackson County, FL',
        'Calhoun County, FL',
        'Gulf County, FL',
        'Franklin County, FL',
      ],
      // Bounding box as a fallback for map rendering
      boundingBox: {
        north: 31.0,
        south: 29.8,
        west: -87.65,
        east: -84.95,
      },
    },
    {
      id: 'greater-montgomery',
      name: 'Greater Montgomery',
      color: '#7c3aed',
      radiusFromHqMiles: 60, // ~60-mile radius from Prattville HQ covers Montgomery metro
    },
    {
      id: 'birmingham-metro',
      name: 'Birmingham Metro',
      color: '#059669',
      // Jefferson + Shelby + Walker + St. Clair counties
      counties: [
        'Jefferson County, AL',
        'Shelby County, AL',
        'Walker County, AL',
        'St. Clair County, AL',
        'Blount County, AL',
      ],
    },
    {
      id: 'gulf-coast-al',
      name: 'Gulf Coast Alabama',
      color: '#d97706',
      counties: [
        'Baldwin County, AL',
        'Mobile County, AL',
      ],
    },
  ],
}

// ─── Full Config ──────────────────────────────────────────────────────────────

export const LEK_CONFIG: TenantConfig = {
  geography: LEK_GEOGRAPHY,
  verticals: ['EDUCATION', 'GOVERNMENT', 'COMMERCIAL', 'HEALTHCARE', 'INDUSTRIAL'],
  prompts: {
    companyDescription:
      'LEK Technologies, Prattville AL — Verkada-certified security integrator specializing in CCTV, access control, and alarm systems. 31 technicians across Alabama and the Florida Panhandle.',
    territory: 'Alabama statewide with secondary coverage across the Florida Panhandle',
    differentiators: [
      'Verkada-certified (cloud CCTV, access control, and alarms on one platform)',
      'Free site security assessments for direct customers',
      'Local — Prattville, AL — fast response times',
      'Service agreements available post-install',
      '31 technicians across Alabama and Florida Panhandle',
      'SAM.gov registered small business',
    ],
    references: [
      'Alabama State House',
      'Jefferson County Schools',
      'Autauga County Board of Education',
      'Dothan City Schools',
    ],
    certifications: ['Verkada-certified', 'SAM.gov registered small business'],
  },
}

// ─── Branding ─────────────────────────────────────────────────────────────────

export const LEK_BRANDING: TenantBranding = {
  companyName: 'LEK Technologies',
  tagline: 'Verkada-certified security for Alabama and the Panhandle',
  primaryColor: '#1A56FF',
  accentColor: '#E8500A',
  tenantAccentColor: '#E8500A',
  logoUrl: '/logo.png',
  faviconUrl: '/tenants/lek/favicon.ico',
}
