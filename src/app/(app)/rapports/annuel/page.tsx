import { requireMember, getCurrentFY, getSettings, loadLedger } from '@/lib/auth';
import { accMap, getAccounts, getBudget, getEvents } from '@/lib/data';
import { bilan, budgetTotals, contributionsVolontaires, eventResults, incomeStatement } from '@/lib/reports';
import { PageHeader, Stat, Notice, Amount } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { AmountTable, ReportHeader } from '@/components/ReportBits';
import { eur, fmtDate, today } from '@/lib/format';

export default async function Annuel() {
  await requireMember();
  const { fy, all } = await getCurrentFY();
  if (!fy) return <Notice tone="warn">Aucun exercice.</Notice>;
  const prev = all.find((y) => y.end_date < fy.start_date && y.id !== fy.id);  // all est trié du plus récent au plus ancien
  const [rows, prevRows, budget, accounts, events, settings] = await Promise.all([
    loadLedger(fy.id), prev ? loadLedger(prev.id) : Promise.resolve([]), getBudget(fy.id), getAccounts(false), getEvents(fy.id), getSettings(),
  ]);
  const acc = accMap(accounts);
  const is = incomeStatement(rows);
  const ps = incomeStatement(prevRows);
  const b = bilan(rows);
  const cv = contributionsVolontaires(rows);
  const bt = budgetTotals(budget, acc);
  const results = eventResults(events, budget, rows, acc).filter((r) => r.budget.charges + r.budget.produits + r.actual.charges + r.actual.produits > 0);
  const withPrev = (list: typeof is.charges, pl: typeof is.charges) => list.map((a) => ({ ...a, prev: pl.find((p) => p.number === a.number)?.amount ?? 0 }));
  const title = `Bilan annuel : exercice ${fy.label}`;
  const cmp = prev ? { total: 0, label: `Exercice ${prev.label}` } : undefined;

  return (
    <>
      <PageHeader title={title} subtitle={`${fmtDate(fy.start_date)} au ${fmtDate(fy.end_date)}${fy.closed ? '' : ' · exercice en cours (chiffres provisoires)'}`} actions={<PrintButton />} />
      <ReportHeader assoc={settings.association_name} title={title} period={`${fmtDate(fy.start_date)} au ${fmtDate(fy.end_date)} · édité le ${fmtDate(today())}`} />
      {!fy.closed && <div className="mb-4 no-print"><Notice tone="warn">L'exercice n'est pas clôturé : ces chiffres peuvent encore changer.</Notice></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total des recettes" value={eur(is.totalProduits)} hint={`Budget ${eur(bt.produits)}`} />
        <Stat label="Total des dépenses" value={eur(is.totalCharges)} hint={`Budget ${eur(bt.charges)}`} />
        <Stat label="Résultat" value={<Amount value={is.resultat} signed />} tone={is.resultat >= 0 ? 'good' : 'bad'} hint={`Budget ${eur(bt.net)}`} />
        <Stat label="Total du bilan" value={eur(b.totalActif)} />
      </div>

      <section className="card card-pad mt-6">
        <h2 className="mb-2">Rapport financier (à présenter à l'assemblée générale)</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Sur l'exercice {fy.label}, {settings.association_name} a enregistré {eur(is.totalProduits)} de recettes et {eur(is.totalCharges)} de dépenses, soit un {is.resultat >= 0 ? 'excédent' : 'déficit'} de {eur(Math.abs(is.resultat))}.
          {bt.produits + bt.charges > 0 && <> Le budget prévoyait {eur(bt.produits)} de recettes et {eur(bt.charges)} de dépenses, soit un résultat de {eur(bt.net)}.</>}
          {' '}Le total du bilan s'élève à {eur(b.totalActif)}.
          {results.length > 0 && <> {results.length} événement(s) ou opération(s) ont été suivis en analytique.</>}
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AmountTable title="Compte de résultat : produits" rows={withPrev(is.produits, ps.produits)} total={is.totalProduits} totalLabel="Total produits" compare={cmp && { ...cmp, total: ps.totalProduits }} />
        <AmountTable title="Compte de résultat : charges" rows={withPrev(is.charges, ps.charges)} total={is.totalCharges} totalLabel="Total charges" compare={cmp && { ...cmp, total: ps.totalCharges }} />
      </div>
      <div className="mt-4 card card-pad flex justify-between text-sm font-semibold"><span>Résultat de l'exercice</span><Amount value={is.resultat} signed /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AmountTable title="Bilan : actif" rows={b.actif} total={b.totalActif} totalLabel="Total actif" />
        <AmountTable title="Bilan : passif" rows={b.passif} total={b.totalPassif} totalLabel="Total passif" />
      </div>

      {(cv.emplois.length > 0 || cv.ressources.length > 0) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AmountTable title="Contributions volontaires : emplois" rows={cv.emplois} total={cv.totalEmplois} totalLabel="Total" />
          <AmountTable title="Contributions volontaires : ressources" rows={cv.ressources} total={cv.totalRessources} totalLabel="Total" />
        </div>
      )}

      {results.length > 0 && (
        <section className="card mt-6 overflow-x-auto">
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-sm font-semibold">Résultat par événement</div>
          <table className="w-full">
            <thead><tr><th className="th">Événement</th><th className="th num">Recettes</th><th className="th num">Dépenses</th><th className="th num">Net réel</th><th className="th num">Net prévu</th></tr></thead>
            <tbody>{results.map((r) => <tr key={r.event.id} className="border-t border-slate-50"><td className="td font-medium">{r.event.name}</td><td className="td num">{eur(r.actual.produits)}</td><td className="td num">{eur(r.actual.charges)}</td><td className="td num"><Amount value={r.actual.net} signed /></td><td className="td num text-ink-soft">{eur(r.budget.net)}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      <section className="card card-pad mt-6">
        <h2 className="mb-2">Annexe simplifiée</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>Comptes tenus en partie double selon le plan comptable des associations (règlement ANC 2018-06), en comptabilité d'engagement.</li>
          <li>Exercice du {fmtDate(fy.start_date)} au {fmtDate(fy.end_date)}. Écritures numérotées, validées, non modifiables ; toute correction passe par une contre-passation.</li>
          <li>Les événements portés par le BDE ne figurent pas dans les comptes de l'association.</li>
          <li>Les stocks de marchandises (miel, roses, etc.) sont valorisés au coût d'achat.</li>
          <li>À compléter par le bureau : engagements hors bilan, événements postérieurs à la clôture, mises à disposition gratuites de salles.</li>
        </ul>
      </section>
    </>
  );
}
