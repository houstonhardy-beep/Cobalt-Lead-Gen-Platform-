'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

// Detect whether we're on a tenant subdomain (e.g. lek.localhost:3000)
// vs the root domain (localhost:3000). Runs client-side only.
function getTenantSlug(rootDomain: string): string | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname
  const root = rootDomain.split(':')[0] // strip port
  if (hostname === root || hostname === 'localhost') return null
  if (hostname.endsWith('.' + root)) return hostname.slice(0, hostname.length - root.length - 1)
  return null
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

  // 'workspace' step shown on root domain; 'credentials' shown on tenant subdomain
  const [step, setStep] = useState<'workspace' | 'credentials'>('workspace')
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(searchParams.get('error') ? 'Sign-in failed. Please try again.' : '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const slug = getTenantSlug(rootDomain)
    if (slug) {
      setStep('credentials')
      setTenantSlug(slug)
    } else {
      setStep('workspace')
    }
  }, [rootDomain])

  function handleWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!workspace.trim()) return
    const proto = window.location.protocol
    const port = window.location.port ? `:${window.location.port}` : ''
    const root = rootDomain.split(':')[0]
    window.location.href = `${proto}//${workspace.trim().toLowerCase()}.${root}${port}/login`
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', { email, password, redirect: false })

    if (!result || result.error) {
      setLoading(false)
      setError('Invalid email or password.')
      return
    }

    // Session cookie was set on this subdomain — safe to redirect within same origin
    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="rounded-xl p-8"
      style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl mb-4 select-none"
          style={{ background: '#1A56FF' }}
        >
          <img src="/LOGO_Cobalt_white_image_only_x2.png" alt="Cobalt" width={30} height={30} style={{ objectFit: 'contain' }} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          Cobalt
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
          {step === 'workspace'
            ? 'Enter your workspace to continue'
            : tenantSlug
              ? `Sign in to ${tenantSlug.toUpperCase()}`
              : 'Sign in to your workspace'
          }
        </p>
      </div>

      {/* ── Workspace selector (root domain) ── */}
      {step === 'workspace' && (
        <form onSubmit={handleWorkspace} className="space-y-4">
          <div>
            <label
              htmlFor="workspace"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text2)' }}
            >
              Workspace
            </label>
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--bg4)' }}>
              <input
                id="workspace"
                type="text"
                autoComplete="off"
                autoFocus
                required
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="lek"
                className="flex-1 px-3 py-2.5 text-sm outline-none"
                style={{ background: 'var(--bg3)', color: 'var(--text)' }}
              />
              <span
                className="px-3 py-2.5 text-sm shrink-0 select-none"
                style={{ background: 'var(--bg4)', color: 'var(--text3)' }}
              >
                .{rootDomain}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white mt-2 cursor-pointer"
            style={{ background: 'var(--cobalt)' }}
          >
            Continue
          </button>

          <p className="text-center text-xs pt-1" style={{ color: 'var(--text3)' }}>
            Cobalt admin?{' '}
            <button
              type="button"
              onClick={() => setStep('credentials')}
              className="underline cursor-pointer"
              style={{ color: 'var(--cobalt3)' }}
            >
              Sign in here
            </button>
          </p>
        </form>
      )}

      {/* ── Credential form (tenant subdomain or admin fallback) ── */}
      {step === 'credentials' && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text2)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ background: 'var(--bg3)', border: '1px solid var(--bg4)', color: 'var(--text)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cobalt2)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bg4)' }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text2)' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ background: 'var(--bg3)', border: '1px solid var(--bg4)', color: 'var(--text)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cobalt2)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bg4)' }}
            />
          </div>

          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2.5"
              style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity mt-2 cursor-pointer"
            style={{ background: 'var(--cobalt)', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => { setStep('workspace'); setError('') }}
            className="w-full text-xs text-center cursor-pointer"
            style={{ color: 'var(--text3)' }}
          >
            ← Back to workspace
          </button>
        </form>
      )}

      <p className="text-center text-xs mt-6" style={{ color: 'var(--text3)' }}>
        Cobalt · Intelligent sales for security integrators
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
