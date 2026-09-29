import { requireMember, getSettings, canWrite } from '@/lib/auth';
import { PageHeader, Notice } from '@/components/ui';
import { ActionForm, Submit } from '@/components/Forms';
import { updateRole, updateSettings } from '@/app/actions';
import type { Profile } from '@/lib/types';

const ROLES = [['tresorier', 'Trésorier (tous les droits)'], ['president', 'Présidence (valide les notes de frais)'], ['secretaire', 'Secrétariat (lecture, notes de frais)'], ['lecteur', 'Lecture seule'], ['en_attente', 'Accès refusé']];

export default async function Parametres() {
  const { supabase, profile } = await requireMember();
  const settings = await getSettings();
  const write = canWrite(profile.role);
  const { data } = await supabase.from('profiles').select('*').order('created_at');
  const members = (data ?? []) as Profile[];
  return (
    <>
      <PageHeader title="Paramètres" />
      {!write && <div className="mb-4"><Notice tone="info">Seul le trésorier peut modifier les paramètres.</Notice></div>}
      <section className="card card-pad">
        <h2 className="mb-4">Association</h2>
        <ActionForm action={updateSettings} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Nom</label><input name="association_name" defaultValue={settings.association_name} disabled={!write} className="input" /></div>
          <div><label className="label">N° RNA</label><input name="rna" defaultValue={settings.rna ?? ''} disabled={!write} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Adresse du siège</label><input name="address" defaultValue={settings.address ?? ''} disabled={!write} className="input" /></div>
          <div><label className="label">Banque</label><input name="bank_name" defaultValue={settings.bank_name ?? ''} disabled={!write} className="input" /></div>
          <div><label className="label">Solde d'ouverture du compte (€)</label><input name="bank_opening_balance" defaultValue={String(settings.bank_opening_balance)} disabled={!write} className="input" /></div>
          <div><label className="label">Seuil de double validation des dépenses (€)</label><input name="validation_threshold" defaultValue={String(settings.validation_threshold)} disabled={!write} className="input" /></div>
          {write && <div className="sm:col-span-2"><Submit>Enregistrer</Submit></div>}
        </ActionForm>
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="px-5 pt-5"><h2>Membres et droits</h2><p className="mt-1 text-sm text-ink-soft">Un nouveau compte n'a aucun accès tant que le trésorier ne lui attribue pas un rôle.</p></div>
        <div className="mt-3 divide-y divide-slate-100">
          {members.map((m) => (
            <ActionForm key={m.id} action={updateRole} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <input type="hidden" name="id" value={m.id} />
              <input name="full_name" defaultValue={m.full_name ?? ''} disabled={!write} className="input w-48" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{m.email}</span>
              <select name="role" defaultValue={m.role} disabled={!write} className="input w-64">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              {write && <Submit className="btn-ghost btn-sm">Enregistrer</Submit>}
            </ActionForm>
          ))}
        </div>
      </section>
    </>
  );
}
