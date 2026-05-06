/**
 * Analytics service — wraps /api/analytics endpoints.
 * Response shapes match analyticsService.js and analyticsController.js.
 */
import api from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OverallStats {
  totalHits: number;
  errorHits: number;
  successHits: number;
  errorRate: number;       // percentage, e.g. 0.12
  avgLatency: number;      // ms
  uniqueServices: number;
  uniqueEndpoints: number;
  timeRange: { start: string; end: string };
}

export interface TopEndpoint {
  serviceName: string;
  endpoint: string;
  method: string;
  totalHits: number;
  avgLatency: string;
  errorHits: number;
  errorRate: string;       // percentage string, e.g. "0.12"
}

export interface TimeSeriesPoint {
  serviceName: string;
  endpoint: string;
  method: string;
  totalHits: number;
  errorHits: number;
  avgLatency: string;
  minLatency: string;
  maxLatency: string;
  timeBucket: string;      // ISO timestamp
}

export interface DashboardData {
  stats: OverallStats | null;
  topEndpoints: TopEndpoint[] | null;
  recentActitivy: TimeSeriesPoint[] | null;   // note: typo in backend is intentional
}

export type TimeRange = '24h' | '7d' | '30d';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildParams(timeRange: TimeRange, clientId?: string) {
  const now = Date.now();
  const offsets: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7  * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const params: Record<string, string | number> = {
    startTime: now - offsets[timeRange],
    endTime:   now,
  };
  if (clientId) params.clientId = clientId;
  return params;
}

// ── API calls ──────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/dashboard
 * Returns stats + topEndpoints + recentActivity in one shot.
 * Super admins can optionally scope to a specific clientId.
 */
export async function getDashboard(
  timeRange: TimeRange = '24h',
  clientId?: string
): Promise<DashboardData> {
  const res = await api.get<{ data: DashboardData }>('/analytics/dashboard', {
    params: buildParams(timeRange, clientId),
  });
  return res.data.data;
}

/**
 * GET /api/analytics/stats
 * Returns only the OverallStats aggregate.
 */
export async function getStats(
  timeRange: TimeRange = '24h',
  clientId?: string
): Promise<OverallStats> {
  const res = await api.get<{ data: OverallStats }>('/analytics/stats', {
    params: buildParams(timeRange, clientId),
  });
  return res.data.data;
}
