'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useTenant } from '@/lib/tenant/context'
import type { UserRole } from '@/app/generated/prisma/client'

const ROLE_LABEL: Record<UserRole, string> = {
  REP: 'Rep',
  TENANT_ADMIN: 'Admin',
  COBALT_SUPER_ADMIN: 'Super Admin',
}

interface TopbarProps {
  userName:   string
  userEmail:  string
  userRole:   UserRole
  alertCount?: number
}

export function Topbar({ userName, userEmail, userRole, alertCount }: TopbarProps) {
  const { name: tenantName, branding } = useTenant()

  return (
    <header
      className="flex items-center justify-between px-5 shrink-0"
      style={{
        height: 'var(--topbar-h)',
        background: 'var(--sidebar-bg)',
        borderBottom: '2px solid var(--accent)',
      }}
    >
      {/* Left: reserved for page-level breadcrumbs injected by pages */}
      <div id="topbar-left" className="flex items-center gap-2 text-sm" />

      {/* Right: tenant identity + alerts + user */}
      <div className="flex items-center gap-3">

        {/* Tenant logo + name */}
        <div
          className="flex items-center gap-2 pr-3 hidden sm:flex"
          style={{ borderRight: '1px solid var(--sidebar-border)' }}
        >
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={tenantName}
              style={{ height: 22, maxWidth: 80, objectFit: 'contain', display: 'block' }}
            />
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sidebar-text)', whiteSpace: 'nowrap' }}>
            {tenantName}
          </span>
        </div>

        {/* Bell icon — links to Reports alerts section */}
        <Link
          href="/reports#alerts"
          className="relative flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{ color: 'var(--sidebar-text3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'var(--sidebar-bg2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text3)'; e.currentTarget.style.background = '' }}
          title="Alerts & Insights"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1.5a5 5 0 0 1 5 5v2.5l1.5 2H1.5L3 9V6.5a5 5 0 0 1 5-5z" strokeLinejoin="round" />
            <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
          </svg>
          {(alertCount ?? 0) > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-white font-bold rounded-full"
              style={{ width: '14px', height: '14px', fontSize: '9px', background: '#DC2626', lineHeight: 1 }}
            >
              {alertCount! > 9 ? '9+' : alertCount}
            </span>
          )}
        </Link>

        {/* User identity */}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-tight" style={{ color: 'var(--sidebar-text)' }}>{userName}</p>
          <p className="text-xs leading-tight" style={{ color: 'var(--sidebar-text3)' }}>{ROLE_LABEL[userRole]}</p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
          style={{ background: 'var(--sidebar-bg2)', color: 'var(--sidebar-text2)', border: '1px solid var(--sidebar-border)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text2)'; e.currentTarget.style.background = 'var(--sidebar-bg2)' }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
