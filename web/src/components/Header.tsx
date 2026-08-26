import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, ShoppingBag, Heart, Menu, X } from 'lucide-react';
import { useStore, waLink } from '../lib/store';

export function Header() {
  const { headlines } = useStore();
  const [hi, setHi] = useState(0);
  const [open, setOpen] = useState(false);
  const { supportWhatsapp } = useStore();

  useEffect(() => {
    if ((headlines?.length ?? 0) <= 1) return;
    const id = setInterval(() => setHi(x => (x + 1) % headlines.length), 5000);
    return () => clearInterval(id);
  }, [headlines]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const line = headlines?.[hi] ?? headlines?.[0] ?? 'Pakistan-wide delivery · COD available';

  const navLinks = (
    <>
      <NavLink to="/shop" onClick={() => setOpen(false)}>Shop</NavLink>
      <NavLink to="/wishlist" onClick={() => setOpen(false)}>Wishlist</NavLink>
      <NavLink to="/account" onClick={() => setOpen(false)}>My account</NavLink>
      <NavLink to="/about" onClick={() => setOpen(false)}>About</NavLink>
      <NavLink to="/support" onClick={() => setOpen(false)}>Support</NavLink>
      <a href={waLink(supportWhatsapp, 'Assalam o alaikum! Mujhe Sell Wave se baat karni hai.')} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>WhatsApp us</a>
    </>
  );

  return (
    <>
      <div className="topbar" key={hi}>{line}</div>
      <header>
        <Link className="brand" to="/" aria-label="Sell Wave home" onClick={() => setOpen(false)}>
          <img className="mark" src="/brand/sellwave-mark.png" alt="" />
          <img className="wordmark" src="/brand/sellwave-wordmark.png" alt="Sell Wave" />
        </Link>
        <nav className="desktop-nav">
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/support">Support</NavLink>
        </nav>
        <div className="header-actions">
          <Link aria-label="Search products" to="/shop"><Search size={20} /></Link>
          <Link to="/wishlist" aria-label="Your wishlist" className="heart"><Heart size={19} /></Link>
          <Link to="/account" aria-label="Your account" className="account-link">Account</Link>
          <Link className="bag" to="/cart"><ShoppingBag size={19} /> Cart</Link>
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></button>
        </div>
      </header>

      <div className={`mobile-nav ${open ? 'open' : ''}`}>
        <button className="mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={26} /></button>
        <span className="mobile-nav-brand">SELL<span>WAVE</span></span>
        <nav className="mobile-nav-links">{navLinks}</nav>
      </div>
      {open && <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
