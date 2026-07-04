import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Activity, User, Lock, Mail, Server, Key, CheckCircle, Copy, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import styles from '../styles/modules/Setup.module.scss';

const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL ?? '/api';

const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

// ── Step indicators ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Create Account', icon: User },
  { id: 2, label: 'Add Project',    icon: Server },
  { id: 3, label: 'Get API Key',    icon: Key },
];

// ── Copy-to-clipboard helper ─────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Step 1: SuperAdmin Registration ─────────────────────────────────────────
function Step1({ onComplete }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => api.post('/auth/onboard-super-admin', data),
    onSuccess: async (res, vars) => {
      // Server returns HTTP 200 even for business-logic errors — check body
      const isError = res.data?.success === false ||
        (res.data?.statusCode && res.data.statusCode >= 400);

      if (isError) {
        const msg = res.data?.message || '';
        // Super admin already exists — just try to log in directly
        if (msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('already')) {
          try {
            const lr = await api.post('/auth/login', { username: vars.username, password: vars.password });
            if (lr.data?.success === false || (lr.data?.statusCode && lr.data.statusCode >= 401)) {
              setError('A Super Admin already exists. Use the Login page to sign in.');
              return;
            }
            onComplete({ username: vars.username });
          } catch {
            setError('A Super Admin already exists. Please use the Login page instead.');
          }
        } else {
          setError(msg || 'Failed to create account');
        }
        return;
      }

      // New super admin created — auto-login
      try {
        await api.post('/auth/login', { username: vars.username, password: vars.password });
        onComplete({ username: vars.username });
      } catch {
        setError('Account created but auto-login failed. Please use the Login page.');
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to create account';
      setError(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    mutation.mutate({ username: form.username, email: form.email, password: form.password });
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className={styles.stepForm}>
      <p className={styles.stepDescription}>
        You're setting up Cerberus for the first time. Create your Super Admin account to manage all monitored projects.
      </p>
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.inputGroup}>
        <label className={styles.label}>Username</label>
        <div className={styles.inputContainer}>
          <User size={16} />
          <input className={styles.input} type="text" placeholder="e.g. devansh" value={form.username} onChange={set('username')} required disabled={mutation.isPending} />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Email</label>
        <div className={styles.inputContainer}>
          <Mail size={16} />
          <input className={styles.input} type="email" placeholder="admin@yourcompany.com" value={form.email} onChange={set('email')} required disabled={mutation.isPending} />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Password</label>
        <div className={styles.inputContainer}>
          <Lock size={16} />
          <input className={styles.input} type="password" placeholder="Min 8 chars, uppercase + special" value={form.password} onChange={set('password')} required disabled={mutation.isPending} />
        </div>
        <p style={{fontSize:'11px', color:'var(--text-muted, #888)', marginTop:'4px', paddingLeft:'4px'}}>
          Must include uppercase, lowercase, number &amp; special character (e.g. <code>MyPass@123</code>)
        </p>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Confirm Password</label>
        <div className={styles.inputContainer}>
          <Lock size={16} />
          <input className={styles.input} type="password" placeholder="Repeat your password" value={form.confirm} onChange={set('confirm')} required disabled={mutation.isPending} />
        </div>
      </div>

      <button type="submit" className={styles.primaryBtn} disabled={mutation.isPending}>
        {mutation.isPending ? <><Loader2 size={16} className={styles.spin} /> Creating account…</> : <> Create Account <ChevronRight size={16} /></>}
      </button>
    </form>
  );
}

// ── Step 2: Create Client (Project) ─────────────────────────────────────────
function Step2({ onComplete }) {
  const [form, setForm] = useState({ name: '', email: '', description: '', website: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => api.post('/client/admin/clients/onboard', data),
    onSuccess: (res) => onComplete({ clientId: res.data?.data?.client?._id || res.data?.data?._id }),
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to create project';
      setError(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ name: form.name, email: form.email, description: form.description, website: form.website });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.stepForm}>
      <p className={styles.stepDescription}>
        A <strong>Project</strong> (Client) groups all API hits from one of your services. Give it a name that matches the app you want to monitor.
      </p>
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.inputGroup}>
        <label className={styles.label}>Project Name</label>
        <div className={styles.inputContainer}>
          <Server size={16} />
          <input className={styles.input} type="text" placeholder="e.g. My Todo App" value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} required disabled={mutation.isPending} />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Contact Email</label>
        <div className={styles.inputContainer}>
          <Mail size={16} />
          <input className={styles.input} type="email" placeholder="contact@yourapp.com" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} required disabled={mutation.isPending} />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Description <span className={styles.optional}>(optional)</span></label>
        <div className={styles.inputContainer}>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            placeholder="What does this service do?"
            value={form.description}
            onChange={(e) => setForm(f => ({...f, description: e.target.value}))}
            disabled={mutation.isPending}
            rows={2}
          />
        </div>
      </div>

      <button type="submit" className={styles.primaryBtn} disabled={mutation.isPending}>
        {mutation.isPending ? <><Loader2 size={16} className={styles.spin} /> Creating project…</> : <> Create Project <ChevronRight size={16} /></>}
      </button>
    </form>
  );
}

