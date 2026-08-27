import { FormEvent, useEffect, useRef, useState } from 'react';
import { MapPin, PackageSearch, Truck, Clock } from 'lucide-react';
import { setSeo } from '../lib/seo';
import 'leaflet/dist/leaflet.css';

type TrackInfo = {
  orderNumber: string; status: string; paymentMethod: string; paymentStatus: string;
  createdAt: string; updatedAt: string; city: string | null; items: number;
};
type Zone = { name: string; cities: string[]; rates: { name: string; min: number; max: number | null; amount: string }[] };

const CITY_COORDS: Record<string, [number, number]> = {
  islamabad: [33.6844, 73.0479], rawalpindi: [33.5651, 73.0169], karachi: [24.8607, 67.0011],
  lahore: [31.5204, 74.3587], faisalabad: [31.418, 73.079], multan: [30.1575, 71.5249],
  peshawar: [34.0151, 71.5808], quetta: [30.1798, 66.975], hyderabad: [25.396, 68.3578],
  gujranwala: [32.1877, 74.1945], sialkot: [32.4945, 74.5229], sargodha: [32.0836, 72.6711],
  bahawalpur: [29.3956, 71.6836], sukkur: [27.7052, 68.8574], abbottabad: [34.1688, 73.2215],
  mardan: [34.198, 72.0459], 'rahim yar khan': [28.4202, 70.2952], gujrat: [32.5731, 74.0789],
  kasur: [31.1187, 74.4506], okara: [30.8081, 73.4534],
};

const FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export function Track() {
  const [info, setInfo] = useState<TrackInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    setSeo({ title: 'Track Order & Delivery Coverage — Sell Wave', description: 'Apne order ka status check karein aur dekhein Sell Wave Pakistan bhar kin cities me delivery karta hai.' });
    apiCoverage();
  }, []);

  async function apiCoverage() {
    try {
      const z = await fetch('/api/coverage').then(r => r.json());
      setZones(z);
      // load leaflet lazily after zones ready
      const L = await import('leaflet');
      if (!mapRef.current || mapObj.current) return;
      const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([30.3753, 69.3451], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 12,
      }).addTo(map);
      const added: [number, number][] = [];
      const seen = new Set<string>();
      for (const zone of z as Zone[]) {
        for (const city of zone.cities) {
          const key = city.trim().toLowerCase();
          const coord = CITY_COORDS[key];
          if (!coord || seen.has(key)) continue;
          seen.add(key);
          added.push(coord);
          L.circleMarker(coord, { radius: 8, color: '#c9a24b', weight: 2, fillColor: '#101827', fillOpacity: 0.85 })
            .addTo(map)
            .bindPopup(`<b>${city}</b><br/><span style="color:#a8842f;font-weight:700">${zone.name}</span>`);
        }
      }
      if (added.length) map.fitBounds(L.latLngBounds(added).pad(0.25));
      mapObj.current = map;
    } catch { /* map optional */ }
  }

  async function track(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const num = String(new FormData(e.currentTarget).get('orderNumber') || '').trim().toUpperCase();
    if (!num) return;
    setBusy(true); setError(''); setInfo(null);
    try {
      const res = await fetch(`/api/track/${encodeURIComponent(num)}`);
      const d = await res.json();
      if (!res.ok) setError(d.message || 'Order nahi mila.'); else setInfo(d);
    } catch { setError('Network masla — dobara koshish karein.'); }
    setBusy(false);
  }

  const step = info ? FLOW.indexOf(info.status) : -1;
  const eta = info ? new Date(new Date(info.createdAt).getTime() + 4 * 864e5) : null;

  return (
    <main className="page track-page">
      <p className="eyebrow">SELL WAVE</p>
      <h1>Track your order</h1>
      <p className="lede">Order number daal kar apne parcel ki live position dekhein — ya neeche map par dekhein hum kin cities me delivery karte hain.</p>

      <section className="track-panel">
        <form className="track-form" onSubmit={track}>
          <PackageSearch size={19} />
          <input required name="orderNumber" placeholder="Order number: SW-17877…-123" maxLength={40} />
          <button className="button primary" disabled={busy}>{busy ? 'Checking…' : 'Track'}</button>
        </form>
        {error && <p className="error">{error}</p>}

        {info && (
          <div className="track-result">
            <div className="rowline">
              <b>{info.orderNumber}</b>
              <span className={`badge ${info.status.toLowerCase()}`}>{info.status}</span>
            </div>
            <ol className="timeline track-timeline">
              {FLOW.map((st, i) => (
                <li key={st} className={i <= step ? 'done' : ''}>
                  <span className="dot" />
                  <span className="label">{st.charAt(0) + st.slice(1).toLowerCase()}</span>
                </li>
              ))}
            </ol>
            <div className="track-meta">
              <span><Clock size={13} /> Order: {new Date(info.createdAt).toLocaleDateString('en-PK')}</span>
              <span><Truck size={13} /> {info.city ? `Delivering to: ${info.city}` : 'Delivery: Pakistan-wide'}</span>
              <span>Payment: {info.paymentMethod} · {info.paymentStatus}</span>
              {info.status === 'SHIPPED' && <span className="success">Dispatch ho chuka hai — 1-3 din me pohanchna hai</span>}
              {info.status !== 'DELIVERED' && info.status !== 'CANCELLED' && eta && step >= 0 && (
                <span>Expected delivery: ~{eta.toLocaleDateString('en-PK')}</span>
              )}
              {info.status === 'DELIVERED' && <span className="success">Deliver ho gaya — shukriya! 🎉</span>}
            </div>
            <p className="minor">Tafseel/return ke liye <a className="text-link" href={`/order/${info.orderNumber}`}>order page</a> kholein (account login zaroori).</p>
          </div>
        )}
      </section>

      <h2 className="faq-head"><MapPin size={19} /> Delivery coverage — Pakistan bhar</h2>
      <p className="minor">Neeche wale shehron me hum delivery karte hain (gold pins map par). Apna city na dikhe? WhatsApp karein — arrangement ho sakta hai.</p>

      <div ref={mapRef} className="coverage-map" aria-label="Pakistan delivery coverage map" />

      <div className="coverage-grid">
        {zones.map(z => (
          <article className="coverage-card" key={z.name}>
            <b>{z.name}</b>
            <div className="chips">{z.cities.map(c => <span className="chip" key={c}>{c}</span>)}</div>
            <div className="coverage-rates">
              {z.rates.length ? z.rates.map(rt => (
                <p key={rt.name}><span>{rt.name}</span><b>PKR {Number(rt.amount).toLocaleString()}</b></p>
              )) : <p className="minor">Rates on request — WhatsApp karein</p>}
            </div>
          </article>
        ))}
        {!zones.length && <p className="minor">Coverage info load ho rahi hai…</p>}
      </div>
    </main>
  );
}
