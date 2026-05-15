// Apollo.io enrichment helpers — best-effort, never throw

export interface ApolloOrgData {
  employeeCount:      number | null
  estimatedRevenue:   string | null
  industry:           string | null
  city:               string | null
  state:              string | null
  website:            string | null
  foundedYear:        number | null
  companyLinkedinUrl: string | null
  companyPhone:       string | null
  technologies:       string[]
}

export interface ApolloPersonData {
  email:       string | null
  phone:       string | null
  title:       string | null
  linkedinUrl: string | null
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

type ApolloOrgSearchResult = {
  primary_domain?: string | null
  website_url?:    string | null
  organization_revenue_printed?: string | null
  [key: string]: unknown
}

type ApolloOrgSearchResponse = {
  organizations?: ApolloOrgSearchResult[] | null
  error?:   string
  message?: string
}

type ApolloOrgEnrichResponse = {
  organization?: {
    estimated_num_employees?: number | null
    annual_revenue_printed?:  string | null
    industry?:                string | null
    city?:                    string | null
    state?:                   string | null
    website_url?:             string | null
    primary_domain?:          string | null
    founded_year?:            number | null
    linkedin_url?:            string | null
    phone?:                   string | null
    current_technologies?:    { name?: string | null }[] | null
  } | null
  error?:   string
  message?: string
}

type ApolloPersonResponse = {
  person?: {
    title?:         string | null
    email?:         string | null
    linkedin_url?:  string | null
    phone_numbers?: { sanitized_number?: string | null }[] | null
  } | null
  error?:   string
  message?: string
}

export type ApolloPeopleSearchResult = {
  id:          string
  name:        string | null
  firstName:   string | null
  title:       string | null
  email:       string | null
  phone:       string | null
  linkedinUrl: string | null
  hasEmail:    boolean
  hasPhone:    boolean
}

export class ApolloUpgradeRequired extends Error {
  constructor() {
    super('Apollo Search requires a paid plan. Upgrade at apollo.io to enable Find Contacts.')
    this.name = 'ApolloUpgradeRequired'
  }
}

type ApolloPersonSearchRecord = {
  id?:               string | null
  name?:             string | null
  first_name?:       string | null
  last_name?:        string | null
  title?:            string | null
  linkedin_url?:     string | null
  has_email?:        boolean | null
  has_direct_phone?: boolean | null
  // present on paid plans / after enrichment
  email?:            string | null
  phone_numbers?:    { sanitized_number?: string | null }[] | null
}

type ApolloPeopleSearchResponse = {
  people?:   ApolloPersonSearchRecord[] | null
  contacts?: ApolloPersonSearchRecord[] | null
  error?:   string
  message?: string
}

export async function apolloEnrichOrg(
  apiKey: string,
  company: string,
): Promise<ApolloOrgData | null> {
  try {
    // Step 1: search by name to resolve domain
    const searchRes = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ q_organization_name: company, page: 1, per_page: 1 }),
      cache: 'no-store',
    })
    if (!searchRes.ok) {
      const body = await searchRes.text().catch(() => '(unreadable)')
      console.error('[apollo] search HTTP', searchRes.status, 'for', company, '—', body)
      return null
    }
    const searchData = await searchRes.json() as ApolloOrgSearchResponse
    const first = searchData.organizations?.[0]
    if (!first) {
      console.log('[apollo] search: no results for', company)
      return null
    }

    const domain = first.primary_domain ?? null
    console.log('[apollo] search resolved domain for', company, ':', domain)

    if (!domain) {
      return {
        employeeCount:      null,
        estimatedRevenue:   first.organization_revenue_printed ?? null,
        industry:           null,
        city:               null,
        state:              null,
        website:            first.website_url ?? null,
        foundedYear:        null,
        companyLinkedinUrl: null,
        companyPhone:       null,
        technologies:       [],
      }
    }

    // Step 2: enrich by domain for full org record
    const enrichRes = await fetch('https://api.apollo.io/api/v1/organizations/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ domain }),
      cache: 'no-store',
    })
    if (!enrichRes.ok) {
      const body = await enrichRes.text().catch(() => '(unreadable)')
      console.error('[apollo] enrich HTTP', enrichRes.status, 'for domain', domain, '—', body)
      return {
        employeeCount:      null,
        estimatedRevenue:   first.organization_revenue_printed ?? null,
        industry:           null,
        city:               null,
        state:              null,
        website:            domain,
        foundedYear:        null,
        companyLinkedinUrl: null,
        companyPhone:       null,
        technologies:       [],
      }
    }
    const enrichData = await enrichRes.json() as ApolloOrgEnrichResponse
    const org = enrichData.organization
    if (!org) {
      console.log('[apollo] enrich: no organization in response for domain', domain)
      return null
    }

    const techs = (org.current_technologies ?? [])
      .slice(0, 5)
      .map((t) => t.name ?? '')
      .filter(Boolean)

    const rawIndustry = org.industry ?? null
    const industry = rawIndustry ? toTitleCase(rawIndustry) : null

    console.log('[apollo] enrich result for', company, ':', JSON.stringify({
      estimated_num_employees: org.estimated_num_employees,
      annual_revenue_printed:  org.annual_revenue_printed,
      industry,
      city: org.city, state: org.state,
      founded_year: org.founded_year,
    }))

    return {
      employeeCount:      org.estimated_num_employees           ?? null,
      estimatedRevenue:   org.annual_revenue_printed            ?? null,
      industry,
      city:               org.city                              ?? null,
      state:              org.state                             ?? null,
      website:            org.website_url ?? org.primary_domain ?? domain,
      foundedYear:        org.founded_year                      ?? null,
      companyLinkedinUrl: org.linkedin_url                      ?? null,
      companyPhone:       org.phone                             ?? null,
      technologies:       techs,
    }
  } catch (err) {
    console.error('[apollo] enrichOrg exception for', company, ':', err)
    return null
  }
}

