'use client';
import { Icon } from './Icon';
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn-ghost"><Icon name="print" /> Imprimer / PDF</button>;
}
