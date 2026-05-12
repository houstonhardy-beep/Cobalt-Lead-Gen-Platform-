'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTenant } from '@/lib/tenant/context'

const NAV = [
  { href: '/',              label: 'Command Center', icon: IconRadar },
  { href: '/pipeline',      label: 'Pipeline',       icon: IconPipeline },
  { href: '/queue',         label: 'Signal Queue',   icon: IconSignal },
  { href: '/opportunities', label: 'Opportunities',  icon: IconOpportunity },
  { href: '/outreach',      label: 'Outreach',       icon: IconOutreach },
  { href: '/research',      label: 'Research',       icon: IconResearch },
  { href: '/customers',     label: 'Customers',      icon: IconCustomers },
  { href: '/reports',       label: 'Reports',        icon: IconReports },
  { href: '/territory-map', label: 'Territory Map',  icon: IconMap },
]

const BOTTOM_NAV = [
  { href: '/settings', label: 'Settings', icon: IconSettings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { name, branding } = useTenant()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-full"
      style={{ width: 'var(--sidebar-w)', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Brand header — Cobalt platform + tenant identity */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--sidebar-border)' }}>

        {/* Cobalt logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: '#1A56FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <img
              src="/LOGO_Cobalt_white_image_only_x2.png"
              alt=""
              width={19}
              height={19}
              style={{ objectFit: 'contain', display: 'block' }}
            />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--sidebar-text)' }}>
            Cobalt
          </span>
        </div>

        {/* Divider */}
        <div style={{ margin: '10px 0 9px', borderTop: '1px solid var(--sidebar-border)' }} />

        {/* Tenant logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={name}
              style={{ height: 24, maxWidth: 88, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{name.charAt(0)}</span>
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--sidebar-text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} active={isActive(href)}>
            <Icon />
          </NavItem>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="py-3 px-2 space-y-0.5" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} active={isActive(href)}>
            <Icon />
          </NavItem>
        ))}
      </div>
    </aside>
  )
}

function NavItem({
  href,
  label,
  active,
  children,
}: {
  href: string
  label: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
      style={
        active
          ? { background: 'var(--accent)', color: '#fff' }
          : { color: 'var(--sidebar-text2)' }
      }
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--sidebar-bg2)'
          e.currentTarget.style.color = 'var(--sidebar-text)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = ''
          e.currentTarget.style.color = 'var(--sidebar-text2)'
        }
      }}
    >
      <span className="w-4 h-4 shrink-0 opacity-75">{children}</span>
      {label}
    </Link>
  )
}

// ── Icons (16×16 inline SVG) ──────────────────────────────────────────────────

function IconRadar() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="3.5" />
      <line x1="8" y1="8" x2="12" y2="4" />
    </svg>
  )
}

function IconPipeline() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="3" height="8" rx="0.5" />
      <rect x="6" y="2" width="3" height="10" rx="0.5" />
      <rect x="11" y="6" width="3" height="6" rx="0.5" />
    </svg>
  )
}

function IconSignal() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12 Q4 4 8 8 Q12 12 15 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconOpportunity() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3l2.5 1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconMap() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="1,2 5,4 10,2 14,4 14,13 10,11 5,13 1,11" strokeLinejoin="round" />
      <line x1="5" y1="4" x2="5" y2="13" />
      <line x1="10" y1="2" x2="10" y2="11" />
    </svg>
  )
}

function IconOutreach() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1" />
      <path d="M1.5 4.5 L8 9 L14.5 4.5" strokeLinecap="round" />
    </svg>
  )
}

function IconResearch() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6.5" cy="6.5" r="4" />
      <line x1="9.5" y1="9.5" x2="14" y2="14" strokeLinecap="round" />
    </svg>
  )
}

function IconCustomers() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 13c0-2.76 2.24-5 5-5h0c2.76 0 5 2.24 5 5" strokeLinecap="round" />
      <circle cx="11.5" cy="5" r="2" />
      <path d="M13.5 13c0-2.21-1.79-4-4-4" strokeLinecap="round" />
    </svg>
  )
}

function IconReports() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="9" width="2.5" height="5" rx="0.5" />
      <rect x="6"   y="5" width="2.5" height="9" rx="0.5" />
      <rect x="10.5" y="2" width="2.5" height="12" rx="0.5" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2" />
      <path
        d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.2 3.2l.7.7M12.1 12.1l.7.7M12.8 3.2l-.7.7M3.9 12.1l-.7.7"
        strokeLinecap="round"
      />
    </svg>
  )
}
