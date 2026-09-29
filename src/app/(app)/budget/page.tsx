import { requireMember, getCurrentFY, loadLedger, canWrite } from '@/lib/auth';
import { accMap, getAccounts, getBudget, getEvents } from '@/lib/data';
import { budgetTotals, eventResults, plannedSeries } from '@/lib/reports';
import { PageHeader, Stat, Notice, Amount } from '@/components/ui';
import { ActionButton, ActionForm, Submit } from '@/components/Forms';
import { deleteBudgetLine, saveBudgetLine } from '@/app/actions';
import { TreasuryChart, LegendDot } from '@/components/charts';
import { cashSeries } from '@/lib/reports';
import { eur, fmtDate, today } from '@/lib/format';

export default async function BudgetPage() {
  const { profile } = await requireMember();
  const { fy } = await getCurrentFY();
  if (!fy) return <Notice tone="warn">Aucun exercice.</Notice>;
  const [budget, events, accounts, rows] = await Promise.all([getBudget(fy.id), getEvents(fy.id), getAccounts(false), loadLedger(fy.id)]);
  const acc = accMap(accounts);
  const totals = budgetTotals(budget, acc);
  const results = eventResults(events, budget, rows, acc);
  const planned = plannedSeries(budget, acc, fy.start_date);
  const actual = cashSeries(rows, fy.start_date);
  const low = planned.reduce((m, p) => (p.balance < m.balance ? p : m), { date: fy.start_date, balance: 0 });
  const write = canWrite(profile.role) && !fy.closed;
  const general = budget.filter((b) => !b.event_id);
  const catAccounts = accounts.filter((a) => a.active && (a.class === 6 || a.class === 7));

  return (
    <>
      <PageHeader title="Budget prévisionnel" subtitle={`Exercice ${fy.label}. Compare avec le réel, ligne par ligne et par événement.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Recettes prévues" value={eur(totals.produits)} />
        <Stat label="Dépenses prévues" value={eur(totals.charges)} />
        <Stat label="Résultat prévu" value={<Amount value={totals.net} signed />} tone={totals.net >= 0 ? 'good' : 'bad'} />
      </div>
      {low.balance < 0 && <div className="mt-4"><Notice tone="bad">Avec un solde de départ à 0 €, la trésorerie prévue descend à {eur(low.balance)} le {fmtDate(low.date)}. Il faut un apport (avance du BDE, subvention) d'au moins {eur(-low.balance)}.</Notice></div>}
      <section className="card card-pad mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2>Courbe de trésorerie</h2><div className="flex gap-4"><LegendDot color="#2f3d99" label="Réel" /><LegendDot color="#a9b2d6" label="Prévu" dashed /></div></div>
        <TreasuryChart actual={actual} planned={planned} start={fy.start_date} end={fy.end_date} today={today()} />
      </section>

      <div className="mt-6 space-y-4">
        {[...results.map((r) => ({ key: r.event.id, title: r.event.name, sub: r.event.event_date ? fmtDate(r.event.event_date) : 'Date à définir', bde: r.event.hosted_by_bde, r, lines: budget.filter((b) => b.event_id === r.event.id) })),
          ...(general.length ? [{ key: 'general', title: 'Hors événement', sub: '', bde: false, r: null, lines: general }] : [])]
          .filter((g) => g.lines.length > 0 || write).map((g) => (
          <div key={g.key} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div><div className="font-semibold">{g.title} {g.bde && <span className="badge-mute ml-2">Porté par le BDE</span>}</div><div className="text-xs text-ink-faint">{g.sub}</div></div>
              {g.r && <div className="text-xs text-ink-soft">Prévu net <Amount value={g.r.budget.net} signed /> · Réel net <Amount value={g.r.actual.net} signed /></div>}
            </div>
            {g.lines.length > 0 && (
              <table className="w-full border-t border-slate-100">
                <tbody>{g.lines.map((b) => {
                  const a = acc.get(b.account_id);
                  return (
                    <tr key={b.id} className="border-b border-slate-50 last:border-0">
                      <td className="td w-28 text-ink-faint">{fmtDate(b.planned_date)}</td>
                      <td className="td">{b.label} <span className="ml-1 font-mono text-xs text-ink-faint">{a?.number}</span></td>
                      <td className="td"><span className={a?.class === 7 ? 'badge-ok' : 'badge-mute'}>{a?.class === 7 ? 'Recette' : 'Dépense'}</span></td>
                      <td className="td num">{eur(b.amount)}</td>
                      <td className="td w-24 text-right">{write && <ActionButton action={deleteBudgetLine} label="Retirer" hidden={{ id: b.id }} />}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {write && (
        <section className="card card-pad mt-6">
          <h2 className="mb-4">Ajouter une ligne de budget</h2>
          <ActionForm action={saveBudgetLine} resetOnSuccess className="grid gap-4 sm:grid-cols-6">
            <input type="hidden" name="fy" value={fy.id} />
            <div className="sm:col-span-2"><label className="label">Événement</label><select name="event_id" className="input"><option value="">Hors événement</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label">Catégorie</label><select name="account" required className="input"><option value="">Choisir…</option>{catAccounts.map((a) => <option key={a.id} value={a.number}>{a.number} · {a.label}</option>)}</select></div>
            <div><label className="label">Montant (€)</label><input name="amount" required inputMode="decimal" className="input" /></div>
            <div><label className="label">Date prévue</label><input type="date" name="planned_date" min={fy.start_date} max={fy.end_date} className="input" /></div>
            <div className="sm:col-span-5"><label className="label">Libellé</label><input name="label" className="input" /></div>
            <div className="flex items-end"><Submit>Ajouter</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
