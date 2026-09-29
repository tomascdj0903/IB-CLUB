import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { LedgerRow } from '@/lib/types';

const d8 = (s: string) => s.replace(/-/g, '');
const fr = (n: number) => n.toFixed(2).replace('.', ',');
const clean = (v: unknown) => String(v ?? '').replace(/[\t\r\n|]+/g, ' ');

const JOURNALS: Record<string, string> = { BQ: 'Banque', CA: 'Caisse', AC: 'Achats et dépenses', VE: 'Ventes et recettes', OD: 'Opérations diverses', AN: 'À-nouveaux' };

/** Fichier des écritures comptables au format FEC (18 colonnes, séparateur tabulation). */
export async function GET(request: NextRequest) {
  const fy = new URL(request.url).searchParams.get('fy');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !fy) return new NextResponse('Non autorisé', { status: 401 });
  const { data: year } = await supabase.from('fiscal_years').select('label,end_date').eq('id', fy).single();
  const { data: settings } = await supabase.from('settings').select('rna').eq('id', 1).single();
  const rows: LedgerRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('v_ledger').select('*').eq('fiscal_year_id', fy).eq('status', 'validee').order('entry_number').order('position').range(from, from + 999);
    rows.push(...((data ?? []) as LedgerRow[]));
    if (!data || data.length < 1000) break;
  }
  const { data: valid } = await supabase.from('entries').select('id,validated_at').eq('fiscal_year_id', fy).eq('status', 'validee');
  const vd = new Map((valid ?? []).map((e) => [e.id as string, String(e.validated_at ?? '').slice(0, 10)]));
  const head = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'];
  const body = rows.map((r) => [
    r.journal_code, JOURNALS[r.journal_code] ?? r.journal_code, r.entry_number, d8(r.entry_date), r.account_number, clean(r.account_label), '', '',
    clean(r.piece_ref || `E${r.entry_number}`), d8(r.entry_date), clean(r.line_label || r.entry_label), fr(Number(r.debit)), fr(Number(r.credit)), '', '', d8(vd.get(r.entry_id) ?? r.entry_date), '', '',
  ].join('\t'));
  const siren = (settings?.rna ?? 'ASSO').replace(/\W/g, '');
  const name = `${siren}FEC${d8(year?.end_date ?? '')}.txt`;
  return new NextResponse([head.join('\t'), ...body].join('\r\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });
}
