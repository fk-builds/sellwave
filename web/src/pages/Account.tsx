import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Auth } from './Auth';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Coins, Heart, RotateCcw, UserRound, LogOut, Save } from 'lucide-react';
import { useUser } from '../lib/user';

type U = { firstName: string; lastName: string; email: string; phone?: string | null; city?: string | null; role: string; createdAt?: string; loyaltyPoints?: number };
type Order = { id: string; orderNumber: string; status: string; paymentMethod: string; totalAmount: string; createdAt: string };
type Loyalty = { points: number; transactions: { id: string; type: string; points: number; note?: string | null; createdAt: string }[] };
type ReturnReq = { id: string; reason: string; status: string; adminNote?: string | null; createdAt: string; order: { orderNumber: string } };

const statusLabel: Record<string, string> = {
  REQUESTED: 'Requested', APPROVED: 'Approved', REJECTED: 'Rejected', RECEIVED: 'Received', REFUNDED: 'Refunded',
};

export function Account() {
  const { refresh, clear } = useUser();
  const [u, setU] = useState<U | null>(null);
  const [tab, setTab] = useState<'profile' | 'orders' | 'wishlist' | 'settings'>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [wishlist, setWishlist] = useState<unknown[]>([]);
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const [returnTarget, setReturnTarget] = useState('');
  const [returnMsg, setReturnMsg] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api<{ user: U }>('/auth/me')
      .then(x => {
        setU(x.user);
        return api<Order[]>('/orders').then(o => {
          setOrders(o);
          return Promise.all([
            api<Loyalty>('/account/loyalty').then(setLoyalty).catch(() => {}),
            api<unknown[]>('/wishlist').then(setWishlist).catch(() => {}),
            api<ReturnReq[]>('/returns/mine').then(setReturns).catch(() => {}),
          ]);
        });
      })
      .catch(() => {});
  }, []);

  async function requestReturn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api('/returns', {
        method: 'POST',
        body: JSON.stringify({ orderId: returnTarget, reason: String(fd.get('reason')), details: String(fd.get('details') || '') || undefined }),
      });
      setReturnMsg('Return request submitted. We will review it and contact you.');
      setReturnTarget('');
      api<ReturnReq[]>('/returns/mine').then(setReturns).catch(() => {});
    } catch (e) {
      setReturnMsg(e instanceof Error ? e.message : 'Could not submit request.');
    }
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const x = await api<{ user: U }>('/account/profile', { method: 'PATCH', body: JSON.stringify(d) });
      setU(prev => ({ ...prev!, ...x.user }));
      setProfileMsg('Profile saved successfully.');
      refresh();
    } catch (e) { setProfileMsg(e instanceof Error ? e.message : 'Could not update profile.'); }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api('/account/password', { method: 'POST', body: JSON.stringify(d) });
      setPasswordMsg('Password changed successfully.');
      e.currentTarget.reset();
    } catch (e) { setPasswordMsg(e instanceof Error ? e.message : 'Could not change password.'); }
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clear();
    nav('/');
  }

  if (!u) return <Auth />;

  return (
    <main className="page account-v2">
      <h1>My Account</h1>

      <nav className="acct-tabs">
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}><UserRound size={15} /> Profile</button>
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}><Package size={15} /> Orders</button>
        <button className={tab === 'wishlist' ? 'on' : ''} onClick={() => setTab('wishlist')}><Heart size={15} /> Wishlist</button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}><Coins size={15} /> Rewards & Settings</button>
      </nav>

      {/* ================= PROFILE ================= */}
      {tab === 'profile' && (
        <section className="acct-card">
          <h2>Profile Information</h2>
          <form onSubmit={saveProfile} className="acct-form">
            <div className="acct-row">
              <label>Full Name<input required name="firstName" defaultValue={u.firstName} placeholder="First name" /></label>
              <label>Last Name<input required name="lastName" defaultValue={u.lastName} placeholder="Last name" /></label>
            </div>
            <div className="acct-row">
              <label>Email (read-only)<input value={u.email} readOnly disabled /></label>
              <label>Phone<input name="phone" defaultValue={u.phone || ''} placeholder="+92-3XX-XXXXXXX" /></label>
            </div>
            <div className="acct-row">
              <label>City<input name="city" defaultValue={u.city || ''} placeholder="Karachi, Lahore, etc." /></label>
              <label>Member Since<input value={u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-PK') : '—'} readOnly disabled /></label>
            </div>
            <button className="button primary"><Save size={15} /> Save Changes</button>
            {profileMsg && <p className="minor success">{profileMsg}</p>}
          </form>
        </section>
      )}

      {/* ================= ORDERS ================= */}
      {tab === 'orders' && (
        <>
          <section className="acct-card">
            <h2>Order History</h2>
            {orders.length ? (
              <div className="acct-orders">
                {orders.map(o => (
                  <Link to={`/order/${o.orderNumber}`} className="acct-order" key={o.id}>
                    <div className="acct-order-main">
                      <b>{o.orderNumber}</b>
                      <small>{new Date(o.createdAt).toLocaleDateString('en-PK')} · {o.paymentMethod}</small>
                    </div>
                    <span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span>
                    <strong>PKR {Number(o.totalAmount).toLocaleString()}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ marginTop: 10 }}>
                <p>No orders yet.</p>
                <Link className="button primary" to="/shop">Start shopping</Link>
              </div>
            )}
          </section>

          <section className="acct-card">
            <h2>Request a Return</h2>
            <p className="minor">Returns are accepted within 7 days for courier-damaged, broken or otherwise faulty items.</p>
            <form className="return-form" onSubmit={requestReturn}>
              <select required value={returnTarget} onChange={e => setReturnTarget(e.target.value)}>
                <option value="" disabled>Select your order</option>
                {orders.map(o => <option value={o.id} key={o.id}>{o.orderNumber} · {new Date(o.createdAt).toLocaleDateString('en-PK')}</option>)}
              </select>
              <input required name="reason" maxLength={120} placeholder="Reason (e.g. item arrived damaged)" />
              <textarea name="details" maxLength={1000} placeholder="Details (optional)" />
              <button className="button primary">Submit return request</button>
              {returnMsg && <p className="minor">{returnMsg}</p>}
            </form>
            {returns.length > 0 && (
              <>
                <h2>Your return requests</h2>
                <div className="acct-orders">
                  {returns.map(r => (
                    <div className="acct-order" key={r.id}>
                      <div className="acct-order-main">
                        <b>{r.order.orderNumber}</b>
                        <small>{r.reason}</small>
                      </div>
                      <span className={`badge ${['APPROVED', 'RECEIVED', 'REFUNDED'].includes(r.status) ? 'active' : r.status === 'REJECTED' ? 'draft' : 'pending'}`}>{statusLabel[r.status] || r.status}</span>
                      <small>{new Date(r.createdAt).toLocaleDateString('en-PK')}</small>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* ================= WISHLIST ================= */}
      {tab === 'wishlist' && (
        <section className="acct-card">
          <div className="dash-card-head">
            <h2>My Wishlist ({wishlist.length})</h2>
            <Link className="text-link" to="/wishlist">Open full wishlist →</Link>
          </div>
          <p className="minor">Your saved products live on the wishlist page — open it above to browse, move items to cart or remove them.</p>
        </section>
      )}

      {/* ================= REWARDS & SETTINGS ================= */}
      {tab === 'settings' && (
        <>
          <section className="acct-card">
            <div className="dash-card-head">
              <h2>Wave Points (Rewards)</h2>
              <span className="badge active">{loyalty?.points ?? 0} pts</span>
            </div>
            <p className="minor">Earn 1 point for every PKR 100 spent once your order is delivered. Redeem 1 point = PKR 1 discount at checkout (up to half of the order subtotal).</p>
            {loyalty && loyalty.transactions.length > 0 && (
              <div className="ledger">
                {loyalty.transactions.map(t => (
                  <p key={t.id}><span>{new Date(t.createdAt).toLocaleDateString('en-PK')} · {t.note || t.type}</span><b className={t.points >= 0 ? 'success' : 'error'}>{t.points >= 0 ? `+${t.points}` : t.points}</b></p>
                ))}
              </div>
            )}
          </section>

          <section className="acct-card">
            <h2>Change Password</h2>
            <form onSubmit={changePassword} className="acct-form">
              <div className="acct-row">
                <label>Current Password<input required type="password" name="currentPassword" placeholder="Current password" /></label>
                <label>New Password<input required type="password" name="newPassword" minLength={10} placeholder="New password (min 10 chars)" /></label>
              </div>
              <button className="button primary"><Save size={15} /> Update Password</button>
              {passwordMsg && <p className="minor">{passwordMsg}</p>}
            </form>
          </section>

          <section className="acct-card">
            <h2>Session</h2>
            <p className="minor">Sign out of your account — especially on shared devices.</p>
            <button className="button ghost" onClick={logout}><LogOut size={15} /> Sign out</button>
          </section>
        </>
      )}
    </main>
  );
}
