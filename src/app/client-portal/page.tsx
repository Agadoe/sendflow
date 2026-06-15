import { JWT_SECRET } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import Link from 'next/link';


function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);
}

const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  QUALIFIED: 'bg-green-100 text-green-700',
  NURTURE: 'bg-yellow-100 text-yellow-700',
  CLOSED: 'bg-red-100 text-red-600',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-600',
};

export default async function ClientDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;
  let userId = '';

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      userId = payload.sub as string;
    } catch {
      userId = '';
    }
  }

  // Stats
  const [totalLeads, qualifiedLeads, activeCampaigns, recentLeads, recentCampaigns] = await Promise.all([
    prisma.lead.count({ where: { userId } }),
    prisma.lead.count({ where: { userId, stage: 'QUALIFIED' } }),
    prisma.campaign.count({ where: { userId, status: { in: ['SCHEDULED', 'SENT'] } } }),
    prisma.lead.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  const totalContacts = await prisma.contact.count({ where: { userId } });

  // Response rate: messages with status DELIVERED or READ / total messages
  const totalMessages = await prisma.message.count({
    where: { campaign: { userId } },
  });
  const responseMessages = await prisma.message.count({
    where: { campaign: { userId }, status: { in: ['DELIVERED', 'READ'] } },
  });
  const responseRate = totalMessages > 0 ? Math.round((responseMessages / totalMessages) * 100) : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl text-slate">Dashboard</h1>
        <p className="text-slate-light text-sm mt-1">Welcome back — here&apos;s your performance overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads" value={totalLeads} href="/client-portal/leads" />
        <StatCard label="Qualified Leads" value={qualifiedLeads} href="/client-portal/leads" highlight />
        <StatCard label="Active Campaigns" value={activeCampaigns} href="/client-portal/campaigns" />
        <StatCard label="Response Rate" value={`${responseRate}%`} href="/client-portal/reports" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate">Recent Leads</h2>
            <Link href="/client-portal/leads" className="text-sm text-amber font-medium hover:underline">
              View all →
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-light text-sm">No leads yet</p>
              <p className="text-xs text-slate-light mt-1">Leads will appear here once added</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-light font-medium border-b border-gray-100">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Company</th>
                    <th className="pb-3 pr-4">Stage</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate">{lead.name}</td>
                      <td className="py-3 pr-4 text-slate-light text-xs">{lead.company || '—'}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[lead.stage] || STAGE_COLORS.NEW}`}>
                          {lead.stage}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-slate-light">{formatDate(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate">Campaign Performance</h2>
            <Link href="/client-portal/campaigns" className="text-sm text-amber font-medium hover:underline">
              View all →
            </Link>
          </div>

          {recentCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-light text-sm">No campaigns yet</p>
              <p className="text-xs text-slate-light mt-1">Campaigns will appear here once created</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentCampaigns.map((campaign) => {
                const sentCount = campaign.status === 'SENT' ? campaign.sentAt ? 'Sent' : '—' : '—';
                return (
                  <div key={campaign.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate truncate">{campaign.name}</p>
                      <p className="text-xs text-slate-light mt-0.5">
                        {sentCount !== '—' ? formatDate(campaign.sentAt!) : campaign.scheduledAt ? `Scheduled: ${formatDate(campaign.scheduledAt)}` : 'Draft'}
                      </p>
                    </div>
                    <span className={`ml-4 inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[campaign.status] || STATUS_COLORS.DRAFT}`}>
                      {campaign.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href, highlight }: { label: string; value: number | string; href: string; highlight?: boolean }) {
  return (
    <a
      href={href}
      className={`block bg-white rounded-2xl border p-5 hover:shadow-sm transition-shadow ${highlight ? 'border-amber/30' : 'border-gray-100'}`}
    >
      <p className="text-2xl font-heading text-slate">{value}</p>
      <p className="text-xs text-slate-light font-medium mt-1">{label}</p>
    </a>
  );
}