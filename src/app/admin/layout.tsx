"use client"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { usePathname } from "next/navigation"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
            WA Tracker
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/admin" className={`block px-4 py-2 rounded-lg transition-colors ${pathname === '/admin' ? 'bg-purple-600/20 text-purple-400 font-medium' : 'hover:bg-white/5 hover:text-white'}`}>
            Dashboard & Accounts
          </Link>
          <div className="pt-6 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Selected Account
          </div>
          <Link href="/admin/config" className={`block px-4 py-2 rounded-lg transition-colors ${pathname.includes('/config') ? 'bg-purple-600/20 text-purple-400 font-medium' : 'hover:bg-white/5 hover:text-white'}`}>
            Button Config
          </Link>
          <Link href="/admin/attendants" className={`block px-4 py-2 rounded-lg transition-colors ${pathname.includes('/attendants') ? 'bg-purple-600/20 text-purple-400 font-medium' : 'hover:bg-white/5 hover:text-white'}`}>
            Attendants
          </Link>
          <Link href="/admin/leads" className={`block px-4 py-2 rounded-lg transition-colors ${pathname.includes('/leads') ? 'bg-purple-600/20 text-purple-400 font-medium' : 'hover:bg-white/5 hover:text-white'}`}>
            Leads
          </Link>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={() => signOut()}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 hover:text-white rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </main>
    </div>
  )
}
