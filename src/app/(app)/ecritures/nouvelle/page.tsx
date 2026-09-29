import { requireMember, getCurrentFY, canWrite } from '@/lib/auth';
import { getAccounts, getEvents, getThirdParties } from '@/lib/data';
import { EntryForm } from '@/components/EntryForm';
import { PageHeader, Notice } from '@/components/ui';
import { today } from '@/lib/format';

export default async function NewEntry({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { profile } = await requireMember();
  const { fy } = await getCurrentFY();
  const sp = await searchParams;
  if (!canWrite(profile.role)) return <Notice tone="warn">Seul le trésorier peut saisir des écritures. Pour une dépense à rembourser, utilise « Notes de frais ».</Notice>;
  if (!fy || fy.closed) return <Notice tone="warn">L'exercice sélectionné est clôturé ou absent : choisis un exercice ouvert.</Notice>;
  const [accounts, events, third] = await Promise.all([getAccounts(), getEvents(fy.id), getThirdParties()]);
  const t = today();
  const def = t >= fy.start_date && t <= fy.end_date ? t : fy.start_date;
  const kinds = ['depense', 'recette', 'reglement_fournisseur', 'reglement_client', 'virement', 'libre'] as const;
  const initial = kinds.find((k) => k === sp.type) ?? 'depense';
  return (
    <>
      <PageHeader title="Nouvelle écriture" subtitle="Choisis le type d'opération : l'appli génère l'écriture en partie double." />
      <EntryForm accounts={accounts} events={events} thirdParties={third} defaultDate={def} minDate={fy.start_date} maxDate={fy.end_date} initialKind={initial} />
    </>
  );
}
