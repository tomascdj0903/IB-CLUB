import { requireMember, canWrite } from '@/lib/auth';
import { getAccounts } from '@/lib/data';
import { PageHeader, Notice } from '@/components/ui';
import { ActionButton, ActionForm, Submit } from '@/components/Forms';
import { saveAccount, toggleAccount } from '@/app/actions';

const CLASSES: Record<number, string> = {
  1: 'Classe 1 : Capitaux', 2: 'Classe 2 : Immobilisations', 3: 'Classe 3 : Stocks', 4: 'Classe 4 : Tiers', 5: 'Classe 5 : Trésorerie',
  6: 'Classe 6 : Charges (dépenses)', 7: 'Classe 7 : Produits (recettes)', 8: 'Classe 8 : Contributions volontaires',
};

export default async function Plan() {
  const { profile } = await requireMember();
  const accounts = await getAccounts(false);
  const write = canWrite(profile.role);
  return (
    <>
      <PageHeader title="Plan comptable" subtitle="Comptes utilisables dans les écritures. Un compte utilisé ne peut plus être supprimé, seulement désactivé." />
      <div className="mb-4"><Notice tone="warn">Plan inspiré du règlement ANC 2018-06 (associations). À faire relire une fois par un expert-comptable ou le service vie associative de la fac.</Notice></div>
      <div className="space-y-4">
        {Object.entries(CLASSES).map(([c, title]) => {
          const list = accounts.filter((a) => a.class === Number(c));
          if (!list.length) return null;
          return (
            <div key={c} className="card overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-sm font-semibold">{title}</div>
              <table className="w-full"><tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="td w-24 font-mono text-xs">{a.number}</td>
                    <td className={`td ${a.active ? '' : 'text-ink-faint line-through'}`}>{a.label}</td>
                    <td className="td w-32 text-right">{write && <ActionButton action={toggleAccount} label={a.active ? 'Désactiver' : 'Réactiver'} hidden={{ id: a.id, active: String(!a.active) }} />}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          );
        })}
      </div>
      {write && (
        <section className="card card-pad mt-6">
          <h2 className="mb-4">Ajouter un compte</h2>
          <ActionForm action={saveAccount} resetOnSuccess className="grid gap-4 sm:grid-cols-4">
            <div><label className="label">Numéro</label><input name="number" required pattern="[0-9]{2,8}" placeholder="6064" className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Libellé</label><input name="label" required className="input" /></div>
            <div className="flex items-end"><Submit>Ajouter</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
