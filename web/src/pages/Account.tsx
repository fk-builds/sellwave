import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Auth } from './Auth';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Coins, RotateCcw, UserRound, LogOut } from 'lucide-react';

type U = { firstName: string; lastName: string; email: string; phone?: string | null; role: string; createdAt?: string };
type Order = { id: string; orderNumber: string; status: string; paymentMethod: string; totalAmount: string; createdAt: string };
type Loyalty = { points: number; transactions: { id: string; type: string; points: number; note?: string | null; createdAt: string }[] };
type ReturnReq = { id: string; reason: string; status: string; adminNote?: string | null; createdAt: string; order: { orderNumber: string } };

const statusLabel: Record<string, string> = {
  REQUESTED: 'Requested', APPROVED: 'Approved', REJECTED: 'Rejected', RECEIVED: 'Received', REFUNDED: 'Refunded',
};

export function Account() {
  const [u, setU] = useState<U | null>(null);
  const [tab, setTab] = useState<'orders' | 'loyalty' | 'returns' | 'profile'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
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
      setProfileMsg('Profile updated.');
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
    nav('/');
    window.location.reload();
  }

  if (!u) return <Auth />;

  return (
    <main className="page account">
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1>Hello, {u.firstName}</h1>
      <p className="lede">{u.email}{u.role !== 'CUSTOMER' ? ` · ${u.role}` : ''}</p>

      <nav className="tabs">
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}><Package size={16} /> Orders</button>
        <button className={tab === 'loyalty' ? 'on' : ''} onClick={() => setTab('loyalty')}><Coins size={16} /> Wave Points {loyalty ? `· ${loyalty.points}` : ''}</button>
        <button className={tab === 'returns' ? 'on' : ''} onClick={() => setTab('returns')}><RotateCcw size={16} /> Returns{returns.length ? ` · ${returns.length}` : ''}</button>
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}><UserRound size={16} /> Profile</button>
      </nav>

      {tab === 'orders' && (
        <section>
          {orders.length ? (
            <div className="table">
              {orders.map(o => (
                <article key={o.id}>
                  <div>
                    <b>{o.orderNumber}</b>
                    <small>{new Date(o.createdAt).toLocaleDateString('en-PK')} · {o.paymentMethod}</small>
                  </div>
                  <span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span>
                  <strong>{`PKR ${Number(o.totalAmount).toLocaleString()}`}</strong>
                  <Link className="button ghost" to={`/order/${o.orderNumber}`}>Track</Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty"><p>You have not placed any orders yet.</p><Link className="button primary" to="/shop">Start shopping</Link></div>
          )}
        </section>
      )}

      {tab === 'loyalty' && (
        <section className="loyalty-card">
          <div className="points"><b>{loyalty?.points ?? 0}</b><span>Wave Points</span></div>
          <p className="minor">Earn 1 point for every PKR 100 spent once your order is delivered. Redeem 1 point = PKR 1 discount at checkout (up to half of the order subtotal).</p>
          {loyalty && loyalty.transactions.length > 0 && (
            <div className="ledger">
              {loyalty.transactions.map(t => (
                <p key={t.id}><span>{new Date(t.createdAt).toLocaleDateString('en-PK')} · {t.note || t.type}</span><b className={t.points >= 0 ? 'success' : 'error'}>{t.points >= 0 ? `+${t.points}` : t.points}</b></p>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'returns' && (
        <section>
          <h2>Request a return</h2>
          <p className="minor">Returns are accepted within 7 days for courier-damaged, broken or otherwise faulty items. Customer-caused damage is not eligible.</p>
          <form className="return-form" onSubmit={requestReturn}>
            <select required value={returnTarget} onChange={e => setReturnTarget(e.target.value)}>
              <option value="" disabled>Select your order</option>
              {orders.map(o => <option value={o.id} key={o.id}>{o.orderNumber} · {new Date(o.createdAt).toLocaleDateString('en-PK')}</option>)}
            </select>
            <input required name="reason" maxLength={120} placeholder="Reason (e.g. item arrived damaged)" />
            <textarea name="details" maxLength={1000} placeholder="Details (optional — helps us resolve faster)" />
            <button className="button primary">Submit return request</button>
            {returnMsg && <p className="minor">{returnMsg}</p>}
          </form>
          {returns.length > 0 && (
            <>
              <h2>Your return requests</h2>
              <div className="table">
                {returns.map(r => (
                  <article key={r.id}>
                    <div>
                      <b>{r.order.orderNumber}</b>
                      <small>{r.reason}</small>
                    </div>
                    <span className={`badge ${['APPROVED', 'RECEIVED', 'REFUNDED'].includes(r.status) ? 'active' : r.status === 'REJECTED' ? 'draft' : 'pending'}`}>{statusLabel[r.status] || r.status}</span>
                    <small>{new Date(r.createdAt).toLocaleDateString('en-PK')}</small>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'profile' && (
        <section className="profile-grid">
          <div className="profile-card">
            <h2>Profile details</h2>
            <form onSubmit={saveProfile}>
              <div className="split">
                <input required name="firstName" defaultValue={u.firstName} placeholder="First name" />
                <input required name="lastName" defaultValue={u.lastName} placeholder="Last name" />
              </div>
              <input name="phone" defaultValue={u.phone || ''} placeholder="Mobile number" />
              <button className="button primary">Save changes</button>
              {profileMsg && <p className="minor">{profileMsg}</p>}
            </form>
            <p className="minor">Email: {u.email}{u.createdAt ? ` · Member since ${new Date(u.createdAt).toLocaleDateString('en-PK')}` : ''}</p>
          </div>
          <div className="profile-card">
            <h2>Change password</h2>
            <form onSubmit={changePassword}>
              <input required type="password" name="currentPassword" placeholder="Current password" />
              <input required type="password" name="newPassword" minLength={10} placeholder="New password (min 10 characters)" />
              <button className="button primary">Update password</button>
              {passwordMsg && <p className="minor">{passwordMsg}</p>}
            </form>
          </div>
          <div className="profile-card">
            <h2>Session</h2>
            <p className="minor">Sign out of your account — especially on shared devices.</p>
            <button className="button ghost" onClick={logout}><LogOut size={16} /> Sign out</button>
          </div>
        </section>
      )}
    </main>
  );
}
