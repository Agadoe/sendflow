'use client';

import { useState, useEffect } from 'react';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function maxVal(rows: { sent: number }[]) {
  return Math.max(...rows.map(r => r.sent), 1);
}

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-portal/reports')
      .then(r => r.ok ? r.json() : { stats: null, chartData: [] })
      .then(d => {
        setStats(d.stats);
        setChartData(d.chartData || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-slate">Reports</h1>
        <p className="text-slate-light text-sm mt-1">Track your messaging performance</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-light text-sm">Loading reports...</div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-2xl font-heading text-slate">{stats?.totalMessages ?? 0}</p>
              <p className="text-xs text-slate-light font-medium mt-1">Messages Sent</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-2xl font-heading text-slate">{stats?.deliveredMessages ?? 0}</p>
              <p className="text-xs text-slate-light font-medium mt-1">Delivered</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-2xl font-heading text-slate">{stats?.deliveredRate ?? 0}%</p>
              <p className="text-xs text-slate-light font-medium mt-1">Delivery Rate</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-2xl font-heading text-slate">{stats?.readRate ?? 0}%</p>
              <p className="text-xs text-slate-light font-medium mt-1">Read Rate</p>
            </div>
          </div>

          {/* 7-day chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-slate mb-6">Last 7 Days Performance</h2>
            {chartData.length === 0 || chartData.every(d => d.sent === 0) ? (
              <div className="text-center py-12">
                <p className="text-slate-light text-sm">No message data in the last 7 days</p>
              </div>
            ) : (
              <div className="flex items-end gap-3 h-48">
                {chartData.map((row) => {
                  const pct = (row.sent / maxVal(chartData)) * 100;
                  const deliveredPct = (row.delivered / maxVal(chartData)) * 100;
                  return (
                    <div key={row.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center gap-0.5 h-full justify-end">
                        {/* Sent bar */}
                        <div
                          className="w-full rounded-t bg-amber/80 hover:bg-amber transition-colors relative group min-h-[4px]"
                          style={{ height: `${Math.max(pct, 4)}%` }}
                          title={`Sent: ${row.sent}`}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-slate-light opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {row.sent}
                          </div>
                          {/* Delivered sub-bar */}
                          <div
                            className="absolute bottom-0 left-0 w-full rounded-t bg-green-500/60"
                            style={{ height: `${(deliveredPct / pct) * 100 || 0}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-light mt-1">{formatDate(row.date)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-4 text-xs text-slate-light">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber/80" />
                <span>Sent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500/60" />
                <span>Delivered</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}