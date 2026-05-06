import React from 'react';
import { useParams, Link } from 'react-router-dom';

const ClientDetails: React.FC = () => {
  const { id } = useParams();
  // We use Acme Corp as the default display matching the design
  const clientName = id === 'globex_inc' ? 'Globex Inc' : 'Acme Corp';

  return (
    <>
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 text-text-secondary font-body-sm text-body-sm mb-2">
            <Link className="hover:text-primary transition-colors" to="/clients">Organizations</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-text-primary">{clientName}</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-text-primary flex items-center gap-3">
            {clientName}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">Enterprise</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-card border border-surface-border rounded-DEFAULT p-0.5">
            <button className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary rounded">24h</button>
            <button className="px-3 py-1 text-sm bg-surface-bright text-text-primary rounded shadow-sm">7d</button>
            <button className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary rounded">30d</button>
          </div>
        </div>
      </div>

      <div className="border-b border-surface-border mb-6">
        <nav aria-label="Tabs" className="-mb-px flex space-x-8" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="border-blue-500 text-blue-500 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm bg-transparent cursor-pointer"
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className="border-transparent text-text-secondary hover:text-text-primary hover:border-surface-border whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm bg-transparent cursor-pointer"
          >
            API Keys
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className="border-transparent text-text-secondary hover:text-text-primary hover:border-surface-border whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm bg-transparent cursor-pointer"
          >
            Users
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className="border-transparent text-text-secondary hover:text-text-primary hover:border-surface-border whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm bg-transparent cursor-pointer"
          >
            Integration
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4 bg-surface-card border border-surface-border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="text-text-secondary font-body-sm text-body-sm">Total Requests</div>
            <span className="material-symbols-outlined text-text-secondary">data_usage</span>
          </div>
          <div className="font-display-lg text-display-lg mb-2">14.2M</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-status-success flex items-center"><span className="material-symbols-outlined text-sm">trending_up</span> 12.5%</span>
            <span className="text-text-secondary">vs last 7 days</span>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 bg-surface-card border border-surface-border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="text-text-secondary font-body-sm text-body-sm">Error Rate (5xx)</div>
            <span className="material-symbols-outlined text-text-secondary">error_outline</span>
          </div>
          <div className="font-display-lg text-display-lg text-status-error mb-2">0.14%</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-status-error flex items-center"><span className="material-symbols-outlined text-sm">trending_up</span> 0.02%</span>
            <span className="text-text-secondary">vs last 7 days</span>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 bg-surface-card border border-surface-border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="text-text-secondary font-body-sm text-body-sm">Avg Latency (p95)</div>
            <span className="material-symbols-outlined text-text-secondary">speed</span>
          </div>
          <div className="font-display-lg text-display-lg text-data-latency mb-2">124ms</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-status-success flex items-center"><span className="material-symbols-outlined text-sm">trending_down</span> 5ms</span>
            <span className="text-text-secondary">vs last 7 days</span>
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 bg-surface-card border border-surface-border rounded-lg p-6 min-h-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-body-base text-body-base font-semibold">Traffic Volume</h3>
            <button className="text-text-secondary hover:text-text-primary"><span className="material-symbols-outlined">more_vert</span></button>
          </div>
          <div className="flex-1 w-full bg-gradient-to-t from-surface-bright/20 to-transparent border-b border-surface-border relative rounded-DEFAULT overflow-hidden flex items-end">
            <div className="w-full h-full flex items-end justify-between px-2 gap-1 pb-px opacity-70">
              <div className="w-full bg-primary/30 h-[20%] rounded-t-sm"></div>
              <div className="w-full bg-primary/30 h-[35%] rounded-t-sm"></div>
              <div className="w-full bg-primary/40 h-[45%] rounded-t-sm"></div>
              <div className="w-full bg-primary/50 h-[30%] rounded-t-sm"></div>
              <div className="w-full bg-primary/60 h-[60%] rounded-t-sm"></div>
              <div className="w-full bg-primary/70 h-[80%] rounded-t-sm"></div>
              <div className="w-full bg-primary/80 h-[95%] rounded-t-sm"></div>
              <div className="w-full bg-primary/60 h-[70%] rounded-t-sm"></div>
              <div className="w-full bg-primary/50 h-[55%] rounded-t-sm"></div>
              <div className="w-full bg-primary/40 h-[40%] rounded-t-sm"></div>
              <div className="w-full bg-primary/30 h-[25%] rounded-t-sm"></div>
              <div className="w-full bg-primary/20 h-[15%] rounded-t-sm"></div>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 bg-surface-card border border-surface-border rounded-lg p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-body-base text-body-base font-semibold">Top Endpoints</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border text-text-secondary font-label-caps text-label-caps">
                  <th className="py-2 font-medium w-2/3">Endpoint</th>
                  <th className="py-2 font-medium text-right w-1/3">Hits</th>
                </tr>
              </thead>
              <tbody className="font-mono-data text-mono-data text-sm">
                <tr className="border-b border-surface-border/50 hover:bg-surface-bright/30 transition-colors">
                  <td className="py-3 truncate max-w-[150px]" title="/api/v1/users">/api/v1/users</td>
                  <td className="py-3 text-right text-text-secondary">4.2M</td>
                </tr>
                <tr className="border-b border-surface-border/50 hover:bg-surface-bright/30 transition-colors">
                  <td className="py-3 truncate max-w-[150px]" title="/api/v1/products">/api/v1/products</td>
                  <td className="py-3 text-right text-text-secondary">3.8M</td>
                </tr>
                <tr className="border-b border-surface-border/50 hover:bg-surface-bright/30 transition-colors">
                  <td className="py-3 truncate max-w-[150px]" title="/auth/login">/auth/login</td>
                  <td className="py-3 text-right text-text-secondary">2.1M</td>
                </tr>
                <tr className="hover:bg-surface-bright/30 transition-colors">
                  <td className="py-3 truncate max-w-[150px]" title="/api/v1/orders/recent">/api/v1/orders/re...</td>
                  <td className="py-3 text-right text-text-secondary">1.5M</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClientDetails;
