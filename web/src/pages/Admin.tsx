import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Auth } from './Auth';
import { UploadField } from '../components/UploadField';
import { OpsPanel } from './OpsPanel';
import { PricingAgentPanel } from './PricingAgentPanel';
import { SettingsPanel } from './SettingsPanel';
import { LayoutDashboard, Package, ShoppingCart, TicketPercent, Star, RotateCcw, Truck, Settings as SettingsIcon, Users, Clock, Bot, Calculator, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

type Dashboard = { products: number; orders: number; customers: number; pendingOrders: number; pendingReviews: number; pendingReturns: number };
type Category = { id: string; name: string; slug: string };
type Variant = { id: string; name: string; sku?: string | null; price?: string | null; stockQuantity: number; isActive: boolean };
type Image = { id: string; url: string; alt?: string | null; sortOrder: number };
type Video = { id: string; kind: 'upload' | 'embed'; url: string; thumbnailUrl?: string | null; sortOrder: number };
type Product = {
  id: string; name: string; sku: string; price: string; stockQuantity: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'; isFeatured: boolean; category: Category;
  images: Image[]; videos: Video[]; variants: Variant[];
};
type Order = {
  id: string; orderNumber: string; status: string; paymentMethod: string; paymentStatus: string;
  totalAmount: string; pointsRedeemed: number; createdAt: string; needsVerification: boolean; riskScore: number; riskFlags: string[];
  user: { email: string; firstName: string; lastName: string };
  items: { id: string; productName: string; variantName?: string | null; quantity: number }[];
};
type Coupon = { id: string; code: string; type: string; value: string; usedCount: number; usageLimit?: number | null; isActive: boolean; description?: string | null };
type Review = { id: string; rating: number; body?: string | null; isApproved: boolean; createdAt: string; product: { name: string }; user: { email: string } };
type ReturnReq = { id: string; reason: string; details?: string | null; status: string; adminNote?: string | null; createdAt: string; order: { orderNumber: string }; user: { email: string; firstName: string } };
type Zone = { id: string; name: string; cities: string[]; isActive: boolean; rates?: Rate[] };
type Rate = { id: string; name: string; minimumWeightGrams: number; maximumWeightGrams?: number | null; amount: string; isActive: boolean; zone?: { name: string } };
type Bank = { accountTitle?: string; bankName?: string; accountNumber?: string; iban?: string; raastNumber?: string; instructions?: string };
type Settings = { bank?: Bank; freeDeliveryHeadline?: string };

const TABS = ['Overview', 'AI Ops', 'Pricing AI', 'Catalog', 'Orders', 'Coupons', 'Reviews', 'Returns', 'Shipping', 'Settings'] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof LayoutDashboard> = {
  Overview: LayoutDashboard, 'AI Ops': Bot, 'Pricing AI': Calculator, Catalog: Package, Orders: ShoppingCart, Coupons: TicketPercent,
  Reviews: Star, Returns: RotateCcw, Shipping: Truck, Settings: SettingsIcon,
};

export function Admin() {
  const [u, setU] = useState<{ role: string } | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('Overview');
  const [message, setMessage] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const [uploadedProductImage, setUploadedProductImage] = useState('');
  const [seoTitleLen, setSeoTitleLen] = useState(0);
  const [seoDescLen, setSeoDescLen] = useState(0);

  const load = () =>
    Promise.all([
      api<Dashboard>('/admin/dashboard'),
      api<Category[]>('/admin/categories'),
      api<Product[]>('/admin/products'),
      api<Order[]>('/admin/orders'),
      api<Coupon[]>('/admin/coupons'),
      api<Review[]>('/reviews/admin'),
      api<ReturnReq[]>('/returns/admin'),
      api<Zone[]>('/admin/shipping/zones'),
      api<Rate[]>('/admin/shipping/rates'),
      api<Settings>('/admin/settings'),
    ])
      .then(([d, c, p, o, cp, rv, rt, z, ra, st]) => {
        setData(d); setCategories(c); setProducts(p); setOrders(o); setCoupons(cp); setReviews(rv); setReturns(rt); setZones(z); setRates(ra); setSettings(st);
      })
      .catch(e => setMessage(e.message));

  useEffect(() => {
    api<{ user: { role: string } }>('/auth/me')
      .then(x => { setU(x.user); return load(); })
      .catch(() => {})
      .finally(() => setMeLoaded(true));
  }, []);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) setMessage(ok);
      load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Action failed.'); }
  };

  if (!meLoaded) return <main className="page"><p>Loading admin…</p></main>;
  if (!u || (u.role !== 'ADMIN' && u.role !== 'STAFF')) return <Auth />;

  return (
    <main className="page admin">
      <div className="admin-topbar">
        <Link to="/" className="text-link">← Back to store</Link>
        <span className="admin-topbar-title">Sell Wave Admin</span>
      </div>

      <div className="admin-shell">
      <aside className="admin-side">
        {TABS.map(t => {
          const Icon = TAB_ICONS[t];
          const badge = t === 'Reviews' && data?.pendingReviews ? data.pendingReviews : t === 'Returns' && data?.pendingReturns ? data.pendingReturns : null;
          return (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setMessage(''); }}>
              <Icon size={16} />
              <span className="admin-side-label">{t}</span>
              {badge ? <span className="admin-side-badge">{badge}</span> : null}
            </button>
          );
        })}
      </aside>

      <div className="admin-main">
      {message && <p className="error">{message}</p>}

      {tab === 'AI Ops' && <OpsPanel />}
      {tab === 'Pricing AI' && <PricingAgentPanel />}

      {tab === 'Overview' && data && (() => {
        const revenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
        const recent = orders.slice(0, 6);
        return (
          <>
            <div className="admin-dash-grid">
              <div className="admin-stat"><DollarSign size={20} strokeWidth={1.7} /><b>PKR {revenue.toLocaleString()}</b><span>Total Revenue</span></div>
              <div className="admin-stat"><ShoppingCart size={20} strokeWidth={1.7} /><b>{data.orders}</b><span>Total Orders{data.pendingOrders ? ` · ${data.pendingOrders} pending` : ''}</span></div>
              <div className="admin-stat"><Package size={20} strokeWidth={1.7} /><b>{data.products}</b><span>Total Products</span></div>
              <div className="admin-stat"><Users size={20} strokeWidth={1.7} /><b>{data.customers}</b><span>Customers</span></div>
            </div>

            <section className="dash-card wide">
              <div className="dash-card-head">
                <h2>Recent Orders</h2>
                <button className="text-link" onClick={() => setTab('Orders')}>View All →</button>
              </div>
              {recent.length ? (
                <div className="dash-orders">
                  {recent.map(o => (
                    <div className="dash-order-row" key={o.id}>
                      <div>
                        <b>{o.orderNumber}</b>
                        <small>{o.user.firstName} {o.user.lastName} · {new Date(o.createdAt).toLocaleDateString('en-PK')}</small>
                      </div>
                      <span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span>
                      <strong>PKR {Number(o.totalAmount).toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="minor">No orders yet.</p>}
            </section>

            <section className="dash-card wide">
              <div className="dash-card-head"><h2>Quick Actions</h2></div>
              <div className="admin-quick">
                <button onClick={() => setTab('Catalog')}><Package size={18} /> Manage Products</button>
                <button onClick={() => setTab('Orders')}><ShoppingCart size={18} /> View Orders</button>
                <button onClick={() => setTab('Shipping')}><Truck size={18} /> Shipping Zones</button>
                <button onClick={() => setTab('Settings')}><SettingsIcon size={18} /> Store Settings</button>
              </div>
              <div className="rowline" style={{ marginTop: 12 }}>
                <small className="minor">Pending: {data.pendingOrders} orders · {data.pendingReviews} reviews · {data.pendingReturns} returns</small>
              </div>
            </section>
          </>
        );
      })()}

      {tab === 'Catalog' && (
        <>
          <div className="admin-forms">
            <section>
              <h2>Create category</h2>
              <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); act(() => api('/admin/categories', { method: 'POST', body: JSON.stringify({ ...d, sortOrder: d.sortOrder ? Number(d.sortOrder) : 0 }) }), 'Category saved.'); e.currentTarget.reset(); }}>
                <input required name="name" placeholder="Category name" />
                <input required name="slug" placeholder="category-slug" />
                <input name="sortOrder" type="number" placeholder="Sort order (optional)" />
                <button className="button primary">Save category</button>
              </form>
            </section>
            <section>
              <h2>Add product</h2>
              <form onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
                act(async () => {
                  const p = await api<{ id: string }>('/admin/products', {
                    method: 'POST',
                    body: JSON.stringify({ ...d, price: Number(d.price), compareAtPrice: d.compareAtPrice ? Number(d.compareAtPrice) : undefined, stockQuantity: Number(d.stockQuantity), weightGrams: d.weightGrams ? Number(d.weightGrams) : undefined, status: 'DRAFT' }),
                  });
                  const img = uploadedProductImage || d.imageUrl;
                  if (img) await api(`/admin/products/${p.id}/images`, { method: 'POST', body: JSON.stringify({ url: img, alt: d.name, sortOrder: 0 }) });
                }, 'Product saved as draft — publish it from the catalogue list below.');
                e.currentTarget.reset();
                setUploadedProductImage('');
              }}>
                <input required name="name" placeholder="Product name" />
                <input required name="slug" placeholder="product-slug" />
                <input required name="sku" placeholder="SKU" />
                <select required name="categoryId" defaultValue="">
                  <option value="" disabled>Select category</option>
                  {categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                </select>
                <div className="split">
                  <input required type="number" min="0" step="0.01" name="price" placeholder="Price in PKR" />
                  <input type="number" min="0" step="0.01" name="compareAtPrice" placeholder="Was-price (optional)" />
                </div>
                <div className="split">
                  <input required type="number" min="0" name="stockQuantity" placeholder="Stock quantity" />
                  <input type="number" min="1" name="weightGrams" placeholder="Weight in grams (optional)" />
                </div>
                <div className="inline">
                  <UploadField label="Upload main photo" onUploaded={(url) => setUploadedProductImage(url)} />
                  {uploadedProductImage && <img src={uploadedProductImage} alt="" style={{ width: 46, height: 46, objectFit: 'cover' }} />}
                </div>
                <input type="url" name="imageUrl" placeholder="…or paste an image URL (optional)" />
                <textarea name="shortDescription" placeholder="Short description" />
                <input name="seoTitle" maxLength={60} placeholder="SEO title (max 60 chars)" onChange={e => setSeoTitleLen(e.target.value.length)} />
                <p className="minor" style={{ margin: '-6px 0 0' }}>{seoTitleLen}/60 characters</p>
                <textarea name="seoDescription" maxLength={160} placeholder="SEO description (max 160 chars)" onChange={e => setSeoDescLen(e.target.value.length)} />
                <p className="minor" style={{ margin: '-6px 0 0' }}>{seoDescLen}/160 characters</p>
                <button className="button primary">Save draft product</button>
              </form>
            </section>
          </div>

          <section className="admin-table">
            <h2>Product catalogue</h2>
            {products.length ? (
              <div className="table">
                {products.map(p => (
                  <article key={p.id} className="stack">
                    <div className="rowline">
                      <div>
                        <b>{p.name}</b>
                        <small>{p.category.name} · {p.sku} · stock {p.stockQuantity} · {p.images.length} image{p.images.length === 1 ? '' : 's'} · {p.variants.length} option{p.variants.length === 1 ? '' : 's'}</small>
                      </div>
                      <span>{`PKR ${Number(p.price).toLocaleString()}`}</span>
                      {p.isFeatured && <span className="badge active">Featured</span>}
                      <span className={`badge ${p.status.toLowerCase()}`}>{p.status}</span>
                      <button className="button ghost" onClick={() => act(() => api(`/admin/products/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status: p.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE' }) }))}>{p.status === 'ACTIVE' ? 'Unpublish' : 'Publish'}</button>
                      <button className="button ghost" onClick={() => act(() => api(`/admin/products/${p.id}`, { method: 'PATCH', body: JSON.stringify({ isFeatured: !p.isFeatured }) }))}>{p.isFeatured ? 'Unfeature' : 'Feature'}</button>
                      <button className="text-button" onClick={() => setOpenProduct(openProduct === p.id ? null : p.id)}>{openProduct === p.id ? 'Close' : 'Manage'}</button>
                    </div>
                    {openProduct === p.id && (
                      <div className="manage">
                        <h3>Images</h3>
                        <div className="thumbs">
                          {p.images.map(img => (
                            <div key={img.id}>
                              <img src={img.url} alt={img.alt || ''} />
                              <button className="text-button" onClick={() => act(() => api(`/admin/products/${p.id}/images/${img.id}`, { method: 'DELETE' }))}>Remove</button>
                            </div>
                          ))}
                          {!p.images.length && <small className="minor">No images yet.</small>}
                        </div>
                        <div className="inline">
                          <UploadField label="Upload from phone/PC" onUploaded={(url) => act(() => api(`/admin/products/${p.id}/images`, { method: 'POST', body: JSON.stringify({ url, alt: p.name, sortOrder: p.images.length }) }), 'Image add ho gayi.')} />
                        </div>
                        <form className="inline" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; act(() => api(`/admin/products/${p.id}/images`, { method: 'POST', body: JSON.stringify({ url: d.url, alt: d.alt || p.name, sortOrder: Number(d.sortOrder || 0) }) })); e.currentTarget.reset(); }}>
                          <input required type="url" name="url" placeholder="Image URL" />
                          <input name="alt" placeholder="Alt text (optional)" />
                          <input type="number" name="sortOrder" min="0" placeholder="Order" />
                          <button className="button primary">Add image</button>
                        </form>

                        <h3>Videos</h3>
                        <div className="thumbs">
                          {p.videos.map(v => (
                            <div key={v.id}>
                              {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover' }} /> : <div style={{ width: 72, height: 72, background: '#0c1420', color: '#fff', display: 'grid', placeItems: 'center' }}>▶</div>}
                              <small className="minor">{v.kind === 'embed' ? 'Embed' : 'File'}</small>
                              <button className="text-button" onClick={() => act(() => api(`/admin/products/${p.id}/videos/${v.id}`, { method: 'DELETE' }))}>Remove</button>
                            </div>
                          ))}
                          {!p.videos.length && <small className="minor">No videos yet.</small>}
                        </div>
                        <form className="inline" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; act(() => api(`/admin/products/${p.id}/videos`, { method: 'POST', body: JSON.stringify({ kind: 'embed', url: d.url }) })); e.currentTarget.reset(); }}>
                          <input required type="url" name="url" placeholder="YouTube / Shorts / Vimeo / TikTok link" style={{ minWidth: 240 }} />
                          <button className="button ghost">Add embed video</button>
                        </form>
                        <VideoUpload productId={p.id} onDone={() => act(async () => {}, 'Video uploaded.')} />

                        <h3>Options (size / colour with own stock)</h3>
                        <div className="table">
                          {p.variants.map(v => (
                            <article key={v.id}>
                              <div><b>{v.name}</b><small>{v.sku || '—'}</small></div>
                              <span>{v.price ? `PKR ${Number(v.price).toLocaleString()}` : 'Main price'}</span>
                              <form className="inline" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; act(() => api(`/admin/variants/${v.id}`, { method: 'PATCH', body: JSON.stringify({ stockQuantity: Number(d.stock) }) })); e.currentTarget.reset(); }}>
                                <input type="number" name="stock" min="0" placeholder={`Stock: ${v.stockQuantity}`} />
                                <button className="button ghost">Update stock</button>
                              </form>
                              <span className={`badge ${v.isActive ? 'active' : 'draft'}`}>{v.isActive ? 'Active' : 'Hidden'}</span>
                              <button className="text-button" onClick={() => act(() => api(`/admin/variants/${v.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !v.isActive }) }))}>{v.isActive ? 'Hide' : 'Show'}</button>
                              <button className="text-button" onClick={() => act(() => api(`/admin/variants/${v.id}`, { method: 'DELETE' }))}>Delete</button>
                            </article>
                          ))}
                          {!p.variants.length && <small className="minor">No options — customers buy the main product with its own stock.</small>}
                        </div>
                        <form className="inline" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; act(() => api(`/admin/products/${p.id}/variants`, { method: 'POST', body: JSON.stringify({ name: d.name, sku: d.sku || undefined, price: d.price ? Number(d.price) : undefined, stockQuantity: Number(d.stockQuantity || 0) }) })); e.currentTarget.reset(); }}>
                          <input required name="name" placeholder="Option name e.g. Red / Large" />
                          <input name="sku" placeholder="SKU (optional)" />
                          <input type="number" step="0.01" min="0" name="price" placeholder="Price override (optional)" />
                          <input type="number" min="0" name="stockQuantity" placeholder="Stock" />
                          <button className="button primary">Add option</button>
                        </form>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : <p className="minor">No products have been added yet.</p>}
          </section>
        </>
      )}

      {tab === 'Orders' && (
        <section className="admin-table">
          <h2>All orders</h2>
          {orders.length ? (
            <div className="table">
              {orders.map(o => (
                <article key={o.id} className="stack">
                  <div className="rowline">
                    <div>
                      <b>{o.orderNumber}</b>
                      <small>{o.user.firstName} {o.user.lastName} · {o.user.email} · {new Date(o.createdAt).toLocaleString('en-PK')}</small>
                      <small>{o.items.map(i => `${i.productName}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity}`).join(', ')}</small>
                    </div>
                    <span>{`PKR ${Number(o.totalAmount).toLocaleString()}`}</span>
                    <span className="badge pending">{o.paymentMethod === 'BANK_TRANSFER' ? 'Bank' : o.paymentMethod === 'COD' ? 'COD' : o.paymentMethod}</span>
                    {o.needsVerification && <span className="badge risk">RISK {o.riskScore}</span>}
                    <select value={o.paymentStatus} onChange={e => act(() => api(`/admin/orders/${o.id}/payment-status`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: e.target.value }) }), e.target.value === 'PAID' ? 'Payment marked as received — verify the money is in your account first.' : undefined)}>
                      {['PENDING', 'PAID', 'FAILED', 'REFUNDED'].map(s => <option key={s}>{s}</option>)}
                    </select>
                    {o.pointsRedeemed > 0 && <span className="badge draft">−{o.pointsRedeemed} pts</span>}
                    <select value={o.status} onChange={e => act(() => api(`/admin/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }), o.status === 'DELIVERED' || e.target.value !== 'DELIVERED' ? undefined : 'Order delivered — loyalty points awarded.')}>
                      {['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {o.needsVerification && o.riskFlags.length > 0 && (
                    <small className="minor risk-note">AI Risk Guard: {o.riskFlags.join(' · ')} — verify the customer (call/WhatsApp) before dispatch.</small>
                  )}
                  {o.paymentMethod === 'COD' && o.status === 'PENDING' && !o.needsVerification && (
                    <small className="minor">COD: confirm this order by call or WhatsApp at your discretion before processing.</small>
                  )}
                </article>
              ))}
            </div>
          ) : <p className="minor">Customer orders will appear here.</p>}
        </section>
      )}

      {tab === 'Coupons' && (
        <>
          <div className="admin-forms">
            <section>
              <h2>Create coupon</h2>
              <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; act(() => api('/admin/coupons', { method: 'POST', body: JSON.stringify({ code: d.code, type: d.type, value: Number(d.value), minimumOrderAmount: d.minimumOrderAmount ? Number(d.minimumOrderAmount) : undefined, maximumDiscountAmount: d.maximumDiscountAmount ? Number(d.maximumDiscountAmount) : undefined, usageLimit: d.usageLimit ? Number(d.usageLimit) : undefined, description: d.description || undefined }) }), 'Coupon created.'); e.currentTarget.reset(); }}>
                <input required name="code" placeholder="CODE (A-Z, 0-9, -)" style={{ textTransform: 'uppercase' }} />
                <select required name="type" defaultValue="FIXED"><option value="FIXED">Fixed PKR discount</option><option value="PERCENT">Percent %</option></select>
                <div className="split">
                  <input required type="number" min="1" step="0.01" name="value" placeholder="Value" />
                  <input type="number" min="0" name="minimumOrderAmount" placeholder="Min order (optional)" />
                </div>
                <div className="split">
                  <input type="number" min="0" name="maximumDiscountAmount" placeholder="Max discount (optional)" />
                  <input type="number" min="1" name="usageLimit" placeholder="Usage limit (optional)" />
                </div>
                <input name="description" placeholder="Description (optional)" />
                <button className="button primary">Save coupon</button>
              </form>
            </section>
          </div>
          <section className="admin-table">
            <h2>Coupons</h2>
            {coupons.length ? (
              <div className="table">
                {coupons.map(c => (
                  <article key={c.id}>
                    <div><b>{c.code}</b><small>{c.description || (c.type === 'PERCENT' ? `${Number(c.value)}% off` : `PKR ${Number(c.value)} off`)}</small></div>
                    <span>Used: {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</span>
                    <span className={`badge ${c.isActive ? 'active' : 'draft'}`}>{c.isActive ? 'Active' : 'Paused'}</span>
                    <button className="button ghost" onClick={() => act(() => api(`/admin/coupons/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) }))}>{c.isActive ? 'Pause' : 'Activate'}</button>
                  </article>
                ))}
              </div>
            ) : <p className="minor">No coupons yet.</p>}
          </section>
        </>
      )}

      {tab === 'Reviews' && (
        <section className="admin-table">
          <h2>Review moderation</h2>
          {reviews.length ? (
            <div className="table">
              {reviews.map(r => (
                <article key={r.id}>
                  <div>
                    <b>{r.product.name}</b>
                    <small>{r.user.email} · {new Date(r.createdAt).toLocaleDateString('en-PK')} · {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</small>
                    {r.body && <small>{r.body}</small>}
                  </div>
                  <span className={`badge ${r.isApproved ? 'active' : 'pending'}`}>{r.isApproved ? 'Approved' : 'Pending'}</span>
                  <button className="button ghost" onClick={() => act(() => api(`/reviews/admin/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isApproved: !r.isApproved }) }))}>{r.isApproved ? 'Unpublish' : 'Approve'}</button>
                </article>
              ))}
            </div>
          ) : <p className="minor">No customer reviews yet.</p>}
        </section>
      )}

      {tab === 'Returns' && (
        <section className="admin-table">
          <h2>Return requests</h2>
          {returns.length ? (
            <div className="table">
              {returns.map(r => (
                <article key={r.id} className="stack">
                  <div className="rowline">
                    <div>
                      <b>{r.order.orderNumber}</b>
                      <small>{r.user.firstName} · {r.user.email} · {new Date(r.createdAt).toLocaleDateString('en-PK')}</small>
                      <small><b>Reason:</b> {r.reason}{r.details ? ` — ${r.details}` : ''}</small>
                    </div>
                    <span className={`badge ${['APPROVED', 'RECEIVED', 'REFUNDED'].includes(r.status) ? 'active' : r.status === 'REJECTED' ? 'draft' : 'pending'}`}>{r.status}</span>
                  </div>
                  <div className="rowline">
                    <select value={r.status} onChange={e => act(() => api(`/returns/admin/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }))}>
                      {['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED'].map(s => <option key={s}>{s}</option>)}
                    </select>
                    <form className="inline" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; if (!d.adminNote) return; act(() => api(`/returns/admin/${r.id}`, { method: 'PATCH', body: JSON.stringify({ adminNote: d.adminNote }) })); e.currentTarget.reset(); }}>
                      <input name="adminNote" placeholder="Add internal / customer note" />
                      <button className="button ghost">Save note</button>
                    </form>
                  </div>
                  {r.adminNote && <small className="minor">Note: {r.adminNote}</small>}
                </article>
              ))}
            </div>
          ) : <p className="minor">No return requests.</p>}
        </section>
      )}

      {tab === 'Shipping' && (
        <>
          <div className="admin-forms">
            <section>
              <h2>Shipping zone</h2>
              <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; act(() => api('/admin/shipping/zones', { method: 'POST', body: JSON.stringify({ name: d.name, cities: d.cities.split(',').map(x => x.trim()).filter(Boolean) }) }), 'Zone saved.'); e.currentTarget.reset(); }}>
                <input required name="name" placeholder="Zone name e.g. Islamabad / Rawalpindi" />
                <input required name="cities" placeholder="Cities, separated by commas" />
                <button className="button primary">Save shipping zone</button>
              </form>
            </section>
            <section>
              <h2>Weight-based delivery rate</h2>
              <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; act(() => api('/admin/shipping/rates', { method: 'POST', body: JSON.stringify({ zoneId: d.zoneId, name: d.name, minimumWeightGrams: Number(d.minimumWeightGrams), maximumWeightGrams: d.maximumWeightGrams ? Number(d.maximumWeightGrams) : undefined, amount: Number(d.amount) }) }), 'Delivery rate saved.'); e.currentTarget.reset(); }}>
                <select required name="zoneId" defaultValue="">
                  <option value="" disabled>Select shipping zone</option>
                  {zones.map(z => <option value={z.id} key={z.id}>{z.name}</option>)}
                </select>
                <input required name="name" placeholder="Rate label e.g. up to 1 kg" />
                <div className="split">
                  <input required type="number" min="0" name="minimumWeightGrams" placeholder="Min weight (g)" />
                  <input type="number" min="1" name="maximumWeightGrams" placeholder="Max weight (g)" />
                </div>
                <input required type="number" min="0" name="amount" placeholder="Delivery charge (PKR)" />
                <button className="button primary">Save delivery rate</button>
              </form>
            </section>
          </div>
          <section className="admin-table">
            <h2>Zones</h2>
            {zones.length ? (
              <div className="table">
                {zones.map(z => (
                  <article key={z.id}>
                    <div><b>{z.name}</b><small>{z.cities.join(', ')}</small></div>
                    <span className={`badge ${z.isActive ? 'active' : 'draft'}`}>{z.isActive ? 'Active' : 'Inactive'}</span>
                  </article>
                ))}
              </div>
            ) : <p className="minor">No zones yet — create your first zone above.</p>}
          </section>
          <section className="admin-table">
            <h2>Delivery rates</h2>
            {rates.length ? (
              <div className="table">
                {rates.map(r => (
                  <article key={r.id}>
                    <div><b>{r.name}</b><small>{r.zone?.name || 'Zone'} · {r.minimumWeightGrams}g – {r.maximumWeightGrams ? `${r.maximumWeightGrams}g` : 'and above'}</small></div>
                    <span>{`PKR ${Number(r.amount).toLocaleString()}`}</span>
                    <span className={`badge ${r.isActive ? 'active' : 'draft'}`}>{r.isActive ? 'Active' : 'Inactive'}</span>
                    <button className="button ghost" onClick={() => act(() => api(`/admin/shipping/rates/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !r.isActive }) }))}>{r.isActive ? 'Disable' : 'Enable'}</button>
                  </article>
                ))}
              </div>
            ) : <p className="minor">No delivery rates yet.</p>}
          </section>
        </>
      )}
      {tab === 'Settings' && <SettingsPanel />}
      </div>
      </div>
    </main>
  );
}


function VideoUpload({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(mp4|webm)$/i.test(f.name)) { setMsg('Only .mp4 or .webm allowed.'); return; }
    if (f.size > 50 * 1024 * 1024) { setMsg('Max 50MB.'); return; }
    setBusy(true); setMsg('Uploading…');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const rd = new FileReader();
        rd.onload = () => resolve(String(rd.result));
        rd.onerror = () => reject(new Error('read failed'));
        rd.readAsDataURL(f);
      });
      const res = await fetch(`/api/admin/media/video?productId=${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f.name, data: dataUrl }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Upload failed');
      setMsg('Uploaded ✓');
      onDone();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Upload failed'); }
    setBusy(false);
    if (ref.current) ref.current.value = '';
  }

  return (
    <span className="inline">
      <input ref={ref} type="file" accept="video/mp4,video/webm" style={{ display: 'none' }} onChange={handle} />
      <button type="button" className="button ghost" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Uploading…' : 'Upload video file (.mp4/.webm, max 50MB)'}</button>
      {msg && <small className="minor">{msg}</small>}
    </span>
  );
}
