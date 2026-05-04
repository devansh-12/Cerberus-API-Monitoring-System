import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display-lg text-display-lg text-text-primary">Dashboard</h2>
          <p className="text-text-secondary mt-1 font-body-sm text-body-sm">Overview of API performance and security metrics.</p>
        </div>
        <div className="flex items-center bg-surface-card border border-surface-border rounded-lg p-1">
          <button className="px-3 py-1.5 text-sm font-medium rounded-md text-text-primary bg-surface-background shadow-sm border border-surface-border">24h</button>
          <button className="px-3 py-1.5 text-sm font-medium rounded-md text-text-secondary hover:text-text-primary transition-colors">7d</button>
          <button className="px-3 py-1.5 text-sm font-medium rounded-md text-text-secondary hover:text-text-primary transition-colors">30d</button>
          <div className="w-px h-4 bg-surface-border mx-1"></div>
          <button className="px-2 py-1.5 text-text-secondary hover:text-text-primary transition-colors flex items-center">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-8">
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Total Hits</h3>
            <span className="material-symbols-outlined text-primary-fixed text-[20px]">data_usage</span>
          </div>
          <div>
            <div className="font-display-lg text-[36px] font-bold text-text-primary leading-none tracking-tight">24.8M</div>
            <div className="flex items-center gap-1 mt-2 text-status-success font-mono-data text-mono-data text-xs">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>+12.5%</span>
              <span className="text-text-secondary font-body-sm text-[11px] ml-1">vs last 24h</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Avg Latency</h3>
            <span className="material-symbols-outlined text-data-latency text-[20px]">speed</span>
          </div>
          <div>
            <div className="font-display-lg text-[36px] font-bold text-text-primary leading-none tracking-tight flex items-baseline gap-1">
              42<span className="text-lg font-medium text-text-secondary">ms</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-status-warning font-mono-data text-mono-data text-xs">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>+2.1%</span>
              <span className="text-text-secondary font-body-sm text-[11px] ml-1">vs last 24h</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Error Rate</h3>
            <span className="material-symbols-outlined text-status-error text-[20px]">error_outline</span>
          </div>
          <div>
            <div className="font-display-lg text-[36px] font-bold text-status-error leading-none tracking-tight flex items-baseline gap-1">
              0.12<span className="text-lg font-medium">%</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-status-success font-mono-data text-mono-data text-xs">
              <span className="material-symbols-outlined text-[14px]">trending_down</span>
              <span>-0.05%</span>
              <span className="text-text-secondary font-body-sm text-[11px] ml-1">vs last 24h</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between group hover:border-outline-variant transition-colors relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-status-success/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-text-secondary font-label-caps text-label-caps uppercase tracking-wider">Success Rate</h3>
            <span className="material-symbols-outlined text-status-success text-[20px]">check_circle</span>
          </div>
          <div className="relative z-10">
            <div className="font-display-lg text-[36px] font-bold text-text-primary leading-none tracking-tight flex items-baseline gap-1">
              99.88<span className="text-lg font-medium text-text-secondary">%</span>
            </div>
            <div className="w-full bg-surface-background h-1.5 rounded-full mt-3 overflow-hidden border border-surface-border">
              <div className="bg-status-success h-full rounded-full w-[99.88%]"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mb-8">
        <div className="lg:col-span-2 bg-surface-card border border-surface-border rounded-xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-[18px] text-text-primary">Traffic Over Time</h3>
            <button className="text-text-secondary hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
          </div>
          <div className="flex-1 min-h-[280px] w-full relative flex items-end pt-8 pb-6 border-l border-b border-surface-border px-2">
            <div className="absolute left-[-40px] top-0 h-full flex flex-col justify-between text-xs text-text-secondary font-mono-data">
              <span>2.0M</span>
              <span>1.5M</span>
              <span>1.0M</span>
              <span>0.5M</span>
              <span className="relative top-4">0</span>
            </div>
            <div className="absolute bottom-[-24px] left-0 w-full flex justify-between text-xs text-text-secondary font-mono-data px-4">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-between pointer-events-none pb-6">
              <div className="w-full border-b border-surface-border border-dashed opacity-50"></div>
              <div className="w-full border-b border-surface-border border-dashed opacity-50"></div>
              <div className="w-full border-b border-surface-border border-dashed opacity-50"></div>
              <div className="w-full border-b border-surface-border border-dashed opacity-50"></div>
            </div>
            <svg className="absolute top-0 left-0 w-full h-[calc(100%-24px)]" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#adc6ff" stopOpacity="0.3"></stop>
                  <stop offset="100%" stopColor="#adc6ff" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
              <path d="M0,80 Q10,70 20,75 T40,60 T60,85 T80,40 T100,20 L100,100 L0,100 Z" fill="url(#chartGradient)"></path>
              <path d="M0,80 Q10,70 20,75 T40,60 T60,85 T80,40 T100,20" fill="none" stroke="#adc6ff" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
            </svg>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-6 flex flex-col">
          <h3 className="font-headline-md text-[18px] text-text-primary mb-6">System Health</h3>
          <div className="flex-1 flex flex-col gap-4">
            <div className="p-3 rounded-lg border border-surface-border bg-surface-background flex items-start gap-3">
              <div className="mt-0.5"><span className="material-symbols-outlined text-status-warning text-[18px]">warning</span></div>
              <div>
                <h4 className="text-sm font-medium text-text-primary">Latency Spike Detected</h4>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">Endpoint /api/v2/users experienced a 300ms delay spike for 4 minutes.</p>
                <span className="text-[10px] text-text-secondary font-mono-data mt-2 block">12 mins ago</span>
              </div>
            </div>
            <div className="p-3 rounded-lg border border-surface-border bg-surface-background flex items-start gap-3">
              <div className="mt-0.5"><span className="material-symbols-outlined text-status-error text-[18px]">error</span></div>
              <div>
                <h4 className="text-sm font-medium text-text-primary">Rate Limit Exceeded</h4>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">Client 'Initech' hit global rate limit across 3 distinct API keys.</p>
                <span className="text-[10px] text-text-secondary font-mono-data mt-2 block">1 hr ago</span>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-surface-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-label-caps text-text-secondary uppercase">Quick Diagnostic cURL</span>
                <button className="text-text-secondary hover:text-white transition-colors" title="Copy to clipboard">
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </button>
              </div>
              <div className="bg-surface-background border border-surface-border rounded p-2 overflow-x-auto">
                <code className="font-mono-data text-[11px] text-primary whitespace-nowrap">curl -I -X GET "https://api.cerberus.io/v1/health"</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden flex flex-col mb-8">
        <div className="p-5 border-b border-surface-border flex justify-between items-center bg-surface-card">
          <h3 className="font-headline-md text-[18px] text-text-primary">Top Endpoints</h3>
          <button className="text-sm text-primary hover:text-primary-fixed transition-colors font-medium flex items-center gap-1">
            View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-background/50 border-b border-surface-border text-xs uppercase font-label-caps text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-semibold" scope="col">Method</th>
                <th className="px-5 py-3 font-semibold w-1/2" scope="col">Path</th>
                <th className="px-5 py-3 font-semibold text-right" scope="col">Hits</th>
                <th className="px-5 py-3 font-semibold text-right" scope="col">Avg Latency</th>
                <th className="px-5 py-3 font-semibold text-right" scope="col">Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              <tr className="hover:bg-surface-background/40 transition-colors group">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-data font-bold bg-primary-container/20 text-primary border border-primary-container/30">GET</span>
                </td>
                <td className="px-5 py-3 font-mono-data text-text-primary truncate max-w-[200px]" title="/v1/users/profile">/v1/users/profile</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-primary">8.2M</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-secondary">24ms</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono-data text-status-success">0.01%</span>
                    <div className="w-16 h-1 bg-surface-background rounded-full overflow-hidden">
                      <div className="bg-status-success h-full w-[2%]"></div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-surface-background/40 transition-colors group">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-data font-bold bg-status-success/20 text-status-success border border-status-success/30">POST</span>
                </td>
                <td className="px-5 py-3 font-mono-data text-text-primary truncate max-w-[200px]" title="/v2/transactions/create">/v2/transactions/create</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-primary">4.1M</td>
                <td className="px-5 py-3 text-right font-mono-data text-data-latency">142ms</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono-data text-status-warning">0.8%</span>
                    <div className="w-16 h-1 bg-surface-background rounded-full overflow-hidden">
                      <div className="bg-status-warning h-full w-[15%]"></div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-surface-background/40 transition-colors group">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-data font-bold bg-primary-container/20 text-primary border border-primary-container/30">GET</span>
                </td>
                <td className="px-5 py-3 font-mono-data text-text-primary truncate max-w-[200px]" title="/v1/catalog/items">/v1/catalog/items</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-primary">3.9M</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-secondary">45ms</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono-data text-status-success">0.05%</span>
                    <div className="w-16 h-1 bg-surface-background rounded-full overflow-hidden">
                      <div className="bg-status-success h-full w-[5%]"></div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-surface-background/40 transition-colors group">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-data font-bold bg-status-warning/20 text-status-warning border border-status-warning/30">PUT</span>
                </td>
                <td className="px-5 py-3 font-mono-data text-text-primary truncate max-w-[200px]" title="/v1/inventory/update">/v1/inventory/update</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-primary">1.2M</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-secondary">88ms</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono-data text-status-error">4.2%</span>
                    <div className="w-16 h-1 bg-surface-background rounded-full overflow-hidden">
                      <div className="bg-status-error h-full w-[42%]"></div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-surface-background/40 transition-colors group">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-data font-bold bg-status-error/20 text-status-error border border-status-error/30">DELETE</span>
                </td>
                <td className="px-5 py-3 font-mono-data text-text-primary truncate max-w-[200px]" title="/v1/users/{id}">/v1/users/&#123;id&#125;</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-primary">850K</td>
                <td className="px-5 py-3 text-right font-mono-data text-text-secondary">62ms</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono-data text-status-success">0.1%</span>
                    <div className="w-16 h-1 bg-surface-background rounded-full overflow-hidden">
                      <div className="bg-status-success h-full w-[10%]"></div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
