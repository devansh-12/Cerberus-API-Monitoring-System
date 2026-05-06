/**
 * ClientsDirectory — Super Admin view.
 *
 * Real backend integration:
 *  - Fetches GET /api/client/admin/clients for the list
 *  - "Onboard New Client" opens a modal that calls POST /api/client/admin/clients/onboard
 *  - Client rows navigate to /clients/:id on click
 *  - Status badge is driven by the real `status` field from the API
 *  - Graceful handling when the list endpoint doesn't exist yet (shows empty state)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listClients, createClient } from '../services/clientService';
import type { Client, CreateClientPayload } from '../services/clientService';

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  active:    { badge: 'bg-status-success/10 text-status-success border-status-success/20',   dot: 'bg-status-success' },
  pending:   { badge: 'bg-status-warning/10 text-status-warning border-status-warning/20',   dot: 'bg-status-warning' },
  suspended: { badge: 'bg-status-error/10 text-status-error border-status-error/20',         dot: 'bg-status-error' },
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Simple hash → pick from a palette of TW-safe colours
const AVATAR_COLORS = [
  'bg-primary/20 text-primary',
  'bg-secondary-container/20 text-secondary-container',
  'bg-status-success/20 text-status-success',
  'bg-status-warning/20 text-status-warning',
  'bg-data-latency/20 text-data-latency',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-surface-border/30 rounded animate-pulse ${className}`} />
);

// ── Onboard Modal ──────────────────────────────────────────────────────────

interface OnboardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (client: Client) => void;
}

const OnboardModal: React.FC<OnboardModalProps> = ({ open, onClose, onSuccess }) => {
  const [form, setForm] = useState<CreateClientPayload>({ name: '', email: '', description: '', website: '' });
  const [serverError, setServerError] = useState<string | null>(null);

  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: (newClient) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      onSuccess(newClient);
      setForm({ name: '', email: '', description: '', website: '' });
      setServerError(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setServerError(e?.response?.data?.message ?? e?.message ?? 'Failed to onboard client.');
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-surface-card border border-surface-border rounded-xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline-md text-headline-md text-text-primary">Onboard New Client</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {serverError && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-sm">
            <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">error</span>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="client-name">
              Organization Name <span className="text-status-error">*</span>
            </label>
            <input
              id="client-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Acme Corporation"
              className="w-full bg-surface-background border border-surface-border rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="client-email">
              Contact Email
            </label>
            <input
              id="client-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="contact@acme.com"
              className="w-full bg-surface-background border border-surface-border rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="client-website">
              Website
            </label>
            <input
              id="client-website"
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://acme.com"
              className="w-full bg-surface-background border border-surface-border rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="client-desc">
              Description
            </label>
            <textarea
              id="client-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this client organization…"
              className="w-full bg-surface-background border border-surface-border rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary bg-surface-background border border-surface-border rounded hover:bg-surface-border/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name.trim()}
              id="onboard-client-submit-btn"
              className="flex-1 px-4 py-2 text-sm font-semibold text-on-primary bg-primary rounded hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  Creating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">add_business</span>
                  Onboard Client
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

const ClientsDirectory: React.FC = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  const { data: clients = [], isLoading, isError, error } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: listClients,
  });

  // Client-side filter + sort
  const filtered = clients
    .filter((c) => statusFilter === 'all' || (c.status ?? 'active') === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

  const notFoundError = isError && (error as { response?: { status?: number } })?.response?.status === 404;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-headline-md text-headline-md text-text-primary mb-1">Clients Directory</h2>
          <p className="font-body-base text-body-base text-text-secondary">
            Manage external consumer organizations and their API access.
          </p>
        </div>
        <button
          id="open-onboard-modal-btn"
          onClick={() => setModalOpen(true)}
          className="bg-primary text-on-primary px-4 py-2 rounded-DEFAULT font-body-sm text-body-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[18px]">add_business</span>
          <span>Onboard New Client</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex items-center justify-between mb-4 bg-surface-card p-4 rounded-DEFAULT border border-surface-border">
        <div className="flex items-center gap-4">
          {/* Status filter */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">filter_list</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-surface-background border-surface-border text-text-primary rounded-DEFAULT pl-10 pr-8 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-body-sm font-body-sm cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-surface-background border-surface-border text-text-primary rounded-DEFAULT pl-4 pr-8 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-body-sm font-body-sm cursor-pointer"
            >
              <option value="newest">Sort by: Newest</option>
              <option value="name">Sort by: Name A–Z</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
          </div>
        </div>

        <div className="text-body-sm font-body-sm text-text-secondary">
          Showing <span className="text-text-primary font-medium">{filtered.length}</span> of{' '}
          <span className="text-text-primary font-medium">{clients.length}</span> clients
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
        {/* Loading */}
        {isLoading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {/* API returned 404 — list endpoint may not be wired yet */}
        {notFoundError && !isLoading && (
          <div className="p-10 flex flex-col items-center gap-3 text-text-secondary">
            <span className="material-symbols-outlined text-[40px] opacity-40">cloud_off</span>
            <p className="text-sm font-medium text-text-primary">Client list endpoint not available</p>
            <p className="text-xs text-center max-w-sm">
              The <code className="font-mono-data bg-surface-background px-1 rounded">/api/client/admin/clients</code> GET
              endpoint is not yet implemented. Onboard a client using the button above.
            </p>
          </div>
        )}

        {/* Generic error */}
        {isError && !notFoundError && !isLoading && (
          <div className="p-6 flex items-center gap-3 text-status-error text-sm">
            <span className="material-symbols-outlined">error</span>
            <span>{(error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (error as Error)?.message}</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-10 flex flex-col items-center gap-3 text-text-secondary">
            <span className="material-symbols-outlined text-[40px] opacity-40">group_off</span>
            <p className="text-sm">No clients found. Onboard your first client.</p>
          </div>
        )}

        {/* Data table */}
        {!isLoading && !isError && filtered.length > 0 && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-background/50 border-b border-surface-border">
                <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4 w-1/4">Name</th>
                <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4">Slug</th>
                <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4">Email</th>
                <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4">Created</th>
                <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4">Status</th>
                <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((client) => {
                const s = STATUS_STYLES[(client.status ?? 'active')] ?? STATUS_STYLES['active'];
                return (
                  <tr
                    key={client._id}
                    className="hover:bg-surface-background/30 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/clients/${client._id}`)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-body-sm ${avatarColor(client.name)}`}>
                          {getInitials(client.name)}
                        </div>
                        <span className="font-body-base text-body-base font-medium text-text-primary">{client.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-data text-mono-data text-text-secondary">{client.slug}</td>
                    <td className="py-3 px-4 font-body-sm text-body-sm text-text-secondary truncate max-w-[160px]">{client.email ?? '—'}</td>
                    <td className="py-3 px-4 font-body-sm text-body-sm text-text-secondary">{formatDate(client.createdAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${s.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                        <span className="capitalize">{client.status ?? 'active'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/clients/${client._id}`); }}
                        className="text-text-secondary hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1"
                        title="View details"
                      >
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Onboard Modal */}
      <OnboardModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => setModalOpen(false)}
      />
    </div>
  );
};

export default ClientsDirectory;
