/** Per-page SEO: title, description, OG tags — SPA me document head update karta hai. */
export function setSeo(opts: { title: string; description?: string; image?: string; noindex?: boolean }) {
  document.title = opts.title;
  const set = (selector: string, attr: string, value: string, create: () => HTMLElement) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
    if (!el) { el = create() as HTMLMetaElement; document.head.appendChild(el); }
    el.setAttribute(attr, value);
  };
  const meta = (name: string, content: string, prop = false) =>
    set(prop ? `meta[property="${name}"]` : `meta[name="${name}"]`, 'content', content, () => {
      const m = document.createElement('meta');
      if (prop) m.setAttribute('property', name); else m.setAttribute('name', name);
      return m;
    });
  meta('description', opts.description || opts.title);
  meta('robots', opts.noindex ? 'noindex, nofollow' : 'index, follow');
  meta('og:title', opts.title, true);
  meta('og:description', opts.description || opts.title, true);
  if (opts.image) meta('og:image', opts.image, true);
}
