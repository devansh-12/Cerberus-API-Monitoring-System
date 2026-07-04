import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientApi } from '../api/api';
import {
    Plus, Key, Copy, CheckCircle, ChevronDown, ChevronUp,
    FolderOpen, Loader2, X, Eye, EyeOff, Server, Mail, FileText,
} from 'lucide-react';
import styles from '../styles/modules/pages/ProjectsPage.module.scss';

// ── tiny helpers ─────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy' }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button className={styles.copyBtn} onClick={handle} title="Copy">
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : label}
        </button>
    );
}

// ── Create-project modal ──────────────────────────────────────────────────────
function CreateProjectModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ name: '', email: '', description: '' });
    const [err, setErr] = useState('');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: (data) => clientApi.createClient(data),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            const client = res?.data?.client || res?.data;
            onCreated(client);
            onClose();
        },
        onError: (e) => setErr(e.response?.data?.message || e.message || 'Failed'),
    });

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>New Project</h3>
                    <button className={styles.iconBtn} onClick={onClose}><X size={18} /></button>
                </div>

                {err && <div className={styles.errorBox}>{err}</div>}

                <div className={styles.field}>
                    <label>Project Name *</label>
                    <div className={styles.inputRow}><Server size={15} />
                        <input placeholder="e.g. mern-todo-app" value={form.name}
                            onChange={set('name')} required />
                    </div>
                </div>

                <div className={styles.field}>
                    <label>Contact Email *</label>
                    <div className={styles.inputRow}><Mail size={15} />
                        <input type="email" placeholder="you@example.com" value={form.email}
                            onChange={set('email')} required />
                    </div>
                </div>

                <div className={styles.field}>
                    <label>Description <span className={styles.opt}>(optional)</span></label>
                    <div className={styles.inputRow}><FileText size={15} />
                        <input placeholder="What does this service do?" value={form.description}
                            onChange={set('description')} />
                    </div>
                </div>

                <button
                    className={styles.primaryBtn}
                    disabled={mutation.isPending || !form.name || !form.email}
                    onClick={() => mutation.mutate(form)}
                >
                    {mutation.isPending
                        ? <><Loader2 size={15} className={styles.spin} /> Creating…</>
                        : <><Plus size={15} /> Create Project</>}
                </button>
            </div>
        </div>
    );
}

// ── API-key row ───────────────────────────────────────────────────────────────
function KeyRow({ apiKey }) {
    const [show, setShow] = useState(false);
    const display = show ? apiKey.keyValue ?? '(hidden after creation)' : '••••••••••••••••••••••';
    return (
        <div className={styles.keyRow}>
            <div className={styles.keyMeta}>
                <span className={styles.keyName}>{apiKey.name || 'production'}</span>
                <span className={`${styles.badge} ${styles[apiKey.environment] || styles.production}`}>
                    {apiKey.environment || 'production'}
                </span>
                {apiKey.isActive === false && <span className={styles.badgeInactive}>inactive</span>}
            </div>
            <div className={styles.keyValue}>
                <code>{display}</code>
                <button className={styles.iconBtn} onClick={() => setShow(s => !s)} title="Toggle">
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
        </div>
    );
}

