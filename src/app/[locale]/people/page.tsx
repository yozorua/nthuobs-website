import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'People' };

function displayName(
  user: {
    firstNameEn?: string | null;
    lastNameEn?: string | null;
    firstNameZh?: string | null;
    lastNameZh?: string | null;
    name?: string | null;
  },
  locale: string,
): { primary: string; secondary: string | null } {
  const en =
    [user.firstNameEn, user.lastNameEn].filter(Boolean).join(' ') ||
    user.name ||
    'Unknown';
  const zh =
    [user.lastNameZh, user.firstNameZh].filter(Boolean).join('') || null;

  if (locale === 'tw' && zh) {
    return { primary: zh, secondary: en };
  }
  return { primary: en, secondary: zh };
}

function Avatar({
  image,
  initials,
}: {
  image?: string | null;
  initials: string;
}) {
  if (image) {
    return (
      <div className="w-16 h-16 shrink-0 overflow-hidden" style={{ border: '1px solid var(--line)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" width={64} height={64} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="w-16 h-16 flex items-center justify-center shrink-0 text-base font-light"
      style={{ background: 'var(--bg-muted)', border: '1px solid var(--line)', color: 'var(--ink-faint)' }}
    >
      {initials}
    </div>
  );
}

type UserRow = {
  id: string;
  name: string | null;
  image: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  firstNameZh: string | null;
  lastNameZh: string | null;
  updatedAt: Date;
};

function MemberGrid({ users, emptyLabel, locale }: { users: UserRow[]; emptyLabel: string; locale: string }) {
  if (users.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-px">
      {users.map((u) => {
        const { primary, secondary } = displayName(u, locale);
        const initials = primary.charAt(0).toUpperCase();
        const imageUrl = u.image ? `${u.image}?t=${u.updatedAt.getTime()}` : null;
        return (
          <div
            key={u.id}
            className="p-5 flex flex-col items-center text-center gap-3"
            style={{ background: 'var(--bg)', width: '10rem', border: '1px solid var(--line)' }}
          >
            <Avatar image={imageUrl} initials={initials} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{primary}</p>
              {secondary && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{secondary}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    firstNameEn: true,
    lastNameEn: true,
    firstNameZh: true,
    lastNameZh: true,
    updatedAt: true,
  };

  const [managers, operators, members] = await Promise.all([
    db.user.findMany({ where: { role: 'MANAGER' }, select, orderBy: { createdAt: 'asc' } }),
    db.user.findMany({ where: { role: 'OPERATOR' }, select, orderBy: { createdAt: 'asc' } }),
    db.user.findMany({ where: { role: 'MEMBER' }, select, orderBy: { createdAt: 'asc' } }),
  ]);

  const sections = [
    { label: t('managersLabel'), users: managers },
    { label: t('operatorsLabel'), users: operators },
    { label: t('membersLabel'), users: members },
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
