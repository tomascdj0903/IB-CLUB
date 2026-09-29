import type { Account, BudgetLine, EventRow, FiscalYear, LedgerRow } from './types';
import { round2 } from './format';

export const isCashAccount = (n: string) => n === '512' || n === '530';

export interface AccountTotal {
  number: string; label: string; class: number; debit: number; credit: number; balance: number; // balance = débit - crédit
}

export function totalsByAccount(rows: LedgerRow[], filter?: (r: LedgerRow) => boolean): AccountTotal[] {
  const m = new Map<string, AccountTotal>();
  for (const r of rows) {
    if (filter && !filter(r)) continue;
    let t = m.get(r.account_number);
    if (!t) {
      t = { number: r.account_number, label: r.account_label, class: r.class, debit: 0, credit: 0, balance: 0 };
      m.set(r.account_number, t);
    }
    t.debit = round2(t.debit + r.debit);
    t.credit = round2(t.credit + r.credit);
    t.balance = round2(t.debit - t.credit);
  }
  return [...m.values()].sort((a, b) => a.number.localeCompare(b.number));
}

export interface IncomeStatement {
  charges: { number: string; label: string; amount: number }[];
  produits: { number: string; label: string; amount: number }[];
  totalCharges: number; totalProduits: number; resultat: number;
}

export function incomeStatement(rows: LedgerRow[], filter?: (r: LedgerRow) => boolean): IncomeStatement {
  const t = totalsByAccount(rows, filter);
  const charges = t.filter((a) => a.class === 6).map((a) => ({ number: a.number, label: a.label, amount: a.balance })).filter((a) => a.amount !== 0);
  const produits = t.filter((a) => a.class === 7).map((a) => ({ number: a.number, label: a.label, amount: round2(-a.balance) })).filter((a) => a.amount !== 0);
  const totalCharges = round2(charges.reduce((s, a) => s + a.amount, 0));
  const totalProduits = round2(produits.reduce((s, a) => s + a.amount, 0));
  return { charges, produits, totalCharges, totalProduits, resultat: round2(totalProduits - totalCharges) };
}

export function cashBalance(rows: LedgerRow[], upTo?: string) {
  let b = 0;
  for (const r of rows) if (isCashAccount(r.account_number) && (!upTo || r.entry_date <= upTo)) b += r.debit - r.credit;
  return round2(b);
}

export interface SeriesPoint { date: string; balance: number }

export function cashSeries(rows: LedgerRow[], start: string): SeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const r of rows) if (isCashAccount(r.account_number)) byDate.set(r.entry_date, (byDate.get(r.entry_date) ?? 0) + r.debit - r.credit);
  let bal = 0;
  const pts: SeriesPoint[] = [{ date: start, balance: 0 }];
  for (const d of [...byDate.keys()].sort()) {
    bal = round2(bal + (byDate.get(d) ?? 0));
    pts.push({ date: d, balance: bal });
  }
  return pts;
}

type AccInfo = Pick<Account, 'number' | 'label' | 'class'>;

export function plannedSeries(budget: BudgetLine[], acc: Map<string, AccInfo>, start: string): SeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const b of budget) {
    if (!b.planned_date) continue;
    const a = acc.get(b.account_id);
    if (!a) continue;
    const d = a.class === 7 ? Number(b.amount) : a.class === 6 ? -Number(b.amount) : 0;
    byDate.set(b.planned_date, (byDate.get(b.planned_date) ?? 0) + d);
  }
  let bal = 0;
  const pts: SeriesPoint[] = [{ date: start, balance: 0 }];
  for (const d of [...byDate.keys()].sort()) {
    bal = round2(bal + (byDate.get(d) ?? 0));
    pts.push({ date: d, balance: bal });
  }
  return pts;
}

/** Solde d'une série à une date donnée (dernier point <= date). */
export function seriesAt(pts: SeriesPoint[], date: string) {
  let v = 0;
  for (const p of pts) if (p.date <= date) v = p.balance;
  return v;
}

export interface BudgetTotals { charges: number; produits: number; net: number }

