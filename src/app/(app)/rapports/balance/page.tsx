import { requireMember, getCurrentFY, loadLedger, getSettings } from '@/lib/auth';
import { PageHeader, Notice } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { ReportHeader } from '@/components/ReportBits';
import { totalsByAccount } from '@/lib/reports';
import { eur, fmtDate } from '@/lib/format';

export default async function Balance() {
  await requireMember();
  const { fy } = await getCurrentFY();
  if (!fy) return <Notice tone="warn">Aucun exercice.</Notice>;
  const [rows, settings] = await Promise.all([loadLedger(fy.id), getSettings()]);
  const t = totalsByAccount(rows);
  const D = t.reduce((s, a) => s + a.debit, 0), C = t.reduce((s, a) => s + a.credit, 0);
  return (
    <>
      <PageHeader title="Balance des comptes" subtitle={`Exercice ${fy.label}`} actions={<PrintButton />} />
      <ReportHeader assoc={settings.association_name} title="Balance des comptes" period={`Exercice ${fy.label}`} />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">Compte</th><th className="th">Libellé</th><th className="th num">Débit</th><th className="th num">Crédit</th><th className="th num">Solde débiteur</th><th className="th num">Solde créditeur</th></tr></thead>
          <tbody>{t.map((a) => (
            <tr key={a.number} className="border-b border-slate-50 last:border-0">
              <td className="td font-mono text-xs"><a className="hover:text-brand-700" href={`/rapports/grand-livre?compte=${a.number}`}>{a.number}</a></td><td className="td">{a.label}</td>
              <td className="td num">{eur(a.debit)}</td><td className="td num">{eur(a.credit)}</td>
              <td className="td num">{a.balance > 0 ? eur(a.balance) : ''}</td><td className="td num">{a.balance < 0 ? eur(-a.balance) : ''}</td>
            </tr>))}</tbody>
          <tfoot><tr className="border-t border-slate-200 font-semibold"><td className="td" colSpan={2}>Totaux {D === C ? '(équilibrée)' : '(DÉSÉQUILIBRÉE)'}</td><td className="td num">{eur(D)}</td><td className="td num">{eur(C)}</td><td colSpan={2} /></tr></tfoot>
        </table>
      </div>
      <p className="no-print mt-3 text-xs text-ink-faint">Édité le {fmtDate(new Date())}.</p>
    </>
  );
}
