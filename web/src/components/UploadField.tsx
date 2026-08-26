import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { Upload } from 'lucide-react';

/** Phone/PC se image upload — Supabase Storage par jati hai, URL wapas milta hai. */
export function UploadField({ onUploaded, label = 'Upload photo' }: { onUploaded: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3_000_000) { setMsg('Image 3MB se choti honi chahiye — tinypng.com par compress karein.'); return; }
    setBusy(true); setMsg('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api<{ url: string }>('/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ filename: f.name, data: String(reader.result) }),
        });
        onUploaded(res.url);
        setMsg('Uploaded ✓');
      } catch (err) { setMsg(err instanceof Error ? err.message : 'Upload failed'); }
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    };
    reader.onerror = () => { setMsg('File read failed'); setBusy(false); };
    reader.readAsDataURL(f);
  }

  return (
    <span className="upload-field">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" style={{ display: 'none' }} onChange={handle} />
      <button type="button" className="button ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload size={14} /> {busy ? 'Uploading…' : label}
      </button>
      {msg && <small className="minor">{msg}</small>}
    </span>
  );
}