export function budgetTotals(budget: BudgetLine[], acc: Map<string, AccInfo>, filter?: (b: BudgetLine) => boolean): BudgetTotals {
  let charges = 0, produits = 0;
  for (const b of budget) {
    if (filter && !filter(b)) continue;
    const a = acc.get(b.account_id);
    if (!a) continue;
    if (a.class === 6) charges += Number(b.amount);
    if (a.class === 7) produits += Number(b.amount);
  }
  return { charges: round2(charges), produits: round2(produits), net: round2(produits - charges) };
}

export interface EventResult {
  event: EventRow; budget: BudgetTotals; actual: BudgetTotals;
}

export function eventResults(events: EventRow[], budget: BudgetLine[], rows: LedgerRow[], acc: Map<string, AccInfo>): EventResult[] {
  return events.map((event) => {
    const b = budgetTotals(budget, acc, (l) => l.event_id === event.id);
    let charges = 0, produits = 0;
    for (const r of rows) {
      if (r.event_id !== event.id) continue;
      if (r.class === 6) charges += r.debit - r.credit;
      if (r.class === 7) produits += r.credit - r.debit;
    }
    charges = round2(charges); produits = round2(produits);
    return { event, budget: b, actual: { charges, produits, net: round2(produits - charges) } };
  });
}

export interface BilanLine { number: string; label: string; amount: number }
export interface Bilan { actif: BilanLine[]; passif: BilanLine[]; totalActif: number; totalPassif: number; resultat: number }

export function bilan(rows: LedgerRow[]): Bilan {
  const t = totalsByAccount(rows).filter((a) => a.class >= 1 && a.class <= 5);
  const actif: BilanLine[] = [];
  const passif: BilanLine[] = [];
  for (const a of t) {
    if (a.balance > 0) actif.push({ number: a.number, label: a.label, amount: a.balance });
    else if (a.balance < 0) passif.push({ number: a.number, label: a.label, amount: round2(-a.balance) });
  }
  const resultat = incomeStatement(rows).resultat;
  passif.push({ number: resultat >= 0 ? '120' : '129', label: `Résultat de l'exercice (${resultat >= 0 ? 'excédent' : 'déficit'})`, amount: resultat });
  const totalActif = round2(actif.reduce((s, a) => s + a.amount, 0));
  const totalPassif = round2(passif.reduce((s, a) => s + a.amount, 0));
  return { actif, passif, totalActif, totalPassif, resultat };
}

export function contributionsVolontaires(rows: LedgerRow[]) {
  const t = totalsByAccount(rows, (r) => r.class === 8);
  const emplois = t.filter((a) => a.number.startsWith('86')).map((a) => ({ number: a.number, label: a.label, amount: a.balance }));
  const ressources = t.filter((a) => a.number.startsWith('87')).map((a) => ({ number: a.number, label: a.label, amount: round2(-a.balance) }));
  return {
    emplois, ressources,
    totalEmplois: round2(emplois.reduce((s, a) => s + a.amount, 0)),
    totalRessources: round2(ressources.reduce((s, a) => s + a.amount, 0)),
  };
}

// ---------- Périodes --------------------------------------------------
export function monthsOf(fy: Pick<FiscalYear, 'start_date' | 'end_date'>): string[] {
  const out: string[] = [];
  let [y, m] = fy.start_date.split('-').map(Number);
  const [ey, em] = fy.end_date.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export const monthRange = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};

export function quartersOf(fy: Pick<FiscalYear, 'start_date' | 'end_date'>) {
  const months = monthsOf(fy);
  const qs: { index: number; label: string; from: string; to: string; months: string[] }[] = [];
  for (let i = 0; i < months.length; i += 3) {
    const ms = months.slice(i, i + 3);
    qs.push({ index: i / 3 + 1, label: `T${i / 3 + 1}`, from: monthRange(ms[0]).from, to: monthRange(ms[ms.length - 1]).to, months: ms });
  }
  return qs;
}

export const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

/** Bornes de dates pour un axe de graphique */
export const dayNumber = (d: string) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);
