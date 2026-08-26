import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference?: string | null;
  subtotal: string;
  discountAmount: string;
  shippingAmount: string;
  totalAmount: string;
  couponCode?: string | null;
  pointsRedeemed: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: { label?: string; line1: string; line2?: string | null; city: string; province?: string | null };
  createdAt: string;
  items: { id: string; productName: string; variantName?: string | null; sku: string; quantity: number; unitPrice: string }[];
};

const flow = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

type Bank = { accountTitle?: string; bankName?: string; accountNumber?: string; iban?: string; raastNumber?: string; instructions?: string };

export function OrderDetail() {
  const { orderNumber } = useParams();
  const [o, setOrder] = useState<Order | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [error, setError] = useState('');
  const [returnMsg, setReturnMsg] = useState('');

  useEffect(() => {
    api<Order>(`/orders/${orderNumber}`).then(setOrder).catch(e => setError(e.message));
    api<{ bank: Bank | null }>('/settings/store').then(s => setBank(s.bank)).catch(() => {});
  }, [orderNumber]);

  async function requestReturn() {
    if (!o) return;
    const reason = window.prompt('Return reason (e.g. item arrived damaged):');
    if (!reason) return;
    try {
      await api('/returns', { method: 'POST', body: JSON.stringify({ orderId: o.id, reason }) });
      setReturnMsg('Return request submitted. Track it from your account → Returns.');
    } catch (e) {
      setReturnMsg(e instanceof Error ? e.message : 'Could not submit request.');
    }
  }

  if (error) return <main className="page"><h1>We could not find this order.</h1><p className="error">{error}</p><Link className="text-link" to="/account">Go to your account</Link></main>;
  if (!o) return <main className="page"><p>Loading your order…</p></main>;

  const step = flow.indexOf(o.status);

  return (
    <main className="page confirmation">
      <p className="eyebrow">ORDER {o.orderNumber}</p>
      <h1>{step >= 0 ? 'Thank you for your order.' : 'Order update'}</h1>
      <p className="lede">Placed on {new Date(o.createdAt).toLocaleString('en-PK')} · Payment: {o.paymentMethod} ({o.paymentStatus})</p>

      <ol className="timeline">
        {flow.map((s, i) => (
          <li key={s} className={i <= step ? 'done' : ''}>
            <span className="dot" />
            <span className="label">{s.charAt(0) + s.slice(1).toLowerCase()}</span>
          </li>
        ))}
      </ol>
      {(o.status === 'CANCELLED' || o.status === 'REFUNDED') && <p className="error">This order is {o.status.toLowerCase()}.</p>}

      {o.paymentMethod === 'BANK_TRANSFER' && o.paymentStatus === 'PENDING' && bank && (bank.iban || bank.accountNumber || bank.raastNumber) && (
        <section className="receipt bank-panel">
          <div className="receipt-head"><h2>Payment pending</h2><span className="badge pending">Unpaid</span></div>
          <p><span>Account title</span><b>{bank.accountTitle || 'Sell Wave'}</b></p>
          {bank.bankName && <p><span>Bank</span><b>{bank.bankName}</b></p>}
          {bank.accountNumber && <p><span>Account number</span><b>{bank.accountNumber}</b></p>}
          {bank.iban && <p><span>IBAN</span><b className="iban">{bank.iban}</b></p>}
          {bank.raastNumber && <p><span>Raast</span><b>{bank.raastNumber}</b></p>}
          <p><span>Exact amount</span><b>PKR {Number(o.totalAmount).toLocaleString()}</b></p>
          {o.paymentReference && <p className="minor">Your reference: {o.paymentReference}</p>}
          <a
            className="button primary"
            style={{ display: 'inline-block', marginTop: 12 }}
            href={`https://wa.me/923119579613?text=${encodeURIComponent(`Assalam o alaikum! Order ${o.orderNumber} — PKR ${Number(o.totalAmount).toLocaleString()} paid. Receipt attached.`)}`}
            target="_blank" rel="noreferrer"
          >
            Send receipt on WhatsApp
          </a>
          {bank.instructions && <p className="minor">{bank.instructions}</p>}
        </section>
      )}

      <section className="receipt">
        <div className="receipt-head"><h2>Items</h2><span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span></div>
        {o.items.map(i => (
          <p key={i.id}>
            <span>{i.productName}{i.variantName ? ` — ${i.variantName}` : ''} × {i.quantity}<br /><small className="minor">{i.sku}</small></span>
            <b>PKR {(Number(i.unitPrice) * i.quantity).toLocaleString()}</b>
          </p>
        ))}
        <hr />
        <p><span>Subtotal</span><b>PKR {Number(o.subtotal).toLocaleString()}</b></p>
        {Number(o.discountAmount) > 0 && (
          <p><span>Discount{o.couponCode ? ` (${o.couponCode})` : ''}{o.pointsRedeemed > 0 ? ` · ${o.pointsRedeemed} points` : ''}</span><b>− PKR {Number(o.discountAmount).toLocaleString()}</b></p>
        )}
        <p><span>Delivery</span><b>{Number(o.shippingAmount) > 0 ? `PKR ${Number(o.shippingAmount).toLocaleString()}` : 'To be confirmed'}</b></p>
        <p className="total"><span>Total</span><b>PKR {Number(o.totalAmount).toLocaleString()}</b></p>
      </section>

      <section className="receipt">
        <h2>Delivery address</h2>
        <p><span>{o.shippingName}<br />{o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}, {o.shippingAddress.city}{o.shippingAddress.province ? `, ${o.shippingAddress.province}` : ''}<br />{o.shippingPhone}</span></p>
      </section>

      <div className="row wrap">
        <Link className="button primary" to="/account">My orders</Link>
        <button className="button ghost" onClick={requestReturn}>Request return</button>
        <button className="button ghost" onClick={() => window.print()}>Print summary</button>
      </div>
      {returnMsg && <p className="minor">{returnMsg}</p>}
      <p className="minor">Need help? WhatsApp us at <a href="https://wa.me/923119579613" target="_blank" rel="noreferrer">0311 9579613</a>.</p>
    </main>
  );
}
