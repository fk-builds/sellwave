import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
import { setSeo } from '../lib/seo';
import { api, Product, money } from '../lib/api';

type Category = { id: string; name: string; slug: string };

export function Shop() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const featured = params.get('featured') === '1';

  useEffect(() => {
    setSeo({ title: 'Shop All Products — Sell Wave Pakistan', description: 'Browse electronics, fashion, beauty, home & fitness products. COD available, Pakistan-wide delivery, 7-day returns.' });
    api<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api<Product[]>(`/products?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}${featured ? '&featured=1' : ''}`)
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, category, featured]);

  function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') || '');
    setParams(x => { q ? x.set('q', q) : x.delete('q'); return x; });
  }

  return (
    <main className="page">
      <p className="eyebrow">CATALOGUE</p>
      <h1>{featured ? 'Featured products' : 'Shop Sell Wave'}</h1>
      <p className="lede">Explore products curated and fulfilled directly by Sell Wave.</p>
      <form className="shop-search" onSubmit={search}>
        <input name="q" defaultValue={query} placeholder="Search products" />
        <button className="button primary">Search</button>
      </form>
      <div className="chips">
        <button className={!category && !featured ? 'selected' : ''} onClick={() => setParams(x => { x.delete('category'); x.delete('featured'); return x; })}>All</button>
        <button className={featured ? 'selected' : ''} onClick={() => setParams(x => { x.delete('category'); x.set('featured', '1'); return x; })}>Featured</button>
        {categories.map(c => (
          <button key={c.id} className={category === c.slug ? 'selected' : ''} onClick={() => setParams(x => { x.set('category', c.slug); x.delete('featured'); return x; })}>{c.name}</button>
        ))}
      </div>
      {loading ? <p>Loading catalogue…</p>
        : error ? <p className="error">We could not load the catalogue: {error}</p>
        : items.length === 0 ? (
          <section className="empty">
            <PackageSearch className="empty-icon" size={44} strokeWidth={1.4} />
            <h2>{query || category || featured ? 'No products match your search.' : 'Our catalogue is being prepared.'}</h2>
            <p>{query || category || featured ? 'Try a different search or category.' : 'There are no public products yet. Please check back soon.'}</p>
          </section>
        ) : (
          <div className="grid">
            {items.map(p => (
              <Link className="product" to={`/product/${p.slug}`} key={p.id}>
                {p.images[0] ? <img src={p.images[0].url} alt={p.images[0].alt || p.name} loading="lazy" /> : <div className="product-image">SELL WAVE</div>}
                <small>{p.category.name}</small>
                <h3>{p.name}</h3>
                <strong>
                  {money(Number(p.price))}
                  {p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price) && <s>{money(Number(p.compareAtPrice))}</s>}
                </strong>
                {p.stockQuantity === 0 && !(p.variants && p.variants.some(v => v.stockQuantity > 0)) && <span className="badge draft">Out of stock</span>}
              </Link>
            ))}
          </div>
        )}
    </main>
  );
}
