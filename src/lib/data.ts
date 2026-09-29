import { createClient } from '@/lib/supabase/server';
import type { Account, BudgetLine, EventRow, ThirdParty } from '@/lib/types';

export async function getAccounts(onlyActive = true) {
  const supabase = await createClient();
  let q = supabase.from('accounts').select('*').order('number');
  if (onlyActive) q = q.eq('active', true);
  const { data } = await q;
  return (data ?? []) as Account[];
}

export async function getEvents(fyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('events').select('*').eq('fiscal_year_id', fyId).order('event_date', { nullsFirst: false }).order('code');
  return (data ?? []) as EventRow[];
}

export async function getThirdParties() {
  const supabase = await createClient();
  const { data } = await supabase.from('third_parties').select('*').order('name');
  return (data ?? []) as ThirdParty[];
}

export async function getBudget(fyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('budget_lines').select('*').eq('fiscal_year_id', fyId).order('planned_date', { nullsFirst: false });
  return ((data ?? []) as BudgetLine[]).map((b) => ({ ...b, amount: Number(b.amount) }));
}

export const accMap = (accounts: Account[]) => new Map(accounts.map((a) => [a.id, a]));
