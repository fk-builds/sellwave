import { createContext, useContext, useEffect, useState } from 'react';

export type Slide = {
  image: string; eyebrow: string; title1: string; title2: string;
  copy: string; cta: string; link: string; active: boolean;
};

export type StoreInfo = {
  name: string;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  returnPolicy: string | null;
  headlines: string[];
  slides: Slide[];
  loaded: boolean;
};

const FALLBACK: StoreInfo = {
  name: 'Sell Wave',
  supportEmail: 'sellwave04@gmail.com',
  supportWhatsapp: '03119579613',
  returnPolicy: null,
  headlines: ['Pakistan-wide delivery · COD available · Support: 0311 9579613'],
  slides: [],
  loaded: false,
};

const Ctx = createContext<StoreInfo>(FALLBACK);

export function StoreSettingsProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<StoreInfo>(FALLBACK);
  useEffect(() => {
    fetch('/api/settings/store')
      .then(r => r.json())
      .then(s => setInfo({
        name: s.name ?? FALLBACK.name,
        supportEmail: s.supportEmail ?? FALLBACK.supportEmail,
        supportWhatsapp: s.supportWhatsapp ?? FALLBACK.supportWhatsapp,
        returnPolicy: s.returnPolicy ?? null,
        headlines: Array.isArray(s.headlines) && s.headlines.length ? s.headlines : FALLBACK.headlines,
        slides: Array.isArray(s.slides) ? s.slides : [],
        loaded: true,
      }))
      .catch(() => setInfo(x => ({ ...x, loaded: true })));
  }, []);
  return <Ctx.Provider value={info}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

/** wa.me link builder: 03119579613 → 923119579613 */
export const waLink = (number: string | null | undefined, text?: string): string => {
  let n = (number || '03119579613').replace(/[^0-9]/g, '');
  if (n.startsWith('0')) n = '92' + n.slice(1);
  if (!n.startsWith('92')) n = '92' + n;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
