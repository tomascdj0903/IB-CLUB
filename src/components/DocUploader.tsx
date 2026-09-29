'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDocument } from '@/app/actions';
import { uploadJustificatif } from '@/lib/upload';
import { Icon } from './Icon';

export function DocUploader({ entryId }: { entryId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true); setErr('');
          try {
            const up = await uploadJustificatif(f, `entries/${entryId}`);
            const r = await addDocument(entryId, up.path, up.name);
            if (r?.error) throw new Error(r.error);
            router.refresh();
          } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Échec de l\'envoi'); }
          setBusy(false);
          if (ref.current) ref.current.value = '';
        }} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="btn-ghost btn-sm"><Icon name="clip" className="h-3.5 w-3.5" /> {busy ? 'Envoi…' : 'Ajouter un justificatif'}</button>
      {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}
    </div>
  );
}
