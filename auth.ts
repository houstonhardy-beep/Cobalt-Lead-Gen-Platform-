import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import type { UserRole } from '@/app/generated/prisma/client'

// ─── Type augmentation ───────────────────────────────────────────────────────
// next-auth/jwt re-exports from @auth/core/jwt — augment the source module.

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      tenantId: string | null
      tenantSlug: string | null
    } & DefaultSession['user']
  }
  interface User {
    role: UserRole
    tenantId: string | null
    tenantSlug: string | null
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    userId: string
    role: UserRole
    tenantId: string | null
    tenantSlug: string | null
  }
}

// ─── Input validation ─────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ─── Cookie config ────────────────────────────────────────────────────────────
// In production, set domain to .{rootDomain} so the session cookie is shared
// across all tenant subdomains (e.g. lek.cobalt.app and cobalt.app).
//
// In development, domain is intentionally omitted: Chrome treats `localhost`
// as a public suffix and silently drops any cookie with Domain=.localhost,
// which would make every auth() call return null.
//
// csrfToken is left at its default (no domain override). In production it uses
// the __Host- prefix, which the browser rejects if a domain attribute is present.

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
const useSecureCookies = process.env.NODE_ENV === 'production'
const cookiePrefix = useSecureCookies ? '__Secure-' : ''
// Only set domain in production — Chrome rejects Domain=.localhost (PSL) in dev,
// which causes the session cookie to be silently dropped.
const cookieDomain = useSecureCookies ? '.' + rootDomain.split(':')[0] : undefined

// ─── NextAuth config ──────────────────────────────────────────────────────────

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  // Required for Vercel and other proxy deployments — allows NextAuth to trust
  // the forwarded host header rather than rejecting non-localhost origins.
  trustHost: true,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecureCookies,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecureCookies,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await db.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash || !user.active) return null

        let valid = false
        try {
          valid = await bcrypt.compare(password, user.passwordHash)
        } catch {
          return null
        }
        if (!valid) return null

        let tenantSlug: string | null = null
        if (user.tenantId) {
          const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } })
          tenantSlug = tenant?.slug ?? null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string
        token.role = user.role
        token.tenantId = user.tenantId
        token.tenantSlug = user.tenantSlug
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.userId
      session.user.role = token.role
      session.user.tenantId = token.tenantId
      session.user.tenantSlug = token.tenantSlug
      return session
    },
  },
})
