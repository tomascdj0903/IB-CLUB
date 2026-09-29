import { requireMember, getCurrentFY, loadLedger, canWrite } from '@/lib/auth';
import { PageHeader, Notice, Amount } from '@/components/ui';
import { ActionForm, Submit } from '@/components/Forms';
import { adjustStock, closeFiscalYear, saveFiscalYear } from '@/app/actions';
import { incomeStatement } from '@/lib/reports';
import { eur, fmtDate, round2 } from '@/lib/format';

export default async function Exercices() {
  const { supabase, profile } = await requireMember();
  const { fy, all } = await getCurrentFY();
  const write = canWrite(profile.role);
  let checks: { ok: boolean; text: string }[] = [];
  let stock = 0;
  let result = 0;
  if (fy) {
    const rows = await loadLedger(fy.id);
    result = incomeStatement(rows).resultat;
    stock = round2(rows.filter((r) => r.account_number === '370').reduce((s, r) => s + r.debit - r.credit, 0));
    const [drafts, missing, unmatched, claims] = await Promise.all([
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('fiscal_year_id', fy.id).eq('status', 'brouillon'),
      supabase.from('v_entries').select('id', { count: 'exact', head: true }).eq('fiscal_year_id', fy.id).eq('status', 'validee').eq('has_expense', true).eq('docs', 0),
      supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).is('matched_line_id', null).gte('tx_date', fy.start_date).lte('tx_date', fy.end_date),
      supabase.from('expense_claims').select('id', { count: 'exact', head: true }).in('status', ['soumise', 'validee']),
    ]);
    checks = [
      { ok: (drafts.count ?? 0) === 0, text: (drafts.count ?? 0) === 0 ? 'Aucune écriture en brouillon' : `${drafts.count} écriture(s) en brouillon (bloquant)` },
      { ok: (unmatched.count ?? 0) === 0, text: (unmatched.count ?? 0) === 0 ? 'Rapprochement bancaire terminé' : `${unmatched.count} ligne(s) de relevé non pointée(s)` },
      { ok: (missing.count ?? 0) === 0, text: (missing.count ?? 0) === 0 ? 'Toutes les dépenses ont un justificatif' : `${missing.count} dépense(s) sans justificatif` },
      { ok: (claims.count ?? 0) === 0, text: (claims.count ?? 0) === 0 ? 'Notes de frais toutes traitées' : `${claims.count} note(s) de frais non soldée(s)` },
    ];
  }
  return (
    <>
      <PageHeader title="Exercices et clôture" subtitle="La clôture verrouille l'exercice et reporte les soldes dans le suivant (à-nouveaux)." />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">Exercice</th><th className="th">Début</th><th className="th">Fin</th><th className="th">Statut</th></tr></thead>
          <tbody>{all.map((y) => (
            <tr key={y.id} className="border-b border-slate-50 last:border-0"><td className="td font-medium">{y.label}</td><td className="td">{fmtDate(y.start_date)}</td><td className="td">{fmtDate(y.end_date)}</td>
              <td className="td">{y.closed ? <span className="badge-mute">Clôturé</span> : <span className="badge-ok">Ouvert</span>}</td></tr>
          ))}</tbody>
        </table>
      </div>

      {fy && !fy.closed && write && (
        <section className="card card-pad mt-6 space-y-5">
          <div><h2>Clôturer l'exercice {fy.label}</h2><p className="mt-1 text-sm text-ink-soft">Résultat provisoire : <Amount value={result} signed /></p></div>
          <ul className="space-y-2 text-sm">{checks.map((c, i) => <li key={i} className="flex items-center gap-2"><span className={c.ok ? 'badge-ok' : 'badge-warn'}>{c.ok ? 'OK' : 'À voir'}</span>{c.text}</li>)}</ul>
          <div className="border-t border-slate-100 pt-5">
            <h3 className="mb-2 text-sm font-semibold">Stock final de marchandises</h3>
            <p className="mb-3 text-xs text-ink-soft">Miel, roses, goodies invendus à la date de clôture. Stock actuellement comptabilisé : {eur(stock)}. Saisis la valeur d'achat du stock restant.</p>
            <ActionForm action={adjustStock} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="fy" value={fy.id} />
              <div><label className="label">Valeur du stock final (€)</label><input name="value" inputMode="decimal" defaultValue={String(stock)} className="input" /></div>
              <Submit className="btn-ghost">Ajuster le stock</Submit>
            </ActionForm>
          </div>
          <div className="border-t border-slate-100 pt-5">
            <ActionForm action={closeFiscalYear} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={fy.id} />
              <div><label className="label">Nom de l'exercice suivant (facultatif)</label><input name="next_label" placeholder="2027-2028" className="input" /></div>
              <Submit className="btn-danger">Clôturer définitivement</Submit>
            </ActionForm>
            <p className="mt-2 text-xs text-ink-faint">Irréversible : plus aucune écriture ne pourra être ajoutée ou modifiée dans cet exercice.</p>
          </div>
        </section>
      )}
      {fy?.closed && <div className="mt-6"><Notice tone="info">L'exercice {fy.label} est clôturé. Ses rapports restent disponibles dans « Rapports ».</Notice></div>}

      {write && (
        <section className="card card-pad mt-6">
          <h2 className="mb-4">Créer un exercice</h2>
          <ActionForm action={saveFiscalYear} resetOnSuccess className="grid gap-4 sm:grid-cols-4">
            <div><label className="label">Nom</label><input name="label" required placeholder="2027-2028" className="input" /></div>
            <div><label className="label">Début</label><input type="date" name="start_date" required className="input" /></div>
            <div><label className="label">Fin</label><input type="date" name="end_date" required className="input" /></div>
            <div className="flex items-end"><Submit>Créer</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
