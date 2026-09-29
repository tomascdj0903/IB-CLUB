'use client';
import { useState } from 'react';
import { ActionForm, Submit } from '@/components/Forms';
import { signIn, signUp } from './actions';

export default function LoginPage() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 via-paper to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-700 text-xl font-bold text-white shadow-card">IB</div>
          <h1>IB Club IAE Nice</h1>
          <p className="mt-1 text-sm text-ink-soft">Comptabilité de l'association</p>
        </div>
        <div className="card card-pad">
          <ActionForm action={mode === 'in' ? signIn : signUp} className="space-y-4" key={mode}>
            {mode === 'up' && (
              <div><label className="label">Nom complet</label><input name="full_name" required className="input" autoComplete="name" /></div>
            )}
            <div><label className="label">E-mail</label><input name="email" type="email" required className="input" autoComplete="email" /></div>
            <div><label className="label">Mot de passe</label><input name="password" type="password" required minLength={8} className="input" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></div>
            <Submit className="btn-primary w-full">{mode === 'in' ? 'Se connecter' : 'Créer mon compte'}</Submit>
          </ActionForm>
          <button onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="mt-4 w-full text-center text-sm text-brand-700 hover:underline">
            {mode === 'in' ? 'Première visite ? Créer un compte' : 'J\'ai déjà un compte'}
          </button>
        </div>
      </div>
    </main>
  );
}
