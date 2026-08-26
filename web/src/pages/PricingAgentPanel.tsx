import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Calculator, Save, ScanSearch, Boxes, Info } from 'lucide-react';

type Settings = { highMarginFlat: number; lowMarginPercentTarget: number; deliveryCostPkr: number; marketCapPercent: number; minProfitAlert: number };
type Plan = {
  id: string; name: string; sku: string; currentPrice: number; cost: number; market: number; stock: number;
  suggestedPrice: number | null; profit: number | null; capped: boolean; lowMargin: boolean;
  highValue: boolean; anchor: number | null; needsChange: boolean;
};

export function PricingAgentPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState('');
  const [edits, setEdits] = useState<Record<string, { cost: string; market: string }>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Record<string, unknown> | null>(null);

  const load = () =>
    Promise.all([
      api<Settings>('/admin/pricing-agent/settings'),
      api<Plan[]>('/admin/pricing-agent/plans'),
    ])
      .then(([st, pl]) => { setSettings(st); setPlans(pl); })
      .catch(e => setMessage(e.message));

  useEffect(() => { load(); }, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMessage(ok); load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Action failed'); }
  };

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await act(() => api('/admin/pricing-agent/settings', {
      method: 'PUT',
      body: JSON.stringify({
        highMarginFlat: Number(d.highMarginFlat),
        lowMarginPercentTarget: Number(d.lowMarginPercentTarget),
        deliveryCostPkr: Number(d.deliveryCostPkr),
        marketCapPercent: Number(d.marketCapPercent),
        minProfitAlert: Number(d.minProfitAlert),
      }),
    }), 'Pricing rules saved.');
  }

  const editKey = (id: string) => edits[id] ?? { cost: '', market: '' };

  async function saveCost(id: string) {
    const e = editKey(id);
    await act(() => api('/admin/pricing-agent/product-cost', {
      method: 'PATCH',
      body: JSON.stringify({ productId: id, costPrice: e.cost ? Number(e.cost) : null, marketPrice: e.market ? Number(e.market) : 0 }),
    }), 'Cost/market price saved. Ab scan chalayein.');
  }

  async function showBreakdown(id: string) {
    const b = await api<Record<string, unknown>>('/admin/pricing-agent/calculate', { method: 'POST', body: JSON.stringify({ productId: id }) });
    setBreakdown(b); setOpenId(openId === id ? null : id);
  }

  return (
    <main style={{ display: 'grid', gap: 26 }}>
      {message && <p className="success">{message}</p>}
      <p className="minor" style={{ marginTop: 0 }}>
        <Info size={13} /> Rules: Cost ≥ PKR 1,000 → flat PKR {settings?.highMarginFlat ?? 500} profit + delivery. Cost &lt; PKR 1,000 → {settings?.lowMarginPercentTarget ?? 30}% margin. Market rate se {settings?.marketCapPercent ?? 15}%+ upar ho to market par cap. Cap ke baad profit PKR {settings?.minProfitAlert ?? 500} se kam ho to <b>Low Margin Alert</b> — approve karne par hi live hoga. Koi bhi price bina aapki approval ke live nahi hoti.
      </p>

      {/* ---------- Settings ---------- */}
      {settings && (
        <section className="admin-table" style={{ marginTop: 0 }}>
          <h2>Pricing rules</h2>
          <form onSubmit={saveSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, maxWidth: 900 }}>
            {([['highMarginFlat', 'High-value flat profit (PKR)'], ['deliveryCostPkr', 'Delivery cost per item (PKR)'], ['lowMarginPercentTarget', 'Low-value margin % (20-35)'], ['marketCapPercent', 'Market cap tolerance %'], ['minProfitAlert', 'Min profit — is se kam = red flag (PKR)']] as const).map(([key, label]) => (
              <label key={key} className="minor">{label}
                <input type="number" name={key} defaultValue={settings[key]} style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
              </label>
            ))}
            <button className="button primary" style={{ alignSelf: 'end', justifySelf: 'start' }}><Save size={15} /> Save rules</button>
          </form>
        </section>
      )}

      {/* ---------- Scan ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <div className="rowline">
          <h2 style={{ margin: 0 }}>Product cost & market prices <Calculator size={19} /></h2>
          <button className="button primary" onClick={() => act(() => api('/admin/pricing-agent/run', { method: 'POST' }), 'Scan mukammal — drafts AI Ops → Approvals me hain.').then(() => undefined)}>
            <ScanSearch size={15} /> Run master pricing scan
          </button>
        </div>
        <p className="minor">Cost price aur market rate (Daraz/local store) likhein, phir scan chalayein — har product ke liye approval draft banega. Anchor visual ke liye market rate crossed-out dikhega.</p>
        <div className="table">
          {plans.map(pl => (
            <article key={pl.id} className="stack">
              <div className="rowline">
                <div>
                  <b>{pl.name}</b>
                  <small>{pl.sku} · current PKR {pl.currentPrice.toLocaleString()} · stock {pl.stock}</small>
                </div>
                <div className="inline">
                  <input placeholder={`Cost${pl.cost ? `: ${pl.cost}` : ''}`} value={editKey(pl.id).cost} onChange={e => setEdits(x => ({ ...x, [pl.id]: { ...editKey(pl.id), cost: e.target.value } }))} style={{ width: 110, padding: 8, border: '1px solid #cfd3da', font: 'inherit' }} />
                  <input placeholder={`Market${pl.market ? `: ${pl.market}` : ''}`} value={editKey(pl.id).market} onChange={e => setEdits(x => ({ ...x, [pl.id]: { ...editKey(pl.id), market: e.target.value } }))} style={{ width: 110, padding: 8, border: '1px solid #cfd3da', font: 'inherit' }} />
                  <button className="button ghost" onClick={() => saveCost(pl.id)}>Save cost</button>
                  <button className="text-button" onClick={() => showBreakdown(pl.id)}>Preview</button>
                </div>
              </div>
              {pl.cost > 0 && (
                <div className="inline" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <span>{pl.highValue ? 'High-value rule' : 'Low-value % rule'}</span>
                  <span>→ suggested <b>PKR {(pl.suggestedPrice ?? 0).toLocaleString()}</b></span>
                  <span>profit <b className={(pl.profit ?? 0) < (settings?.minProfitAlert ?? 500) ? 'error' : 'success'}>PKR {(pl.profit ?? 0).toLocaleString()}</b></span>
                  {pl.capped && <span className="badge pending">Market cap</span>}
                  {pl.lowMargin && <span className="badge risk">Low margin — red flag</span>}
                  {pl.needsChange ? <span className="badge pending">Draft chahiye</span> : <span className="badge active">Sahi price par</span>}
                </div>
              )}
              {openId === pl.id && breakdown && (breakdown as { productId?: string })?.productId === pl.id && (
                <pre className="minor" style={{ background: '#fff', border: '1px solid var(--line)', padding: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(breakdown, null, 1)}</pre>
              )}
            </article>
          ))}
          {!plans.length && <p className="minor">Pehle products banayein.</p>}
        </div>
      </section>

      {/* ---------- Bundles ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2><Boxes size={19} /> Smart bundle generator <small className="minor">(low-value items se 2-item combos — draft approval banta hai)</small></h2>
        <button className="button primary" onClick={() => act(() => api('/admin/pricing-agent/bundle-suggestions', { method: 'POST' }), 'Bundle drafts ready — AI Ops → Approvals me approve karein.')}>
          <Boxes size={15} /> Generate bundle suggestions
        </button>
        <p className="minor">Approve hone par combo product khud ban kar live ho jata hai (components ki list description me, stock = sab se kam component stock).</p>
      </section>
    </main>
  );
}