// ── Step 3: Generate API Key ─────────────────────────────────────────────────
function Step3({ clientId, onFinish }) {
  const [keyName, setKeyName] = useState('production');
  const [apiKey, setApiKey] = useState(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/client/admin/clients/${clientId}/api/keys`, data),
    onSuccess: (res) => {
      // The raw key is only returned once on creation
      const key = res.data?.data?.key || res.data?.data?.apiKey || res.data?.data?.rawKey;
      setApiKey(key);
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to generate API key'),
  });

  const envSnippet = apiKey
    ? `CERBERUS_URL=http://localhost:3000/api/hit\nCERBERUS_API_KEY=${apiKey}`
    : '';

  if (apiKey) {
    return (
      <div className={styles.stepForm}>
        <div className={styles.successBanner}>
          <CheckCircle size={20} />
          <span>API Key generated successfully!</span>
        </div>
        <p className={styles.stepDescription}>
          <strong>Copy this key now.</strong> It is hashed on the server and cannot be shown again.
        </p>

        <div className={styles.keyBlock}>
          <code className={styles.keyText}>{apiKey}</code>
          <CopyButton text={apiKey} />
        </div>

        <div className={styles.envBlock}>
          <div className={styles.envBlockHeader}>
            <span>.env snippet for your project</span>
            <CopyButton text={envSnippet} />
          </div>
          <pre className={styles.envCode}>{envSnippet}</pre>
        </div>

        <div className={styles.sdkBlock}>
          <p className={styles.envBlockHeader}><span>Install the Express SDK</span></p>
          <pre className={styles.envCode}>{`npm install @devanshwastaken/cerberus-express`}</pre>
          <pre className={styles.envCode}>{`// app.js — add before your routes\nconst cerberus = require('@devanshwastaken/cerberus-express').default;\napp.use(cerberus());`}</pre>
        </div>

        <button className={styles.primaryBtn} onClick={onFinish}>
          Go to Dashboard <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name: keyName }); }} className={styles.stepForm}>
      <p className={styles.stepDescription}>
        Generate a secret API key that your application will use to send hits to Cerberus. You can create multiple keys per project.
      </p>
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.inputGroup}>
        <label className={styles.label}>Key Name</label>
        <div className={styles.inputContainer}>
          <Key size={16} />
          <input className={styles.input} type="text" placeholder="e.g. production, staging" value={keyName} onChange={(e) => setKeyName(e.target.value)} required disabled={mutation.isPending} />
        </div>
      </div>

      <button type="submit" className={styles.primaryBtn} disabled={mutation.isPending}>
        {mutation.isPending ? <><Loader2 size={16} className={styles.spin} /> Generating…</> : <> Generate API Key <ChevronRight size={16} /></>}
      </button>
    </form>
  );
}

// ── Main Setup Wizard ────────────────────────────────────────────────────────
function Setup({ onSetupComplete, onBackToLogin }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [stepData, setStepData] = useState({});

  const handleStep1Complete = (data) => {
    setStepData(d => ({ ...d, ...data }));
    setCurrentStep(2);
  };

  const handleStep2Complete = (data) => {
    setStepData(d => ({ ...d, ...data }));
    setCurrentStep(3);
  };

  return (
    <div className={styles.container}>
      <div className={styles.backgroundElements}>
        <div className={`${styles.backgroundOrb} ${styles.orb1}`} />
        <div className={`${styles.backgroundOrb} ${styles.orb2}`} />
        <div className={`${styles.backgroundOrb} ${styles.orb3}`} />
      </div>

      <div className={styles.setupCard}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.logoContainer}><Activity /></div>
          <h1 className={styles.title}>Welcome to Cerberus</h1>
          <p className={styles.subtitle}>Let's get you set up in 3 steps</p>
        </div>

        {/* Step Progress */}
        <div className={styles.stepProgress}>
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const status = currentStep > step.id ? 'done' : currentStep === step.id ? 'active' : 'pending';
            return (
              <div key={step.id} className={styles.stepItem}>
                <div className={`${styles.stepDot} ${styles[status]}`}>
                  {status === 'done' ? <CheckCircle size={14} /> : <Icon size={14} />}
                </div>
                <span className={`${styles.stepLabel} ${styles[status]}`}>{step.label}</span>
                {idx < STEPS.length - 1 && <div className={`${styles.stepConnector} ${currentStep > step.id ? styles.connectorDone : ''}`} />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className={styles.cardContent}>
          <h2 className={styles.stepTitle}>{STEPS[currentStep - 1].label}</h2>
          {currentStep === 1 && <Step1 onComplete={handleStep1Complete} />}
          {currentStep === 2 && <Step2 onComplete={handleStep2Complete} />}
          {currentStep === 3 && <Step3 clientId={stepData.clientId} onFinish={onSetupComplete} />}
        </div>

        {/* Back to login */}
        {currentStep === 1 && (
          <button className={styles.backLink} onClick={onBackToLogin}>
            <ArrowLeft size={14} /> Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
}

export default Setup;
