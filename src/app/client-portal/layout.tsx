import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    redirect('/client-portal/login');
  }

  let user: { sub?: string; email?: string; name?: string; role?: string } = {};
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    user = payload as { sub?: string; email?: string; name?: string; role?: string };
    if (user.role !== 'CLIENT') {
      redirect('/client-portal/login');
    }
  } catch {
    redirect('/client-portal/login');
  }

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
              </svg>
            </div>
            <div>
              <span className="font-heading text-slate text-lg">SendFlow</span>
              <span className="block text-xs text-amber font-medium">Client Portal</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink href="/client-portal" label="Dashboard" icon="📊" />
          <NavLink href="/client-portal/leads" label="My Leads" icon="👥" />
          <NavLink href="/client-portal/campaigns" label="My Campaigns" icon="📨" />
          <NavLink href="/client-portal/reports" label="Reports" icon="📈" />
          <NavLink href="/client-portal/settings" label="Settings" icon="⚙️" />
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber/10 flex items-center justify-center text-amber font-semibold text-sm">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate truncate">{user.name}</p>
              <p className="text-xs text-slate-light truncate">{user.email}</p>
            </div>
          </div>
          <form action="/api/client-auth/logout" method="POST">
            <button
              type="submit"
              className="mt-3 w-full py-2 text-xs font-medium text-slate-light hover:text-red-500 hover:bg-red-50 rounded-btn transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm text-slate hover:bg-amber/5 hover:text-amber transition-colors"
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </a>
  );
}