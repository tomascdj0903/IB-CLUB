import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember, canWrite } from '@/lib/auth';
import { PageHeader, EntryBadge, Notice } from '@/components/ui';
import { ActionButton } from '@/components/Forms';
import { DocUploader } from '@/components/DocUploader';
import { deleteDocument, deleteDraft, reverseEntry, validateEntry } from '@/app/actions';
import { eur, fmtDate, today } from '@/lib/format';
import type { EntryRow, LedgerRow } from '@/lib/types';
import { ActionForm, Submit } from '@/components/Forms';

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireMember();
  const { data: entry } = await supabase.from('v_entries').select('*').eq('id', id).single();
  if (!entry) notFound();
  const e = entry as EntryRow & { created_by: string | null; validated_at: string | null };
  const [{ data: lines }, { data: docs }, { data: fy }, { data: rev }, { data: origin }, { data: third }, { data: events }] = await Promise.all([
    supabase.from('v_ledger').select('*').eq('entry_id', id).order('position'),
    supabase.from('entry_documents').select('*').eq('entry_id', id).order('created_at'),
    supabase.from('fiscal_years').select('label,closed').eq('id', e.fiscal_year_id).single(),
    supabase.from('entries').select('id,label').eq('reverses_entry_id', id).maybeSingle(),
    e.reverses_entry_id ? supabase.from('entries').select('id,label').eq('id', e.reverses_entry_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('third_parties').select('id,name'),
    supabase.from('events').select('id,name'),
  ]);
  const L = ((lines ?? []) as LedgerRow[]);
  const tp = new Map((third ?? []).map((t) => [t.id, t.name as string]));
  const ev = new Map((events ?? []).map((t) => [t.id, t.name as string]));
  const signed = await Promise.all((docs ?? []).map(async (d) => {
    const { data } = await supabase.storage.from('justificatifs').createSignedUrl(d.storage_path, 3600);
    return { ...d, url: data?.signedUrl as string | undefined };
  }));
  const write = canWrite(profile.role);
  const totalD = L.reduce((s, l) => s + Number(l.debit), 0);
  const totalC = L.reduce((s, l) => s + Number(l.credit), 0);

  return (
    <>
      <PageHeader title={e.label} subtitle={<span className="flex flex-wrap items-center gap-2"><EntryBadge status={e.status} /> {e.number ? `Écriture n° ${e.number}` : 'Sans numéro (brouillon)'} · Journal {e.journal_code} · {fmtDate(e.entry_date)} · Exercice {fy?.label}</span>}
        actions={<Link href="/ecritures" className="btn-ghost">Retour</Link>} />
      {origin && <div className="mb-4"><Notice tone="info">Contre-passation de <Link className="underline" href={`/ecritures/${origin.id}`}>{origin.label}</Link>.</Notice></div>}
      {rev && <div className="mb-4"><Notice tone="warn">Cette écriture a été contre-passée : <Link className="underline" href={`/ecritures/${rev.id}`}>voir la contre-passation</Link>.</Notice></div>}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">Compte</th><th className="th">Libellé</th><th className="th">Tiers / événement</th><th className="th num">Débit</th><th className="th num">Crédit</th></tr></thead>
          <tbody>
            {L.map((l) => (
              <tr key={l.line_id} className="border-b border-slate-50 last:border-0">
                <td className="td"><span className="font-mono text-xs">{l.account_number}</span> <span className="text-ink-soft">{l.account_label}</span></td>
                <td className="td">{l.line_label}</td>
                <td className="td text-ink-soft">{[l.third_party_id && tp.get(l.third_party_id), l.event_id && ev.get(l.event_id)].filter(Boolean).join(' · ')}</td>
                <td className="td num">{Number(l.debit) ? eur(l.debit) : ''}</td>
                <td className="td num">{Number(l.credit) ? eur(l.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-slate-200 font-medium"><td colSpan={3} className="td">Total</td><td className="td num">{eur(totalD)}</td><td className="td num">{eur(totalC)}</td></tr></tfoot>
        </table>
      </div>

      <section className="card card-pad mt-6">
        <div className="mb-3 flex items-center justify-between"><h2>Justificatifs</h2>{!fy?.closed && <DocUploader entryId={id} />}</div>
        {signed.length === 0 ? <p className="text-sm text-ink-faint">{e.has_expense ? 'Aucun justificatif : une dépense doit en avoir un.' : 'Aucun justificatif.'}</p> : (
          <ul className="divide-y divide-slate-100">
            {signed.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <a href={d.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{d.file_name}</a>
                {write && !fy?.closed && <ActionButton action={deleteDocument} label="Retirer" confirm="Retirer ce justificatif ?" hidden={{ id: d.id, path: d.storage_path }} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {write && !fy?.closed && (
        <section className="mt-6 flex flex-wrap items-start gap-3">
          {e.status === 'brouillon' && (<>
            <ActionButton action={validateEntry} label="Valider l'écriture" className="btn-primary" hidden={{ id }} />
            <ActionButton action={deleteDraft} label="Supprimer le brouillon" className="btn-danger" confirm="Supprimer ce brouillon ?" hidden={{ id }} />
          </>)}
          {e.status === 'validee' && !rev && !e.reverses_entry_id && (
            <ActionForm action={reverseEntry} className="card card-pad flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={id} />
              <div><label className="label">Date de la contre-passation</label><input type="date" name="date" defaultValue={today()} className="input" /></div>
              <Submit className="btn-danger">Contre-passer (corriger)</Submit>
              <p className="w-full text-xs text-ink-faint">Une écriture validée ne se modifie pas : on l'annule par une écriture inverse, puis on saisit la bonne.</p>
            </ActionForm>
          )}
        </section>
      )}
    </>
  );
}
