import { redirect } from 'next/navigation'
import { type Session } from 'next-auth'
import { auth } from '@/auth'
import type { UserRole } from '@/app/generated/prisma/client'

// ─── Session helpers ──────────────────────────────────────────────────────────

export async function getSession() {
  return auth()
}

// Enforces authentication and optional role requirement.
// Redirects rather than throwing — safe to call directly in Server Components and layouts.
export async function requireAuth(allowed?: UserRole | UserRole[]): Promise<Session> {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (allowed) {
    const roles = Array.isArray(allowed) ? allowed : [allowed]
    if (!roles.includes(session.user.role)) {
      redirect('/unauthorized')
    }
  }

  return session
}

// Variant for API routes — returns a typed result object instead of redirecting.
export async function requireAuthApi(
  allowed?: UserRole | UserRole[]
): Promise<
  | { ok: true; session: Session }
  | { ok: false; response: Response }
> {
  const session = await auth()

  if (!session?.user) {
    return { ok: false, response: new Response('Unauthorized', { status: 401 }) }
  }

  if (allowed) {
    const roles = Array.isArray(allowed) ? allowed : [allowed]
    if (!roles.includes(session.user.role)) {
      return { ok: false, response: new Response('Forbidden', { status: 403 }) }
    }
  }

  return { ok: true, session }
}

// ─── Role predicates ──────────────────────────────────────────────────────────
// For conditional UI rendering only — not a security gate.
// Security gates use requireAuth() / requireAuthApi() above.

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'COBALT_SUPER_ADMIN'
}

export function isTenantAdmin(role: UserRole): boolean {
  return role === 'TENANT_ADMIN' || role === 'COBALT_SUPER_ADMIN'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'TENANT_ADMIN' || role === 'COBALT_SUPER_ADMIN'
}

export function canManageIntegrations(role: UserRole): boolean {
  return role === 'TENANT_ADMIN' || role === 'COBALT_SUPER_ADMIN'
}

export function canViewAllTenants(role: UserRole): boolean {
  return role === 'COBALT_SUPER_ADMIN'
}
