import { env } from '../config/env.js';

type EmailInput = { to: string; subject: string; html: string };

/**
 * Sends a transactional email through Resend. Fire-and-forget: an email failure
 * must never block or fail the customer's order — errors are logged only.
 * Uses the REST API directly, so no extra SDK dependency is needed.
 */
export async function sendEmail({ to, subject, html }: EmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) return; // Email not configured — silently skip.
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend ${res.status} for ${to}: ${body.slice(0, 300)}`);
    } else {
      console.log(`[email] sent to ${to}: ${subject}`);
    }
  } catch (e) {
    console.error('[email] send failed:', e instanceof Error ? e.message : e);
  }
}

const wrap = (inner: string) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#101827">
  <div style="background:#101827;color:#fff;padding:18px 24px;font-weight:800;letter-spacing:3px;font-size:15px">SELLWAVE</div>
  <div style="border:1px solid #e7e6e0;border-top:0;padding:24px;line-height:1.7;font-size:14px">${inner}</div>
  <p style="color:#637083;font-size:12px;padding:16px 4px">Sell Wave · Pakistan-wide delivery · WhatsApp 0311 9579613 · sellwave04@gmail.com</p>
</div>`;

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 0;color:#637083">${label}</td><td style="text-align:right"><b>${value}</b></td></tr>`;

type OrderEmailData = {
  orderNumber: string;
  status?: string;
  to: string;
  customerName: string;
  items: { productName: string; variantName?: string | null; quantity: number; lineTotal: unknown }[];
  subtotal: unknown;
  discountAmount: unknown;
  shippingAmount: unknown;
  totalAmount: unknown;
  paymentMethod: string;
  paymentStatus: string;
  bank?: { accountTitle?: string; bankName?: string; accountNumber?: string; iban?: string } | null;
};

export function orderConfirmationEmail(d: OrderEmailData): string {
  const rows = d.items
    .map(i => `<tr><td style="padding:6px 0">${i.productName}${i.variantName ? ` — ${i.variantName}` : ''} × ${i.quantity}</td><td style="text-align:right"><b>PKR ${Number(i.lineTotal).toLocaleString()}</b></td></tr>`)
    .join('');
  const bankBlock =
    d.paymentMethod === 'BANK_TRANSFER' && d.paymentStatus === 'PENDING' && d.bank
      ? `<div style="background:#f9f8f4;border:1px solid #e7e6e0;padding:14px;margin:16px 0;font-size:13px">
          <b>Payment pending — transfer to:</b><br/>
          Account title: <b>${d.bank.accountTitle || 'Sell Wave'}</b><br/>
          ${d.bank.bankName ? `Bank: <b>${d.bank.bankName}</b><br/>` : ''}
          ${d.bank.accountNumber ? `Account number: <b>${d.bank.accountNumber}</b><br/>` : ''}
          ${d.bank.iban ? `IBAN: <b>${d.bank.iban}</b><br/>` : ''}
          Exact amount: <b>PKR ${Number(d.totalAmount).toLocaleString()}</b><br/>
          Payment ke baad receipt screenshot WhatsApp 0311 9579613 par bhej dein.
        </div>`
      : '';
  return wrap(`
    <h2 style="margin:0 0 8px">Order ${d.orderNumber} received</h2>
    <p>Dear ${d.customerName}, thank you for shopping with Sell Wave. Your order has been placed${d.paymentMethod === 'COD' ? ' and will be confirmed by call or WhatsApp before dispatch' : ''}.</p>
    ${bankBlock}
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0">${rows}
      ${Number(d.discountAmount) > 0 ? row('Discount', `− PKR ${Number(d.discountAmount).toLocaleString()}`) : ''}
      ${row('Delivery', Number(d.shippingAmount) > 0 ? `PKR ${Number(d.shippingAmount).toLocaleString()}` : 'To be confirmed')}
      ${row('Total', `PKR ${Number(d.totalAmount).toLocaleString()}`)}
      ${row('Payment', `${d.paymentMethod} · ${d.paymentStatus}`)}
    </table>
    <p style="font-size:13px;color:#637083">Returns accepted within 7 days for damaged, broken or courier-damaged items. Track your order any time from your Sell Wave account.</p>
  `);
}

/** Notifies the store owner about a new order — works even before domain verification (goes to owner's own inbox). */
export async function notifyOwnerNewOrder(d: OrderEmailData): Promise<void> {
  const rows = d.items.map(i => `<li>${i.productName}${i.variantName ? ` — ${i.variantName}` : ''} × ${i.quantity} — PKR ${Number(i.lineTotal).toLocaleString()}</li>`).join('');
  await sendEmail({
    to: env.OWNER_EMAIL,
    subject: `🔔 New order ${d.orderNumber} — PKR ${Number(d.totalAmount).toLocaleString()} (${d.paymentMethod})`,
    html: wrap(`
      <h2 style="margin:0 0 8px">New order ${d.orderNumber}</h2>
      <p><b>${d.customerName}</b> ne order place kiya hai.</p>
      <ul style="font-size:14px;line-height:1.8;padding-left:18px">${rows}</ul>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:10px 0">
        ${row('Total', `PKR ${Number(d.totalAmount).toLocaleString()}`)}
        ${row('Payment', `${d.paymentMethod} · ${d.paymentStatus}`)}
        ${d.paymentMethod === 'BANK_TRANSFER' ? row('Action needed', 'Bank app me payment verify karein, phir admin panel se PAID karein') : ''}
        ${d.paymentMethod === 'COD' ? row('Action needed', 'Call / WhatsApp par order confirm karein') : ''}
      </table>
    `),
  });
}

export function orderStatusEmail(d: OrderEmailData): string {
  const messages: Record<string, string> = {
    SHIPPED: 'Good news — your order has been dispatched and is on its way to you.',
    DELIVERED: 'Your order has been delivered. Thank you for shopping with Sell Wave! We would love to hear your feedback.',
    CANCELLED: 'Your order has been cancelled. If you paid in advance, your refund/points will be processed shortly.',
    REFUNDED: 'A refund has been processed for this order.',
  };
  const message = messages[d.status ?? ''] ?? `Your order status is now: ${d.status}.`;
  return wrap(`
    <h2 style="margin:0 0 8px">Order ${d.orderNumber} — ${(d.status ?? '').charAt(0)}${(d.status ?? '').slice(1).toLowerCase()}</h2>
    <p>Dear ${d.customerName}, ${message}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0">
      ${row('Order total', `PKR ${Number(d.totalAmount).toLocaleString()}`)}
      ${row('Payment', `${d.paymentMethod} · ${d.paymentStatus}`)}
    </table>
    <p style="font-size:13px;color:#637083">Questions? WhatsApp us at 0311 9579613.</p>
  `);
}
