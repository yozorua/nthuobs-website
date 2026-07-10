import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { MemberGrid } from '@/components/people/PeopleGrid';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'People' };

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'people' });

  const select = {
    id: true,
    name: true,
    image: true,
    role: true,
    extraRoles: true,
    firstNameEn: true,
    lastNameEn: true,
    firstNameZh: true,
    lastNameZh: true,
    contactEmail: true,
    bio: true,
    website: true,
    department: true,
    showPublicProfile: true,
    showPublicEmail: true,
    updatedAt: true,
  };

  const [managers, operators, members, mascots, webManagers] = await Promise.all([
    db.user.findMany({ where: { role: 'MANAGER' }, select, orderBy: { createdAt: 'asc' } }),
    db.user.findMany({ where: { role: 'OPERATOR' }, select, orderBy: { createdAt: 'asc' } }),
    db.user.findMany({ where: { role: 'MEMBER', NOT: { extraRoles: { has: 'MASCOT' } } }, select, orderBy: { createdAt: 'asc' } }),
    db.user.findMany({ where: { role: 'MEMBER', extraRoles: { has: 'MASCOT' } }, select, orderBy: { createdAt: 'asc' } }),
    db.user.findMany({ where: { extraRoles: { has: 'WEB_MANAGER' } }, select, orderBy: { createdAt: 'asc' } }),
  ]);

  const sections = [
    { label: t('managersLabel'), users: managers },
    { label: t('operatorsLabel'), users: operators },
    { label: t('membersLabel'), users: members },
    { label: t('mascotsLabel'), users: mascots },
    { label: t('webManagersLabel'), users: webManagers },
  ];

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      {/* Header */}
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('teamLabel')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>{t('title')}</h1>
      </div>

      {/* Role sections */}
      {sections.map((section) => (
        <div key={section.label} className="mb-14">
          <p className="text-xs font-medium tracking-ultra uppercase mb-6" style={{ color: 'var(--ink-secondary)' }}>{section.label}</p>
          <MemberGrid users={section.users} emptyLabel={t('noMembers')} locale={locale} />
        </div>
      ))}

      {/* Join */}
      <div className="p-8" style={{ background: 'var(--bg-warm)', border: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('joinLabel')}</p>
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--ink-secondary)' }}>
          {t('joinDesc')}
        </p>
        <a href="mailto:nthuobs@gmail.com" className="btn">
          {t('contactUs')}
        </a>
      </div>
    </div>
  );
}
