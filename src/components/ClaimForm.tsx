'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { submitClaim } from '@/app/actions';
import { uploadJustificatif } from '@/lib/upload';
import { Submit } from './Forms';
import type { EventRow } from '@/lib/types';

export function ClaimForm({ events, defaultName, userId }: { events: EventRow[]; defaultName: string; userId: string }) {
  const [state, action] = useActionState(submitClaim, null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pathRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (state?.ok) { formRef.current?.reset(); if (pathRef.current) pathRef.current.value = ''; } }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        const f = fileRef.current?.files?.[0];
        if (f && !pathRef.current?.value) {
          e.preventDefault();
          setErr('');
          try {
            const up = await uploadJustificatif(f, `claims/${userId}`);
            if (pathRef.current) pathRef.current.value = up.path;
            formRef.current?.requestSubmit();
          } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Échec de l\'envoi du justificatif'); }
        }
      }}>
      <input ref={pathRef} type="hidden" name="document_path" />
      <div><label className="label">Ton nom</label><input name="claimant_name" defaultValue={defaultName} required className="input" /></div>
      <div><label className="label">Date de la dépense</label><input type="date" name="expense_date" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
      <div className="sm:col-span-2"><label className="label">Description</label><input name="description" required placeholder="Ex. Affiches pour la conférence du 14/10" className="input" /></div>
      <div><label className="label">Montant (€)</label><input name="amount" required inputMode="decimal" placeholder="0,00" className="input" /></div>
      <div><label className="label">Événement concerné</label><select name="event_id" className="input"><option value="">Aucun</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
      <div className="sm:col-span-2"><label className="label">Photo du ticket ou facture</label>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={() => { if (pathRef.current) pathRef.current.value = ''; }}
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700" /></div>
      <div className="sm:col-span-2 flex items-center gap-3"><Submit>Envoyer la note de frais</Submit></div>
      {err && <p className="sm:col-span-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      {state?.error && <p className="sm:col-span-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="sm:col-span-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>}
    </form>
  );
}
