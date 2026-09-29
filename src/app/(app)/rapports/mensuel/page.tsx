import { requireMember, getCurrentFY, getSettings, loadLedger } from '@/lib/auth';
import { accMap, getAccounts, getBudget } from '@/lib/data';
import { budgetTotals, cashBalance, incomeStatement, inRange, monthRange, monthsOf } from '@/lib/reports';
import { PageHeader, Stat, Notice, Amount } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { AmountTable, ReportHeader } from '@/components/ReportBits';
import { eur, monthLabel, today, fmtDate } from '@/lib/format';

export default async function Mensuel({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { supabase } = await requireMember();
  const { fy } = await getCurrentFY();
  const sp = await searchParams;
  if (!fy) return <Notice tone="warn">Aucun exercice.</Notice>;
  const months = monthsOf(fy);
  const t = today().slice(0, 7);
  const m = sp.m && months.includes(sp.m) ? sp.m : months.includes(t) ? t : months[0];
  const { from, to } = monthRange(m);
  const [rows, budget, accounts, settings] = await Promise.all([loadLedger(fy.id), getBudget(fy.id), getAccounts(false), getSettings()]);
  const acc = accMap(accounts);
  const inMonth = (r: { entry_date: string }) => inRange(r.entry_date, from, to);
  const month = incomeStatement(rows, inMonth);
  const ytd = incomeStatement(rows, (r) => r.entry_date <= to);
  const withYtd = (list: typeof month.charges, ytdList: typeof month.charges) => list.map((a) => ({ ...a, prev: ytdList.find((y) => y.number === a.number)?.amount ?? 0 }));
  const cash = cashBalance(rows, to);
  const bt = budgetTotals(budget, acc, (b) => !!b.planned_date && b.planned_date <= to);
  const top = rows.filter((r) => r.class === 6 && inMonth(r) && r.debit - r.credit > 0).sort((a, b) => b.debit - b.credit - (a.debit - a.credit)).slice(0, 5);

  const [drafts, unmatched, missing] = await Promise.all([
    supabase.from('entries').select('id', { count: 'exact', head: true }).eq('fiscal_year_id', fy.id).eq('status', 'brouillon').gte('entry_date', from).lte('entry_date', to),
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).is('matched_line_id', null).gte('tx_date', from).lte('tx_date', to),
    supabase.from('v_entries').select('id', { count: 'exact', head: true }).eq('fiscal_year_id', fy.id).eq('status', 'validee').eq('has_expense', true).eq('docs', 0).gte('entry_date', from).lte('entry_date', to),
  ]);

  return (
    <>
      <PageHeader title={`Bilan mensuel : ${monthLabel(m)}`} subtitle={`Exercice ${fy.label}`}
        actions={<><form className="flex gap-2"><select name="m" defaultValue={m} className="input w-auto">{months.map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select><button className="btn-ghost">Afficher</button></form><PrintButton /></>} />
      <ReportHeader assoc={settings.association_name} title={`Bilan mensuel : ${monthLabel(m)}`} period={`Exercice ${fy.label} · édité le ${fmtDate(today())}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recettes du mois" value={eur(month.totalProduits)} />
        <Stat label="Dépenses du mois" value={eur(month.totalCharges)} />
        <Stat label="Résultat du mois" value={<Amount value={month.resultat} signed />} tone={month.resultat >= 0 ? 'good' : 'bad'} />
        <Stat label="Trésorerie fin de mois" value={eur(cash)} tone={cash < 0 ? 'bad' : 'neutral'} hint="Banque + caisse" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AmountTable title="Recettes par catégorie" rows={withYtd(month.produits, ytd.produits)} total={month.totalProduits} totalLabel="Total recettes" compare={{ total: ytd.totalProduits, label: 'Cumul exercice' }} />
        <AmountTable title="Dépenses par catégorie" rows={withYtd(month.charges, ytd.charges)} total={month.totalCharges} totalLabel="Total dépenses" compare={{ total: ytd.totalCharges, label: 'Cumul exercice' }} />
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-sm font-semibold">Cumul de l'exercice contre budget (à fin {monthLabel(m).toLowerCase()})</div>
        <table className="w-full">
          <thead><tr><th className="th" /><th className="th num">Budget prévu</th><th className="th num">Réalisé</th><th className="th num">Écart</th></tr></thead>
          <tbody>
            {[['Recettes', bt.produits, ytd.totalProduits], ['Dépenses', bt.charges, ytd.totalCharges]].map(([l, b, r]) => (
              <tr key={l as string} className="border-t border-slate-50"><td className="td font-medium">{l}</td><td className="td num">{eur(b as number)}</td><td className="td num">{eur(r as number)}</td><td className="td num"><Amount value={(r as number) - (b as number)} signed /></td></tr>
            ))}
            <tr className="border-t border-slate-200 font-semibold"><td className="td">Résultat</td><td className="td num">{eur(bt.net)}</td><td className="td num">{eur(ytd.resultat)}</td><td className="td num"><Amount value={ytd.resultat - bt.net} signed /></td></tr>
          </tbody>
        </table>
        <p className="px-5 pb-4 pt-2 text-xs text-ink-faint">Le budget prévu ne compte que les lignes datées jusqu'à cette fin de mois.</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3">5 plus grosses dépenses</h2>
          {top.length === 0 ? <p className="text-sm text-ink-faint">Aucune dépense ce mois-ci.</p> : (
            <ul className="divide-y divide-slate-100">{top.map((r) => <li key={r.line_id} className="flex justify-between py-2 text-sm"><span>{r.entry_label} <span className="text-ink-faint">· {fmtDate(r.entry_date)}</span></span><span className="tabular-nums">{eur(r.debit - r.credit)}</span></li>)}</ul>
          )}
        </section>
        <section className="card card-pad">
          <h2 className="mb-3">Contrôles du mois</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><span className={(unmatched.count ?? 0) === 0 ? 'badge-ok' : 'badge-warn'}>{(unmatched.count ?? 0) === 0 ? 'OK' : 'À voir'}</span>Rapprochement bancaire : {unmatched.count ?? 0} ligne(s) non pointée(s)</li>
            <li className="flex items-center gap-2"><span className={(drafts.count ?? 0) === 0 ? 'badge-ok' : 'badge-warn'}>{(drafts.count ?? 0) === 0 ? 'OK' : 'À voir'}</span>{drafts.count ?? 0} écriture(s) en brouillon</li>
            <li className="flex items-center gap-2"><span className={(missing.count ?? 0) === 0 ? 'badge-ok' : 'badge-warn'}>{(missing.count ?? 0) === 0 ? 'OK' : 'À voir'}</span>{missing.count ?? 0} dépense(s) sans justificatif</li>
          </ul>
        </section>
      </div>
    </>
  );
}
