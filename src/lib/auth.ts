import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { FiscalYear, Profile, Role, Settings } from '@/lib/types';

export async function getSessionContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return { supabase, user, profile: profile as Profile | null };
}

export async function requireMember() {
  const ctx = await getSessionContext();
  if (!ctx.profile || ctx.profile.role === 'en_attente') redirect('/en-attente');
  return { ...ctx, profile: ctx.profile as Profile };
}

export const canWrite = (role: Role) => role === 'tresorier';
export const canApprove = (role: Role) => role === 'tresorier' || role === 'president';

export async function getFiscalYears() {
  const supabase = await createClient();
  const { data } = await supabase.from('fiscal_years').select('*').order('start_date', { ascending: false });
  return (data ?? []) as FiscalYear[];
}

/** Exercice choisi (cookie), sinon celui qui couvre aujourd'hui, sinon le plus récent. */
export async function getCurrentFY() {
  const all = await getFiscalYears();
  const jar = await cookies();
  const wanted = jar.get('fy')?.value;
  const t = new Date().toISOString().slice(0, 10);
  const fy =
    all.find((f) => f.id === wanted) ??
    all.find((f) => f.start_date <= t && t <= f.end_date) ??
    all[0] ??
    null;
  return { fy, all };
}

export async function getSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
  return (data ?? { association_name: 'Association', validation_threshold: 200, bank_opening_balance: 0, rna: null, address: null, bank_name: null }) as Settings;
}

/** Charge tout le grand livre validé d'un exercice (quelques milliers de lignes au maximum). */
export async function loadLedger(fyId: string, includeDrafts = false) {
  const supabase = await createClient();
  const rows: import('@/lib/types').LedgerRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('v_ledger').select('*').eq('fiscal_year_id', fyId).order('entry_date').range(from, from + 999);
    if (!includeDrafts) q = q.eq('status', 'validee');
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as import('@/lib/types').LedgerRow[]).map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit) })));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
