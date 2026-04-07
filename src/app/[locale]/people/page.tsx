import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = { title: 'People' };

const members = [
  {
    name: '賴詩萍',
    nameEn: 'Shiping Lai',
    title: 'Professor / Observatory Supervisor',
    titleZh: '教授 / 天文台負責人',
    dept: 'Institute of Astronomy, NTHU',
    note: 'Oversees observatory planning, renovation, and management.',
  },
];

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'people' });
  const roles = t.raw('roles') as Array<{ role: string; roleZh: string; desc: string }>;

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('teamLabel')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>{t('title')}</h1>
      </div>

      {/* Faculty */}
      <div className="mb-14">
        <p className="label mb-6">{t('facultyLabel')}</p>
        <div className="space-y-px" style={{ background: 'var(--line)' }}>
          {members.map((m) => (
            <div key={m.name} className="px-6 py-5" style={{ background: 'var(--bg)' }}>
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bg-muted)', border: '1px solid var(--line)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>{m.nameEn[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {m.nameEn}{' '}
                    <span className="font-normal" style={{ color: 'var(--ink-faint)' }}>· {m.name}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>{m.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{m.dept}</p>
                  {m.note && <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>{m.note}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student team */}
      <div className="mb-14">
        <p className="label mb-6">{t('studentLabel')}</p>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
          {t('studentDesc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ background: 'var(--line)' }}>
          {roles.map((r) => (
            <div key={r.role} className="p-6" style={{ background: 'var(--bg)' }}>
              <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--ink)' }}>{r.role}</p>
              <p className="text-xs mb-3" style={{ color: 'var(--ink-faint)' }}>{r.roleZh}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

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
