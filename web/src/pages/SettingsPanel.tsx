import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Save, Image as ImageIcon } from 'lucide-react';
import { UploadField } from '../components/UploadField';

type Bank = { accountTitle?: string; bankName?: string; accountNumber?: string; iban?: string; raastNumber?: string; instructions?: string };
type Slide = { image: string; eyebrow: string; title1: string; title2: string; copy: string; cta: string; link: string; active: boolean };
type Courier = { provider?: string; enabled?: boolean; environment?: string; apiUrl?: string; apiKey?: string; apiSecret?: string; clientId?: string; clientSecret?: string; accountCode?: string; pickupCity?: string; defaultCharges?: number; notes?: string };
type Gateway = { enabled?: boolean; environment?: string; merchantId?: string; password?: string; integritySalt?: string; storeId?: string; hashKey?: string; returnUrl?: string };
type StoreSettings = {
  bank?: Bank; freeDeliveryHeadline?: string; supportWhatsapp?: string; supportEmail?: string;
  headlines?: string[]; slides?: Slide[];
  courier?: Courier; payments?: { jazzcash?: Gateway; easypaisa?: Gateway };
};

const EMPTY_SLIDE: Slide = { image: '/banners/deals.jpg', eyebrow: 'NEW BANNER', title1: 'Your headline here', title2: 'italic line', copy: 'Short banner text for customers.', cta: 'Shop now', link: '/shop', active: true };

