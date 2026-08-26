import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, ShoppingBag, Heart, Menu } from 'lucide-react';
import { useStore } from '../lib/store';

export function Header() {
  const { headlines } = useStore();
  const [hi, setHi] = useState(0);
  useEffect(() => {
    if ((headlines?.length ?? 0) <= 1) return;
    const id = setInterval(() => setHi(x => (x + 1) % headlines.length), 5000);
    return () => clearInterval(id);
  }, [headlines]);
  const line = headlines?.[hi] ?? headlines?.[0] ?? 'Pakistan-wide delivery · COD available';

  return (
    <>
      <div className="topbar" key={hi}>{line}</div>
      <header>
        <Link className="brand" to="/" aria-label="Sell Wave home">
          <img className="mark" src="/brand/sellwave-mark.png" alt="" />
          <img className="wordmark" src="/brand/sellwave-wordmark.png" alt="Sell Wave" />
        </Link>
        <nav>
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/support">Support</NavLink>
        </nav>
        <div className="header-actions">
          <Link aria-label="Search products" to="/shop"><Search size={20} /></Link>
          <Link to="/wishlist" aria-label="Your wishlist" className="heart"><Heart size={19} /></Link>
          <Link to="/account" aria-label="Your account">Account</Link>
          <Link className="bag" to="/cart"><ShoppingBag size={19} /> Cart</Link>
          <button className="mobile-menu" aria-label="Open navigation"><Menu /></button>
        </div>
      </header>
    </>
  );
}
