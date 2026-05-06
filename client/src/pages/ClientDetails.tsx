import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClientApiKeys, createApiKey } from '../services/clientService';
import type { ApiKey, CreateApiKeyPayload } from '../services/clientService';
import { getDashboard } from '../services/analyticsService';
import type { DashboardData } from '../services/analyticsService';

type Tab = 'overview' | 'apikeys' | 'users' | 'integration';
type TimeRange = '24h' | '7d' | '30d';

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-surface-border/30 rounded animate-pulse ${className}`} />
);

// ── API Key Create Modal ────────────────────────────────────────────────────
const CreateKeyModal: React.FC<{
  open: boolean; clientId: string;
  onClose: () => void; onCreated: (key: ApiKey & { keyValue: string }) => void;
}> = ({ open, clientId, onClose, onCreated }) => {
  const [form, setForm] = useState<CreateApiKeyPayload>({ name: '', description: '', environment: 'production' });
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (p: CreateApiKeyPayload) => createApiKey(clientId, p),
    onSuccess: (key) => { qc.invalidateQueries({ queryKey: ['apikeys', clientId] }); onCreated(key); },
    onError: (e: unknown) => {
      const ae = e as { response?: { data?: { message?: string } }; message?: string };
      setErr(ae?.response?.data?.message ?? ae?.message ?? 'Failed to create key');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-headline-md text-text-primary">Generate API Key</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><span className="material-symbols-outlined">close</span></button>
        </div>
        {err && <div className="mb-4 p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-sm">{err}</div>}
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Key Name <span className="text-status-error">*</span></label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Production Key" className="w-full bg-surface-background border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="w-full bg-surface-background border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Environment</label>
            <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value as CreateApiKeyPayload['environment'] }))} className="w-full bg-surface-background border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-text-secondary bg-surface-background border border-surface-border rounded hover:bg-surface-border/20">Cancel</button>
            <button type="submit" disabled={mutation.isPending || !form.name.trim()} className="flex-1 px-4 py-2 text-sm font-semibold text-on-primary bg-primary rounded hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {mutation.isPending ? <><span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>Creating…</> : <><span className="material-symbols-outlined text-[15px]">vpn_key</span>Generate</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Key Reveal Banner (shown once after creation) ──────────────────────────
const NewKeyBanner: React.FC<{ keyValue: string; onDismiss: () => void }> = ({ keyValue, onDismiss }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(keyValue); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="mb-6 p-4 rounded-xl border border-status-success/30 bg-status-success/10">
      <div className="flex items-start gap-3 mb-3">
        <span className="material-symbols-outlined text-status-success mt-0.5">check_circle</span>
        <div>
          <p className="text-sm font-semibold text-text-primary">API Key Generated Successfully</p>
          <p className="text-xs text-text-secondary mt-0.5">Copy it now — it will never be shown again.</p>
        </div>
        <button onClick={onDismiss} className="ml-auto text-text-secondary hover:text-text-primary"><span className="material-symbols-outlined text-[18px]">close</span></button>
      </div>
      <div className="flex items-center gap-2 bg-surface-background border border-surface-border rounded p-2">
        <code className="flex-1 font-mono-data text-xs text-primary break-all">{keyValue}</code>
        <button onClick={copy} className={`shrink-0 text-xs px-2 py-1 rounded transition-colors ${copied ? 'bg-status-success/20 text-status-success' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

// ── Overview Tab ────────────────────────────────────────────────────────────
const OverviewTab: React.FC<{ clientId: string; timeRange: TimeRange }> = ({ clientId, timeRange }) => {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['client-dashboard', clientId, timeRange],
    queryFn: () => getDashboard(timeRange, clientId),
  });
  const stats = data?.stats;
  const top = data?.topEndpoints ?? [];

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (isError) return <div className="p-6 flex items-center gap-2 text-status-error text-sm"><span className="material-symbols-outlined">error</span>Failed to load analytics for this client.</div>;
  if (!stats) return <div className="p-6 text-text-secondary text-sm">No analytics data yet for this client.</div>;

  const successRate = parseFloat((100 - stats.errorRate).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card border border-surface-border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="text-text-secondary font-body-sm text-body-sm">Total Requests</div>
            <span className="material-symbols-outlined text-text-secondary">data_usage</span>
          </div>
          <div className="font-display-lg text-display-lg mb-1">{formatNumber(stats.totalHits)}</div>
          <div className="text-xs text-text-secondary">Last {timeRange}</div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="text-text-secondary font-body-sm text-body-sm">Error Rate (5xx)</div>
            <span className="material-symbols-outlined text-text-secondary">error_outline</span>
          </div>
          <div className={`font-display-lg text-display-lg mb-1 ${stats.errorRate > 5 ? 'text-status-error' : stats.errorRate > 1 ? 'text-status-warning' : 'text-status-success'}`}>
            {stats.errorRate.toFixed(2)}%
          </div>
          <div className="text-xs text-text-secondary">{formatNumber(stats.errorHits)} error hits</div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="text-text-secondary font-body-sm text-body-sm">Avg Latency</div>
            <span className="material-symbols-outlined text-text-secondary">speed</span>
          </div>
          <div className="font-display-lg text-display-lg text-data-latency mb-1">{Math.round(stats.avgLatency)}ms</div>
          <div className="text-xs text-text-secondary">Success: {successRate}%</div>
        </div>
      </div>

      {/* Top endpoints */}
      {top.length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-surface-border">
            <h4 className="text-sm font-semibold text-text-primary">Top Endpoints</h4>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-background/50 border-b border-surface-border text-xs text-text-secondary uppercase">
              <tr>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Endpoint</th>
                <th className="px-4 py-2 text-right">Hits</th>
                <th className="px-4 py-2 text-right">Avg Latency</th>
                <th className="px-4 py-2 text-right">Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {top.map((ep, i) => (
                <tr key={i} className="hover:bg-surface-background/30 transition-colors">
                  <td className="px-4 py-3"><span className="font-mono-data text-[10px] font-bold px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">{ep.method}</span></td>
                  <td className="px-4 py-3 font-mono-data text-xs text-text-primary truncate max-w-[200px]">{ep.endpoint}</td>
                  <td className="px-4 py-3 text-right font-mono-data text-text-primary">{formatNumber(ep.totalHits)}</td>
                  <td className="px-4 py-3 text-right font-mono-data text-text-secondary">{ep.avgLatency}ms</td>
                  <td className="px-4 py-3 text-right font-mono-data text-text-secondary">{parseFloat(ep.errorRate).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── API Keys Tab ────────────────────────────────────────────────────────────
const ApiKeysTab: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [newKey, setNewKey] = useState<(ApiKey & { keyValue: string }) | null>(null);

  const { data: keys = [], isLoading, isError } = useQuery<ApiKey[]>({
    queryKey: ['apikeys', clientId],
    queryFn: () => getClientApiKeys(clientId),
  });

  const ENV_BADGE: Record<string, string> = {
    production:  'bg-primary/10 text-primary border-primary/20',
    staging:     'bg-status-warning/10 text-status-warning border-status-warning/20',
    development: 'bg-status-success/10 text-status-success border-status-success/20',
  };

  return (
    <div>
      {newKey && <NewKeyBanner keyValue={newKey.keyValue} onDismiss={() => setNewKey(null)} />}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{keys.length} key{keys.length !== 1 ? 's' : ''} configured</p>
        <button id="generate-api-key-btn" onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-on-primary bg-primary rounded hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[16px]">add</span>Generate Key
        </button>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {isError && <div className="p-4 text-status-error text-sm flex items-center gap-2"><span className="material-symbols-outlined">error</span>Failed to load API keys.</div>}

      {!isLoading && !isError && keys.length === 0 && (
        <div className="p-10 flex flex-col items-center gap-3 text-text-secondary border border-dashed border-surface-border rounded-lg">
          <span className="material-symbols-outlined text-[40px] opacity-40">vpn_key</span>
          <p className="text-sm">No API keys yet. Generate one to start ingesting data.</p>
        </div>
      )}

      {!isLoading && !isError && keys.length > 0 && (
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key._id} className="bg-surface-card border border-surface-border rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>vpn_key</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{key.name}</p>
                  <p className="text-xs text-text-secondary mt-0.5 font-mono-data">{key.keyId}</p>
                  {key.description && <p className="text-xs text-text-secondary mt-0.5 truncate">{key.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded border capitalize font-medium ${ENV_BADGE[key.environment] ?? ENV_BADGE['production']}`}>{key.environment}</span>
                <span className="text-xs text-text-secondary">{new Date(key.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateKeyModal open={modalOpen} clientId={clientId} onClose={() => setModalOpen(false)} onCreated={(k) => { setNewKey(k); setModalOpen(false); }} />
    </div>
  );
};

// ── Integration Tab ─────────────────────────────────────────────────────────
const IntegrationTab: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [copied, setCopied] = useState(false);
  const snippet = `curl -X POST https://your-server/api/hit \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceName": "my-service",
    "endpoint": "/api/v1/users",
    "method": "GET",
    "statusCode": 200,
    "latency": 42
  }'`;

  return (
    <div className="space-y-6">
      <div className="bg-surface-card border border-surface-border rounded-lg p-6">
        <h4 className="text-sm font-semibold text-text-primary mb-2">Client ID</h4>
        <p className="text-xs text-text-secondary mb-3">Use this when scoping analytics queries.</p>
        <div className="flex items-center gap-2 bg-surface-background border border-surface-border rounded p-2">
          <code className="flex-1 font-mono-data text-xs text-primary break-all">{clientId}</code>
          <button onClick={() => navigator.clipboard.writeText(clientId)} className="text-text-secondary hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-6">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold text-text-primary">Ingest a Hit (cURL)</h4>
          <button onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${copied ? 'text-status-success' : 'text-text-secondary hover:text-primary'}`}>
            <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="bg-surface-background border border-surface-border rounded p-3 overflow-x-auto">
          <code className="font-mono-data text-[11px] text-primary whitespace-pre">{snippet}</code>
        </pre>
      </div>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────
const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  if (!id) { navigate('/clients'); return null; }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'apikeys', label: 'API Keys' },
    { key: 'users', label: 'Users' },
    { key: 'integration', label: 'Integration' },
  ];

  return (
    <>
      {/* Breadcrumb + header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 text-text-secondary font-body-sm text-body-sm mb-2">
            <Link className="hover:text-primary transition-colors" to="/clients">Clients</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-text-primary font-mono-data text-xs">{id}</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-text-primary">Client Details</h1>
        </div>

        {/* Time range picker — only relevant on overview */}
        {tab === 'overview' && (
          <div className="flex bg-surface-card border border-surface-border rounded-DEFAULT p-0.5">
            {(['24h', '7d', '30d'] as TimeRange[]).map((r) => (
              <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 text-sm rounded transition-colors ${timeRange === r ? 'bg-surface-bright text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>{r}</button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-border mb-6">
        <nav className="-mb-px flex space-x-8" role="tablist">
          {TABS.map(({ key, label }) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} type="button"
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm bg-transparent cursor-pointer transition-colors ${tab === key ? 'border-blue-500 text-blue-500' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-surface-border'}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab clientId={id} timeRange={timeRange} />}
      {tab === 'apikeys' && <ApiKeysTab clientId={id} />}
      {tab === 'users' && (
        <div className="p-10 flex flex-col items-center gap-3 text-text-secondary border border-dashed border-surface-border rounded-lg">
          <span className="material-symbols-outlined text-[40px] opacity-40">group</span>
          <p className="text-sm font-medium text-text-primary">User management coming soon</p>
          <p className="text-xs">Use the API directly to create users for this client.</p>
        </div>
      )}
      {tab === 'integration' && <IntegrationTab clientId={id} />}
    </>
  );
};

export default ClientDetails;
