import Link from 'next/link';
import { requireMember, getCurrentFY, loadLedger, canWrite } from '@/lib/auth';
import { getThirdParties } from '@/lib/data';
import { PageHeader, Amount, Empty } from '@/components/ui';
import { ActionForm, Submit } from '@/components/Forms';
import { saveThirdParty } from '@/app/actions';
import { round2 } from '@/lib/format';

const KINDS = ['fournisseur', 'client', 'membre', 'financeur', 'sponsor', 'autre'];

export default async function Tiers() {
  const { profile } = await requireMember();
  const { fy } = await getCurrentFY();
  const [third, rows] = await Promise.all([getThirdParties(), fy ? loadLedger(fy.id) : Promise.resolve([])]);
  const owed = new Map<string, number>();  // 401 : on doit ; 411/441 : on nous doit
  for (const r of rows) {
    if (!r.third_party_id) continue;
    if (r.account_number === '401') owed.set(r.third_party_id, round2((owed.get(r.third_party_id) ?? 0) + r.credit - r.debit));
    if (r.account_number === '411' || r.account_number === '441') owed.set(r.third_party_id, round2((owed.get(r.third_party_id) ?? 0) - (r.credit - r.debit)));
  }
  const write = canWrite(profile.role);
  return (
    <>
      <PageHeader title="Tiers" subtitle="Fournisseurs, clients, financeurs, sponsors et membres. Le solde montre ce qu'on doit (rouge) ou ce qu'on nous doit (vert)." />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100"><th className="th">Nom</th><th className="th">Type</th><th className="th">E-mail</th><th className="th num">Solde ouvert</th><th className="th" /></tr></thead>
          <tbody>
            {third.length === 0 && <tr><td colSpan={5}><Empty>Aucun tiers pour l'instant.</Empty></td></tr>}
            {third.map((t) => {
              const v = owed.get(t.id) ?? 0;
              return (
                <tr key={t.id} className="border-b border-slate-50 last:border-0">
                  <td className="td font-medium">{t.name}</td><td className="td"><span className="badge-mute">{t.kind}</span></td><td className="td text-ink-soft">{t.email}</td>
                  <td className="td num">{v === 0 ? '-' : <Amount value={-v} signed />}</td>
                  <td className="td text-right">{write && v > 0 && <Link className="btn-ghost btn-sm" href="/ecritures/nouvelle?type=reglement_fournisseur">Régler</Link>}{write && v < 0 && <Link className="btn-ghost btn-sm" href="/ecritures/nouvelle?type=reglement_client">Encaisser</Link>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {write && (
        <section className="card card-pad mt-6">
          <h2 className="mb-4">Ajouter un tiers</h2>
          <ActionForm action={saveThirdParty} resetOnSuccess className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2"><label className="label">Nom</label><input name="name" required className="input" /></div>
            <div><label className="label">Type</label><select name="kind" className="input">{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div><label className="label">E-mail</label><input name="email" type="email" className="input" /></div>
            <div className="sm:col-span-4"><Submit>Ajouter</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
