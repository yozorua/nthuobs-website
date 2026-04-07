import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import UserRoleRow from '@/components/admin/UserRoleRow';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations({ locale, namespace: 'admin' });

  const users = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, image: true, role: true, createdAt: true },
  });

  const counts = {
    total: users.length,
    pending: users.filter(u => u.role === 'PENDING').length,
    member: users.filter(u => u.role === 'MEMBER').length,
    operator: users.filter(u => u.role === 'OPERATOR').length,
    manager: users.filter(u => u.role === 'MANAGER').length,
    admin: users.filter(u => u.role === 'ADMIN').length,
  };

  const stats = [
    { label: t('totalUsers'), value: counts.total },
    { label: t('pending'), value: counts.pending },
    { label: t('members'), value: counts.member + counts.operator + counts.manager + counts.admin },
    { label: t('admins'), value: counts.admin },
  ];

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 py-16">
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('label')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-14" style={{ background: 'var(--line)' }}>
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-5" style={{ background: 'var(--bg)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--ink-faint)' }}>{s.label}</p>
            <p className="text-xl font-light" style={{ color: 'var(--ink)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* User Management */}
      <div>
        <p className="label mb-6">{t('userManagement')}</p>

        <div style={{ border: '1px solid var(--line)' }}>
          {/* Table header */}
          <div
            className="hidden md:grid grid-cols-[1fr_1fr_160px_120px] gap-4 px-5 py-3 text-xs tracking-ultra uppercase"
            style={{ color: 'var(--ink-faint)', borderBottom: '1px solid var(--line)', background: 'var(--bg-warm)' }}
          >
            <span>{t('colName')}</span>
            <span>{t('colEmail')}</span>
            <span>{t('colJoined')}</span>
            <span>{t('colRole')}</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {users.map((user) => (
              <UserRoleRow key={user.id} user={user} currentUserId={(session.user as { id: string }).id} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
