import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

  // "lek.cobalt.app"     → "lek"
  // "lek.localhost:3000" → "lek"
  // "cobalt.app"         → ""   (Cobalt super-admin / marketing)
  // "localhost:3000"     → ""
  const subdomain = hostname.endsWith(`.${rootDomain}`)
    ? hostname.slice(0, hostname.length - rootDomain.length - 1)
    : ''

  const forwarded = new Headers(request.headers)

  if (subdomain && subdomain !== 'www') {
    forwarded.set('x-tenant-slug', subdomain)
  }

  forwarded.set('x-pathname', request.nextUrl.pathname)

  return NextResponse.next({ request: { headers: forwarded } })
}
