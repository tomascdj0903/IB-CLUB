import { dayNumber, type SeriesPoint } from '@/lib/reports';

const eur0 = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n).replace(/[  ]/g, ' ') + ' €';

function stepPath(pts: SeriesPoint[], x: (d: string) => number, y: (v: number) => number, end: string) {
  if (!pts.length) return '';
  let d = `M${x(pts[0].date)},${y(pts[0].balance)}`;
  for (let i = 1; i < pts.length; i++) d += ` L${x(pts[i].date)},${y(pts[i - 1].balance)} L${x(pts[i].date)},${y(pts[i].balance)}`;
  d += ` L${x(end)},${y(pts[pts.length - 1].balance)}`;
  return d;
}

export function TreasuryChart({ actual, planned, start, end, today }: { actual: SeriesPoint[]; planned: SeriesPoint[]; start: string; end: string; today?: string }) {
  const W = 640, H = 260, L = 58, R = 14, T = 14, B = 30;
  const all = [...actual, ...planned].map((p) => p.balance);
  const min = Math.min(0, ...all), max = Math.max(0, ...all, 1);
  const rawStep = (max - min) / 4 || 100;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((v) => v >= rawStep) ?? 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.max(Math.ceil(max / step) * step, lo + step);
  const d0 = dayNumber(start), d1 = dayNumber(end);
  const x = (d: string) => L + ((dayNumber(d) - d0) / Math.max(1, d1 - d0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const yt: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += step) yt.push(Math.round(v * 100) / 100);
  const months: string[] = [];
  { let [yy, mm] = start.split('-').map(Number); const [ey, em] = end.split('-').map(Number);
    while (yy < ey || (yy === ey && mm <= em)) { months.push(`${yy}-${String(mm).padStart(2, '0')}-01`); mm++; if (mm > 12) { mm = 1; yy++; } } }
  const stepEvery = Math.ceil(months.length / 8);
  const lastActual = today && today <= end ? today : actual[actual.length - 1]?.date ?? start;
  const actualClipped = actual.filter((p) => p.date <= lastActual);
  const minPlanned = planned.reduce((m, p) => (p.balance < m.balance ? p : m), planned[0] ?? { date: start, balance: 0 });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Courbe de trésorerie réelle et prévisionnelle">
      {yt.map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e8eaf2" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#8a92a6">{eur0(v)}</text>
        </g>
      ))}
      {min < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#c9cee0" strokeDasharray="4 3" />}
      {months.map((m, i) => i % stepEvery === 0 && (
        <text key={m} x={x(m)} y={H - 8} fontSize="11" fill="#8a92a6" textAnchor="middle">
          {new Date(m + 'T00:00:00Z').toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })}
        </text>
      ))}
      <path d={stepPath(planned, x, y, end)} fill="none" stroke="#a9b2d6" strokeWidth="2" strokeDasharray="6 4" />
      <path d={stepPath(actualClipped, x, y, lastActual)} fill="none" stroke="#2f3d99" strokeWidth="2.5" />
      {today && today >= start && today <= end && <line x1={x(today)} x2={x(today)} y1={T} y2={H - B} stroke="#f59e0b" strokeDasharray="3 3" />}
      {minPlanned.balance < 0 && (
        <g>
          <circle cx={x(minPlanned.date)} cy={y(minPlanned.balance)} r="4" fill="#e11d48" />
          <text x={x(minPlanned.date) + 8} y={y(minPlanned.balance) - 6} fontSize="11" fill="#e11d48">Creux prévu : {eur0(minPlanned.balance)}</text>
        </g>
      )}
    </svg>
  );
}

export function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-soft">
      <span className="inline-block w-5 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} /> {label}
    </span>
  );
}

/** Barres horizontales prévu / réel pour un ensemble de lignes */
export function BudgetBars({ rows }: { rows: { label: string; budget: number; actual: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget, r.actual]));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{r.label}</span><span className="tabular-nums text-ink-soft">{eur0(r.actual)} / {eur0(r.budget)}</span></div>
          <div className="relative h-2.5 rounded-full bg-slate-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-200" style={{ width: `${(r.budget / max) * 100}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-700" style={{ width: `${Math.min(100, (r.actual / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
