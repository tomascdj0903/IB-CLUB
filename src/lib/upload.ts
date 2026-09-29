'use client';
import { createClient } from '@/lib/supabase/client';

/** Envoie un justificatif directement vers le stockage Supabase (sans passer par le serveur Vercel). */
export async function uploadJustificatif(file: File, prefix: string) {
  const supabase = createClient();
  const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const path = `${prefix}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from('justificatifs').upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return { path, name: file.name };
}
