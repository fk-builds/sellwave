import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { api, Product, money } from '../lib/api';

/** Intron-style product card: hover zoom, discount ribbon, quick add. */
export function ProductCard({ p }: { p: Product }) {
  const nav = useNavigate();
  const price = Number(p.price);
  const was = p.compareAtPrice ? Number(p.compareAtPrice) : 0;
  const off = was > price ? Math.round((1 - price / was) * 100) : 0;
  const soldOut = p.stockQuantity === 0 && !(p.variants ?? []).some(v => v.stockQuantity > 0);

  async function quickAdd() {
    if (p.variants && p.variants.length > 0) { nav(`/product/${p.slug}`); return; }
    try {
      await api('/cart', { method: 'POST', body: JSON.stringify({ productId: p.id, quantity: 1 }) });
      nav('/cart');
    } catch { nav(`/product/${p.slug}`); }
  }

  return (
    <article className={`pcard ${soldOut ? 'soldout' : ''}`}>
      <Link to={`/product/${p.slug}`} className="pcard-media">
        {p.images[0] ? <img src={p.images[0].url} alt={p.images[0].alt || p.name} loading="lazy" /> : <div className="product-image">SELL WAVE</div>}
        {off > 0 && <span className="pcard-off">-{off}%</span>}
        {p.isFeatured && <span className="pcard-flag">Featured</span>}
        {soldOut && <span className="pcard-soldout">Sold out</span>}
        {!soldOut && (
          <button
            className="pcard-quick"
            aria-label={`Add ${p.name} to cart`}
            onClick={e => { e.preventDefault(); e.stopPropagation(); quickAdd(); }}
          >
            <ShoppingCart size={14} /> Quick add
          </button>
        )}
      </Link>
      <div className="pcard-body">
        <small>{p.category.name}</small>
        <Link to={`/product/${p.slug}`} className="pcard-name">{p.name}</Link>
        <div className="pcard-price">
          <b>{money(price)}</b>
          {was > price && <s>{money(was)}</s>}
        </div>
      </div>
    </article>
  );
}
