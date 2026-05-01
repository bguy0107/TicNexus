export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">TicNexus</h1>
          <p className="text-slate-500 mt-1 text-sm">Franchise Equipment & IT Management</p>
        </div>
        {children}
      </div>
    </div>
  )
}
