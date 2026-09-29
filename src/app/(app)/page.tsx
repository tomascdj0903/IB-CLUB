import Link from 'next/link';
import { getCurrentFY, getSettings, loadLedger, requireMember } from '@/lib/auth';
import { accMap, getAccounts, getBudget, getEvents } from '@/lib/data';
import { budgetTotals, cashBalance, cashSeries, eventResults, incomeStatement, plannedSeries } from '@/lib/reports';
import { PageHeader, Stat, Notice, Amount } from '@/components/ui';
import { TreasuryChart, LegendDot, BudgetBars } from '@/components/charts';
import { eur, fmtDate, today } from '@/lib/format';

export default async function Dashboard() {
  const { supabase } = await requireMember();
  const { fy } = await getCurrentFY();
  if (!fy) return <Notice tone="warn">Aucun exercice n'existe encore. Crée-en un dans « Exercices ».</Notice>;

  const [rows, budget, events, accounts, settings] = await Promise.all([
    loadLedger(fy.id), getBudget(fy.id), getEvents(fy.id), getAccounts(false), getSettings(),
  ]);
  const acc = accMap(accounts);
  const [drafts, missing, unmatched, claims] = await Promise.all([
    supabase.from('entries').select('id', { count: 'exact', head: true }).eq('fiscal_year_id', fy.id).eq('status', 'brouillon'),
    supabase.from('v_entries').select('id', { count: 'exact', head: true }).eq('fiscal_year_id', fy.id).eq('status', 'validee').eq('has_expense', true).eq('docs', 0),
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).is('matched_line_id', null),
    supabase.from('expense_claims').select('id,status', { count: 'exact' }).in('status', ['soumise', 'validee']),
  ]);

  const cash = cashBalance(rows);
  const is = incomeStatement(rows);
  const bt = budgetTotals(budget, acc);
  const actual = cashSeries(rows, fy.start_date);
  const planned = plannedSeries(budget, acc, fy.start_date);
  const minPlanned = Math.min(0, ...planned.map((p) => p.balance));
  const results = eventResults(events, budget, rows, acc);
  const withBudget = results.filter((r) => r.budget.charges + r.budget.produits > 0);
  const t = today();
  const upcoming = events.filter((e) => e.event_date && e.event_date >= t).slice(0, 4);

  const alerts: { tone: 'warn' | 'bad' | 'info'; text: string; href: string }[] = [];
  if (minPlanned < 0) alerts.push({ tone: 'bad', text: `Trésorerie prévue négative jusqu'à ${eur(minPlanned)} : prévoir un apport de départ.`, href: '/budget' });
  if (cash < 0) alerts.push({ tone: 'bad', text: `Le solde banque + caisse est négatif (${eur(cash)}).`, href: '/banque' });
  if ((drafts.count ?? 0) > 0) alerts.push({ tone: 'warn', text: `${drafts.count} écriture(s) en brouillon à valider.`, href: '/ecritures?statut=brouillon' });
  if ((missing.count ?? 0) > 0) alerts.push({ tone: 'warn', text: `${missing.count} dépense(s) sans justificatif.`, href: '/ecritures?sans=justificatif' });
  if ((unmatched.count ?? 0) > 0) alerts.push({ tone: 'info', text: `${unmatched.count} ligne(s) de relevé bancaire à pointer.`, href: '/banque' });
  if ((claims.count ?? 0) > 0) alerts.push({ tone: 'info', text: `${claims.count} note(s) de frais en cours de traitement.`, href: '/notes-de-frais' });

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle={`Exercice ${fy.label} (${fmtDate(fy.start_date)} au ${fmtDate(fy.end_date)})`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Trésorerie (banque + caisse)" value={eur(cash)} tone={cash < 0 ? 'bad' : 'neutral'} hint={`Solde d'ouverture ${eur(settings.bank_opening_balance)}`} />
        <Stat label="Résultat provisoire" value={<Amount value={is.resultat} signed />} hint={`${eur(is.totalProduits)} de recettes, ${eur(is.totalCharges)} de dépenses`} />
        <Stat label="Recettes prévues" value={eur(bt.produits)} hint={`Réalisé : ${eur(is.totalProduits)}`} />
        <Stat label="Dépenses prévues" value={eur(bt.charges)} hint={`Réalisé : ${eur(is.totalCharges)}`} />
      </div>

      {alerts.length > 0 && (
        <div className="mt-6 grid gap-2">
          {alerts.map((a, i) => (
            <Link key={i} href={a.href}><Notice tone={a.tone}>{a.text}</Notice></Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card card-pad lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2>Trésorerie : réel et prévu</h2>
            <div className="flex gap-4"><LegendDot color="#2f3d99" label="Réel" /><LegendDot color="#a9b2d6" label="Prévu (budget)" dashed /></div>
          </div>
          <TreasuryChart actual={actual} planned={planned} start={fy.start_date} end={fy.end_date} today={t} />
        </section>
        <section className="card card-pad lg:col-span-2">
          <h2 className="mb-4">Dépenses : réel / budget par événement</h2>
          {withBudget.length === 0 ? <p className="text-sm text-ink-faint">Aucun budget par événement.</p> : (
            <BudgetBars rows={withBudget.filter((r) => r.budget.charges > 0).map((r) => ({ label: r.event.name, budget: r.budget.charges, actual: r.actual.charges }))} />
          )}
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5"><h2>Prochains événements</h2><Link href="/evenements" className="text-sm text-brand-700 hover:underline">Tout voir</Link></div>
        <table className="mt-3 w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">Date</th><th className="th">Événement</th><th className="th num">Budget net</th><th className="th num">Réel net</th></tr></thead>
          <tbody>
            {upcoming.length === 0 && <tr><td colSpan={4} className="td text-ink-faint">Aucun événement à venir.</td></tr>}
            {upcoming.map((e) => {
              const r = results.find((x) => x.event.id === e.id)!;
              return (
                <tr key={e.id} className="border-b border-slate-50 last:border-0">
                  <td className="td">{fmtDate(e.event_date)}</td>
                  <td className="td font-medium">{e.name} {e.hosted_by_bde && <span className="badge-mute ml-2">BDE</span>}</td>
                  <td className="td num"><Amount value={r.budget.net} signed /></td>
                  <td className="td num"><Amount value={r.actual.net} signed /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
