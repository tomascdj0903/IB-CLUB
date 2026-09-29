import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { LedgerRow } from '@/lib/types';

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const fr = (n: number) => n.toFixed(2).replace('.', ',');

export async function GET(request: NextRequest) {
  const fy = new URL(request.url).searchParams.get('fy');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !fy) return new NextResponse('Non autorisé', { status: 401 });
  const rows: LedgerRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('v_ledger').select('*').eq('fiscal_year_id', fy).order('entry_date').order('entry_number').range(from, from + 999);
    rows.push(...((data ?? []) as LedgerRow[]));
    if (!data || data.length < 1000) break;
  }
  const head = ['N°', 'Date', 'Journal', 'Statut', 'Compte', 'Libellé compte', 'Écriture', 'Ligne', 'Pièce', 'Débit', 'Crédit'];
  const lines = rows.map((r) => [r.entry_number ?? '', r.entry_date, r.journal_code, r.status, r.account_number, q(r.account_label), q(r.entry_label), q(r.line_label), q(r.piece_ref), fr(Number(r.debit)), fr(Number(r.credit))].join(';'));
  const body = '﻿' + [head.join(';'), ...lines].join('\r\n');
  return new NextResponse(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ecritures.csv"' } });
}
