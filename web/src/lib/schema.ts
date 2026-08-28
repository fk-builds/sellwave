import { Product } from './api';

const BASE = 'https://sellwave-roan.vercel.app';

export function productSchemaJsonLd(p: Product) {
  const stock = p.stockQuantity > 0 || (p.variants ?? []).some(v => v.stockQuantity > 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.shortDescription || p.description?.slice(0, 300) || p.name,
    sku: p.sku || p.slug,
    image: p.images.map(i => i.url),
    brand: { '@type': 'Brand', name: 'Sell Wave' },
    offers: {
      '@type': 'Offer',
      url: `${BASE}/product/${p.slug}`,
      priceCurrency: 'PKR',
      price: Number(p.price).toFixed(2),
      availability: stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(p.reviews && p.reviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length).toFixed(1),
            reviewCount: p.reviews.length,
          },
        }
      : {}),
  };
}

export function breadcrumbSchemaJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${BASE}${it.url}`,
    })),
  };
}

export function injectJsonLd(id: string, data: unknown) {
  const old = document.getElementById(id);
  if (old) old.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}
