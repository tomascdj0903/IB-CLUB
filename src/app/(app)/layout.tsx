import { requireMember, getCurrentFY, getSettings } from '@/lib/auth';
import { Sidebar, MobileNav } from '@/components/Sidebar';
import { FYSelect } from '@/components/FYSelect';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireMember();
  const [{ fy, all }, settings] = await Promise.all([getCurrentFY(), getSettings()]);
  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile.role} name={profile.full_name ?? profile.email ?? ''} assoc={settings.association_name} />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <div className="no-print flex items-center justify-end gap-3 px-6 pt-5 md:px-10">
          {fy?.closed && <span className="badge-mute">Exercice clôturé : lecture seule</span>}
          <FYSelect years={all} current={fy?.id ?? null} />
        </div>
        <main className="mx-auto max-w-6xl px-6 pb-16 pt-4 md:px-10">{children}</main>
      </div>
    </div>
  );
}
