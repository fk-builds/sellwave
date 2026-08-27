import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MessageCircle, Mail, PackageSearch, Truck, RotateCcw, Wallet, Coins } from 'lucide-react';
import { useStore, waLink } from '../lib/store';

export function Support() {
  const nav = useNavigate();
  const { supportWhatsapp, supportEmail } = useStore();
  const [orderNo, setOrderNo] = useState('');
  const wa = waLink(supportWhatsapp, 'Hello! I would like to talk to the Sell Wave team.');
  const waDisplay = (supportWhatsapp || '0311 9579613').replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3');

  function track(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (orderNo.trim()) nav(`/order/${orderNo.trim().toUpperCase()}`);
  }

  return (
    <main className="page support">
      <p className="eyebrow">WE'RE HERE TO HELP</p>
      <h1>Support</h1>
      <p className="lede">24/7 messaging support — WhatsApp gets you the fastest reply — every day, all year.</p>

      <div className="support-cards">
        <a className="support-card" href={wa} target="_blank" rel="noreferrer">
          <MessageCircle size={26} strokeWidth={1.7} />
          <span><b>WhatsApp — fastest</b><small>{waDisplay} · 24/7 messaging</small></span>
        </a>
        <a className="support-card" href={`mailto:${supportEmail || 'sellwave04@gmail.com'}`}>
          <Mail size={26} strokeWidth={1.7} />
          <span><b>Email</b><small>{supportEmail || 'sellwave04@gmail.com'} · reply within 24 hours</small></span>
        </a>
      </div>

      <section className="track-box">
        <h2><PackageSearch size={19} /> Track your order</h2>
        <form className="inline" onSubmit={track}>
          <input
            value={orderNo}
            onChange={e => setOrderNo(e.target.value)}
            placeholder="Order number e.g. SW-17877-123"
            maxLength={40}
          />
          <button className="button primary">Track</button>
        </form>
        <p className="minor">Your order number is in your email and on the order page. Or open the <Link className="text-link" to="/track">Track Order page</Link> and enter it there.</p>
      </section>

      <h2 className="faq-head">Frequently asked questions</h2>
      <div className="faq">
        <details>
          <summary>When is my order confirmed & delivered?</summary>
          <p>COD orders are processed after call/WhatsApp confirmation. Bank transfer orders dispatch right after payment verification. Delivery time depends on your location — typically 2-4 working days in major cities.</p>
        </details>
        <details>
          <summary>What are the delivery charges?</summary>
          <p>Charges depend on your location and product weight. Exact charges are always shown before you confirm the order — no hidden fees.</p>
        </details>
        <details>
          <summary>What payment options are available?</summary>
          <p>Cash on Delivery and Bank Transfer (Raast/IBFT) are available now. JazzCash and Easypaisa are coming soon.</p>
        </details>
        <details>
          <summary>How do I return or exchange an item?</summary>
          <p>Within 7 days, request from Account → Returns or message us on WhatsApp with your order number. Courier-damaged, broken or faulty items are replaced/refunded — damage from misuse is not eligible.</p>
        </details>
        <details>
          <summary>How do Wave Points work?</summary>
          <p>Earn 1 point for every PKR 100 spent on delivered orders. 1 point = PKR 1 discount — redeem at checkout (up to half your order subtotal).</p>
        </details>
        <details>
          <summary>How do I cancel an order?</summary>
          <p>Orders can be cancelled before dispatch — message us on WhatsApp (0311 9579613) with your order number.</p>
        </details>
      </div>

      <section className="assurance small">
        <div><Truck size={20} strokeWidth={1.7} /><b>Pakistan-wide delivery</b><span>Every city and town — charges by location & weight</span></div>
        <div><RotateCcw size={20} strokeWidth={1.7} /><b>7-day easy returns</b><span>Faulty or damaged item? Hassle-free return</span></div>
        <div><Wallet size={20} strokeWidth={1.7} /><b>Secure payments</b><span>COD, Raast/IBFT — JazzCash & Easypaisa coming</span></div>
        <div><Coins size={20} strokeWidth={1.7} /><b>Wave Points rewards</b><span>Points on every delivered order, discount at checkout</span></div>
      </section>
    </main>
  );
}
