import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Headphones, Truck, Sparkles } from 'lucide-react';
import { api, Product, money } from '../lib/api';
import { useStore, Slide } from '../lib/store';
import { setSeo } from '../lib/seo';

const FALLBACK_SLIDES: Slide[] = [
  { image: '/banners/electronics-hero.jpg', eyebrow: 'SELL WAVE · PAKISTAN', title1: 'The future of your', title2: 'everyday living.', copy: 'Discover essentials across technology, home, fashion and more — delivered across Pakistan.', cta: 'Explore the store', link: '/shop', active: true },
  { image: '/banners/fashion.jpg', eyebrow: 'CURATED FOR EVERYDAY', title1: 'Find more to love.', title2: 'For less.', copy: 'Fresh finds, thoughtful choices and a simpler way to shop from one trusted store.', cta: 'Shop new arrivals', link: '/shop', active: true },
];

// Maps a category slug/name to the closest homepage banner image.
const bannerFor = (slug: string, name: string): string => {
  const s = `${slug} ${name}`.toLowerCase();
  if (/electronic|laptop|computer|mobile|phone|tv|camera/.test(s)) return '/banners/electronics-hero.jpg';
  if (/gadget|watch|audio|headphone|tech/.test(s)) return '/banners/gadgets.jpg';
  if (/fashion|cloth|wear|apparel|shoe/.test(s)) return '/banners/fashion.jpg';
  if (/deal|sale|offer/.test(s)) return '/banners/deals.jpg';
  if (/sport|fitness|gym|outdoor/.test(s)) return '/banners/sports.jpg';
  if (/applian|kitchen/.test(s)) return '/banners/appliances.jpg';
  if (/home|garden|decor|furniture/.test(s)) return '/banners/home-garden.jpg';
  if (/beauty|cosmetic|care|health/.test(s)) return '/banners/beauty.jpg';
  return '/banners/deals.jpg';
};

export function Home() {
  const [index, setIndex] = useState(0);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const { slides: dbSlides } = useStore();

  const slides = (dbSlides.length > 0 ? dbSlides : FALLBACK_SLIDES).filter(s => s.active !== false);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
    setSeo({ title: 'Sell Wave — Pakistan ka Trusted Online Mega Store | COD Available', description: 'Electronics, fashion, beauty, home aur fitness — Pakistan-wide delivery, COD, 7-day returns, Wave Points rewards.' });
    const id = setInterval(() => setIndex(x => (x + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    api<{ id: string; name: string; slug: string }[]>('/categories').then(setCategories).catch(() => {});
    api<Product[]>('/products?featured=1').then(setFeatured).catch(() => {});
  }, []);

  const s = slides[index];

  return (
    <main>
      <section className="hero-banner" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,18,33,.83) 0%,rgba(8,18,33,.55) 38%,rgba(8,18,33,.05) 70%),url(${s.image})` }}>
        <div className="hero-content">
          <p className="eyebrow light">{s.eyebrow}</p>
          <h1>{s.title1}{s.title2 ? <> <em>{s.title2}</em></> : null}</h1>
          <p className="hero-copy">{s.copy}</p>
          <div className="row">
            <Link className="button primary bright" to={s.link || "/shop"}>{s.cta || "Shop now"}</Link>
            <Link className="button ghost light-border" to="/support">Get support</Link>
          </div>
          <div className="slider-dots">
            {slides.map((_, i) => (
              <button onClick={() => setIndex(i)} className={i === index ? 'on' : ''} aria-label={`Show banner ${i + 1}`} key={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="trust">
        <div><ShieldCheck size={26} strokeWidth={1.7} /><b>Secure checkout</b><span>COD, JazzCash & Easypaisa</span></div>
        <div><Headphones size={26} strokeWidth={1.7} /><b>Customer support</b><span>WhatsApp: 0311 9579613</span></div>
        <div><Truck size={26} strokeWidth={1.7} /><b>Pakistan-wide delivery</b><span>Charges by location & weight</span></div>
        <div><Sparkles size={26} strokeWidth={1.7} /><b>Wave Points</b><span>Earn on every delivered order</span></div>
      </section>

      {categories.length > 0 && (
        <section className="page">
          <div className="section-head">
            <p className="eyebrow">BROWSE THE STORE</p>
            <h2>Shop by category</h2>
          </div>
          <div className="category-tiles">
            {categories.slice(0, 8).map(c => (
              <Link className="tile" key={c.id} to={`/shop?category=${c.slug}`} style={{ backgroundImage: `linear-gradient(180deg,rgba(8,18,33,.05) 30%,rgba(8,18,33,.72) 100%),url(${bannerFor(c.slug, c.name)})` }}>
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="page">
          <div className="section-head">
            <p className="eyebrow">HAND-PICKED</p>
            <h2>Featured products</h2>
            <Link className="text-link" to="/shop?featured=1">View all →</Link>
          </div>
          <div className="grid">
            {featured.slice(0, 8).map(p => (
              <Link className="product" to={`/product/${p.slug}`} key={p.id}>
                {p.images[0] ? <img src={p.images[0].url} alt={p.images[0].alt || p.name} loading="lazy" /> : <div className="product-image">SELL WAVE</div>}
                <small>{p.category.name}</small>
                <h3>{p.name}</h3>
                <strong>{money(Number(p.price))}</strong>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="intro">
        <p className="eyebrow">THE SELL WAVE PROMISE</p>
        <h2>Everything you need, from one trusted store.</h2>
        <p>Shop confidently with transparent policies, secure ordering and responsive local customer support.</p>
        <Link className="button ghost" to="/returns">Read our returns policy</Link>
      </section>
    </main>
  );
}
