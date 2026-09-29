'use client';
import { useState } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';
import { importBank } from '@/app/actions';
import { parseAmount } from '@/lib/format';

type Row = string[];

function parseDate(s: string): string | null {
  const v = s.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2})$/);
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
const money = (s: string | undefined) => (s ? parseAmount(s.replace(/[−–]/g, '-')) : NaN);
const guess = (head: string[], re: RegExp) => Math.max(-1, head.findIndex((h) => re.test(h)));

export function BankImport() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [map, setMap] = useState({ date: -1, label: -1, amount: -1, debit: -1, credit: -1 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const head = rows[0] ?? [];

  function onFile(f: File) {
    setMsg(null);
    Papa.parse<Row>(f, {
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (res) => {
        const data = res.data.filter((r) => r.length > 1);
        setRows(data);
        const h = (data[0] ?? []).map((x) => x.toLowerCase());
        setMap({
          date: guess(h, /date/), label: guess(h, /libell|label|descr|d[ée]tail|objet|tiers/),
          amount: guess(h, /montant|amount|somme/), debit: guess(h, /d[ée]bit/), credit: guess(h, /cr[ée]dit/),
        });
      },
    });
  }

  const parsed = rows.slice(1).map((r) => {
    const date = parseDate(r[map.date] ?? '');
    let amount = map.amount >= 0 ? money(r[map.amount]) : NaN;
    if (map.amount < 0 && (map.debit >= 0 || map.credit >= 0)) {
      const d = map.debit >= 0 ? money(r[map.debit]) : 0;
      const c = map.credit >= 0 ? money(r[map.credit]) : 0;
      amount = (Number.isFinite(c) ? c : 0) - Math.abs(Number.isFinite(d) ? d : 0);
    }
    return { date, label: (r[map.label] ?? '').trim(), amount };
  });
  const valid = parsed.filter((p) => p.date && p.label && Number.isFinite(p.amount) && p.amount !== 0) as { date: string; label: string; amount: number }[];

  const select = (k: keyof typeof map, title: string) => (
    <div><label className="label">{title}</label>
      <select className="input" value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>
        <option value={-1}>(aucune)</option>{head.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
      </select></div>
  );

  return (
    <div className="card card-pad">
      <h2 className="mb-1">Importer un relevé (CSV)</h2>
      <p className="mb-4 text-sm text-ink-soft">Exporte le relevé depuis l'appli de ta banque (CSV ou Excel enregistré en CSV). Les lignes déjà importées sont ignorées.</p>
      <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700" />
      {rows.length > 1 && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            {select('date', 'Date')}{select('label', 'Libellé')}{select('amount', 'Montant (+/-)')}{select('debit', 'ou Débit')}{select('credit', 'ou Crédit')}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm"><thead><tr><th className="th">Date</th><th className="th">Libellé</th><th className="th num">Montant</th></tr></thead>
              <tbody>{valid.slice(0, 5).map((p, i) => <tr key={i} className="border-t border-slate-50"><td className="td">{p.date}</td><td className="td">{p.label}</td><td className="td num">{p.amount.toFixed(2)}</td></tr>)}</tbody></table>
          </div>
          <p className="text-sm text-ink-soft">{valid.length} ligne(s) valide(s) sur {rows.length - 1}.{valid.length < rows.length - 1 && ' Vérifie les colonnes choisies si ce nombre paraît trop bas.'}</p>
          <button disabled={!valid.length || busy} className="btn-primary" onClick={async () => {
            setBusy(true);
            const r = await importBank(valid);
            setMsg({ ok: !!r?.ok, text: r?.message ?? r?.error ?? '' });
            setBusy(false);
            if (r?.ok) { setRows([]); router.refresh(); }
          }}>{busy ? 'Import…' : `Importer ${valid.length} ligne(s)`}</button>
        </div>
      )}
      {msg && <p className={`mt-4 rounded-xl px-4 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.text}</p>}
    </div>
  );
}
