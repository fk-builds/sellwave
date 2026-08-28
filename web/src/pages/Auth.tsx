import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound } from 'lucide-react';

export function Auth() {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      await api('/auth/otp/send', { method: 'POST', body: JSON.stringify({ email }) });
      setStage('code');
      setMessage(`Code ${email} par bhej diya gaya hai — 10 minute me expire hoga.`);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Code send nahi hua.'); }
    setBusy(false);
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      await api('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email, code }) });
      window.location.href = '/dashboard';
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Verify nahi hua.'); setBusy(false); }
  }

  return (
    <main className="auth">
      <section>
        <p className="eyebrow">YOUR SELL WAVE ACCOUNT</p>
        <h1>{stage === 'email' ? 'Sign in' : 'Enter code'}</h1>

        {stage === 'email' ? (
          <form onSubmit={sendCode}>
            <p className="minor" style={{ marginTop: 0 }}>Email enter karein — hum aapko 6-digit ka login code bhejenge. Naya customer? Account khud ban jayega.</p>
            <input required type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" />
            <button className="button primary" disabled={busy}><Mail size={15} /> {busy ? 'Sending…' : 'Send login code'}</button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <p className="minor" style={{ marginTop: 0 }}>Code bhej diya gaya <b>{email}</b> par. Inbox (ya spam) check karein.</p>
            <input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" style={{ letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 800 }} />
            <button className="button primary" disabled={busy}><KeyRound size={15} /> {busy ? 'Verifying…' : 'Verify & sign in'}</button>
            <button type="button" className="text-button" style={{ marginTop: 4 }} onClick={() => { setStage('email'); setMessage(''); }}>Wrong email? Go back</button>
          </form>
        )}

        <div className="auth-divider"><span>or</span></div>
        <a className="button google-btn" href="/api/auth/google/start">
          <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.4 44 30.2 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>
          Continue with Google
        </a>

        {message && <p className="minor">{message}</p>}
        <p className="minor" style={{ marginTop: 14 }}>Sign in karke order karein, wishlist banayen aur Wave Points kamayen.</p>
      </section>
    </main>
  );
}
