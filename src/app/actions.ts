'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { loadLedger } from '@/lib/auth';
import { parseAmount, round2 } from '@/lib/format';
import type { ActionState } from '@/components/Forms';

const fail = (error: string): ActionState => ({ error });
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const orNull = (v: string) => (v ? v : null);
const refresh = () => revalidatePath('/', 'layout');

export async function setFiscalYear(id: string) {
  (await cookies()).set('fy', id, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  refresh();
}

// ---------------------------------------------------------------- Ecritures
type Line = { account: string; debit?: number; credit?: number; label?: string; third_party_id?: string | null; event_id?: string | null };

export async function createEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const kind = str(fd, 'kind');
  const date = str(fd, 'date');
  const label = str(fd, 'label');
  const piece = str(fd, 'piece_ref');
  const event = orNull(str(fd, 'event_id'));
  const third = orNull(str(fd, 'third_party_id'));
  const account = str(fd, 'account');
  const method = str(fd, 'method') === '530' ? '530' : '512';
  const paid = str(fd, 'paid') !== 'later';
  const amount = parseAmount(fd.get('amount'));
  if (!date) return fail('Indique la date.');
  if (!label) return fail('Indique un libellé.');

  let lines: Line[] = [];
  let journal = 'OD';
  let validate = true;

  if (kind === 'libre') {
    try { lines = JSON.parse(str(fd, 'lines')); } catch { return fail('Lignes illisibles.'); }
    lines = lines.filter((l) => l.account && (Number(l.debit) || Number(l.credit)));
    if (lines.length < 2) return fail('Une écriture demande au moins 2 lignes.');
    validate = str(fd, 'validate') !== '0';
    const d = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
    const c = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
    if (d !== c) return fail(`Écriture déséquilibrée : débit ${d} / crédit ${c}.`);
    journal = str(fd, 'journal') || 'OD';
  } else {
    if (!(amount > 0)) return fail('Indique un montant supérieur à 0.');
    const cashJournal = method === '530' ? 'CA' : 'BQ';
    if (kind === 'depense') {
      if (!account) return fail('Choisis une catégorie.');
      if (!paid && !third) return fail('Choisis le fournisseur pour une dépense à payer plus tard.');
      journal = paid ? cashJournal : 'AC';
      lines = [
        { account, debit: amount, label, event_id: event, third_party_id: third },
        { account: paid ? method : '401', credit: amount, label, third_party_id: paid ? null : third },
      ];
    } else if (kind === 'recette') {
      if (!account) return fail('Choisis une catégorie.');
      if (!paid && !third) return fail('Choisis le client ou financeur pour une recette à encaisser plus tard.');
      journal = paid ? cashJournal : 'VE';
      lines = [
        { account: paid ? method : '411', debit: amount, label, third_party_id: paid ? null : third },
        { account, credit: amount, label, event_id: event, third_party_id: third },
      ];
    } else if (kind === 'reglement_fournisseur') {
      if (!third) return fail('Choisis le fournisseur réglé.');
      journal = cashJournal;
      lines = [{ account: '401', debit: amount, label, third_party_id: third }, { account: method, credit: amount, label }];
    } else if (kind === 'reglement_client') {
      if (!third) return fail('Choisis le client ou financeur qui a payé.');
      journal = cashJournal;
      lines = [{ account: method, debit: amount, label }, { account: '411', credit: amount, label, third_party_id: third }];
    } else if (kind === 'virement') {
      const retrait = str(fd, 'direction') !== 'depot';   // retrait : banque -> caisse
      journal = 'OD';
      lines = retrait
        ? [{ account: '530', debit: amount, label }, { account: '512', credit: amount, label }]
        : [{ account: '512', debit: amount, label }, { account: '530', credit: amount, label }];
    } else return fail('Type d\'écriture inconnu.');
  }

  const { data, error } = await supabase.rpc('post_entry', {
    p_date: date, p_journal: journal, p_label: label, p_piece: piece || null, p_lines: lines, p_validate: validate,
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, id: String(data), message: 'Écriture enregistrée.' };
}

export async function validateEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('validate_entry', { p_entry: str(fd, 'id') });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteDraft(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('entries').delete().eq('id', str(fd, 'id')).eq('status', 'brouillon');
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function reverseEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const date = str(fd, 'date') || new Date().toISOString().slice(0, 10);
  const { error } = await supabase.rpc('reverse_entry', { p_entry: str(fd, 'id'), p_date: date });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Contre-passation enregistrée.' };
}

export async function addDocument(entryId: string, path: string, name: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('entry_documents').insert({ entry_id: entryId, storage_path: path, file_name: name });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const path = str(fd, 'path');
  const { error } = await supabase.from('entry_documents').delete().eq('id', str(fd, 'id'));
  if (error) return fail(error.message);
  await supabase.storage.from('justificatifs').remove([path]);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Tiers, comptes
export async function saveThirdParty(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const name = str(fd, 'name');
  if (!name) return fail('Nom obligatoire.');
  const { error } = await supabase.from('third_parties').insert({
    name, kind: str(fd, 'kind') || 'fournisseur', email: orNull(str(fd, 'email')), notes: orNull(str(fd, 'notes')),
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Tiers ajouté.' };
}

export async function saveAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const number = str(fd, 'number');
  const label = str(fd, 'label');
  if (!/^[0-9]{2,8}$/.test(number)) return fail('Numéro de compte : 2 à 8 chiffres.');
  if (!label) return fail('Libellé obligatoire.');
  const { error } = await supabase.from('accounts').insert({ number, label });
  if (error) return fail(error.code === '23505' ? 'Ce numéro existe déjà.' : error.message);
  refresh();
  return { ok: true, message: 'Compte ajouté.' };
}

export async function toggleAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').update({ active: str(fd, 'active') === 'true' }).eq('id', str(fd, 'id'));
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Evénements et budget
export async function saveEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const code = str(fd, 'code').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const name = str(fd, 'name');
  if (!code || !name) return fail('Code et nom obligatoires.');
  const { error } = await supabase.from('events').insert({
    fiscal_year_id: str(fd, 'fy'), code, name, event_date: orNull(str(fd, 'event_date')), hosted_by_bde: fd.get('bde') === 'on',
  });
  if (error) return fail(error.code === '23505' ? 'Ce code existe déjà dans cet exercice.' : error.message);
  refresh();
  return { ok: true, message: 'Événement ajouté.' };
}

export async function updateEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const code = str(fd, 'code').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const name = str(fd, 'name');
  if (!code || !name) return fail('Code et nom obligatoires.');
  const { data, error } = await supabase.from('events').update({
    code, name, event_date: orNull(str(fd, 'event_date')), hosted_by_bde: fd.get('bde') === 'on', notes: orNull(str(fd, 'notes')),
  }).eq('id', str(fd, 'id')).select('id');
  if (error) return fail(error.code === '23505' ? 'Ce code existe déjà dans cet exercice.' : error.message);
  if (!data || data.length === 0) return fail('Modification refusée (droits insuffisants).');
  refresh();
  return { ok: true, message: 'Événement modifié.' };
}

export async function deleteEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(fd, 'id');
  const { count } = await supabase.from('entry_lines').select('id', { count: 'exact', head: true }).eq('event_id', id);
  if ((count ?? 0) > 0) return fail('Impossible de supprimer : des écritures sont rattachées à cet événement.');
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function saveBudgetLine(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const amount = parseAmount(fd.get('amount'));
  if (!(amount >= 0)) return fail('Montant invalide.');
  const { data: acc } = await supabase.from('accounts').select('id').eq('number', str(fd, 'account')).single();
  if (!acc) return fail('Compte introuvable.');
  const { error } = await supabase.from('budget_lines').insert({
    fiscal_year_id: str(fd, 'fy'), event_id: orNull(str(fd, 'event_id')), account_id: acc.id,
    label: orNull(str(fd, 'label')), amount, planned_date: orNull(str(fd, 'planned_date')),
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Ligne de budget ajoutée.' };
}

export async function deleteBudgetLine(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('budget_lines').delete().eq('id', str(fd, 'id'));
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Notes de frais
export async function submitClaim(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const amount = parseAmount(fd.get('amount'));
  if (!(amount > 0)) return fail('Indique un montant supérieur à 0.');
  const description = str(fd, 'description');
  if (!description) return fail('Décris la dépense.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Session expirée.');
  const { data: profile } = await supabase.from('profiles').select('full_name,email').eq('id', user.id).single();
  const { error } = await supabase.from('expense_claims').insert({
    claimant_id: user.id, claimant_name: str(fd, 'claimant_name') || profile?.full_name || profile?.email || 'Membre',
    description, amount, expense_date: str(fd, 'expense_date'), event_id: orNull(str(fd, 'event_id')),
    document_path: orNull(str(fd, 'document_path')),
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Note de frais envoyée.' };
}

export async function validateClaim(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('validate_claim', {
    p_claim: str(fd, 'id'), p_account: orNull(str(fd, 'account')), p_event: orNull(str(fd, 'event_id')),
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function refuseClaim(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('refuse_claim', { p_claim: str(fd, 'id'), p_reason: str(fd, 'reason') || 'Refusée' });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function payClaim(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('pay_claim', {
    p_claim: str(fd, 'id'), p_date: str(fd, 'date') || new Date().toISOString().slice(0, 10), p_cash: str(fd, 'method') === '530',
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteClaim(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('expense_claims').delete().eq('id', str(fd, 'id'));
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Banque
export async function importBank(rows: { date: string; label: string; amount: number }[]): Promise<ActionState> {
  const supabase = await createClient();
  const seen = new Map<string, number>();
  const payload = rows.map((r) => {
    const base = `${r.date}|${r.label}|${r.amount.toFixed(2)}`;
    const k = (seen.get(base) ?? 0) + 1;
    seen.set(base, k);
    return { tx_date: r.date, label: r.label.slice(0, 300), amount: r.amount, import_hash: `${base}|${k}` };
  });
  if (!payload.length) return fail('Aucune ligne à importer.');
  const { data, error } = await supabase
    .from('bank_transactions')
    .upsert(payload, { onConflict: 'import_hash', ignoreDuplicates: true })
    .select('id');
  if (error) return fail(error.message);
  refresh();
  const added = data?.length ?? 0;
  return { ok: true, message: `${added} ligne(s) importée(s), ${payload.length - added} déjà présente(s).` };
}

export async function matchTx(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('match_bank_transaction', { p_tx: str(fd, 'tx'), p_line: str(fd, 'line') });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function unmatchTx(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('unmatch_bank_transaction', { p_tx: str(fd, 'tx') });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function bookTx(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('book_bank_transaction', {
    p_tx: str(fd, 'tx'), p_account: str(fd, 'account'), p_label: str(fd, 'label') || 'Opération bancaire',
    p_event: orNull(str(fd, 'event_id')), p_third: orNull(str(fd, 'third_party_id')), p_piece: orNull(str(fd, 'piece_ref')),
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteTx(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('bank_transactions').delete().eq('id', str(fd, 'id')).is('matched_line_id', null);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Exercices
export async function saveFiscalYear(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('fiscal_years').insert({
    label: str(fd, 'label'), start_date: str(fd, 'start_date'), end_date: str(fd, 'end_date'),
  });
  if (error) return fail(error.message.includes('exclusion') ? 'Cet exercice chevauche un autre exercice.' : error.message);
  refresh();
  return { ok: true, message: 'Exercice créé.' };
}

export async function closeFiscalYear(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('close_fiscal_year', { p_fy: str(fd, 'id'), p_next_label: orNull(str(fd, 'next_label')) });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Exercice clôturé, à-nouveaux créés dans l\'exercice suivant.' };
}

/** Stock final de marchandises : ajuste 370 / 6037 pour atteindre la valeur saisie. */
export async function adjustStock(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const fyId = str(fd, 'fy');
  const target = parseAmount(fd.get('value'));
  if (!(target >= 0)) return fail('Valeur de stock invalide.');
  const { data: fy } = await supabase.from('fiscal_years').select('*').eq('id', fyId).single();
  if (!fy) return fail('Exercice introuvable.');
  const rows = await loadLedger(fyId);
  const current = round2(rows.filter((r) => r.account_number === '370').reduce((s, r) => s + r.debit - r.credit, 0));
  const delta = round2(target - current);
  if (delta === 0) return { ok: true, message: 'Le stock est déjà à cette valeur.' };
  const lines: Line[] = delta > 0
    ? [{ account: '370', debit: delta, label: 'Stock final' }, { account: '6037', credit: delta, label: 'Variation de stock' }]
    : [{ account: '6037', debit: -delta, label: 'Variation de stock' }, { account: '370', credit: -delta, label: 'Stock final' }];
  const { error } = await supabase.rpc('post_entry', {
    p_date: fy.end_date, p_journal: 'OD', p_label: `Variation de stock ${fy.label}`, p_piece: null, p_lines: lines, p_validate: true,
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Stock ajusté.' };
}

// ---------------------------------------------------------------- Paramètres
export async function updateSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('settings').update({
    association_name: str(fd, 'association_name'), rna: orNull(str(fd, 'rna')), address: orNull(str(fd, 'address')),
    bank_name: orNull(str(fd, 'bank_name')), validation_threshold: parseAmount(fd.get('validation_threshold')) || 200,
    bank_opening_balance: parseAmount(fd.get('bank_opening_balance')) || 0,
  }).eq('id', 1);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Paramètres enregistrés.' };
}

export async function updateRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role: str(fd, 'role'), full_name: orNull(str(fd, 'full_name')) }).eq('id', str(fd, 'id'));
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: 'Membre mis à jour.' };
}
