import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Heart, Menu, X, ChevronDown, LayoutDashboard, UserRound, Package, ShieldCheck, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { useStore, waLink } from '../lib/store';
import { useUser } from '../lib/user';

export function Header() {
  const { headlines } = useStore();
  const { user, clear } = useUser();
  const [hi, setHi] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { supportWhatsapp } = useStore();
  const nav = useNavigate();

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
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clear();
    setMenuOpen(false);
    nav('/');
  }

  return (
    <>
      <div className="topbar" key={hi}>{line}</div>
      <header>
        <Link className="brand" to="/" aria-label="Sell Wave home">
          <img className="mark" src="/brand/sellwave-mark.png" alt="" />
          <img className="wordmark" src="/brand/sellwave-wordmark.png" alt="Sell Wave" />
        </Link>
        <form
          className="header-search"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get('q') || '').trim();
            nav(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
          }}
        >
          <input name="q" placeholder="Search products… (earbuds, watch, serum)" aria-label="Search products" />
          <button aria-label="Search"><Search size={17} /></button>
        </form>
        <nav className="desktop-nav">
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/track">Track</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/support">Support</NavLink>
        </nav>
        <div className="header-actions">
          <Link aria-label="Search products" to="/shop"><Search size={20} /></Link>
          <Link to="/wishlist" aria-label="Your wishlist" className="heart"><Heart size={19} /></Link>
          <div className="account-wrap" ref={menuRef}>
            <button
              className="account-btn"
              aria-label="Account menu"
              onClick={() => setMenuOpen(o => !o)}
            >
              <UserRound size={18} />
              <span className="account-btn-label">{user ? user.firstName : 'Account'}</span>
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="account-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="account-menu">
                  {user ? (
                    <>
                      <div className="account-menu-head">
                        <b>{user.firstName} {user.lastName}</b>
                        <small>{user.email}</small>
                      </div>
                      <Link to="/dashboard" onClick={() => setMenuOpen(false)}><LayoutDashboard size={16} /> Dashboard</Link>
                      <Link to="/account" onClick={() => setMenuOpen(false)}><UserRound size={16} /> My account</Link>
                      <Link to="/account" onClick={() => setMenuOpen(false)}><Package size={16} /> Orders & returns</Link>
                      {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)}><ShieldCheck size={16} /> Admin Panel</Link>}
                      <button className="logout" onClick={logout}><LogOut size={16} /> Sign out</button>
                    </>
                  ) : (
                    <>
                      <div className="account-menu-head">
                        <b>Welcome</b>
                        <small>Sign in for orders, wishlist & Wave Points</small>
                      </div>
                      <Link to="/account" onClick={() => setMenuOpen(false)}><UserRound size={16} /> Sign in / Register</Link>
                      <Link to="/dashboard" onClick={() => setMenuOpen(false)}><LayoutDashboard size={16} /> Dashboard</Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <Link className="bag" to="/cart" aria-label="Cart"><ShoppingBag size={19} /></Link>
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></button>
        </div>
      </header>

      <div className={`mobile-nav ${open ? 'open' : ''}`}>
        <button className="mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={26} /></button>
        <img className="mobile-nav-brand" src="/brand/sellwave-wordmark.png" alt="Sell Wave" />
        {user && <span className="mobile-nav-user">Hi, {user.firstName}</span>}
        <nav className="mobile-nav-links">
          <NavLink to="/shop" onClick={() => setOpen(false)}>Shop</NavLink>
          <NavLink to="/track" onClick={() => setOpen(false)}>Track order</NavLink>
          {user && <NavLink to="/dashboard" onClick={() => setOpen(false)}>Dashboard</NavLink>}
          <NavLink to="/wishlist" onClick={() => setOpen(false)}>Wishlist</NavLink>
          <NavLink to="/account" onClick={() => setOpen(false)}>{user ? 'My account' : 'Sign in'}</NavLink>
          {isAdmin && <NavLink to="/admin" onClick={() => setOpen(false)}>Admin Panel</NavLink>}
          <NavLink to="/about" onClick={() => setOpen(false)}>About</NavLink>
          <NavLink to="/support" onClick={() => setOpen(false)}>Support</NavLink>
          <a href={waLink(supportWhatsapp, 'Hello! I would like to talk to Sell Wave.')} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>WhatsApp us</a>
          {user && <button className="mobile-logout" onClick={() => { setOpen(false); logout(); }}><LogOut size={16} /> Sign out</button>}
        </nav>
      </div>
      {open && <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
