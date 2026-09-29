import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember, loadLedger, canWrite } from '@/lib/auth';
import { accMap, getAccounts, getBudget } from '@/lib/data';
import { budgetTotals, incomeStatement } from '@/lib/reports';
import { PageHeader, Stat, Amount } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { ActionForm, Submit } from '@/components/Forms';
import { updateEvent } from '@/app/actions';
import { eur, fmtDate } from '@/lib/format';
import type { EventRow } from '@/lib/types';

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireMember();
  const { data } = await supabase.from('events').select('*').eq('id', id).single();
  if (!data) notFound();
  const ev = data as EventRow;
  const [rows, budget, accounts] = await Promise.all([loadLedger(ev.fiscal_year_id), getBudget(ev.fiscal_year_id), getAccounts(false)]);
  const acc = accMap(accounts);
  const mine = rows.filter((r) => r.event_id === ev.id);
  const is = incomeStatement(mine);
  const bt = budgetTotals(budget, acc, (b) => b.event_id === ev.id);
  const lines = mine.filter((r) => r.class === 6 || r.class === 7);

  return (
    <>
      <PageHeader title={`Bilan : ${ev.name}`} subtitle={`${ev.event_date ? fmtDate(ev.event_date) : 'Date à définir'}${ev.hosted_by_bde ? ' · Porté par le BDE' : ''}`}
        actions={<><PrintButton /><Link href="/evenements" className="btn-ghost">Retour</Link></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Recettes" value={eur(is.totalProduits)} hint={`Prévu ${eur(bt.produits)}`} />
        <Stat label="Dépenses" value={eur(is.totalCharges)} hint={`Prévu ${eur(bt.charges)}`} />
        <Stat label="Résultat net" value={<Amount value={is.resultat} signed />} hint={`Prévu ${eur(bt.net)}`} tone={is.resultat >= 0 ? 'good' : 'bad'} />
      </div>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">Date</th><th className="th">Écriture</th><th className="th">Compte</th><th className="th num">Dépense</th><th className="th num">Recette</th></tr></thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={5} className="td text-ink-faint">Aucune écriture rattachée à cet événement.</td></tr>}
            {lines.map((l) => (
              <tr key={l.line_id} className="border-b border-slate-50 last:border-0">
                <td className="td whitespace-nowrap">{fmtDate(l.entry_date)}</td>
                <td className="td"><Link className="hover:text-brand-700" href={`/ecritures/${l.entry_id}`}>{l.entry_label}</Link></td>
                <td className="td text-ink-soft"><span className="font-mono text-xs">{l.account_number}</span> {l.account_label}</td>
                <td className="td num">{l.class === 6 ? eur(l.debit - l.credit) : ''}</td>
                <td className="td num">{l.class === 7 ? eur(l.credit - l.debit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canWrite(profile.role) && (
        <section className="card card-pad mt-6 print:hidden">
          <h2 className="mb-4">Modifier l'événement</h2>
          <ActionForm action={updateEvent} className="grid gap-4 sm:grid-cols-5">
            <input type="hidden" name="id" value={ev.id} />
            <div><label className="label">Code court</label><input name="code" required defaultValue={ev.code} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Nom</label><input name="name" required defaultValue={ev.name} className="input" /></div>
            <div><label className="label">Date</label><input type="date" name="event_date" defaultValue={ev.event_date ?? ''} className="input" /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="bde" defaultChecked={ev.hosted_by_bde} /> Porté par le BDE</label>
            <div className="sm:col-span-5"><label className="label">Notes</label><textarea name="notes" rows={2} defaultValue={ev.notes ?? ''} className="input" /></div>
            <div className="sm:col-span-5"><Submit>Enregistrer</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