// ── Generate-key modal ────────────────────────────────────────────────────────
function GenerateKeyModal({ clientId, onClose }) {
    const [name, setName] = useState('production');
    const [newKey, setNewKey] = useState(null);
    const [err, setErr] = useState('');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: (d) => clientApi.createApiKey(clientId, d),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['apikeys', clientId] });
            const key = res?.data?.keyValue || res?.data?.key || res?.data?.rawKey;
            setNewKey(key);
        },
        onError: (e) => setErr(e.response?.data?.message || e.message || 'Failed'),
    });

    const envSnippet = newKey
        ? `CERBERUS_URL=http://localhost:5000/api/hit\nCERBERUS_API_KEY=${newKey}`
        : '';

    return (
        <div className={styles.modalOverlay} onClick={newKey ? onClose : undefined}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>{newKey ? '🎉 API Key Generated' : 'Generate API Key'}</h3>
                    <button className={styles.iconBtn} onClick={onClose}><X size={18} /></button>
                </div>

                {newKey ? (
                    <>
                        <p className={styles.hint}>
                            <strong>Copy this key now.</strong> It cannot be shown again.
                        </p>
                        <div className={styles.newKeyBox}>
                            <code className={styles.newKeyText}>{newKey}</code>
                            <CopyBtn text={newKey} />
                        </div>
                        <div className={styles.envBlock}>
                            <div className={styles.envHeader}>
                                <span>.env snippet</span>
                                <CopyBtn text={envSnippet} />
                            </div>
                            <pre>{envSnippet}</pre>
                        </div>
                        <button className={styles.primaryBtn} onClick={onClose}>Done</button>
                    </>
                ) : (
                    <>
                        {err && <div className={styles.errorBox}>{err}</div>}
                        <div className={styles.field}>
                            <label>Key Name</label>
                            <div className={styles.inputRow}>
                                <Key size={15} />
                                <input
                                    placeholder="e.g. production, staging"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            className={styles.primaryBtn}
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate({ name })}
                        >
                            {mutation.isPending
                                ? <><Loader2 size={15} className={styles.spin} /> Generating…</>
                                : <><Key size={15} /> Generate Key</>}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ client }) {
    const [expanded, setExpanded] = useState(false);
    const [showGenerate, setShowGenerate] = useState(false);

    const { data: keysData, isLoading } = useQuery({
        queryKey: ['apikeys', client._id],
        queryFn: () => clientApi.getClientApiKeys(client._id),
        enabled: expanded,
    });

    const keys = keysData?.data ?? [];

    return (
        <div className={styles.card}>
            <div className={styles.cardTop} onClick={() => setExpanded(e => !e)}>
                <div className={styles.cardInfo}>
                    <div className={styles.cardIcon}><FolderOpen size={18} /></div>
                    <div>
                        <div className={styles.cardName}>{client.name}</div>
                        <div className={styles.cardEmail}>{client.email}</div>
                    </div>
                </div>
                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => setShowGenerate(true)}
                        title="Generate API key"
                    >
                        <Key size={14} /> New Key
                    </button>
                    <button
                        className={styles.iconBtn}
                        onClick={() => setExpanded(e => !e)}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className={styles.keysList}>
                    {isLoading && <div className={styles.loading}><Loader2 size={16} className={styles.spin} /> Loading keys…</div>}
                    {!isLoading && keys.length === 0 && (
                        <p className={styles.emptyKeys}>No API keys yet. Click "New Key" to generate one.</p>
                    )}
                    {keys.map(k => <KeyRow key={k._id} apiKey={k} />)}
                </div>
            )}

            {showGenerate && (
                <GenerateKeyModal
                    clientId={client._id}
                    onClose={() => setShowGenerate(false)}
                />
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ProjectsPage() {
    const [showCreate, setShowCreate] = useState(false);
    const qc = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['clients'],
        queryFn: () => clientApi.getClients(),
    });

    const clients = data?.data ?? [];

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2>Projects</h2>
                    <p>Manage monitored applications and their API keys</p>
                </div>
                <button className={styles.primaryBtn} onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> New Project
                </button>
            </div>

            {error && <div className={styles.errorBox}>Failed to load projects: {error.message}</div>}

            {isLoading && (
                <div className={styles.loading}>
                    <Loader2 size={20} className={styles.spin} /> Loading projects…
                </div>
            )}

            {!isLoading && clients.length === 0 && (
                <div className={styles.empty}>
                    <FolderOpen size={48} />
                    <h3>No projects yet</h3>
                    <p>Create your first project to start monitoring an application.</p>
                    <button className={styles.primaryBtn} onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> Create Project
                    </button>
                </div>
            )}

            <div className={styles.cardList}>
                {clients.map(c => <ProjectCard key={c._id} client={c} />)}
            </div>

            {showCreate && (
                <CreateProjectModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => qc.invalidateQueries({ queryKey: ['clients'] })}
                />
            )}
        </div>
    );
}
