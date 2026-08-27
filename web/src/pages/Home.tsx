import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Headphones, Truck, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, Product } from '../lib/api';
import { useStore, Slide } from '../lib/store';
import { ProductCard } from '../components/ProductCard';

const FALLBACK_SLIDES: Slide[] = [
  { image: '/banners/electronics-hero.jpg', eyebrow: 'SELL WAVE · PAKISTAN', title1: 'The future of your', title2: 'everyday living.', copy: 'Discover essentials across technology, home, fashion and more — delivered across Pakistan.', cta: 'Explore the store', link: '/shop', active: true },
  { image: '/banners/fashion.jpg', eyebrow: 'CURATED FOR EVERYDAY', title1: 'Find more to love.', title2: 'For less.', copy: 'Fresh finds, thoughtful choices and a simpler way to shop from one trusted store.', cta: 'Shop new arrivals', link: '/shop', active: true },
];

const bannerFor = (slug: string, name: string): string => {
  const s = `${slug} ${name}`.toLowerCase();
  if (/electronic|laptop|computer|mobile|phone|tv|camera/.test(s)) return '/banners/electronics-hero.jpg';
  if (/gadget|watch|audio|headphone|tech/.test(s)) return '/banners/gadgets.jpg';
  if (/fashion|cloth|wear|apparel|shoe|bag/.test(s)) return '/banners/fashion.jpg';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState('all');
  const [subscribed, setSubscribed] = useState('');
  const { slides: dbSlides } = useStore();

  const slides = (dbSlides.length > 0 ? dbSlides : FALLBACK_SLIDES).filter(s => s.active !== false);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
    setSeo();
    const id = setInterval(() => setIndex(x => (x + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    setSeo();
    api<{ id: string; name: string; slug: string }[]>('/categories').then(setCategories).catch(() => {});
    api<Product[]>('/products').then(setProducts).catch(() => {});
  }, []);

  function setSeo() {
    document.title = 'Sell Wave — Pakistan ka Trusted Online Mega Store | COD Available';
  }

  const s = slides[index] ?? slides[0];

  const featured = useMemo(() => products.filter(p => p.isFeatured).slice(0, 8), [products]);
  const tabProducts = useMemo(() => {
    const list = tab === 'all' ? products : products.filter(p => p.category.slug === tab);
    return list.slice(0, 8);
  }, [products, tab]);

  function subscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') || '');
    fetch('/api/settings/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      .then(r => r.json())
      .then(() => setSubscribed('Shukriya! Aap deals ki list me shamil ho gaye.'))
      .catch(() => setSubscribed('Kuch masla hua — dobara koshish karein.'));
  }

  if (!s) return <main />;

  return (
    <main>
      {/* ============ HERO SLIDER ============ */}
      <section className="hero-banner" style={{ backgroundImage: `linear-gradient(90deg,rgba(6,12,24,.95) 0%,rgba(6,12,24,.80) 42%,rgba(6,12,24,.28) 75%),url(${s.image})` }}>
        <div className="hero-content">
          <p className="eyebrow light">{s.eyebrow}</p>
          <h1>{s.title1}{s.title2 ? <> <em>{s.title2}</em></> : null}</h1>
          <p className="hero-copy">{s.copy}</p>
          <div className="row">
            <Link className="button primary bright" to={s.link || '/shop'}>{s.cta || 'Shop now'}</Link>
            <Link className="button ghost light-border" to="/support">Get support</Link>
          </div>
          <div className="slider-arrows">
            <button aria-label="Previous banner" onClick={() => setIndex(x => (x - 1 + slides.length) % slides.length)}><ChevronLeft size={18} /></button>
            <button aria-label="Next banner" onClick={() => setIndex(x => (x + 1) % slides.length)}><ChevronRight size={18} /></button>
          </div>
          <div className="slider-dots">
            {slides.map((_, i) => (
              <button onClick={() => setIndex(i)} className={i === index ? 'on' : ''} aria-label={`Show banner ${i + 1}`} key={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ SERVICES STRIP ============ */}
      <section className="trust">
        <div><ShieldCheck size={26} strokeWidth={1.7} /><b>Secure checkout</b><span>COD, JazzCash & Easypaisa</span></div>
        <div><Headphones size={26} strokeWidth={1.7} /><b>24/7 Support</b><span>WhatsApp: 0311 9579613</span></div>
        <div><Truck size={26} strokeWidth={1.7} /><b>Pakistan-wide delivery</b><span>Charges by location & weight</span></div>
        <div><Sparkles size={26} strokeWidth={1.7} /><b>Wave Points</b><span>Earn on every delivered order</span></div>
      </section>

      {/* ============ TOP CATEGORIES (round) ============ */}
      {categories.length > 0 && (
        <section className="lux-section">
          <div className="lux-head"><span /><h2>Top Categories</h2><span /></div>
          <div className="cat-ring-row">
            {categories.slice(0, 8).map(c => (
              <Link className="cat-ring" key={c.id} to={`/shop?category=${c.slug}`}>
                <span className="cat-ring-img" style={{ backgroundImage: `url(${bannerFor(c.slug, c.name)})` }} />
                <b>{c.name}</b>
                <small>Shop Now</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============ LATEST PRODUCTS (tabs) ============ */}
      {products.length > 0 && (
        <section className="lux-section">
          <div className="lux-head"><span /><h2>Latest Products</h2><span /></div>
          <div className="lux-tabs">
            <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All</button>
            {categories.map(c => (
              <button key={c.id} className={tab === c.slug ? 'on' : ''} onClick={() => setTab(c.slug)}>{c.name}</button>
            ))}
          </div>
          <div className="pgrid">
            {tabProducts.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
          <div className="center-cta">
            <Link className="button ghost" to="/shop">View all products</Link>
          </div>
        </section>
      )}

      {/* ============ DEAL BANNERS (split) ============ */}
      <section className="lux-section deal-split">
        <Link to="/shop?featured=1" className="deal-box" style={{ backgroundImage: `linear-gradient(100deg,rgba(16,24,39,.88) 20%,rgba(16,24,39,.25)),url(/banners/deals.jpg)` }}>
          <small>MEGA DEALS</small>
          <b>Up to 30% off</b>
          <span>Hand-picked offers across the store</span>
          <em>Shop deals →</em>
        </Link>
        <Link to="/shop?category=home-kitchen" className="deal-box" style={{ backgroundImage: `linear-gradient(100deg,rgba(16,24,39,.88) 20%,rgba(16,24,39,.25)),url(/banners/home-garden.jpg)` }}>
          <small>NEW SEASON</small>
          <b>Home & Kitchen</b>
          <span>Everything your space needs</span>
          <em>Explore →</em>
        </Link>
      </section>

      {/* ============ FEATURED ============ */}
      {featured.length > 0 && (
        <section className="lux-section">
          <div className="lux-head"><span /><h2>Featured Selection</h2><span /></div>
          <div className="pgrid">
            {featured.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* ============ NEWSLETTER ============ */}
      <section className="newsletter">
        <h2>Join the Wave</h2>
        <p>New arrivals, exclusive deals aur sale alerts — sab se pehle aapko.</p>
        <form onSubmit={subscribe}>
          <input required type="email" name="email" maxLength={120} placeholder="Apna email address likhein" />
          <button className="button primary bright">Subscribe</button>
        </form>
        {subscribed && <p className="newsletter-ok">{subscribed}</p>}
      </section>

      {/* ============ PROMISE ============ */}
      <section className="intro">
        <p className="eyebrow">THE SELL WAVE PROMISE</p>
        <h2>Everything you need, from one trusted store.</h2>
        <p>Shop confidently with transparent policies, secure ordering and responsive local customer support.</p>
        <Link className="button ghost" to="/returns">Read our returns policy</Link>
      </section>
    </main>
  );
}
