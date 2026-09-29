'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEntry } from '@/app/actions';
import { addDocument } from '@/app/actions';
import { uploadJustificatif } from '@/lib/upload';
import { Submit } from './Forms';
import { parseAmount, num } from '@/lib/format';
import type { Account, EventRow, ThirdParty } from '@/lib/types';

const KINDS = [
  { id: 'depense', title: 'Dépense', hint: 'Achat, facture, frais' },
  { id: 'recette', title: 'Recette', hint: 'Vente, subvention, don' },
  { id: 'reglement_fournisseur', title: 'Régler un fournisseur', hint: 'Facture déjà enregistrée' },
  { id: 'reglement_client', title: 'Encaisser un client', hint: 'Facture ou promesse déjà enregistrée' },
  { id: 'virement', title: 'Retrait / dépôt espèces', hint: 'Banque et caisse' },
  { id: 'libre', title: 'Écriture libre', hint: 'Débit / crédit manuel' },
] as const;

type Kind = (typeof KINDS)[number]['id'];
type L = { account: string; debit: string; credit: string; label: string };

export function EntryForm({ accounts, events, thirdParties, defaultDate, minDate, maxDate, initialKind = 'depense' }: {
  accounts: Account[]; events: EventRow[]; thirdParties: ThirdParty[]; defaultDate: string; minDate: string; maxDate: string; initialKind?: Kind;
}) {
  const router = useRouter();
  const [state, action] = useActionState(createEntry, null);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState('512');
  const [direction, setDirection] = useState('retrait');
  const [amount, setAmount] = useState('');
  const [acc, setAcc] = useState('');
  const [lines, setLines] = useState<L[]>([{ account: '', debit: '', credit: '', label: '' }, { account: '', debit: '', credit: '', label: '' }]);
  const file = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);   // React 19 vide le formulaire après l'action : on garde le fichier avant
  const [uploadError, setUploadError] = useState('');

  const expenses = accounts.filter((a) => a.class === 6 || a.number === '218');
  const incomes = accounts.filter((a) => a.class === 7);
  const cats = kind === 'depense' ? expenses : incomes;
  const label = (n: string) => accounts.find((a) => a.number === n)?.label ?? n;
  const amt = parseAmount(amount);

  // Aperçu des écritures générées
  let preview: { account: string; debit?: number; credit?: number }[] = [];
  if (amt > 0) {
    const cash = method;
    if (kind === 'depense' && acc) preview = [{ account: acc, debit: amt }, { account: paid ? cash : '401', credit: amt }];
    if (kind === 'recette' && acc) preview = [{ account: paid ? cash : '411', debit: amt }, { account: acc, credit: amt }];
    if (kind === 'reglement_fournisseur') preview = [{ account: '401', debit: amt }, { account: cash, credit: amt }];
    if (kind === 'reglement_client') preview = [{ account: cash, debit: amt }, { account: '411', credit: amt }];
    if (kind === 'virement') preview = direction === 'retrait' ? [{ account: '530', debit: amt }, { account: '512', credit: amt }] : [{ account: '512', debit: amt }, { account: '530', credit: amt }];
  }
  const sumD = lines.reduce((s, l) => s + (parseAmount(l.debit) || 0), 0);
  const sumC = lines.reduce((s, l) => s + (parseAmount(l.credit) || 0), 0);
  const balanced = Math.abs(sumD - sumC) < 0.005 && sumD > 0;

  useEffect(() => {
    if (!state?.ok || !state.id) return;
    (async () => {
      const f = pendingFile.current;
      if (f) {
        try {
          const up = await uploadJustificatif(f, `entries/${state.id}`);
          await addDocument(state.id!, up.path, up.name);
        } catch (e) {
          setUploadError(e instanceof Error ? e.message : 'Échec de l\'envoi du justificatif');
          return;
        }
      }
      router.push(`/ecritures/${state.id}`);
    })();
  }, [state, router]);

  const needsThird = kind === 'reglement_fournisseur' || kind === 'reglement_client' || ((kind === 'depense' || kind === 'recette') && !paid);
  const showThird = kind === 'depense' || kind === 'recette' || kind === 'reglement_fournisseur' || kind === 'reglement_client';
  const thirdFilter = kind === 'reglement_fournisseur' || kind === 'depense' ? ['fournisseur', 'membre', 'autre'] : ['client', 'financeur', 'sponsor', 'membre', 'autre'];
  const thirdList = thirdParties.filter((t) => thirdFilter.includes(t.kind));

  return (
    <form action={action} className="space-y-6" onSubmit={() => { pendingFile.current = file.current?.files?.[0] ?? null; }}>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KINDS.map((k) => (
          <button type="button" key={k.id} onClick={() => setKind(k.id)}
            className={`rounded-2xl border p-4 text-left transition ${kind === k.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <div className="text-sm font-semibold">{k.title}</div>
            <div className="text-xs text-ink-soft">{k.hint}</div>
          </button>
        ))}
      </div>

      <div className="card card-pad space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Date</label><input type="date" name="date" required defaultValue={defaultDate} min={minDate} max={maxDate} className="input" /></div>
          {kind !== 'libre' && (
            <div><label className="label">Montant (€)</label><input name="amount" required inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" /></div>
          )}
          <div className={kind === 'libre' ? 'sm:col-span-2' : ''}><label className="label">Libellé</label><input name="label" required placeholder={kind === 'depense' ? 'Ex. Cocktail conférence Glize' : 'Description'} className="input" /></div>
        </div>

        {(kind === 'depense' || kind === 'recette') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Catégorie</label>
              <select name="account" required value={acc} onChange={(e) => setAcc(e.target.value)} className="input">
                <option value="">Choisir…</option>
                {cats.map((a) => <option key={a.id} value={a.number}>{a.number} · {a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Événement (analytique)</label>
              <select name="event_id" className="input"><option value="">Aucun</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </div>
          </div>
        )}

        {(kind === 'depense' || kind === 'recette') && (
          <div>
            <label className="label">{kind === 'depense' ? 'Paiement' : 'Encaissement'}</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaid(true)} className={paid ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{kind === 'depense' ? 'Déjà payé' : 'Déjà encaissé'}</button>
              <button type="button" onClick={() => setPaid(false)} className={!paid ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{kind === 'depense' ? 'À payer plus tard' : 'À encaisser plus tard'}</button>
            </div>
            <input type="hidden" name="paid" value={paid ? 'paid' : 'later'} />
          </div>
        )}

        {kind !== 'libre' && kind !== 'virement' && ((kind !== 'depense' && kind !== 'recette') || paid) && (
          <div>
            <label className="label">Moyen</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMethod('512')} className={method === '512' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>Banque</button>
              <button type="button" onClick={() => setMethod('530')} className={method === '530' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>Caisse (espèces)</button>
            </div>
          </div>
        )}
        <input type="hidden" name="method" value={method} />

        {kind === 'virement' && (
          <div>
            <label className="label">Sens</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDirection('retrait')} className={direction === 'retrait' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>Retrait : banque vers caisse</button>
              <button type="button" onClick={() => setDirection('depot')} className={direction === 'depot' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>Dépôt : caisse vers banque</button>
            </div>
            <input type="hidden" name="direction" value={direction} />
          </div>
        )}

        {showThird && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{kind === 'recette' || kind === 'reglement_client' ? 'Client, financeur, sponsor' : 'Fournisseur ou membre'} {needsThird ? '(obligatoire)' : '(facultatif)'}</label>
              <select name="third_party_id" required={needsThird} className="input">
                <option value="">Aucun</option>
                {thirdList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-ink-faint">Absent de la liste ? Ajoute-le dans « Tiers ».</p>
            </div>
            <div><label className="label">N° de pièce (facture, ticket)</label><input name="piece_ref" className="input" /></div>
          </div>
        )}
        {!showThird && <div className="sm:w-1/2"><label className="label">N° de pièce</label><input name="piece_ref" className="input" /></div>}

        {kind === 'libre' && (
          <div>
            <input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({ account: l.account, debit: parseAmount(l.debit) || 0, credit: parseAmount(l.credit) || 0, label: l.label })))} />
            <table className="w-full text-sm">
              <thead><tr><th className="th px-1">Compte</th><th className="th px-1">Débit</th><th className="th px-1">Crédit</th><th className="th px-1">Libellé de ligne</th><th /></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="p-1"><select className="input" value={l.account} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, account: e.target.value } : x))}>
                      <option value="">Compte…</option>{accounts.map((a) => <option key={a.id} value={a.number}>{a.number} · {a.label}</option>)}</select></td>
                    <td className="p-1"><input className="input" inputMode="decimal" value={l.debit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? '' : x.credit } : x))} /></td>
                    <td className="p-1"><input className="input" inputMode="decimal" value={l.credit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? '' : x.debit } : x))} /></td>
                    <td className="p-1"><input className="input" value={l.label} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /></td>
                    <td className="p-1">{lines.length > 2 && <button type="button" className="text-xs text-rose-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Retirer</button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td className="px-1 pt-2"><button type="button" className="btn-ghost btn-sm" onClick={() => setLines([...lines, { account: '', debit: '', credit: '', label: '' }])}>Ajouter une ligne</button></td>
                <td className="px-2 pt-2 text-right font-medium tabular-nums">{num(sumD)}</td>
                <td className="px-2 pt-2 text-right font-medium tabular-nums">{num(sumC)}</td>
                <td colSpan={2} className="px-2 pt-2 text-xs">{balanced ? <span className="text-emerald-700">Équilibrée</span> : <span className="text-amber-700">Écart : {num(Math.abs(sumD - sumC))}</span>}</td>
              </tr></tfoot>
            </table>
            <input type="hidden" name="journal" value="OD" />
          </div>
        )}

        <div>
          <label className="label">Justificatif (photo ou PDF, facultatif)</label>
          <input ref={file} type="file" accept="image/*,application/pdf" className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700" />
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card card-pad">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Écriture générée (partie double)</div>
          <table className="w-full text-sm">
            <tbody>
              {preview.map((p, i) => (
                <tr key={i}><td className="py-1 font-mono text-xs">{p.account}</td><td className="py-1">{label(p.account)}</td>
                  <td className="py-1 text-right tabular-nums">{p.debit ? num(p.debit) : ''}</td><td className="py-1 text-right tabular-nums">{p.credit ? num(p.credit) : ''}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state?.error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>}
      {uploadError && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">L'écriture est enregistrée mais le justificatif n'a pas été envoyé : {uploadError}. Tu peux l'ajouter depuis la fiche de l'écriture.</p>}
      {state?.ok && !uploadError && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Écriture enregistrée, redirection…</p>}

      <div className="flex gap-3">
        <Submit>{kind === 'libre' ? 'Enregistrer et valider' : 'Enregistrer'}</Submit>
        {kind === 'libre' && <button type="submit" name="validate" value="0" className="btn-ghost">Enregistrer en brouillon</button>}
      </div>
    </form>
  );
}
