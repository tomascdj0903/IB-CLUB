'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/components/Forms';

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') ?? '').trim(),
    password: String(fd.get('password') ?? ''),
  });
  if (error) return { error: 'E-mail ou mot de passe incorrect.' };
  redirect('/');
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;
  const password = String(fd.get('password') ?? '');
  if (password.length < 8) return { error: 'Mot de passe : 8 caractères minimum.' };
  const { data, error } = await supabase.auth.signUp({
    email: String(fd.get('email') ?? '').trim(),
    password,
    options: { data: { full_name: String(fd.get('full_name') ?? '').trim() }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect('/');
  return { ok: true, message: 'Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi. Le trésorier devra ensuite valider ton accès.' };
}
