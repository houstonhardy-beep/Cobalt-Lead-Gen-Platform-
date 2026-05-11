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
  const { name } = useTenant()

  return (
    <header
      className="flex items-center justify-between px-5 shrink-0"
      style={{
        height: 'var(--topbar-h)',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--bg4)',
      }}
    >
      {/* Left: page context / breadcrumbs */}
      <div id="topbar-left" className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
        <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{name}</span>
      </div>

      {/* Right: alerts + user identity */}
      <div className="flex items-center gap-3">

        {/* Bell icon — links to Reports alerts section */}
        <Link
          href="/reports#alerts"
          className="relative flex items-center justify-center w-7 h-7 rounded transition-colors"
          style={{ color: 'var(--text3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = '' }}
          title="Alerts & Insights"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1.5a5 5 0 0 1 5 5v2.5l1.5 2H1.5L3 9V6.5a5 5 0 0 1 5-5z" strokeLinejoin="round" />
            <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
          </svg>
          {(alertCount ?? 0) > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-white font-bold rounded-full"
              style={{
                width: '14px', height: '14px', fontSize: '9px',
                background: '#f87171',
                lineHeight: 1,
              }}
            >
              {alertCount! > 9 ? '9+' : alertCount}
            </span>
          )}
        </Link>

        {/* User identity */}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text)' }}>{userName}</p>
          <p className="text-xs leading-tight" style={{ color: 'var(--text3)' }}>{ROLE_LABEL[userRole]}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs px-2.5 py-1 rounded transition-colors cursor-pointer"
          style={{ background: 'var(--bg4)', color: 'var(--text2)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'var(--bg4)' }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
