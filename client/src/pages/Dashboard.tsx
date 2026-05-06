/**
 * Dashboard page — fully wired to GET /api/analytics/dashboard.
 *
 * Business logic:
 *  - Super Admin: sees global aggregated metrics (no clientId filter)
 *  - Client Admin / Viewer: backend automatically scopes to their client
 *  - Time range picker (24h / 7d / 30d) re-fetches fresh data from the API
 *  - Traffic chart is rendered from the real timeSeries data
 *  - Top Endpoints table is rendered from the real topEndpoints array
 *  - All loading states show skeletons; errors show an error banner
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../services/analyticsService';
import type { DashboardData, TimeSeriesPoint } from '../services/analyticsService';
import { useAuth } from '../context/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────

type TimeRange = '24h' | '7d' | '30d';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-primary-container/20 text-primary border-primary-container/30',
  POST:   'bg-status-success/20 text-status-success border-status-success/30',
  PUT:    'bg-status-warning/20 text-status-warning border-status-warning/30',
  DELETE: 'bg-status-error/20 text-status-error border-status-error/30',
  PATCH:  'bg-data-latency/20 text-data-latency border-data-latency/30',
};

function errorRateColor(rate: string | number) {
  const r = parseFloat(String(rate));
  if (r < 1) return 'text-status-success';
  if (r < 5) return 'text-status-warning';
  return 'text-status-error';
}
function errorRateBg(rate: string | number) {
  const r = parseFloat(String(rate));
  if (r < 1) return 'bg-status-success';
  if (r < 5) return 'bg-status-warning';
  return 'bg-status-error';
}

// ── Skeleton ───────────────────────────────────────────────────────────────

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-surface-border/30 rounded animate-pulse ${className}`} />
);

// ── Chart from time-series ─────────────────────────────────────────────────

const TrafficChart: React.FC<{ series: TimeSeriesPoint[] }> = ({ series }) => {
  if (!series || series.length === 0) {
    return (
      <div className="flex-1 min-h-[280px] flex items-center justify-center text-text-secondary text-sm">
        No traffic data for this period.
      </div>
    );
  }

  // Aggregate by timeBucket (sum hits)
  const buckets = series.reduce<Record<string, number>>((acc, pt) => {
    acc[pt.timeBucket] = (acc[pt.timeBucket] ?? 0) + pt.totalHits;
    return acc;
  }, {});
  const sorted = Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0]));
  const maxHits = Math.max(...sorted.map(([, v]) => v), 1);

  // Build SVG polyline path (normalised to 0-100 viewBox)
  const w = 100;
  const h = 100;
  const points = sorted.map(([, v], i) => {
    const x = (i / Math.max(sorted.length - 1, 1)) * w;
    const y = h - (v / maxHits) * h;
    return `${x},${y}`;
  });
  const polyline = points.join(' ');
  const areaPath = `M${points[0]} L${points.join(' L')} L${w},${h} L0,${h} Z`;

  const formatLabel = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const labels = sorted.length > 6
    ? sorted.filter((_, i) => i % Math.ceil(sorted.length / 6) === 0)
    : sorted;

  return (
    <div className="flex-1 min-h-[280px] w-full relative flex items-end pt-8 pb-6 border-l border-b border-surface-border px-2">
      {/* Y-axis labels */}
      <div className="absolute left-[-40px] top-0 h-full flex flex-col justify-between text-xs text-text-secondary font-mono-data">
        <span>{formatNumber(maxHits)}</span>
        <span>{formatNumber(Math.round(maxHits * 0.75))}</span>
        <span>{formatNumber(Math.round(maxHits * 0.5))}</span>
        <span>{formatNumber(Math.round(maxHits * 0.25))}</span>
        <span className="relative top-4">0</span>
      </div>

      {/* X-axis labels */}
      <div className="absolute bottom-[-24px] left-0 w-full flex justify-between text-xs text-text-secondary font-mono-data px-4">
        {labels.map(([ts]) => <span key={ts}>{formatLabel(ts)}</span>)}
      </div>

      {/* Grid lines */}
      <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-between pointer-events-none pb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-full border-b border-surface-border border-dashed opacity-50" />
        ))}
      </div>

      {/* SVG chart */}
      <svg className="absolute top-0 left-0 w-full h-[calc(100%-24px)]" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#adc6ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#adc6ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chartGradient)" />
        <polyline points={polyline} fill="none" stroke="#adc6ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
};

