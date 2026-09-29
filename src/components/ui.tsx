import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : 'text-ink';
  return (
    <div className="card card-pad">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-ink-faint">{children}</div>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  const c = { info: 'bg-brand-50 text-brand-800 border-brand-100', warn: 'bg-amber-50 text-amber-900 border-amber-100', bad: 'bg-rose-50 text-rose-800 border-rose-100', ok: 'bg-emerald-50 text-emerald-800 border-emerald-100' }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function LinkButton({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <Link href={href} className={primary ? 'btn-primary' : 'btn-ghost'}>{children}</Link>;
}

export function Amount({ value, signed = false }: { value: number; signed?: boolean }) {
  const s = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', signDisplay: signed ? 'exceptZero' : 'auto' }).format(value).replace(/[  ]/g, ' ');
  const color = signed ? (value > 0 ? 'text-emerald-700' : value < 0 ? 'text-rose-700' : '') : '';
  return <span className={`tabular-nums ${color}`}>{s}</span>;
}

export function EntryBadge({ status }: { status: string }) {
  return status === 'validee' ? <span className="badge-ok">Validée</span> : <span className="badge-warn">Brouillon</span>;
}
