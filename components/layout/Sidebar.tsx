'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BOTTOM_NAV = [
  { href: '/settings', label: 'Settings', icon: IconSettings },
]

export function Sidebar({ signalCount = 0 }: { signalCount?: number }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const NAV = [
    { href: '/',              label: 'Command Center', icon: IconRadar,       badge: 0 },
    { href: '/pipeline',      label: 'Pipeline',       icon: IconPipeline,    badge: 0 },
    { href: '/queue',         label: 'Signal Queue',   icon: IconSignal,      badge: signalCount },
    { href: '/opportunities', label: 'Opportunities',  icon: IconOpportunity, badge: 0 },
    { href: '/outreach',      label: 'Outreach',       icon: IconOutreach,    badge: 0 },
    { href: '/research',      label: 'Research',       icon: IconResearch,    badge: 0 },
    { href: '/customers',     label: 'Customers',      icon: IconCustomers,   badge: 0 },
    { href: '/reports',       label: 'Reports',        icon: IconReports,     badge: 0 },
    { href: '/territory-map', label: 'Territory Map',  icon: IconMap,         badge: 0 },
  ]

  return (
    <aside
      className="flex flex-col shrink-0 h-full"
      style={{ width: 'var(--sidebar-w)', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Brand header */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center' }}>
        <img
          src="/LOGO_Cobalt_blue_full.png"
          alt="Cobalt"
          style={{ height: 40, maxWidth: 160, objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, badge }) => (
          <NavItem key={href} href={href} label={label} active={isActive(href)} badge={badge}>
            <Icon />
          </NavItem>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="py-3 px-2 space-y-0.5" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} active={isActive(href)} badge={0}>
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
  badge = 0,
  children,
}: {
  href: string
  label: string
  active: boolean
  badge?: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 py-2 rounded-md text-sm transition-colors"
      style={
        active
          ? {
              paddingLeft: 8,
              paddingRight: 12,
              borderLeft: '4px solid var(--accent)',
              color: 'var(--accent)',
              background: 'rgba(255,255,255,0.06)',
            }
          : {
              paddingLeft: 12,
              paddingRight: 12,
              color: 'var(--sidebar-text2)',
            }
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
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span
          className="flex items-center justify-center font-bold rounded-full text-white"
          style={{ minWidth: 18, height: 18, fontSize: 10, paddingInline: 4, background: '#dc2626', lineHeight: 1 }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
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
