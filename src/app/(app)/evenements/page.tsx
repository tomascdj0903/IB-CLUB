import Link from 'next/link';
import { requireMember, getCurrentFY, loadLedger, canWrite } from '@/lib/auth';
import { accMap, getAccounts, getBudget, getEvents } from '@/lib/data';
import { eventResults } from '@/lib/reports';
import { PageHeader, Notice, Amount, Empty } from '@/components/ui';
import { ActionForm, Submit } from '@/components/Forms';
import { saveEvent } from '@/app/actions';
import { fmtDate } from '@/lib/format';

export default async function Evenements() {
  const { profile } = await requireMember();
  const { fy } = await getCurrentFY();
  if (!fy) return <Notice tone="warn">Aucun exercice.</Notice>;
  const [events, budget, accounts, rows] = await Promise.all([getEvents(fy.id), getBudget(fy.id), getAccounts(false), loadLedger(fy.id)]);
  const results = eventResults(events, budget, rows, accMap(accounts));
  const write = canWrite(profile.role) && !fy.closed;
  return (
    <>
      <PageHeader title="Événements" subtitle="Chaque événement a son budget et son résultat net (analytique). Sélectionne-le à la saisie d'une dépense ou d'une recette." />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">Date</th><th className="th">Événement</th><th className="th num">Dépenses prévues</th><th className="th num">Recettes prévues</th><th className="th num">Dépenses réelles</th><th className="th num">Recettes réelles</th><th className="th num">Net réel</th></tr></thead>
          <tbody>
            {results.length === 0 && <tr><td colSpan={7}><Empty>Aucun événement.</Empty></td></tr>}
            {results.map((r) => (
              <tr key={r.event.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="td whitespace-nowrap">{r.event.event_date ? fmtDate(r.event.event_date) : 'À définir'}</td>
                <td className="td"><Link href={`/evenements/${r.event.id}`} className="font-medium hover:text-brand-700">{r.event.name}</Link>{r.event.hosted_by_bde && <span className="badge-mute ml-2">BDE</span>}</td>
                <td className="td num">{r.budget.charges ? <Amount value={r.budget.charges} /> : '-'}</td>
                <td className="td num">{r.budget.produits ? <Amount value={r.budget.produits} /> : '-'}</td>
                <td className="td num">{r.actual.charges ? <Amount value={r.actual.charges} /> : '-'}</td>
                <td className="td num">{r.actual.produits ? <Amount value={r.actual.produits} /> : '-'}</td>
                <td className="td num"><Amount value={r.actual.net} signed /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {write && (
        <section className="card card-pad mt-6">
          <h2 className="mb-4">Ajouter un événement</h2>
          <ActionForm action={saveEvent} resetOnSuccess className="grid gap-4 sm:grid-cols-5">
            <input type="hidden" name="fy" value={fy.id} />
            <div><label className="label">Code court</label><input name="code" required placeholder="GALA" className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Nom</label><input name="name" required className="input" /></div>
            <div><label className="label">Date</label><input type="date" name="event_date" className="input" /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="bde" /> Porté par le BDE</label>
            <div className="sm:col-span-5"><Submit>Ajouter</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
