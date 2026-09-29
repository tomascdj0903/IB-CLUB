import Link from 'next/link';
import { requireMember, getCurrentFY, loadLedger, getSettings } from '@/lib/auth';
import { getAccounts } from '@/lib/data';
import { PageHeader, Notice } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { ReportHeader } from '@/components/ReportBits';
import { eur, fmtDate, round2 } from '@/lib/format';

export default async function GrandLivre({ searchParams }: { searchParams: Promise<{ compte?: string }> }) {
  await requireMember();
  const { fy } = await getCurrentFY();
  const sp = await searchParams;
  if (!fy) return <Notice tone="warn">Aucun exercice.</Notice>;
  const [rows, accounts, settings] = await Promise.all([loadLedger(fy.id), getAccounts(false), getSettings()]);
  const used = new Set(rows.map((r) => r.account_number));
  const list = accounts.filter((a) => used.has(a.number));
  const compte = sp.compte && used.has(sp.compte) ? sp.compte : list[0]?.number;
  const lines = rows.filter((r) => r.account_number === compte).sort((a, b) => a.entry_date.localeCompare(b.entry_date) || (a.entry_number ?? 0) - (b.entry_number ?? 0));
  let run = 0;
  const label = accounts.find((a) => a.number === compte)?.label ?? '';
  return (
    <>
      <PageHeader title="Grand livre" subtitle={`Exercice ${fy.label}`}
        actions={<><form className="flex gap-2"><select name="compte" defaultValue={compte} className="input w-auto">{list.map((a) => <option key={a.id} value={a.number}>{a.number} · {a.label}</option>)}</select><button className="btn-ghost">Afficher</button></form><PrintButton /></>} />
      <ReportHeader assoc={settings.association_name} title={`Grand livre : ${compte} ${label}`} period={`Exercice ${fy.label}`} />
      {!compte ? <Notice tone="info">Aucune écriture validée dans cet exercice.</Notice> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-100"><th className="th">Date</th><th className="th">N°</th><th className="th">Écriture</th><th className="th num">Débit</th><th className="th num">Crédit</th><th className="th num">Solde</th></tr></thead>
            <tbody>{lines.map((l) => { run = round2(run + l.debit - l.credit); return (
              <tr key={l.line_id} className="border-b border-slate-50 last:border-0">
                <td className="td whitespace-nowrap">{fmtDate(l.entry_date)}</td><td className="td text-ink-faint">{l.entry_number}</td>
                <td className="td"><Link className="hover:text-brand-700" href={`/ecritures/${l.entry_id}`}>{l.entry_label}</Link></td>
                <td className="td num">{l.debit ? eur(l.debit) : ''}</td><td className="td num">{l.credit ? eur(l.credit) : ''}</td><td className="td num font-medium">{eur(run)}</td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
