'use client'

import { createContext, useContext } from 'react'
import type { TenantBranding, TenantConfig } from './types'

interface TenantContextValue {
  id: string
  slug: string
  name: string
  branding: TenantBranding
  config: TenantConfig
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({
  value,
  children,
}: {
  value: TenantContextValue
  children: React.ReactNode
}) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider')
  return ctx
}
