import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';

const reports = [
  { href: '/rapports/mensuel', title: 'Bilan mensuel', text: 'Recettes et dépenses du mois, solde de fin de mois, écart au budget, contrôles.', who: 'Bureau' },
  { href: '/rapports/trimestriel', title: 'Bilan trimestriel', text: 'Compte de résultat du trimestre, résultat par événement, subventions, prévision de trésorerie.', who: 'Bureau, financeurs' },
  { href: '/rapports/annuel', title: 'Bilan annuel', text: 'Bilan, compte de résultat, contributions volontaires et rapport financier pour l\'AG.', who: 'AG, université, banque' },
  { href: '/evenements', title: 'Bilan par événement', text: 'Budget contre réel, recettes, dépenses et résultat net de chaque événement.', who: 'Bureau, sponsors' },
  { href: '/rapports/balance', title: 'Balance des comptes', text: 'Total débit, crédit et solde de chaque compte de l\'exercice.', who: 'Trésorier, expert-comptable' },
  { href: '/rapports/grand-livre', title: 'Grand livre', text: 'Toutes les écritures d\'un compte, avec le solde cumulé.', who: 'Trésorier' },
];

export default function Rapports() {
  return (
    <>
      <PageHeader title="Rapports" subtitle="Tous les rapports se calculent sur l'exercice sélectionné et s'exportent en PDF (bouton Imprimer, puis « Enregistrer au format PDF »)." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link key={r.href} href={r.href} className="card card-pad transition hover:-translate-y-0.5 hover:border-brand-200">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon name="chart" className="h-5 w-5" /></div>
            <div className="font-semibold">{r.title}</div>
            <p className="mt-1 text-sm text-ink-soft">{r.text}</p>
            <div className="mt-3 text-xs text-ink-faint">Pour : {r.who}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
