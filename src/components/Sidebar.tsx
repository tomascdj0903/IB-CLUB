'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import type { Role } from '@/lib/types';

const items = [
  { href: '/', label: 'Tableau de bord', icon: 'home' },
  { href: '/ecritures', label: 'Écritures', icon: 'book' },
  { href: '/banque', label: 'Banque', icon: 'bank' },
  { href: '/notes-de-frais', label: 'Notes de frais', icon: 'receipt' },
  { href: '/budget', label: 'Budget', icon: 'target' },
  { href: '/evenements', label: 'Événements', icon: 'calendar' },
  { href: '/tiers', label: 'Tiers', icon: 'users' },
  { href: '/rapports', label: 'Rapports', icon: 'chart' },
  { href: '/exercices', label: 'Exercices', icon: 'lock' },
  { href: '/plan-comptable', label: 'Plan comptable', icon: 'list' },
  { href: '/parametres', label: 'Paramètres', icon: 'gear' },
];

export function Sidebar({ role, name, assoc }: { role: Role; name: string; assoc: string }) {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white px-4 py-5 md:flex">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-sm font-bold text-white">IB</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{assoc}</div>
          <div className="text-xs text-ink-faint">Comptabilité</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {items.map((it) => (
          <Link key={it.href} href={it.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active(it.href) ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-soft hover:bg-slate-50 hover:text-ink'}`}>
            <Icon name={it.icon} /> {it.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs capitalize text-ink-faint">{role === 'tresorier' ? 'Trésorier' : role === 'president' ? 'Présidence' : role === 'secretaire' ? 'Secrétariat' : 'Lecture'}</div>
        <form action="/auth/signout" method="post" className="mt-2">
          <button className="flex items-center gap-2 text-xs text-ink-soft hover:text-ink"><Icon name="logout" className="h-3.5 w-3.5" /> Se déconnecter</button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="no-print flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
      {items.map((it) => (
        <Link key={it.href} href={it.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs ${(it.href === '/' ? path === '/' : path.startsWith(it.href)) ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-soft'}`}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
