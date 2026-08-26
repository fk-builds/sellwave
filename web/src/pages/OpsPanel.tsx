import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Bot, Check, X, Copy, RefreshCw, ShieldAlert, Package, Wallet, Star, Mail } from 'lucide-react';

type OpsNotif = {
  id: string; kind: 'ALERT' | 'APPROVAL'; category: string; title: string; body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL'; status: string; createdAt: string;
};
type OpsSummary = { openApprovals: number; openAlerts: number; criticalAlerts: number; flaggedOrders: number; draftPOs: number };
type OpsSettings = {
  lowStockThreshold: number; codMaxOrderValue: number; fraudCancelledLimit: number;
  fraudMinAccountHours: number; fraudScoreThreshold: number; autoHighlightPositiveReviews: boolean;
};
type PriceSuggestion = { productId: string; name: string; currentPrice: number; suggestedPrice: number; reason: string };
type LowStockItem = { id: string; name: string; sku: string; stock: number; hasVariants: boolean };
type PO = { id: string; qty: number; note?: string | null; status: string; createdAt: string; product: { name: string; sku: string } };
type Category = { id: string; name: string };

export function OpsPanel() {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [filter, setFilter] = useState<'all' | 'approvals' | 'alerts'>('all');
  const [notifs, setNotifs] = useState<OpsNotif[]>([]);
  const [settings, setSettings] = useState<OpsSettings | null>(null);
  const [pricing, setPricing] = useState<{ slow: PriceSuggestion[]; hot: PriceSuggestion[] }>({ slow: [], hot: [] });
  const [lowstock, setLowstock] = useState<LowStockItem[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [broadcast, setBroadcast] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () =>
    Promise.all([
      api<OpsSummary>('/admin/ops/summary'),
      api<{ notifications: OpsNotif[] }>(`/admin/ops/notifications?filter=${filter}`),
      api<OpsSettings>('/admin/ops/settings'),
      api<{ slow: PriceSuggestion[]; hot: PriceSuggestion[] }>('/admin/ops/pricing-suggestions'),
      api<LowStockItem[]>('/admin/ops/lowstock'),
      api<{ id: string; name: string }[]>('/admin/products'),
      api<PO[]>('/admin/ops/purchase-orders'),
      api<{ text: string }>('/admin/ops/marketing/whatsapp-broadcast'),
    ])
      .then(([s, n, st, pr, ls, prods, po, bc]) => {
        setSummary(s); setNotifs(n.notifications); setSettings(st); setPricing(pr);
        setLowstock(ls); setProducts(prods.map(p => ({ id: p.id, name: p.name }))); setPos(po); setBroadcast(bc.text);
      })
      .catch(e => setMessage(e.message));

  useEffect(() => { load(); }, [filter]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) setMessage(ok); load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Action failed'); }
  };

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await act(() => api('/admin/ops/settings', {
      method: 'PUT',
      body: JSON.stringify({
        lowStockThreshold: Number(d.lowStockThreshold),
        codMaxOrderValue: Number(d.codMaxOrderValue),
        fraudCancelledLimit: Number(d.fraudCancelledLimit),
        fraudMinAccountHours: Number(d.fraudMinAccountHours),
        fraudScoreThreshold: Number(d.fraudScoreThreshold),
        autoHighlightPositiveReviews: d.autoHighlightPositiveReviews === 'on',
      }),
    }), 'Automation settings saved.');
  }

  const draftPricing = (s: PriceSuggestion) =>
    act(() => api('/admin/ops/pricing-approval', { method: 'POST', body: JSON.stringify({ productId: s.productId, newPrice: s.suggestedPrice, reason: s.reason }) }), 'Approval draft ban gayi — feed me Approve karein.');

  return (
    <main style={{ display: 'grid', gap: 26 }}>
      {message && <p className="success">{message}</p>}

      {summary && (
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
          <div><Bot size={19} strokeWidth={1.7} /><b>{summary.openApprovals}</b><span>Pending approvals</span></div>
          <div><ShieldAlert size={19} strokeWidth={1.7} /><b>{summary.openAlerts}</b><span>Open alerts</span></div>
          <div><Star size={19} strokeWidth={1.7} /><b>{summary.criticalAlerts}</b><span>Critical</span></div>
          <div><Package size={19} strokeWidth={1.7} /><b>{summary.flaggedOrders}</b><span>Flagged orders</span></div>
          <div><Wallet size={19} strokeWidth={1.7} /><b>{summary.draftPOs}</b><span>Draft POs</span></div>
        </div>
      )}

      {/* ---------- Notifications & approvals feed ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <div className="rowline">
          <h2 style={{ margin: 0 }}>Approvals & alerts</h2>
          <div className="chips" style={{ margin: 0 }}>
            {(['all', 'approvals', 'alerts'] as const).map(f => (
              <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'approvals' ? 'Approvals' : 'Alerts'}</button>
            ))}
          </div>
        </div>
        {notifs.length ? (
          <div className="ops-feed">
            {notifs.map(n => (
              <article key={n.id} className={`ops-item ${n.status}`}>
                <div className="ops-item-head">
                  <span className={`badge ${n.severity === 'CRITICAL' ? 'risk' : n.severity === 'WARNING' ? 'pending' : 'draft'}`}>
                    {n.kind === 'APPROVAL' ? 'APPROVAL' : 'ALERT'} · {n.category}
                  </span>
                  <small>{new Date(n.createdAt).toLocaleString('en-PK')}</small>
                </div>
                <b>{n.title}</b>
                <p>{n.body}</p>
                <div className="rowline">
                  <small>status: {n.status}</small>
                  <div className="inline">
                    {n.status === 'NEW' && n.kind === 'APPROVAL' && (
                      <>
                        <button className="button primary" onClick={() => act(() => api(`/admin/ops/notifications/${n.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) }), 'Approved & executed.')}><Check size={15} /> Approve</button>
                        <button className="button ghost" onClick={() => act(() => api(`/admin/ops/notifications/${n.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'reject' }) }), 'Rejected.')}>Reject</button>
                      </>
                    )}
                    {n.status === 'NEW' && n.kind === 'ALERT' && (
                      <button className="button ghost" onClick={() => act(() => api(`/admin/ops/notifications/${n.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'read' }) }), 'Marked as read.')}>Mark read</button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="minor">Koi notification nahi — sab clear hai.</p>}
      </section>

      {/* ---------- Dynamic pricing ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2>Dynamic pricing engine <small className="minor">(drafts — aap approve karo ge tab price change hogi)</small></h2>
        {pricing.slow.length === 0 && pricing.hot.length === 0 && <p className="minor">Abhi koi suggestion nahi — sales data jama hota rahega.</p>}
        {pricing.slow.map(s => (
          <article key={s.productId} className="rowline" style={{ background: '#fff', border: '1px solid var(--line)', padding: '12px 16px', marginBottom: 8 }}>
            <div><b>{s.name}</b><small>{s.reason}</small></div>
            <div className="inline">
              <span>PKR {s.currentPrice.toLocaleString()} → <b>PKR {s.suggestedPrice.toLocaleString()}</b></span>
              <button className="button ghost" onClick={() => draftPricing(s)}>Draft approval banayein</button>
            </div>
          </article>
        ))}
        {pricing.hot.map(s => (
          <article key={s.productId} className="rowline" style={{ background: '#fff', border: '1px solid var(--line)', padding: '12px 16px', marginBottom: 8 }}>
            <div><b>{s.name}</b><small>{s.reason}</small></div>
            <div className="inline">
              <span>PKR {s.currentPrice.toLocaleString()} → <b>PKR {s.suggestedPrice.toLocaleString()}</b></span>
              <button className="button ghost" onClick={() => draftPricing(s)}>Draft approval banayein</button>
            </div>
          </article>
        ))}
      </section>

      {/* ---------- Restock / Purchase orders ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <div className="rowline">
          <h2 style={{ margin: 0 }}>Restock agent — low stock & purchase orders</h2>
          <button className="button ghost" onClick={() => act(() => api('/admin/ops/run-checks', { method: 'POST' }), 'Stock check chal gaya.')}><RefreshCw size={15} /> Run stock check</button>
        </div>
        {lowstock.length ? (
          <div className="table">
            {lowstock.map(l => (
              <article key={l.id}>
                <div><b>{l.name}</b><small>{l.sku}</small></div>
                <span className={`badge ${l.stock === 0 ? 'risk' : 'pending'}`}>{l.stock} left</span>
              </article>
            ))}
          </div>
        ) : <p className="minor">Sab products ka stock theek hai.</p>}

        <form className="inline" style={{ margin: '14px 0' }} onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          act(() => api('/admin/ops/purchase-orders', { method: 'POST', body: JSON.stringify({ productId: d.productId, qty: Number(d.qty), note: d.note || undefined }) }), 'Purchase order draft saved.');
          e.currentTarget.reset();
        }}>
          <select required name="productId" defaultValue="">
            <option value="" disabled>Product</option>
            {products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
          <input required type="number" min="1" name="qty" placeholder="Qty" style={{ width: 90 }} />
          <input name="note" placeholder="Supplier / note (optional)" />
          <button className="button primary">Create PO draft</button>
        </form>

        {pos.length ? (
          <div className="table">
            {pos.map(po => (
              <article key={po.id}>
                <div><b>{po.product.name} × {po.qty}</b><small>{po.product.sku}{po.note ? ` · ${po.note}` : ''}</small></div>
                <span className={`badge ${po.status === 'RECEIVED' ? 'active' : po.status === 'ORDERED' ? 'pending' : po.status === 'CANCELLED' ? 'draft' : 'draft'}`}>{po.status}</span>
                {po.status === 'DRAFT' && <button className="button ghost" onClick={() => act(() => api(`/admin/ops/purchase-orders/${po.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'order' }) }), 'PO ordered — supplier ko bhejein.')}>Mark ordered</button>}
                {po.status === 'ORDERED' && <button className="button primary" onClick={() => act(() => api(`/admin/ops/purchase-orders/${po.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'receive' }) }), 'Stock received — inventory update ho gayi.')}>Mark received (+stock)</button>}
                {(po.status === 'DRAFT' || po.status === 'ORDERED') && (
                  <button className="text-button" onClick={() => act(() => api(`/admin/ops/purchase-orders/${po.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'cancel' }) }), 'PO cancelled.')}>Cancel</button>
                )}
              </article>
            ))}
          </div>
        ) : <p className="minor">Koi purchase order nahi.</p>}
      </section>

      {/* ---------- Marketing draft ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2>Marketing assistant <small className="minor">(WhatsApp broadcast draft — copy karke apne customers/groups par bhejein)</small></h2>
        <textarea readOnly value={broadcast} rows={9} style={{ width: '100%', maxWidth: 620, font: 'inherit', padding: 14, border: '1px solid #cfd3da', resize: 'vertical' }} />
        <div className="inline" style={{ marginTop: 10 }}>
          <button className="button primary" onClick={() => { navigator.clipboard.writeText(broadcast); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy message'}
          </button>
          <span className="minor"><Mail size={12} /> Email campaigns domain verify hone ke baad activate hongi</span>
        </div>
      </section>

      {/* ---------- Automation settings ---------- */}
      {settings && (
        <section className="admin-table" style={{ marginTop: 0 }}>
          <h2>Automation settings</h2>
          <form onSubmit={saveSettings} className="admin-forms" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', gap: 12, maxWidth: 760 }}>
            <label className="minor">Low stock threshold (units)
              <input type="number" min="0" name="lowStockThreshold" defaultValue={settings.lowStockThreshold} style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
            <label className="minor">COD max order value (PKR) — is se bara COD = risk flag
              <input type="number" min="0" name="codMaxOrderValue" defaultValue={settings.codMaxOrderValue} style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
            <label className="minor">Fraud: cancelled orders limit
              <input type="number" min="0" name="fraudCancelledLimit" defaultValue={settings.fraudCancelledLimit} style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
            <label className="minor">Fraud: new account hours
              <input type="number" min="0" name="fraudMinAccountHours" defaultValue={settings.fraudMinAccountHours} style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
            <label className="minor">Fraud score threshold (flag is se upar)
              <input type="number" min="1" name="fraudScoreThreshold" defaultValue={settings.fraudScoreThreshold} style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
            <label className="minor" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 22 }}>
              <input type="checkbox" name="autoHighlightPositiveReviews" defaultChecked={settings.autoHighlightPositiveReviews} />
              Positive reviews ko highlight karein
            </label>
            <button className="button primary" style={{ justifySelf: 'start' }}>Save automation settings</button>
          </form>
        </section>
      )}
    </main>
  );
}
