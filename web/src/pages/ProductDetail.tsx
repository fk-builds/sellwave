import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, ShoppingCart, Heart, Truck, RotateCcw, Banknote } from 'lucide-react';
import { api, Product, Variant, money, effectivePrice, averageRating } from '../lib/api';
import { setSeo } from '../lib/seo';

export function ProductDetail() {
  const { slug } = useParams();
  const [p, setP] = useState<Product | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<Product[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');

  const variants = p?.variants ?? [];
  const variant: Variant | null = variants.find(v => v.id === variantId) ?? null;
  const price = p ? effectivePrice(p, variant) : 0;
  const stock = variant ? variant.stockQuantity : (p?.stockQuantity ?? 0);
  const avg = averageRating(p?.reviews);

  useEffect(() => {
    setMessage(''); setError(''); setActiveImage(0); setVariantId(''); setQuantity(1); setReviewBody(''); setReviewMessage('');
    api<Product>(`/products/${slug}`)
      .then(prod => {
        setP(prod);
        setSeo({
          title: `${prod.name} — Buy Online in Pakistan | Sell Wave`,
          description: prod.shortDescription || prod.description?.slice(0, 150) || `Buy ${prod.name} at Sell Wave. COD available, Pakistan-wide delivery, 7-day returns.`,
          image: prod.images[0]?.url,
        });
        if (prod.variants && prod.variants.length > 0) setVariantId(prod.variants[0].id);
        api<Product[]>(`/products?category=${prod.category.slug}`)
          .then(list => setRelated(list.filter(x => x.id !== prod.id).slice(0, 4)))
          .catch(() => {});
      })
      .catch(e => setError(e.message));
  }, [slug]);

  const gallery = useMemo(() => p?.images ?? [], [p]);

  async function add() {
    if (!p) return;
    try {
      await api('/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: p.id, variantId: variantId || undefined, quantity }),
      });
      setMessage('Added to your cart.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not add to cart.');
    }
  }

  async function wishlist() {
    if (!p) return;
    try {
      await api('/wishlist', { method: 'POST', body: JSON.stringify({ productId: p.id }) });
      setMessage('Saved to your wishlist.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Please sign in to save this product.');
    }
  }

  async function submitReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!p) return;
    try {
      await api('/reviews', { method: 'POST', body: JSON.stringify({ productId: p.id, rating, body: reviewBody || undefined }) });
      setReviewMessage('Thank you! Your review will appear after approval.');
      setReviewBody('');
    } catch (e) {
      setReviewMessage(e instanceof Error ? e.message : 'Could not submit review.');
    }
  }

  if (error) return <main className="page"><p className="error">{error}</p><Link className="text-link" to="/shop">← Back to shop</Link></main>;
  if (!p) return <main className="page"><p>Loading product…</p></main>;

  return (
    <main className="page product-detail">
      <div className="gallery">
        {gallery[activeImage] ? <img src={gallery[activeImage].url} alt={gallery[activeImage].alt || p.name} loading={activeImage === 0 ? "eager" : "lazy"} /> : <div className="product-image large">SELL WAVE</div>}
        {gallery.length > 1 && (
          <div className="gallery-thumbs">
            {gallery.map((img, i) => (
              <button key={img.id ?? i} className={i === activeImage ? 'on' : ''} onClick={() => setActiveImage(i)} aria-label={`Image ${i + 1}`}>
                <img src={img.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <section>
        <p className="eyebrow">{p.category.name}</p>
        <h1>{p.name}</h1>
        {avg !== null && (
          <span className="stars" aria-label={`Rated ${avg.toFixed(1)} out of 5`}>
            {[1, 2, 3, 4, 5].map(n => <Star key={n} size={16} fill={n <= Math.round(avg) ? 'currentColor' : 'none'} />)}
            <small>{avg.toFixed(1)} · {p.reviews!.length} review{p.reviews!.length === 1 ? '' : 's'}</small>
          </span>
        )}
        <strong className="price">
          {money(price)}
          {p.compareAtPrice && Number(p.compareAtPrice) > price && <s>{money(Number(p.compareAtPrice))}</s>}
        </strong>
        <p className="lede">{p.shortDescription || 'Detailed information will be updated soon.'}</p>

        {variants.length > 0 && (
          <div className="variant-block">
            <p className="minor">Choose an option</p>
            <div className="variant-chips">
              {variants.map(v => (
                <button
                  key={v.id}
                  className={v.id === variantId ? 'selected' : ''}
                  disabled={v.stockQuantity === 0}
                  onClick={() => { setVariantId(v.id); setQuantity(1); }}
                >
                  {v.name}{v.stockQuantity === 0 ? ' · — out of stock' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={`minor ${stock > 0 ? '' : 'error'}`}>
          {stock > 0 ? `${stock} in stock${p.weightGrams ? ` · approx ${p.weightGrams} g` : ''}` : 'Out of stock'}
        </p>

        <div className="row wrap">
          <div className="qty large">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>−</button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity(q => Math.min(Math.max(1, stock), q + 1))} disabled={quantity >= stock}>+</button>
          </div>
          <button className="button primary" onClick={add} disabled={stock === 0}><ShoppingCart size={16} /> Add to cart</button>
          <button className="button ghost" onClick={wishlist}><Heart size={16} /> Save to wishlist</button>
        </div>
        {message && <p className={message.startsWith('Added') || message.startsWith('Saved') ? 'success' : 'error'}>{message}</p>}
        <p className="minor">Secure checkout · COD, JazzCash & Easypaisa available at checkout</p>
        <Link className="text-link" to="/shop">← Continue shopping</Link>
      </section>

      <section className="reviews">
        <h2>Customer reviews</h2>
        {(p.reviews?.length ?? 0) === 0 ? (
          <p className="minor">No reviews yet. Reviews appear here after customers receive their orders.</p>
        ) : (
          <div className="review-list">
            {p.reviews!.map((r, i) => (
              <article key={r.id} className={i === 0 && r.rating >= 4 ? 'top-review' : ''}>
                {i === 0 && r.rating >= 4 && <span className="badge active">Top positive review</span>}
                <span className="stars">
                  {[1, 2, 3, 4, 5].map(n => <Star key={n} size={14} fill={n <= r.rating ? 'currentColor' : 'none'} />)}
                </span>
                <b>{r.user.firstName} {r.user.lastName.charAt(0)}.</b>
                {r.body && <p>{r.body}</p>}
                <small>{new Date(r.createdAt).toLocaleDateString('en-PK')}</small>
              </article>
            ))}
          </div>
        )}
        <details className="review-form">
          <summary>Write a review</summary>
          <form onSubmit={submitReview}>
            <label className="minor">Your rating</label>
            <div className="stars pick">
              {[1, 2, 3, 4, 5].map(n => (
                <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                  <Star size={22} fill={n <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <textarea maxLength={1000} value={reviewBody} onChange={e => setReviewBody(e.target.value)} placeholder="Share your experience with this product (optional)" />
            <button className="button primary">Submit review</button>
            {reviewMessage && <p className="minor">{reviewMessage}</p>}
            <p className="minor">Reviews can be submitted after a delivered purchase and appear once approved.</p>
          </form>
        </details>
      </section>

      {p.bundleItems && p.bundleItems.length > 0 && (
        <section className="product-info">
          <h2>Is bundle me kya hai</h2>
          <BundleContents ids={p.bundleItems.map(b => b.productId)} />
        </section>
      )}

      {p.description && (
        <section className="product-info">
          <h2>Description</h2>
          <p className="desc">{p.description}</p>
        </section>
      )}

      <section className="product-info">
        <h2>Product information</h2>
        <div className="info-table">
          <p><span>SKU</span><b>{variant?.sku || p.sku || '—'}</b></p>
          <p><span>Category</span><b>{p.category.name}</b></p>
          {p.weightGrams ? <p><span>Weight</span><b>approx. {p.weightGrams} g</b></p> : null}
          <p><span>Availability</span><b>{stock > 0 ? `${stock} in stock` : 'Out of stock'}</b></p>
        </div>
      </section>

      {related.length > 0 && (
        <section className="related">
          <h2>You may also like</h2>
          <div className="grid related-grid">
            {related.map(rp => (
              <Link className="product" to={`/product/${rp.slug}`} key={rp.id}>
                {rp.images[0] ? <img src={rp.images[0].url} alt={rp.images[0].alt || rp.name} /> : <div className="product-image">SELL WAVE</div>}
                <small>{rp.category.name}</small>
                <h3>{rp.name}</h3>
                <strong>{money(Number(rp.price))}</strong>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="assurance">
        <div><Truck size={22} strokeWidth={1.7} /><b>Pakistan-wide delivery</b><span>Charges depend on your location and product weight — confirmed before dispatch.</span></div>
        <div><RotateCcw size={22} strokeWidth={1.7} /><b>7-day returns</b><span>Courier-damaged, broken or faulty items are eligible. Customer-caused damage is not.</span></div>
        <div><Banknote size={22} strokeWidth={1.7} /><b>COD & Bank transfer</b><span>Cash on delivery and Raast/IBFT available. JazzCash & Easypaisa coming soon.</span></div>
      </section>
    </main>
  );
}


function BundleContents({ ids }: { ids: string[] }) {
  const [items, setItems] = useState<Product[] | null>(null);
  useEffect(() => {
    api<Product[]>('/products').then(all => setItems(all.filter(x => ids.includes(x.id)))).catch(() => setItems([]));
  }, [ids.join(',')]);
  if (!items || items.length === 0) return null;
  return (
    <div className="info-table">
      {items.map(x => (
        <p key={x.id}><span>{x.name}</span><b>{money(Number(x.price))}</b></p>
      ))}
      <p><span><b>Combo price</b></span><b className="success">You save!</b></p>
    </div>
  );
}
