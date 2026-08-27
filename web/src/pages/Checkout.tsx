import { FormEvent, useEffect, useState } from 'react';
import { MapPin, Ticket, Coins, Wallet, Banknote, Landmark, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { useNavigate, Link } from 'react-router-dom';

type A = { id: string; label: string; recipientName: string; line1: string; city: string };
type Estimate = { amount: number | null; zone: string | null; rate: string | null };
type Loyalty = { points: number };
type Bank = {
  accountTitle?: string; bankName?: string; accountNumber?: string;
  iban?: string; raastNumber?: string; instructions?: string;
};

export function Checkout() {
  const [addresses, setAddresses] = useState<A[]>([]);
  const [selected, setSelected] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [points, setPoints] = useState<number>(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    api<A[]>('/account/addresses')
      .then(x => { setAddresses(x); setSelected(x[0]?.id || ''); })
      .catch(e => setMessage(e.message));
    api<Loyalty>('/account/loyalty').then(l => setBalance(l.points)).catch(() => setBalance(null));
    api<{ bank: Bank | null }>('/settings/store').then(s => setBank(s.bank)).catch(() => {});
  }, []);

  useEffect(() => {
    const addr = addresses.find(a => a.id === selected);
    if (!addr) { setEstimate(null); return; }
    api<Estimate>(`/shipping/estimate?city=${encodeURIComponent(addr.city)}`).then(setEstimate).catch(() => setEstimate(null));
  }, [selected, addresses]);

  const bankReady = !!(bank && (bank.iban || bank.accountNumber || bank.raastNumber));

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api('/account/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...Object.fromEntries(new FormData(e.currentTarget)), isDefault: true }),
      });
      const x = await api<A[]>('/account/addresses');
      setAddresses(x); setSelected(x[0]?.id || '');
      setMessage('Address saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save address'); }
  }

  async function order(method: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    try {
      const o = await api<{ orderNumber: string }>('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          addressId: selected,
          paymentMethod: method,
          couponCode: couponCode || undefined,
          redeemPoints: points > 0 ? points : undefined,
          ...extra,
        }),
      });
      nav(`/order-confirmation/${o.orderNumber}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not place order');
      setBusy(false);
    }
  }

  return (
    <main className="page checkout">
      <p className="eyebrow">SECURE CHECKOUT</p>
      <h1>Delivery & payment</h1>
      {message && <p className="error">{message}</p>}
      {addresses.length ? (
        <section>
          <h2 className="iconed"><MapPin size={19} /> Delivery address</h2>
          {addresses.map(a => (
            <label className="address" key={a.id}>
              <input type="radio" checked={selected === a.id} onChange={() => setSelected(a.id)} />
              <span><b>{a.label} — {a.recipientName}</b><br />{a.line1}, {a.city}</span>
            </label>
          ))}

          <h2 className="iconed"><Ticket size={19} /> Promo code</h2>
          <input className="coupon-input" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} maxLength={40} placeholder="Enter coupon code (optional)" />

          {balance !== null && balance > 0 && (
            <>
              <h2 className="iconed"><Coins size={19} /> Wave Points</h2>
              <div className="loyalty-redeem">
                <input
                  type="number" min={0} max={balance} value={points || ''}
                  onChange={e => setPoints(Math.max(0, Math.min(balance, Number(e.target.value) || 0)))}
                  placeholder="0"
                />
                <span className="minor">Redeem up to <b>{balance}</b> points · 1 point = PKR 1 · max half of subtotal. Balance: {balance} pts.</span>
              </div>
            </>
          )}

          {estimate && (
            <p className="minor" style={{ marginTop: 14 }}>
              📦 {estimate.amount !== null
                ? <>Delivery estimate ({estimate.zone}): <b>PKR {estimate.amount.toLocaleString()}</b> — order total me add ho jayega</>
                : estimate.zone
                  ? 'Delivery: no rate set for this weight — will be confirmed by phone'
                  : 'Delivery: no zone for your city yet — will be confirmed by phone'}
            </p>
          )}

          <h2 className="iconed"><Wallet size={19} /> Choose payment</h2>
          <div className="payment-buttons">
            <button className="button primary" onClick={() => order('COD')} disabled={busy}><Banknote size={17} /> Cash on delivery</button>
            {bankReady && (
              <button className="button ghost" onClick={() => setBankOpen(o => !o)}><Landmark size={17} /> Bank transfer / Raast</button>
            )}
            <button className="button ghost" onClick={() => setMessage('JazzCash will be enabled after merchant credentials are configured.')}><Smartphone size={17} /> JazzCash</button>
            <button className="button ghost" onClick={() => setMessage('Easypaisa will be enabled after merchant credentials are configured.')}><Smartphone size={17} /> Easypaisa</button>
          </div>

          {bankOpen && bank && (
            <div className="bank-panel">
              <h3>Transfer to this account</h3>
              <p><span>Account title</span><b>{bank.accountTitle || 'Sell Wave'}</b></p>
              {bank.bankName && <p><span>Bank</span><b>{bank.bankName}</b></p>}
              {bank.accountNumber && <p><span>Account number</span><b>{bank.accountNumber}</b></p>}
              {bank.iban && <p><span>IBAN</span><b className="iban">{bank.iban}</b></p>}
              {bank.raastNumber && <p><span>Raast</span><b>{bank.raastNumber}</b></p>}
              {bank.instructions && <p className="minor">{bank.instructions}</p>}
              <input
                className="reference-input"
                value={reference}
                onChange={e => setReference(e.target.value.toUpperCase())}
                maxLength={60}
                placeholder="Transaction ID / reference (optional)"
              />
              <button className="button primary" onClick={() => order('BANK_TRANSFER', { paymentReference: reference || undefined })} disabled={busy}>
                I have paid — place order
              </button>
              <p className="minor">After confirming the order, send your receipt screenshot on WhatsApp. Stock is allocated once payment is verified.</p>
            </div>
          )}

          <p className="minor">COD orders are confirmed by call or WhatsApp before dispatch.</p>
        </section>
      ) : (
        <section className="address-form">
          <h2>Add your delivery address</h2>
          <form onSubmit={add}>
            <input required name="label" placeholder="Label (Home / Office)" />
            <input required name="recipientName" placeholder="Recipient full name" />
            <input required name="phone" placeholder="Mobile number" />
            <input required name="line1" placeholder="House / street / area" />
            <input required name="city" placeholder="City" />
            <input name="province" placeholder="Province (optional)" />
            <button className="button primary">Save address</button>
          </form>
          <p className="minor">Signed in but have no address yet? Add one above. Not you? <Link className="text-link" to="/account">Switch account</Link></p>
        </section>
      )}
    </main>
  );
}
