import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Mail, PackageSearch, Truck, RotateCcw, Wallet, Coins } from 'lucide-react';
import { useStore, waLink } from '../lib/store';

export function Support() {
  const nav = useNavigate();
  const { supportWhatsapp, supportEmail } = useStore();
  const [orderNo, setOrderNo] = useState('');
  const wa = waLink(supportWhatsapp, 'Assalam o alaikum! Mujhe Sell Wave ki team se baat karni hai.');
  const waDisplay = (supportWhatsapp || '0311 9579613').replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3');

  function track(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (orderNo.trim()) nav(`/order/${orderNo.trim().toUpperCase()}`);
  }

  return (
    <main className="page support">
      <p className="eyebrow">WE'RE HERE TO HELP</p>
      <h1>Support</h1>
      <p className="lede">24/7 messaging support — WhatsApp par sab se tez jawab milta hai, saal bhar, har din.</p>

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
        <p className="minor">Order number aapko email aur order page par milta hai. Sign in kar ke Account → Orders se bhi track kar sakte ho.</p>
      </section>

      <h2 className="faq-head">Frequently asked questions</h2>
      <div className="faq">
        <details>
          <summary>Order kab confirm aur deliver hota hai?</summary>
          <p>COD orders call ya WhatsApp par confirm hone ke baad process hote hain. Bank transfer par payment verify hote hi dispatch hota hai. Delivery ka waqt location par depend karta hai — bade shehron me aam taur par 2–4 working days.</p>
        </details>
        <details>
          <summary>Delivery charges kitne hain?</summary>
          <p>Charges aapki location aur product weight par depend karte hain. Order confirm se pehle exact charges bata diye jate hain — koi hidden charges nahi.</p>
        </details>
        <details>
          <summary>Payment options kya hain?</summary>
          <p>Cash on Delivery aur Bank Transfer (Raast/IBFT) abhi available hain. JazzCash aur Easypaisa jald hi add ho rahe hain.</p>
        </details>
        <details>
          <summary>Return ya exchange kaise karun?</summary>
          <p>7 din ke andar Account → Returns se request karein ya WhatsApp par order number ke sath rabta karein. Courier damage, toota hua ya kharab maal replace/refund hota hai — ghalat istemal wali cheez eligible nahi.</p>
        </details>
        <details>
          <summary>Wave Points kaise kaam karte hain?</summary>
          <p>Delivered order par har PKR 100 kharch par 1 point milta hai. 1 point = PKR 1 discount — checkout par redeem karein (order ke aadhe subtotal tak).</p>
        </details>
        <details>
          <summary>Order cancel karna ho to?</summary>
          <p>Dispatch se pehle cancel ho sakta hai — WhatsApp par 0311 9579613 order number ke sath message karein.</p>
        </details>
      </div>

      <section className="assurance small">
        <div><Truck size={20} strokeWidth={1.7} /><b>Pakistan-wide delivery</b><span>Har shehar aur gaon — location & weight ke hisab se charges</span></div>
        <div><RotateCcw size={20} strokeWidth={1.7} /><b>7-day easy returns</b><span>Faulty ya damaged item? Bina jhanjhat return</span></div>
        <div><Wallet size={20} strokeWidth={1.7} /><b>Secure payments</b><span>COD, Raast/IBFT — JazzCash & Easypaisa coming</span></div>
        <div><Coins size={20} strokeWidth={1.7} /><b>Wave Points rewards</b><span>Har delivered order par points, checkout par discount</span></div>
      </section>
    </main>
  );
}
