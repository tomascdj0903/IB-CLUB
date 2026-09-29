import { eur } from '@/lib/format';

export function AmountTable({ title, rows, total, totalLabel, compare }: {
  title: string; rows: { number: string; label: string; amount: number; prev?: number }[]; total: number; totalLabel: string; compare?: { total: number; label: string };
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-sm font-semibold">{title}</div>
      <table className="w-full">
        {compare && <thead><tr><th className="th" colSpan={2} /><th className="th num">Cet exercice</th><th className="th num">{compare.label}</th></tr></thead>}
        <tbody>
          {rows.length === 0 && <tr><td className="td text-ink-faint" colSpan={4}>Aucun mouvement.</td></tr>}
          {rows.map((r) => (
            <tr key={r.number} className="border-b border-slate-50 last:border-0">
              <td className="td w-20 font-mono text-xs text-ink-faint">{r.number}</td><td className="td">{r.label}</td>
              <td className="td num">{eur(r.amount)}</td>{compare && <td className="td num text-ink-soft">{eur(r.prev ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t border-slate-200 font-semibold"><td className="td" colSpan={2}>{totalLabel}</td><td className="td num">{eur(total)}</td>{compare && <td className="td num text-ink-soft">{eur(compare.total)}</td>}</tr></tfoot>
      </table>
    </div>
  );
}

export function ReportHeader({ assoc, title, period }: { assoc: string; title: string; period: string }) {
  return (
    <div className="mb-6 hidden print:block">
      <div className="text-sm font-semibold">{assoc}</div>
      <div className="text-xl font-semibold">{title}</div>
      <div className="text-sm text-ink-soft">{period}</div>
    </div>
  );
}
