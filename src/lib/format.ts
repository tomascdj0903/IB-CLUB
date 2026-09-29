const nf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const nfPlain = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const eur = (n: number | string | null | undefined) => nf.format(Number(n ?? 0)).replace(/ /g, ' ').replace(/ /g, ' ');
export const num = (n: number | string | null | undefined) => nfPlain.format(Number(n ?? 0)).replace(/ /g, ' ').replace(/ /g, ' ');

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '';
  const s = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "12,50" ou "12.50" ou "1 250,5" => 12.5 */
export function parseAmount(v: FormDataEntryValue | string | null | undefined): number {
  if (v == null) return NaN;
  const s = String(v).replace(/\s| | /g, '').replace(',', '.').replace(/€/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const today = () => new Date().toISOString().slice(0, 10);
export const ym = (d: string) => d.slice(0, 7);
