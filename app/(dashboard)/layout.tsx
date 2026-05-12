import { requireAuth } from '@/lib/auth'
import { getTenant } from '@/lib/tenant'
import { TenantProvider } from '@/lib/tenant/context'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import type { TenantBranding, TenantConfig } from '@/lib/tenant/types'

// Fallback branding for super admin portfolio view (no tenant context)
const COBALT_BRANDING: TenantBranding = {
  companyName: 'Cobalt',
  tagline: 'Portfolio view',
  primaryColor: '#1A56FF',
  accentColor: '#1A56FF',
  logoUrl: '',
  faviconUrl: '',
}

const COBALT_CONFIG: TenantConfig = {
  geography: {
    hq: { address: '', city: '', state: '', zipCode: '', lat: 0, lng: 0 },
    primaryStates: [],
    displayLabel: 'All Tenants',
    regions: [],
  },
  verticals: [],
  prompts: {
    companyDescription: 'Cobalt platform',
    territory: '',
    differentiators: [],
    references: [],
    certifications: [],
  },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth()
  const tenant  = await getTenant()

  if (!tenant && session.user.role !== 'COBALT_SUPER_ADMIN') {
    redirect('/login')
  }

  const branding   = tenant?.branding  ?? COBALT_BRANDING
  const config     = tenant?.config    ?? COBALT_CONFIG
  const tenantId   = tenant?.id        ?? 'cobalt'
  const tenantSlug = tenant?.slug      ?? 'cobalt'
  const tenantName = tenant?.name      ?? 'Cobalt'

  // Lightweight alert count for topbar bell badge (overdue follow-ups only)
  const alertCount = tenant
    ? await db.lead.count({
        where: {
          tenantId: tenant.id,
          nextFollowUp: { lt: new Date() },
          stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        },
      })
    : 0

  const accentColor = branding.tenantAccentColor ?? branding.primaryColor

  return (
    <TenantProvider value={{ id: tenantId, slug: tenantSlug, name: tenantName, branding, config }}>
      <div
        className="flex h-full"
        style={{
          '--accent': accentColor,
          '--brand':  branding.primaryColor,
        } as React.CSSProperties}
      >
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar
            userName={session.user.name ?? session.user.email ?? 'User'}
            userEmail={session.user.email ?? ''}
            userRole={session.user.role}
            alertCount={alertCount}
          />
          <main
            className="flex-1 overflow-y-auto p-6"
            style={{ background: 'var(--bg)' }}
          >
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
