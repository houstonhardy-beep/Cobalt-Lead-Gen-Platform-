export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
