'use client';
import { useTransition } from 'react';
import { setFiscalYear } from '@/app/actions';
import type { FiscalYear } from '@/lib/types';

export function FYSelect({ years, current }: { years: FiscalYear[]; current: string | null }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Exercice"
      disabled={pending}
      value={current ?? ''}
      onChange={(e) => start(() => setFiscalYear(e.target.value))}
      className="input w-auto py-1.5 pr-8 text-xs"
    >
      {years.map((y) => <option key={y.id} value={y.id}>Exercice {y.label}{y.closed ? ' (clôturé)' : ''}</option>)}
    </select>
  );
}
