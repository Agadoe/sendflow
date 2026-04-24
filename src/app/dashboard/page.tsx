'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const statCards = [
  {
    label: 'Total Contacts',
    value: '0',
    change: '+0 today',
    icon: (
      <svg className="w-6 h-6 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'border-amber/20',
  },
  {
    label: 'Campaigns Sent',
    value: '0',
    change: 'All time',
    icon: (
      <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    color: 'border-green-500/20',
  },
  {
    label: 'Active Automations',
    value: '0',
    change: 'running',
    icon: (
      <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'border-purple-500/20',
  },
  {
    label: 'Quick Actions',
    value: '',
    change: '',
    icon: null,
    color: '',
    noStat: true,
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ contacts: 0, campaigns: 0, messages: 0, automations: 0 });
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);

  useEffect(() => {
    // Load from API
    Promise.all([
      fetch('/api/contacts').then(r => r.json()).catch(() => ({ contacts: [] })),
      fetch('/api/campaigns').then(r => r.json()).catch(() => ({ campaigns: [] })),
      fetch('/api/automations').then(r => r.json()).catch(() => ({ automations: [] })),
    ]).then(([cData, campData, autoData]) => {
      const activeAuto = (autoData.automations || []).filter((a: any) => a.isEnabled).length;
      setStats({
        contacts: cData.contacts?.length || 0,
        campaigns: campData.campaigns?.length || 0,
        messages: campData.campaigns?.reduce((a: number, c: any) => a + (c._count?.messages || 0), 0) || 0,
        automations: activeAuto,
      });
      setRecentCampaigns(campData.campaigns?.slice(0, 5) || []);
    });
  }, []);

  const cards = [
    { ...statCards[0], value: stats.contacts.toString(), change: stats.contacts > 0 ? `${stats.contacts} contacts` : 'No contacts yet' },
    { ...statCards[1], value: stats.campaigns.toString(), change: `${stats.campaigns} campaign${stats.campaigns !== 1 ? 's' : ''}` },
    { ...statCards[2], value: stats.automations.toString(), change: `automations active` },
    statCards[3],
  ];

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl text-slate mb-1">Good morning, Don 👋</h1>
        <p className="text-slate-light">Here&apos;s what&apos;s happening with your WhatsApp marketing today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div key={i} className={`bg-surface rounded-card p-5 border ${card.color} ${card.noStat ? 'flex flex-col justify-center items-center' : ''}`}>
            {card.noStat ? (
              <>
                <div className="text-slate font-semibold mb-3">Start now</div>
                <div className="flex flex-col gap-2 w-full">
                  <Link href="/dashboard/campaigns" className="w-full text-center py-2 bg-amber hover:bg-amber-dark text-white rounded-btn text-sm font-semibold transition-colors">
                    + New Campaign
                  </Link>
                  <Link href="/dashboard/contacts" className="w-full text-center py-2 bg-gray-100 hover:bg-gray-200 text-slate rounded-btn text-sm font-medium transition-colors">
                    Add Contacts
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color.includes('amber') ? 'bg-amber/10' : card.color.includes('green') ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                    {card.icon}
                  </div>
                </div>
                <div className="font-heading text-3xl text-slate mb-1">{card.value}</div>
                <div className="text-sm font-medium text-slate-light">{card.label}</div>
                <div className="text-xs text-slate-light mt-1">{card.change}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Recent campaigns */}
      <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-heading text-lg text-slate">Recent Campaigns</h2>
          <Link href="/dashboard/campaigns" className="text-sm text-amber hover:text-amber-dark font-medium transition-colors">
            View all →
          </Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-3">📨</div>
            <div className="text-slate font-medium mb-1">No campaigns yet</div>
            <div className="text-sm text-slate-light mb-4">Create your first campaign to start reaching customers</div>
            <Link href="/dashboard/campaigns" className="inline-block bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-5 py-2.5 rounded-btn transition-colors">
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentCampaigns.map((c: any) => (
              <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${c.status === 'SENT' ? 'bg-green-500' : c.status === 'SENDING' ? 'bg-amber animate-pulse' : 'bg-gray-300'}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-slate text-sm truncate">{c.name}</div>
                    <div className="text-xs text-slate-light truncate">{c.content.slice(0, 60)}{c.content.length > 60 ? '...' : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === 'SENT' ? 'bg-green-100 text-green-700' : c.status === 'DRAFT' ? 'bg-gray-100 text-slate-light' : 'bg-amber/10 text-amber'}`}>
                    {c.status}
                  </span>
                  <span className="text-xs text-slate-light">{c._count?.messages || 0} messages</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Getting started checklist */}
      <div className="bg-surface rounded-card border border-amber/20 p-6">
        <h2 className="font-heading text-lg text-slate mb-4">🚀 Get started checklist</h2>
        <div className="space-y-3">
          {[
            { done: stats.automations > 0, text: 'Set up your first automation', href: '/dashboard/automations' },
            { done: stats.contacts > 0, text: 'Import your contacts', href: '/dashboard/contacts' },
            { done: stats.campaigns > 0, text: 'Create your first campaign', href: '/dashboard/campaigns' },
            { done: false, text: 'Connect your WhatsApp number', href: '/dashboard/connect' },
          ].map(({ done, text, href }, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${done ? 'bg-green-500' : 'bg-gray-200'}`}>
                {done ? '✓' : i + 1}
              </div>
              {done ? (
                <span className="text-sm text-slate-light line-through">{text}</span>
              ) : (
                <Link href={href} className="text-sm text-slate hover:text-amber transition-colors">{text}</Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}