// ── Main Dashboard component ───────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const { isSuperAdmin } = useAuth();

  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: ['dashboard', timeRange],
    queryFn: () => getDashboard(timeRange),
  });

  const stats = data?.stats;
  const topEndpoints = data?.topEndpoints ?? [];
  const timeSeries = data?.recentActitivy ?? [];

  const successRate = stats
    ? parseFloat((100 - stats.errorRate).toFixed(2))
    : null;

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display-lg text-display-lg text-text-primary">Dashboard</h2>
          <p className="text-text-secondary mt-1 font-body-sm text-body-sm">
            {isSuperAdmin ? 'Global overview across all clients.' : 'Overview of your API performance metrics.'}
          </p>
        </div>

        {/* Time range picker */}
        <div className="flex items-center bg-surface-card border border-surface-border rounded-lg p-1">
          {(['24h', '7d', '30d'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeRange === r
                  ? 'text-text-primary bg-surface-background shadow-sm border border-surface-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error">
          <span className="material-symbols-outlined">error</span>
          <span className="text-sm">
            Failed to load dashboard data:{' '}
            {(error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
              ?? (error as Error)?.message
              ?? 'Unknown error'}
          </span>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-8">
        {/* Total Hits */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Total Hits</h3>
            <span className="material-symbols-outlined text-primary-fixed text-[20px]">data_usage</span>
          </div>
          <div>
            {isLoading ? (
              <><Skeleton className="h-9 w-24 mb-2" /><Skeleton className="h-4 w-32" /></>
            ) : (
              <>
                <div className="font-display-lg text-[36px] font-bold text-text-primary leading-none tracking-tight">
                  {stats ? formatNumber(stats.totalHits) : '—'}
                </div>
                <div className="flex items-center gap-1 mt-2 text-text-secondary font-mono-data text-xs">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  <span>Last {timeRange}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Avg Latency */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Avg Latency</h3>
            <span className="material-symbols-outlined text-data-latency text-[20px]">speed</span>
          </div>
          <div>
            {isLoading ? (
              <><Skeleton className="h-9 w-20 mb-2" /><Skeleton className="h-4 w-28" /></>
            ) : (
              <>
                <div className="font-display-lg text-[36px] font-bold text-text-primary leading-none tracking-tight flex items-baseline gap-1">
                  {stats ? Math.round(stats.avgLatency) : '—'}
                  <span className="text-lg font-medium text-text-secondary">ms</span>
                </div>
                <div className="text-text-secondary font-mono-data text-xs mt-2">
                  {stats ? `${stats.uniqueEndpoints} unique endpoints` : ''}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Error Rate</h3>
            <span className="material-symbols-outlined text-status-error text-[20px]">error_outline</span>
          </div>
          <div>
            {isLoading ? (
              <><Skeleton className="h-9 w-20 mb-2" /><Skeleton className="h-4 w-24" /></>
            ) : (
              <>
                <div className={`font-display-lg text-[36px] font-bold leading-none tracking-tight flex items-baseline gap-1 ${stats && stats.errorRate > 5 ? 'text-status-error' : stats && stats.errorRate > 1 ? 'text-status-warning' : 'text-status-success'}`}>
                  {stats ? stats.errorRate.toFixed(2) : '—'}
                  <span className="text-lg font-medium">%</span>
                </div>
                <div className="text-text-secondary font-mono-data text-xs mt-2">
                  {stats ? `${formatNumber(stats.errorHits)} error hits` : ''}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-status-success/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Success Rate</h3>
            <span className="material-symbols-outlined text-status-success text-[20px]">check_circle</span>
          </div>
          <div className="relative z-10">
            {isLoading ? (
              <><Skeleton className="h-9 w-28 mb-2" /><Skeleton className="h-2 w-full mt-3" /></>
            ) : (
              <>
                <div className="font-display-lg text-[36px] font-bold text-text-primary leading-none tracking-tight flex items-baseline gap-1">
                  {successRate !== null ? successRate.toFixed(2) : '—'}
                  <span className="text-lg font-medium text-text-secondary">%</span>
                </div>
                <div className="w-full bg-surface-background h-1.5 rounded-full mt-3 overflow-hidden border border-surface-border">
                  <div
                    className="bg-status-success h-full rounded-full transition-all duration-700"
                    style={{ width: `${successRate ?? 0}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Chart + Health Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mb-8">
        {/* Traffic Over Time */}
        <div className="lg:col-span-2 bg-surface-card border border-surface-border rounded-xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-[18px] text-text-primary">Traffic Over Time</h3>
            <span className="text-xs text-text-secondary font-mono-data">{timeRange} window</span>
          </div>
          {isLoading ? (
            <Skeleton className="flex-1 min-h-[280px]" />
          ) : (
            <TrafficChart series={timeSeries} />
          )}
        </div>

        {/* Quick Stats panel */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-6 flex flex-col gap-4">
          <h3 className="font-headline-md text-[18px] text-text-primary">Aggregate Stats</h3>

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : stats ? (
            <>
              <div className="p-3 rounded-lg border border-surface-border bg-surface-background flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-secondary mb-1">Unique Services</p>
                  <p className="text-xl font-bold text-text-primary">{stats.uniqueServices}</p>
                </div>
                <span className="material-symbols-outlined text-primary text-[24px]">hub</span>
              </div>
              <div className="p-3 rounded-lg border border-surface-border bg-surface-background flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-secondary mb-1">Unique Endpoints</p>
                  <p className="text-xl font-bold text-text-primary">{stats.uniqueEndpoints}</p>
                </div>
                <span className="material-symbols-outlined text-data-latency text-[24px]">api</span>
              </div>
              <div className="p-3 rounded-lg border border-surface-border bg-surface-background flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-secondary mb-1">Success Hits</p>
                  <p className="text-xl font-bold text-status-success">{formatNumber(stats.successHits)}</p>
                </div>
                <span className="material-symbols-outlined text-status-success text-[24px]">check_circle</span>
              </div>

              {/* Quick Diagnostic */}
              <div className="mt-auto pt-4 border-t border-surface-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-label-caps text-text-secondary uppercase">Quick Diagnostic</span>
                  <button
                    className="text-text-secondary hover:text-white transition-colors"
                    title="Copy to clipboard"
                    onClick={() => navigator.clipboard.writeText('curl -I -X GET "http://localhost:5000/health"')}
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  </button>
                </div>
                <div className="bg-surface-background border border-surface-border rounded p-2 overflow-x-auto">
                  <code className="font-mono-data text-[11px] text-primary whitespace-nowrap">
                    curl -I -X GET &quot;http://localhost:5000/health&quot;
                  </code>
                </div>
              </div>
            </>
          ) : (
            <p className="text-text-secondary text-sm">No data available.</p>
          )}
        </div>
      </div>

      {/* ── Top Endpoints Table ── */}
      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden flex flex-col mb-8">
        <div className="p-5 border-b border-surface-border flex justify-between items-center bg-surface-card">
          <h3 className="font-headline-md text-[18px] text-text-primary">Top Endpoints</h3>
          <span className="text-xs text-text-secondary font-mono-data">{topEndpoints.length} endpoints</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : topEndpoints.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-3 text-text-secondary">
            <span className="material-symbols-outlined text-[40px] opacity-40">search_off</span>
            <p className="text-sm">No endpoint data for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-background/50 border-b border-surface-border text-xs uppercase font-label-caps text-text-secondary">
                <tr>
                  <th className="px-5 py-3 font-semibold" scope="col">Method</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Service</th>
                  <th className="px-5 py-3 font-semibold w-1/3" scope="col">Path</th>
                  <th className="px-5 py-3 font-semibold text-right" scope="col">Hits</th>
                  <th className="px-5 py-3 font-semibold text-right" scope="col">Avg Latency</th>
                  <th className="px-5 py-3 font-semibold text-right" scope="col">Error Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {topEndpoints.map((ep, idx) => (
                  <tr key={idx} className="hover:bg-surface-background/40 transition-colors group">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-data font-bold border ${METHOD_COLORS[ep.method] ?? 'bg-surface-border/20 text-text-secondary border-surface-border/30'}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono-data text-text-secondary text-xs truncate max-w-[120px]" title={ep.serviceName}>
                      {ep.serviceName}
                    </td>
                    <td className="px-5 py-3 font-mono-data text-text-primary truncate max-w-[220px]" title={ep.endpoint}>
                      {ep.endpoint}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-data text-text-primary">
                      {formatNumber(ep.totalHits)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-data text-text-secondary">
                      {ep.avgLatency}ms
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-mono-data ${errorRateColor(ep.errorRate)}`}>
                          {parseFloat(ep.errorRate).toFixed(2)}%
                        </span>
                        <div className="w-16 h-1 bg-surface-background rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${errorRateBg(ep.errorRate)}`}
                            style={{ width: `${Math.min(parseFloat(ep.errorRate) * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
