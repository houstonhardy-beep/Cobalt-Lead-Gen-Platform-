import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ background: 'var(--bg2)', border: '1px solid var(--bg4)' }}
    >
      <div
        className="flex items-center justify-center w-12 h-12 rounded-xl mb-4 mx-auto text-2xl select-none"
        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
      >
        🚫
      </div>
      <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
        Access denied
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
        You don&apos;t have permission to view this page.
      </p>
      <Link
        href="/"
        className="inline-block text-sm font-medium px-4 py-2 rounded-lg"
        style={{ background: 'var(--cobalt)', color: '#fff' }}
      >
        Go to dashboard
      </Link>
    </div>
  )
}
