import { useEffect, useMemo, useState } from 'react';
import { api, money, effectivePrice, Variant } from '../lib/api';
import { Link } from 'react-router-dom';
import { ShoppingBag, Plus } from 'lucide-react';

type AddOn = { id: string; name: string; slug: string; price: string; images: { url: string }[] };
type Item = {
  id: string;
  quantity: number;
  variant?: Variant | null;
  product: { id: string; name: string; slug: string; price: string; images: { url: string }[] };
};

export function Cart() {
  const [items, setItems] = useState<Item[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [message, setMessage] = useState('');

  const load = () => api<Item[]>('/cart').then(x => { setItems(x); return x; }).then(x => {
    api<AddOn[]>('/products?featured=1').then(feats => setAddOns(feats.filter(f => !x.some(i => i.product.id === f.id)).slice(0, 4))).catch(() => {});
  }).catch(e => setMessage(e.message));
  useEffect(() => { load(); }, []);

  async function quickAdd(productId: string) {
    try {
      await api('/cart', { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) });
      load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not add'); }
  }

  const total = useMemo(
    () => items.reduce((n, i) => n + effectivePrice(i.product, i.variant ?? null) * i.quantity, 0),
    [items],
  );

  async function change(i: Item, q: number) {
    try {
      await api(`/cart/${i.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: q }) });
      load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not update cart'); }
  }

  async function remove(id: string) {
    await api(`/cart/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <main className="page">
      <p className="eyebrow">YOUR CART</p>
      <h1>Shopping bag</h1>
      {message && <p className="error">{message}</p>}
      {!items.length ? (
        <section className="empty">
          <ShoppingBag className="empty-icon" size={44} strokeWidth={1.4} />
          <h2>Your bag is empty.</h2>
          <Link className="button primary" to="/shop">Shop products</Link>
        </section>
      ) : (
        <div className="cart-layout">
          <section>
            {items.map(i => (
              <article className="cart-item" key={i.id}>
                {i.product.images[0] ? <img src={i.product.images[0].url} alt="" /> : <div className="cart-thumb" />}
                <div>
                  <h3><Link className="text-link" to={`/product/${i.product.slug}`}>{i.product.name}</Link></h3>
                  {i.variant && <small className="minor">Option: {i.variant.name}</small>}
                  <strong>{money(effectivePrice(i.product, i.variant ?? null))}</strong>
                  <div className="qty">
                    <button onClick={() => change(i, i.quantity - 1)} disabled={i.quantity === 1}>−</button>
                    <span>{i.quantity}</span>
                    <button onClick={() => change(i, i.quantity + 1)}>+</button>
                  </div>
                  <button className="text-button" onClick={() => remove(i.id)}>Remove</button>
                </div>
              </article>
            ))}
          </section>
          <aside className="summary">
            <h2>Order summary</h2>
            <p><span>Subtotal</span><b>{money(total)}</b></p>
            <p className="minor">Delivery charges are confirmed at checkout.</p>
            <Link className="button primary" to="/checkout">Secure checkout</Link>
          </aside>
          {addOns.length > 0 && (
            <section className="addons">
              <h2>Complete your order</h2>
              <div className="addon-grid">
                {addOns.map(a => (
                  <div className="addon" key={a.id}>
                    {a.images[0] ? <img src={a.images[0].url} alt="" loading="lazy" /> : <div className="cart-thumb" />}
                    <small>{a.name}</small>
                    <b>{money(Number(a.price))}</b>
                    <button className="button ghost" onClick={() => quickAdd(a.id)}><Plus size={14} /> Add</button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
