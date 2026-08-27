import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Coins, Heart, RotateCcw, ShieldCheck, MessageCircle, Sparkles, ArrowUpRight, Gift, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../lib/user';
import { Auth } from './Auth';

type Order = { id: string; orderNumber: string; status: string; totalAmount: string; pointsRedeemed: number; createdAt: string };

export function Dashboard() {
  const { user, loaded } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [points, setPoints] = useState(0);
  const [wishlist, setWishlist] = useState(0);
  const [returnsCount, setReturnsCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loyalty, setLoyalty] = useState<{ points: number; transactions: { id: string; type: string; points: number; note?: string | null; createdAt: string }[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Order[]>('/orders').then(setOrders).catch(() => {});
    api<{ points: number; transactions: { id: string; type: string; points: number; note?: string | null; createdAt: string }[] }>('/account/loyalty').then(setLoyalty).catch(() => {});
    api<unknown[]>('/wishlist').then(w => setWishlist(w.length)).catch(() => {});
    api<unknown[]>('/returns/mine').then(r => setReturnsCount(r.length)).catch(() => {});
  }, [user]);

  if (!loaded) return <main className="page"><p>Loading dashboard…</p></main>;
  if (!user) return <Auth />;

  const isAdmin = user.role === 'ADMIN' || user.role === 'STAFF';

  const totalSpent = orders
    .filter(o => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const memberCode = 'SW' + (user.id.slice(-6)).toUpperCase();
  const initial = user.firstName.charAt(0).toUpperCase();

  return (
    <main className="page dash">
      {/* ===== Welcome hero ===== */}
      <section className="dash-hero">
        <div className="dash-hero-left">
          <span className="dash-avatar">{initial}</span>
          <div>
            <h1>Welcome back,<br />{user.firstName} {user.lastName}!</h1>
            <span className="dash-member">Wave Member · {user.email}</span>
          </div>
        </div>
        <div className="dash-hero-actions">
          <Link className="button ghost light-border" to="/account">Account Settings</Link>
          <Link className="button primary bright" to="/shop">Continue Shopping</Link>
        </div>
      </section>

      {/* ===== Colored stat cards ===== */}
      <div className="dash-stats">
        <div className="stat-card violet"><Sparkles size={22} strokeWidth={1.7} /><span>Loyalty Points</span><b>{points}</b><Link to="/account" className="stat-link">View Rewards <ArrowUpRight size={12} /></Link></div>
        <div className="stat-card blue"><Package size={22} strokeWidth={1.7} /><span>Total Orders</span><b>{orders.length}</b><Link to="/account" className="stat-link">View Orders <ArrowUpRight size={12} /></Link></div>
        <div className="stat-card pink"><Heart size={22} strokeWidth={1.7} /><span>Wishlist Items</span><b>{wishlist}</b><Link to="/wishlist" className="stat-link">View Wishlist <ArrowUpRight size={12} /></Link></div>
        <div className="stat-card orange"><Coins size={22} strokeWidth={1.7} /><span>Total Spent</span><b>PKR {totalSpent.toLocaleString()}</b><Link to="/account" className="stat-link">Wave Points: {points} <ArrowUpRight size={12} /></Link></div>
      </div>

      {/* ===== Recent orders ===== */}
      <section className="dash-card wide">
        <div className="dash-card-head">
          <h2>Recent Orders</h2>
          <Link className="text-link" to="/account">View All Orders →</Link>
        </div>
        {orders.length ? (
          <div className="dash-orders">
            {orders.slice(0, 4).map(o => (
              <Link to={`/order/${o.orderNumber}`} key={o.id} className="dash-order-row">
                <div>
                  <b>Order #{o.orderNumber}</b>
                  <small>{new Date(o.createdAt).toLocaleDateString('en-PK')}</small>
                </div>
                <span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span>
                <strong>PKR {Number(o.totalAmount).toLocaleString()}</strong>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 10 }}>
            <p>No orders yet — your first order is one click away.</p>
            <Link className="button primary" to="/shop">Start shopping</Link>
          </div>
        )}
      </section>

      {/* ===== Referral program ===== */}
      <section className="referral">
        <div className="referral-head">
          <Gift size={24} strokeWidth={1.7} />
          <h2>Refer & Earn</h2>
        </div>
        <p>Share your code with friends — they get a great store, you get the good karma (and future rewards).</p>
        <div className="referral-code">{memberCode}</div>
        <button className="referral-copy" onClick={() => { navigator.clipboard.writeText(memberCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </section>

      {/* ===== Quick actions ===== */}
      <section className="dash-card wide">
        <div className="dash-card-head"><h2>Quick Actions</h2></div>
        <div className="dash-links">
          <Link to="/account"><UserRound size={16} /> Edit Profile</Link>
          <Link to="/track"><Package size={16} /> Track Orders</Link>
          <Link to="/account"><Coins size={16} /> Loyalty Rewards</Link>
          <Link to="/wishlist"><Heart size={16} /> My Wishlist</Link>
          <a href="https://wa.me/923119579613" target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp Support</a>
          {isAdmin && <Link to="/admin" className="dash-admin-link"><ShieldCheck size={16} /> Admin Panel</Link>}
        </div>
      </section>

      {/* ===== Recent activity (points ledger) ===== */}
      {loyalty && loyalty.transactions.length > 0 && (
        <section className="dash-card wide">
          <div className="dash-card-head"><h2>Recent Activity</h2></div>
          <div className="dash-orders">
            {loyalty.transactions.slice(0, 5).map(t => (
              <div className="dash-order-row" key={t.id}>
                <div>
                  <b>{t.note || t.type}</b>
                  <small>{new Date(t.createdAt).toLocaleDateString('en-PK')}</small>
                </div>
                <span className={`badge ${t.points >= 0 ? 'active' : 'draft'}`}>{t.points >= 0 ? `+${t.points} pts` : `${t.points} pts`}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

