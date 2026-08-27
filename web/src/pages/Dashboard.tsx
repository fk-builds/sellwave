import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Coins, Heart, RotateCcw, UserRound, ShieldCheck, Search, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../lib/user';
import { Auth } from './Auth';

type Order = { id: string; orderNumber: string; status: string; totalAmount: string; createdAt: string };

export function Dashboard() {
  const { user, loaded } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [points, setPoints] = useState(0);
  const [wishlist, setWishlist] = useState(0);
  const [returnsCount, setReturnsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api<Order[]>('/orders').then(setOrders).catch(() => {});
    api<{ points: number }>('/account/loyalty').then(l => setPoints(l.points)).catch(() => {});
    api<unknown[]>('/wishlist').then(w => setWishlist(w.length)).catch(() => {});
    api<unknown[]>('/returns/mine').then(r => setReturnsCount(r.length)).catch(() => {});
  }, [user]);

  if (!loaded) return <main className="page"><p>Loading dashboard…</p></main>;
  if (!user) return <Auth />;

  const isAdmin = user.role === 'ADMIN' || user.role === 'STAFF';

  return (
    <main className="page dash">
      <p className="eyebrow">MY DASHBOARD</p>
      <h1>Welcome back, {user.firstName}</h1>
      <p className="lede">Here is a quick overview of your Sell Wave activity.</p>

      <div className="dash-stats">
        <div className="stat-card"><Package size={22} strokeWidth={1.7} /><b>{orders.length}</b><span>Orders</span></div>
        <div className="stat-card"><Coins size={22} strokeWidth={1.7} /><b>{points}</b><span>Wave Points</span></div>
        <div className="stat-card"><Heart size={22} strokeWidth={1.7} /><b>{wishlist}</b><span>Wishlist items</span></div>
        <div className="stat-card"><RotateCcw size={22} strokeWidth={1.7} /><b>{returnsCount}</b><span>Returns</span></div>
      </div>

      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Recent orders</h2>
            <Link className="text-link" to="/account">All orders →</Link>
          </div>
          {orders.length ? (
            <div className="dash-orders">
              {orders.slice(0, 5).map(o => (
                <Link to={`/order/${o.orderNumber}`} key={o.id} className="dash-order-row">
                  <div>
                    <b>{o.orderNumber}</b>
                    <small>{new Date(o.createdAt).toLocaleDateString('en-PK')}</small>
                  </div>
                  <span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span>
                  <strong>PKR {Number(o.totalAmount).toLocaleString()}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 12 }}>
              <p>No orders yet — your first order is one click away.</p>
              <Link className="button primary" to="/shop">Start shopping</Link>
            </div>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head"><h2>Quick actions</h2></div>
          <div className="dash-links">
            <Link to="/shop"><Search size={16} /> Browse products</Link>
            <Link to="/account"><UserRound size={16} /> Profile &amp; password</Link>
            <Link to="/wishlist"><Heart size={16} /> My wishlist</Link>
            <Link to="/track"><Package size={16} /> Track an order</Link>
            <Link to="/returns"><RotateCcw size={16} /> Returns &amp; refunds</Link>
            <a href="https://wa.me/923119579613" target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp support</a>
            {isAdmin && <Link to="/admin" className="dash-admin-link"><ShieldCheck size={16} /> Admin Panel</Link>}
          </div>
          <div className="dash-points-mini">
            <Coins size={16} />
            <span>You have <b>{points} Wave Points</b> — worth PKR {points} at checkout.</span>
            <Link className="button ghost" to="/shop">Redeem now</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
