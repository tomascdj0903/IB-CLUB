import { requireMember, getCurrentFY, getSettings, canWrite } from '@/lib/auth';
import { getAccounts, getEvents, getThirdParties } from '@/lib/data';
import { PageHeader, Stat, Empty, Amount } from '@/components/ui';
import { ActionButton, ActionForm, Submit } from '@/components/Forms';
import { BankImport } from '@/components/BankImport';
import { bookTx, deleteTx, matchTx, unmatchTx } from '@/app/actions';
import { eur, fmtDate, round2 } from '@/lib/format';
import type { BankTx, LedgerRow } from '@/lib/types';

export default async function Banque({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { supabase, profile } = await requireMember();
  const { fy } = await getCurrentFY();
  const sp = await searchParams;
  const settings = await getSettings();
  const write = canWrite(profile.role);
  const [txRes, bankLines, accounts, third] = await Promise.all([
    supabase.from('bank_transactions').select('*').order('tx_date', { ascending: false }).order('imported_at', { ascending: false }).limit(1000),
    supabase.from('v_ledger').select('*').eq('account_number', '512').eq('status', 'validee').limit(3000),
    getAccounts(), getThirdParties(),
  ]);
  const events = fy ? await getEvents(fy.id) : [];
  const txs = ((txRes.data ?? []) as BankTx[]).map((t) => ({ ...t, amount: Number(t.amount) }));
  const lines = ((bankLines.data ?? []) as LedgerRow[]).map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit) }));
  const matchedLineIds = new Set(txs.map((t) => t.matched_line_id).filter(Boolean));
  const freeLines = lines.filter((l) => !matchedLineIds.has(l.line_id));

  const statement = round2(Number(settings.bank_opening_balance) + txs.reduce((s, t) => s + t.amount, 0));
  const books = round2(lines.reduce((s, l) => s + l.debit - l.credit, 0));
  const unmatched = txs.filter((t) => !t.matched_line_id);
  const shown = sp.vue === 'tout' ? txs : unmatched;
  const diff = round2(statement - books);

  return (
    <>
      <PageHeader title="Banque et rapprochement" subtitle="Importe le relevé, puis rattache chaque ligne à une écriture. Objectif : écart à zéro." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Solde du relevé importé" value={eur(statement)} hint={`Ouverture ${eur(settings.bank_opening_balance)} + lignes importées`} />
        <Stat label="Solde comptable (512)" value={eur(books)} />
        <Stat label="Écart" value={<Amount value={diff} signed />} tone={diff === 0 ? 'good' : 'bad'} hint={diff === 0 ? 'Rapprochement OK' : `${unmatched.length} ligne(s) à pointer, ${freeLines.length} écriture(s) sans ligne de relevé`} />
        <Stat label="Lignes à pointer" value={String(unmatched.length)} tone={unmatched.length ? 'bad' : 'good'} />
      </div>

      {write && <div className="mt-6"><BankImport /></div>}

      <div className="mt-6 flex items-center justify-between">
        <h2>{sp.vue === 'tout' ? 'Toutes les lignes' : 'Lignes à pointer'}</h2>
        <div className="flex gap-2">
          <a href="/banque" className={sp.vue === 'tout' ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}>À pointer</a>
          <a href="/banque?vue=tout" className={sp.vue === 'tout' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>Tout</a>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {shown.length === 0 && <div className="card"><Empty>{txs.length ? 'Tout est pointé.' : 'Aucune ligne importée.'}</Empty></div>}
        {shown.map((t) => {
          const candidates = freeLines.filter((l) => round2(l.debit - l.credit) === t.amount);
          const matched = lines.find((l) => l.line_id === t.matched_line_id);
          return (
            <div key={t.id} className="card card-pad">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><div className="text-sm font-medium">{t.label}</div><div className="text-xs text-ink-faint">{fmtDate(t.tx_date)}</div></div>
                <div className="flex items-center gap-4">
                  <Amount value={t.amount} signed />
                  {t.matched_line_id
                    ? <span className="badge-ok">Pointée{matched ? ` : ${matched.entry_label}` : ''}</span>
                    : <span className="badge-warn">À pointer</span>}
                  {write && t.matched_line_id && <ActionButton action={unmatchTx} label="Dépointer" hidden={{ tx: t.id }} />}
                  {write && !t.matched_line_id && <ActionButton action={deleteTx} label="Supprimer" className="btn-danger btn-sm" confirm="Supprimer cette ligne de relevé ?" hidden={{ id: t.id }} />}
                </div>
              </div>
              {write && !t.matched_line_id && (
                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
                  <div>
                    <div className="label">Rattacher à une écriture existante</div>
                    {candidates.length === 0 ? <p className="text-xs text-ink-faint">Aucune écriture banque de {eur(t.amount)} non pointée.</p> : (
                      <ActionForm action={matchTx} className="flex gap-2">
                        <input type="hidden" name="tx" value={t.id} />
                        <select name="line" className="input">{candidates.map((l) => <option key={l.line_id} value={l.line_id}>{fmtDate(l.entry_date)} · {l.entry_label}</option>)}</select>
                        <Submit className="btn-ghost btn-sm">Pointer</Submit>
                      </ActionForm>
                    )}
                  </div>
                  <details>
                    <summary className="btn-primary btn-sm cursor-pointer list-none">Créer l'écriture depuis cette ligne</summary>
                    <ActionForm action={bookTx} className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="tx" value={t.id} />
                      <div className="sm:col-span-2"><label className="label">Libellé</label><input name="label" defaultValue={t.label} className="input" /></div>
                      <div className="sm:col-span-2"><label className="label">{t.amount < 0 ? 'Catégorie de dépense (ou 401 pour régler un fournisseur)' : 'Catégorie de recette (ou 411 pour un règlement client)'}</label>
                        <select name="account" required className="input"><option value="">Choisir…</option>
                          {accounts.filter((a) => (t.amount < 0 ? a.class === 6 || a.number === '401' || a.number === '218' || a.number === '467' : a.class === 7 || a.number === '411' || a.number === '441')).map((a) => <option key={a.id} value={a.number}>{a.number} · {a.label}</option>)}
                          <option value="580">580 · Virements internes</option><option value="471">471 · Compte d'attente</option>
                        </select></div>
                      <div><label className="label">Événement</label><select name="event_id" className="input"><option value="">Aucun</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                      <div><label className="label">Tiers</label><select name="third_party_id" className="input"><option value="">Aucun</option>{third.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                      <div className="sm:col-span-2"><Submit>Créer et pointer</Submit></div>
                    </ActionForm>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