export async function apolloEnrichPerson(
  apiKey: string,
  name: string,
  organizationName: string,
): Promise<ApolloPersonData | null> {
  try {
    const res = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        name,
        organization_name:      organizationName,
        reveal_personal_emails: true,
        reveal_phone_number:    true,
      }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json() as ApolloPersonResponse
    const person = data.person
    if (!person) return null
    return {
      email:       person.email                                 ?? null,
      phone:       person.phone_numbers?.[0]?.sanitized_number ?? null,
      title:       person.title                                 ?? null,
      linkedinUrl: person.linkedin_url                         ?? null,
    }
  } catch {
    return null
  }
}

const DECISION_MAKER_TITLES = [
  'Director', 'VP', 'Vice President', 'Manager', 'Chief', 'Head of',
  'Facilities', 'Security', 'IT Director', 'Operations',
]

export async function apolloSearchPeople(
  apiKey: string,
  companyName: string,
  domain?: string | null,
): Promise<ApolloPeopleSearchResult[]> {
  // api_search uses query parameters, not a JSON body
  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('per_page', '5')
  for (const title of DECISION_MAKER_TITLES) {
    params.append('person_titles[]', title)
  }
  if (domain) {
    params.append('q_organization_domains_list[]', domain)
  } else {
    params.set('q_keywords', companyName)
  }

  const url = `https://api.apollo.io/api/v1/mixed_people/api_search?${params.toString()}`
  console.log('[apollo] people search request for', companyName, '| domain:', domain ?? 'none', '| url:', url)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    cache: 'no-store',
  })

  const rawText = await res.text().catch(() => '(unreadable)')
  console.log('[apollo] people search HTTP', res.status, 'for', companyName, '— body:', rawText.slice(0, 2000))

  if (res.status === 402 || res.status === 403) {
    throw new ApolloUpgradeRequired()
  }

  if (!res.ok) {
    console.error('[apollo] people search non-ok status', res.status)
    return []
  }

  let data: ApolloPeopleSearchResponse
  try {
    data = JSON.parse(rawText) as ApolloPeopleSearchResponse
  } catch {
    console.error('[apollo] people search: failed to parse response JSON')
    return []
  }

  // api_search may return results under `people` or `contacts` depending on plan
  const raw = data.people ?? data.contacts ?? []
  const people = raw.map((p) => {
    const name = p.name
      ?? ([p.first_name, p.last_name].filter(Boolean).join(' ') || null)
    return {
      id:          p.id          ?? crypto.randomUUID(),
      name,
      firstName:   p.first_name  ?? null,
      title:       p.title       ?? null,
      email:       p.email       ?? null,
      phone:       p.phone_numbers?.[0]?.sanitized_number ?? null,
      linkedinUrl: p.linkedin_url ?? null,
      hasEmail:    p.has_email        ?? false,
      hasPhone:    p.has_direct_phone ?? false,
    }
  })

  console.log('[apollo] people search returned', people.length, 'results for', companyName,
    '| with email:', people.filter((p) => p.email).length,
    '| with linkedin:', people.filter((p) => p.linkedinUrl).length)

  return people
}
