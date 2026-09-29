import { requireMember, getCurrentFY, getSettings, loadLedger } from '@/lib/auth';
import { accMap, getAccounts, getBudget, getEvents } from '@/lib/data';
import { budgetTotals, cashBalance, eventResults, incomeStatement, inRange, quartersOf } from '@/lib/reports';
import { PageHeader, Stat, Notice, Amount } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { AmountTable, ReportHeader } from '@/components/ReportBits';
import { eur, fmtDate, round2, today } from '@/lib/format';

export default async function Trimestriel({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requireMember();
  const { fy } = await getCurrentFY();
  const sp = await searchParams;
  if (!fy) return <Notice tone="warn">Aucun exercice.</Notice>;
  const qs = quartersOf(fy);
  const now = today();
  const auto = qs.find((q) => inRange(now, q.from, q.to))?.index ?? 1;
  const idx = Math.min(qs.length, Math.max(1, Number(sp.t) || auto));
  const q = qs[idx - 1];
  const [rows, budget, accounts, events, settings] = await Promise.all([loadLedger(fy.id), getBudget(fy.id), getAccounts(false), getEvents(fy.id), getSettings()]);
  const acc = accMap(accounts);
  const inQ = (r: { entry_date: string }) => inRange(r.entry_date, q.from, q.to);
  const qr = incomeStatement(rows, inQ);
  const cum = incomeStatement(rows, (r) => r.entry_date <= q.to);
  const cash = cashBalance(rows, q.to);
  const cumRows = rows.filter((r) => r.entry_date <= q.to);
  const results = eventResults(events, budget.filter((b) => !b.planned_date || b.planned_date <= q.to), cumRows, acc).filter((r) => r.budget.charges + r.budget.produits + r.actual.charges + r.actual.produits > 0);
  const subv = rows.filter((r) => r.account_number === '741' && r.entry_date <= q.to).reduce((s, r) => s + r.credit - r.debit, 0);
  const subvDue = rows.filter((r) => r.account_number === '441' && r.entry_date <= q.to).reduce((s, r) => s + r.debit - r.credit, 0);
  const next = qs[idx];
  const upcoming = next ? budgetTotals(budget, acc, (b) => !!b.planned_date && inRange(b.planned_date, next.from, next.to)) : null;
  const forecast = upcoming ? round2(cash + upcoming.net) : null;

  return (
    <>
      <PageHeader title={`Bilan trimestriel : ${q.label}`} subtitle={`${fmtDate(q.from)} au ${fmtDate(q.to)} · exercice ${fy.label}`}
        actions={<><form className="flex gap-2"><select name="t" defaultValue={idx} className="input w-auto">{qs.map((x) => <option key={x.index} value={x.index}>{x.label} ({fmtDate(x.from)} au {fmtDate(x.to)})</option>)}</select><button className="btn-ghost">Afficher</button></form><PrintButton /></>} />
      <ReportHeader assoc={settings.association_name} title={`Bilan trimestriel ${q.label}`} period={`${fmtDate(q.from)} au ${fmtDate(q.to)} · exercice ${fy.label}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recettes du trimestre" value={eur(qr.totalProduits)} />
        <Stat label="Dépenses du trimestre" value={eur(qr.totalCharges)} />
        <Stat label="Résultat du trimestre" value={<Amount value={qr.resultat} signed />} tone={qr.resultat >= 0 ? 'good' : 'bad'} hint={`Cumul exercice : ${eur(cum.resultat)}`} />
        <Stat label="Trésorerie fin de trimestre" value={eur(cash)} tone={cash < 0 ? 'bad' : 'neutral'} hint={forecast !== null ? `Estimation fin ${next.label} : ${eur(forecast)}` : undefined} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AmountTable title="Recettes du trimestre" rows={qr.produits} total={qr.totalProduits} totalLabel="Total recettes" />
        <AmountTable title="Dépenses du trimestre" rows={qr.charges} total={qr.totalCharges} totalLabel="Total dépenses" />
      </div>

      <section className="card mt-6 overflow-x-auto">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-sm font-semibold">Résultat par événement (cumul à fin {q.label})</div>
        <table className="w-full">
          <thead><tr><th className="th">Événement</th><th className="th num">Budget net</th><th className="th num">Réel net</th><th className="th num">Écart</th></tr></thead>
          <tbody>
            {results.length === 0 && <tr><td colSpan={4} className="td text-ink-faint">Aucun événement chiffré.</td></tr>}
            {results.map((r) => <tr key={r.event.id} className="border-t border-slate-50"><td className="td font-medium">{r.event.name}</td><td className="td num"><Amount value={r.budget.net} signed /></td><td className="td num"><Amount value={r.actual.net} signed /></td><td className="td num"><Amount value={r.actual.net - r.budget.net} signed /></td></tr>)}
          </tbody>
        </table>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3">Subventions</h2>
          <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-ink-soft">Subventions comptabilisées (compte 741)</dt><dd className="tabular-nums">{eur(subv)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Subventions restant à recevoir (compte 441)</dt><dd className="tabular-nums">{eur(subvDue)}</dd></div></dl>
        </section>
        <section className="card card-pad">
          <h2 className="mb-3">Prévision de trésorerie</h2>
          {upcoming && next ? (
            <p className="text-sm text-ink-soft">Budget du trimestre suivant ({next.label}) : {eur(upcoming.produits)} de recettes et {eur(upcoming.charges)} de dépenses prévues, soit {eur(upcoming.net)} net. Trésorerie estimée à fin {next.label} : <strong className="text-ink">{eur(forecast ?? 0)}</strong>.</p>
          ) : <p className="text-sm text-ink-faint">Dernier trimestre de l'exercice : pas de prévision.</p>}
        </section>
      </div>
    </>
  );
}
