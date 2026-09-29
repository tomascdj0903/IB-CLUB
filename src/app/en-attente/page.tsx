import { getSessionContext } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Waiting() {
  const { profile } = await getSessionContext();
  if (profile && profile.role !== 'en_attente') redirect('/');
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card card-pad max-w-md text-center">
        <h1>Accès en attente</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Ton compte est créé, mais le trésorier doit encore t'attribuer un rôle (Paramètres &gt; Membres) avant que tu puisses voir les comptes.
        </p>
        <form action="/auth/signout" method="post" className="mt-5"><button className="btn-ghost">Se déconnecter</button></form>
      </div>
    </main>
  );
}
