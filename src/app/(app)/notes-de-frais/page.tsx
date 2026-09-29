import { requireMember, getCurrentFY, getSettings, canApprove, canWrite } from '@/lib/auth';
import { getAccounts, getEvents } from '@/lib/data';
import { PageHeader, Empty, Amount } from '@/components/ui';
import { ActionButton, ActionForm, Submit } from '@/components/Forms';
import { ClaimForm } from '@/components/ClaimForm';
import { deleteClaim, payClaim, refuseClaim, validateClaim } from '@/app/actions';
import { eur, fmtDate, today } from '@/lib/format';
import type { Claim } from '@/lib/types';

const STATUS: Record<string, [string, string]> = {
  soumise: ['badge-warn', 'En attente'], validee: ['badge-info', 'Validée, à rembourser'],
  remboursee: ['badge-ok', 'Remboursée'], refusee: ['badge-bad', 'Refusée'],
};

export default async function Claims() {
  const { supabase, profile, user } = await requireMember();
  const { fy } = await getCurrentFY();
  const [settings, accounts, events] = await Promise.all([getSettings(), getAccounts(), fy ? getEvents(fy.id) : Promise.resolve([])]);
  const { data } = await supabase.from('expense_claims').select('*').order('created_at', { ascending: false }).limit(200);
  const claims = ((data ?? []) as Claim[]).map((c) => ({ ...c, amount: Number(c.amount) }));
  const signed = new Map<string, string>();
  await Promise.all(claims.filter((c) => c.document_path).map(async (c) => {
    const { data: s } = await supabase.storage.from('justificatifs').createSignedUrl(c.document_path!, 3600);
    if (s?.signedUrl) signed.set(c.id, s.signedUrl);
  }));
  const evName = new Map(events.map((e) => [e.id, e.name]));
  const expenseAccounts = accounts.filter((a) => a.class === 6);
  const approve = canApprove(profile.role);
  const write = canWrite(profile.role);
  const toPay = claims.filter((c) => c.status === 'validee').reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <PageHeader title="Notes de frais" subtitle={`Un membre avance une dépense, le bureau valide, le trésorier rembourse. Au-dessus de ${eur(settings.validation_threshold)}, deux validations sont nécessaires.`} />
      <section className="card card-pad">
        <h2 className="mb-4">Déposer une note de frais</h2>
        <ClaimForm events={events} defaultName={profile.full_name ?? ''} userId={user.id} />
      </section>

      {toPay > 0 && <p className="mt-6 text-sm text-ink-soft">Reste à rembourser : <strong className="text-ink">{eur(toPay)}</strong></p>}
      <div className="mt-3 space-y-3">
        {claims.length === 0 && <div className="card"><Empty>Aucune note de frais.</Empty></div>}
        {claims.map((c) => {
          const [cls, txt] = STATUS[c.status];
          const own = c.claimant_id === user.id;
          const needsSecond = c.status === 'soumise' && c.amount > settings.validation_threshold;
          return (
            <div key={c.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{c.description}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">{c.claimant_name} · {fmtDate(c.expense_date)}{c.event_id && evName.get(c.event_id) ? ` · ${evName.get(c.event_id)}` : ''}
                    {signed.get(c.id) && <> · <a className="text-brand-700 underline" href={signed.get(c.id)} target="_blank" rel="noreferrer">Justificatif</a></>}</div>
                  {c.refusal_reason && c.status === 'refusee' && <div className="mt-1 text-xs text-rose-700">Motif : {c.refusal_reason}</div>}
                  {needsSecond && <div className="mt-1 text-xs text-amber-700">{c.first_validator ? '1 validation sur 2 obtenue' : 'Deux validations requises'}</div>}
                </div>
                <div className="flex items-center gap-3"><Amount value={c.amount} /><span className={cls}>{txt}</span></div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                {approve && !own && c.status === 'soumise' && (
                  <>
                    <ActionForm action={validateClaim} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <div><label className="label">Catégorie</label>
                        <select name="account" required defaultValue="" className="input py-1.5 text-xs"><option value="">Choisir…</option>{expenseAccounts.map((a) => <option key={a.id} value={a.number}>{a.number} · {a.label}</option>)}</select></div>
                      <Submit className="btn-primary btn-sm">Valider</Submit>
                    </ActionForm>
                    <ActionForm action={refuseClaim} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input name="reason" placeholder="Motif du refus" className="input py-1.5 text-xs" />
                      <Submit className="btn-danger btn-sm">Refuser</Submit>
                    </ActionForm>
                  </>
                )}
                {approve && own && c.status === 'soumise' && <span className="text-xs text-ink-faint">Tu ne peux pas valider ta propre note.</span>}
                {write && c.status === 'validee' && (
                  <ActionForm action={payClaim} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <div><label className="label">Date</label><input type="date" name="date" defaultValue={today()} className="input py-1.5 text-xs" /></div>
                    <div><label className="label">Moyen</label><select name="method" className="input py-1.5 text-xs"><option value="512">Virement</option><option value="530">Espèces</option></select></div>
                    <Submit className="btn-primary btn-sm">Marquer remboursée</Submit>
                  </ActionForm>
                )}
                {own && c.status === 'soumise' && <ActionButton action={deleteClaim} label="Supprimer" className="btn-danger btn-sm" confirm="Supprimer cette note ?" hidden={{ id: c.id }} />}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
