import Link from 'next/link';
import { requireMember, getCurrentFY, canWrite } from '@/lib/auth';
import { PageHeader, Empty, EntryBadge, LinkButton } from '@/components/ui';
import { eur, fmtDate } from '@/lib/format';
import type { EntryRow } from '@/lib/types';
import { monthsOf } from '@/lib/reports';
import { monthLabel } from '@/lib/format';
import { Icon } from '@/components/Icon';

export default async function Ecritures({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireMember();
  const { fy } = await getCurrentFY();
  const sp = await searchParams;
  if (!fy) return <Empty>Aucun exercice.</Empty>;

  let q = supabase.from('v_entries').select('*').eq('fiscal_year_id', fy.id).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(400);
  if (sp.q) q = q.ilike('label', `%${sp.q.replace(/[%,]/g, ' ')}%`);
  if (sp.statut === 'brouillon' || sp.statut === 'validee') q = q.eq('status', sp.statut);
  if (sp.journal) q = q.eq('journal_code', sp.journal);
  if (sp.mois) {
    const [y, m] = sp.mois.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    q = q.gte('entry_date', `${sp.mois}-01`).lte('entry_date', `${sp.mois}-${String(last).padStart(2, '0')}`);
  }
  if (sp.sans === 'justificatif') q = q.eq('has_expense', true).eq('docs', 0).eq('status', 'validee');
  const { data } = await q;
  const entries = (data ?? []) as EntryRow[];
  const months = monthsOf(fy);

  return (
    <>
      <PageHeader title="Écritures" subtitle={`Exercice ${fy.label} : ${entries.length} écriture(s) affichée(s)`}
        actions={<>
          <a className="btn-ghost" href={`/export/ecritures?fy=${fy.id}`}><Icon name="download" /> CSV</a>
          <a className="btn-ghost" href={`/export/fec?fy=${fy.id}`}><Icon name="download" /> FEC</a>
          {canWrite(profile.role) && !fy.closed && <LinkButton primary href="/ecritures/nouvelle"><Icon name="plus" /> Nouvelle écriture</LinkButton>}
        </>} />
      <form className="card card-pad mb-4 grid gap-3 sm:grid-cols-5">
        <input name="q" defaultValue={sp.q} placeholder="Rechercher un libellé…" className="input sm:col-span-2" />
        <select name="mois" defaultValue={sp.mois ?? ''} className="input"><option value="">Tous les mois</option>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
        <select name="statut" defaultValue={sp.statut ?? ''} className="input"><option value="">Tous statuts</option><option value="validee">Validées</option><option value="brouillon">Brouillons</option></select>
        <div className="flex gap-2"><select name="journal" defaultValue={sp.journal ?? ''} className="input"><option value="">Journaux</option>{['BQ', 'CA', 'AC', 'VE', 'OD', 'AN'].map((j) => <option key={j}>{j}</option>)}</select><button className="btn-primary">Filtrer</button></div>
        {sp.sans && <input type="hidden" name="sans" value={sp.sans} />}
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">N°</th><th className="th">Date</th><th className="th">Jnl</th><th className="th">Libellé</th><th className="th">Pièce</th><th className="th num">Montant</th><th className="th">Statut</th></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={7}><Empty>Aucune écriture.</Empty></td></tr>}
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="td text-ink-faint">{e.number ?? '-'}</td>
                <td className="td whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                <td className="td"><span className="badge-mute">{e.journal_code}</span></td>
                <td className="td"><Link href={`/ecritures/${e.id}`} className="font-medium hover:text-brand-700">{e.label}</Link>
                  {e.reverses_entry_id && <span className="badge-info ml-2">Contre-passation</span>}
                  {e.status === 'validee' && e.has_expense && e.docs === 0 && <span className="badge-warn ml-2">Sans justificatif</span>}
                </td>
                <td className="td text-ink-soft">{e.piece_ref}</td>
                <td className="td num">{eur(e.total)}</td>
                <td className="td"><EntryBadge status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
