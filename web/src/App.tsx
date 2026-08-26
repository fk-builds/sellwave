import { Routes, Route } from 'react-router-dom';
import { MessageCircle, RotateCcw } from 'lucide-react';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Auth } from './pages/Auth';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Account } from './pages/Account';
import { Admin } from './pages/Admin';
import { Wishlist } from './pages/Wishlist';
import { OrderDetail } from './pages/OrderDetail';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { Support } from './pages/Support';
import { useStore, waLink } from './lib/store';

const Simple = ({ title, children }: { title: string; children: string }) => (
  <main className="page">
    <p className="eyebrow">SELL WAVE</p>
    <h1>{title}</h1>
    <p className="lede">{children}</p>
  </main>
);

function Returns() {
  const { returnPolicy } = useStore();
  return (
    <main className="page">
      <p className="eyebrow">SELL WAVE</p>
      <h1>Returns & refunds</h1>
      <p className="lede">{returnPolicy || 'Return requests are accepted within 7 days of delivery for damaged, broken or courier-damaged items. Items damaged by misuse or customer handling are not eligible. Approved refunds are processed after inspection.'}</p>
      <p className="minor">Return request karne ke liye Account → Returns tab use karein ya WhatsApp par rabta karein.</p>
    </main>
  );
}

export default function App() {
  const { supportWhatsapp } = useStore();
  const waFloatHref = waLink(supportWhatsapp, 'Assalam o alaikum! Mujhe Sell Wave se baat karni hai.');
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/account" element={<Account />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/product/:slug" element={<ProductDetail />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmation />} />
        <Route path="/order/:orderNumber" element={<OrderDetail />} />
        <Route path="/support" element={<Support />} />
        <Route path="/about" element={<Simple title="About Sell Wave">Sell Wave is a single-owner online mega store serving customers across Pakistan.</Simple>} />
        <Route path="/returns" element={<Returns />} />
        <Route path="*" element={<Simple title="Page not found">The page you requested does not exist.</Simple>} />
      </Routes>
      <footer>
        <span>© {new Date().getFullYear()} Sell Wave. All rights reserved.</span>
        <span>Pakistan-wide delivery · <a href={waLink(supportWhatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp support</a> · <a href="/returns"><RotateCcw size={13} /> Returns & refunds</a></span>
      </footer>
      <a
        className="whatsapp-float"
        href={waFloatHref}
        target="_blank"
        rel="noreferrer"
        aria-label="24/7 WhatsApp support"
      >
        <MessageCircle size={27} strokeWidth={2} />
      </a>
    </>
  );
}
