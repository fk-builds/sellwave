import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Save, Image as ImageIcon } from 'lucide-react';
import { UploadField } from '../components/UploadField';

type Bank = { accountTitle?: string; bankName?: string; accountNumber?: string; iban?: string; raastNumber?: string; instructions?: string };
type Slide = { image: string; eyebrow: string; title1: string; title2: string; copy: string; cta: string; link: string; active: boolean };
type StoreSettings = {
  bank?: Bank; freeDeliveryHeadline?: string; supportWhatsapp?: string; supportEmail?: string;
  headlines?: string[]; slides?: Slide[];
};

const EMPTY_SLIDE: Slide = { image: '/banners/deals.jpg', eyebrow: 'NEW BANNER', title1: 'Your headline here', title2: 'italic line', copy: 'Short banner text for customers.', cta: 'Shop now', link: '/shop', active: true };

export function SettingsPanel() {
  const [data, setData] = useState<StoreSettings | null>(null);
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [contact, setContact] = useState({ supportWhatsapp: '', supportEmail: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<StoreSettings>('/admin/settings').then(d => {
      setData(d);
      setHeadlines(Array.isArray(d.headlines) ? d.headlines : []);
      setSlides(Array.isArray(d.slides) && d.slides.length ? d.slides : []);
      setContact({ supportWhatsapp: d.supportWhatsapp || '', supportEmail: d.supportEmail || '' });
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
        <h2><ImageIcon size={19} /> Homepage banners <small className="minor">(add / edit / remove — order wahin rahega jis order me hain)</small></h2>
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
              <input value={s.image} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)))} placeholder="Banner image URL (/banners/... ya https://...)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
              <input value={s.eyebrow} onChange={e => setSlides(arr => arr.map((x, j) => (j === i ? { ...x, eyebrow: e.target.value } : x)))} placeholder="Eyebrow (chhoti upar wali line)" style={{ padding: 10, border: '1px solid #cfd3da', font: 'inherit' }} />
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
        <h2>Store contact <small className="minor">(WhatsApp float button, Support page, footer — sab jagah update hota hai)</small></h2>
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