export function SettingsPanel() {
  const [data, setData] = useState<StoreSettings | null>(null);
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [contact, setContact] = useState({ supportWhatsapp: '', supportEmail: '' });
  const [courier, setCourier] = useState<Courier>({ provider: '', enabled: false, environment: 'sandbox' });
  const [jc, setJc] = useState<Gateway>({ enabled: false, environment: 'sandbox' });
  const [ep, setEp] = useState<Gateway>({ enabled: false, environment: 'sandbox' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<StoreSettings>('/admin/settings').then(d => {
      setData(d);
      setHeadlines(Array.isArray(d.headlines) ? d.headlines : []);
      setSlides(Array.isArray(d.slides) && d.slides.length ? d.slides : []);
      setContact({ supportWhatsapp: d.supportWhatsapp || '', supportEmail: d.supportEmail || '' });
      setCourier(d.courier ?? { provider: '', enabled: false, environment: 'sandbox', apiUrl: '', apiKey: '', apiSecret: '', clientId: '', clientSecret: '', accountCode: '', pickupCity: '', notes: '' });
      setJc(d.payments?.jazzcash ?? { enabled: false, environment: 'sandbox', merchantId: '', password: '', integritySalt: '' });
      setEp(d.payments?.easypaisa ?? { enabled: false, environment: 'sandbox', storeId: '', hashKey: '' });
    }).catch(e => setMessage(e.message));
  }, []);

  const save = async (patch: Record<string, unknown>, ok: string) => {
    try { await api('/admin/settings', { method: 'PATCH', body: JSON.stringify(patch) }); setMessage(ok); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed'); }
  };

  if (!data) return <p className="minor">Loading settings…</p>;

  return (
    <main style={{ display: 'grid', gap: 26 }}>
      {message && <p className="success">{message}</p>}

      {/* ---------- Topbar headlines ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2>Topbar headlines <small className="minor">(1 se zyada hon to khud-ba-khud slideshow ban jata hai — 5 second har line)</small></h2>
        {headlines.map((h, i) => (
          <div className="inline" key={i} style={{ marginBottom: 8 }}>
            <input value={h} onChange={e => setHeadlines(arr => arr.map((x, j) => (j === i ? e.target.value : x)))} style={{ flex: 1, maxWidth: 620, padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            <button className="text-button" onClick={() => setHeadlines(arr => arr.filter((_, j) => j !== i))}><Trash2 size={14} /> Remove</button>
          </div>
        ))}
        <div className="inline" style={{ marginTop: 6 }}>
          <button className="button ghost" disabled={headlines.length >= 10} onClick={() => setHeadlines(arr => [...arr, 'Nayi headline — Pakistan-wide delivery · COD available'])}><Plus size={15} /> Add headline</button>
          <button className="button primary" onClick={() => save({ headlines }, 'Headlines saved — topbar live update.')}><Save size={15} /> Save headlines ({headlines.length})</button>
        </div>
      </section>

      {/* ---------- Homepage banners ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2><ImageIcon size={19} /> Homepage banners <small className="minor">(add / edit / remove — order stays as listed)</small></h2>
        {slides.map((s, i) => (
          <article key={i} style={{ background: '#fff', border: '1px solid var(--line)', padding: 16, marginBottom: 12, display: 'grid', gap: 10 }}>
            <div className="rowline">
              <b style={{ fontSize: 13 }}>Banner {i + 1} {s.active ? '' : '(hidden)'}</b>
              <div className="inline">
                <label className="minor" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={s.active} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} /> Active
                </label>
                <button className="text-button" onClick={() => setSlides(arr => arr.filter((_, j) => j !== i))}><Trash2 size={14} /> Remove banner</button>
              </div>
            </div>
            <div className="inline">
              <UploadField label="Upload banner image" onUploaded={(url) => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, image: url } : x)))} />
              {s.image && <img src={s.image} alt="" style={{ width: 60, height: 30, objectFit: 'cover' }} />}
            </div>
            <div className="split">
              <input value={s.image} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)))} placeholder="Banner image URL (/banners/... or https://...)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
              <input value={s.eyebrow} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, eyebrow: e.target.value } : x)))} placeholder="Eyebrow (small top line)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </div>
            <div className="split">
              <input value={s.title1} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, title1: e.target.value } : x)))} placeholder="Headline (normal)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
              <input value={s.title2} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, title2: e.target.value } : x)))} placeholder="Headline (italic part)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </div>
            <textarea value={s.copy} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, copy: e.target.value } : x)))} placeholder="Banner text (1-2 lines)" rows={2} style={{ font: 'inherit', padding: 10, border: '1px solid #cfd3da', resize: 'vertical' }} />
            <div className="split">
              <input value={s.cta} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, cta: e.target.value } : x)))} placeholder="Button text" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
              <input value={s.link} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)))} placeholder="Button link (/shop)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </div>
          </article>
        ))}
        <div className="inline" style={{ marginTop: 6 }}>
          <button className="button ghost" disabled={slides.length >= 12} onClick={() => setSlides(arr => [...arr, { ...EMPTY_SLIDE }])}><Plus size={15} /> Add banner</button>
          <button className="button primary" onClick={() => save({ slides }, 'Banners saved — homepage live update.')}><Save size={15} /> Save banners ({slides.length})</button>
        </div>
      </section>

      {/* ---------- Store contact ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2>Store contact <small className="minor">(WhatsApp float button, Support page, footer — updates everywhere)</small></h2>
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; save({ supportWhatsapp: d.supportWhatsapp.replace(/[^0-9]/g, ''), supportEmail: d.supportEmail }, 'Contact details saved.'); }}>
          <div className="split" style={{ maxWidth: 620 }}>
            <label className="minor">WhatsApp number (03XXXXXXXXX)
              <input required name="supportWhatsapp" defaultValue={contact.supportWhatsapp} placeholder="03119579613" style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
            <label className="minor">Support email
              <input required type="email" name="supportEmail" defaultValue={contact.supportEmail} placeholder="sellwave04@gmail.com" style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
          </div>
          <button className="button primary" style={{ marginTop: 12 }}><Save size={15} /> Save contact</button>
        </form>
      </section>

      {/* ---------- Courier integration ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2>Courier integration <small className="minor">(create your courier account later — then paste the API details here yourself)</small></h2>
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; save({ courier: { provider: d.provider, enabled: d.enabled === 'on', environment: d.environment, apiUrl: d.apiUrl, apiKey: d.apiKey, apiSecret: d.apiSecret, clientId: d.clientId, clientSecret: d.clientSecret, accountCode: d.accountCode, pickupCity: d.pickupCity, defaultCharges: d.defaultCharges ? Number(d.defaultCharges) : undefined, notes: d.notes } }, 'Courier settings saved.'); }}>
          <div className="split" style={{ maxWidth: 720 }}>
            <label className="minor">Courier (TCS / Leopard / M&P / PostEx…)
              <input name="provider" defaultValue={courier.provider} placeholder="e.g. Leopard" style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            </label>
            <label className="minor">Mode
              <select name="environment" defaultValue={courier.environment || 'sandbox'} style={{ width: '100%', padding: 10, border: '1px solid #cfd3da', font: 'inherit' }}>
                <option value="sandbox">Sandbox / Test</option>
                <option value="production">Production / Live</option>
              </select>
            </label>
          </div>
          <input name="apiUrl" defaultValue={courier.apiUrl} placeholder="API base URL" style={{ width: '100%', maxWidth: 720, marginTop: 10, padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
          <div className="split" style={{ maxWidth: 720, marginTop: 10 }}>
            <input name="apiKey" defaultValue={courier.apiKey} placeholder="API Key" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            <input name="apiSecret" defaultValue={courier.apiSecret} placeholder="API Secret" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
          </div>
          <div className="split" style={{ maxWidth: 720, marginTop: 10 }}>
            <input name="clientId" defaultValue={courier.clientId} placeholder="Client ID (if asked)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            <input name="clientSecret" defaultValue={courier.clientSecret} placeholder="Client Secret (if asked)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
          </div>
          <div className="split" style={{ maxWidth: 720, marginTop: 10 }}>
            <input name="accountCode" defaultValue={courier.accountCode} placeholder="Account code (courier account #)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            <input name="pickupCity" defaultValue={courier.pickupCity} placeholder="Pickup city" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
          </div>
          <label className="minor" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <input type="checkbox" name="enabled" defaultChecked={courier.enabled} /> Enable courier integration
          </label>
          <textarea name="notes" defaultValue={courier.notes} placeholder="Notes (booking process, contact person, etc.)" rows={2} style={{ width: '100%', maxWidth: 720, marginTop: 10, padding: 10, border: '1px solid #cfd3da', font: 'inherit', resize: 'vertical' }} />
          <button className="button primary" style={{ marginTop: 12 }}><Save size={15} /> Save courier settings</button>
        </form>
      </section>

      {/* ---------- Payment gateways ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2>Payment gateways <small className="minor">(COD is primary — paste merchant details when your accounts are ready)</small></h2>
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; save({ payments: { jazzcash: { enabled: d.jc_enabled === 'on', environment: d.jc_env, merchantId: d.jc_merchant, password: d.jc_password, integritySalt: d.jc_salt, returnUrl: d.jc_return }, easypaisa: { enabled: d.ep_enabled === 'on', environment: d.ep_env, storeId: d.ep_store, hashKey: d.ep_hash, returnUrl: d.ep_return } } }, 'Payment gateway settings saved.'); }}>
          <div className="split" style={{ maxWidth: 720 }}>
            <div style={{ background: '#fff', border: '1px solid var(--line)', padding: 16 }}>
              <b style={{ fontSize: 14 }}>JazzCash</b>
              <label className="minor" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                <input type="checkbox" name="jc_enabled" defaultChecked={jc.enabled} /> Enabled
              </label>
              <select name="jc_env" defaultValue={jc.environment || 'sandbox'} style={{ width: '100%', padding: 9, border: '1px solid #cfd3da', font: 'inherit', marginBottom: 8 }}>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
              <input name="jc_merchant" defaultValue={jc.merchantId} placeholder="Merchant ID" style={{ width: '100%', padding: 9, border: '1px solid #cfd3da', font: 'inherit', marginBottom: 8 }} />
              <input name="jc_password" defaultValue={jc.password} placeholder="Password" style={{ width: '100%', padding: 9, border: '1px solid #cfd3da', font: 'inherit', marginBottom: 8 }} />
              <input name="jc_salt" defaultValue={jc.integritySalt} placeholder="Integrity Salt" style={{ width: '100%', padding: 9, border: '1px solid #cfd3da', font: 'inherit' }} />
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--line)', padding: 16 }}>
              <b style={{ fontSize: 14 }}>Easypaisa</b>
              <label className="minor" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                <input type="checkbox" name="ep_enabled" defaultChecked={ep.enabled} /> Enabled
              </label>
              <select name="ep_env" defaultValue={ep.environment || 'sandbox'} style={{ width: '100%', padding: 9, border: '1px solid #cfd3da', font: 'inherit', marginBottom: 8 }}>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
              <input name="ep_store" defaultValue={ep.storeId} placeholder="Store ID" style={{ width: '100%', padding: 9, border: '1px solid #cfd3da', font: 'inherit', marginBottom: 8 }} />
              <input name="ep_hash" defaultValue={ep.hashKey} placeholder="Hash Key" style={{ width: '100%', padding: 9, border: '1px solid #cfd3da', font: 'inherit' }} />
            </div>
          </div>
          <button className="button primary" style={{ marginTop: 12 }}><Save size={15} /> Save payment settings</button>
          <p className="minor">Until a gateway is enabled here, checkout shows only COD + Bank Transfer. When you enable one later, the checkout buttons activate automatically.</p>
        </form>
      </section>

      {/* ---------- Bank + free delivery (existing) ---------- */}
      <section className="admin-table" style={{ marginTop: 0 }}>
        <h2>Bank transfer account</h2>
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; save({ bank: { accountTitle: d.accountTitle, bankName: d.bankName, accountNumber: d.accountNumber, iban: d.iban.replace(/\s+/g, '').toUpperCase(), raastNumber: d.raastNumber, instructions: d.instructions } }, 'Bank details saved.'); }}>
          <div className="split" style={{ maxWidth: 620 }}>
            <input name="accountTitle" defaultValue={data.bank?.accountTitle || ''} placeholder="Account title" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            <input name="bankName" defaultValue={data.bank?.bankName || ''} placeholder="Bank name" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
          </div>
          <div className="split" style={{ maxWidth: 620, marginTop: 10 }}>
            <input name="accountNumber" defaultValue={data.bank?.accountNumber || ''} placeholder="Account number" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
            <input name="iban" defaultValue={data.bank?.iban || ''} placeholder="IBAN" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
          </div>
          <input name="raastNumber" defaultValue={data.bank?.raastNumber || ''} placeholder="Raast number (optional)" style={{ width: '100%', maxWidth: 620, marginTop: 10, padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
          <textarea name="instructions" defaultValue={data.bank?.instructions || ''} placeholder="Customer instructions" rows={2} style={{ width: '100%', maxWidth: 620, marginTop: 10, padding: 10, border: '1px solid #cfd3da', font: 'inherit', resize: 'vertical' }} />
          <button className="button primary" style={{ marginTop: 12 }}><Save size={15} /> Save bank details</button>
        </form>
      </section>
    </main>
  );
}
