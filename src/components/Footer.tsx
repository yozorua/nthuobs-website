'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

export default function Footer() {
  const t = useTranslations('footer');
  const params = useParams();
  const locale = (params.locale as string) || 'en';

  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 'auto' }}>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div>
            <p className="label mb-3">{t('observatory')}</p>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>NTHU Observatory</p>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>國立清華大學天文台</p>
            <p className="text-xs mt-3" style={{ color: 'var(--ink-muted)' }}>Est. 1971</p>
          </div>
          <div>
            <p className="label mb-3">{t('location')}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)', whiteSpace: 'pre-line' }}>
              {t('locationText')}
            </p>
          </div>
          <div>
            <p className="label mb-3">{t('contact')}</p>
            <div className="flex flex-col gap-2">
              {[
                { href: 'mailto:nthuobs@gmail.com', label: 'nthuobs@gmail.com' },
                { href: 'https://www.facebook.com/nthuobs', label: 'Facebook' },
                { href: 'https://www.instagram.com/nthuobs', label: 'Instagram' },
                { href: 'https://www.youtube.com/@nthuobs', label: 'YouTube' },
              ].map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="text-xs transition-colors duration-150"
                  style={{ color: 'var(--ink-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-secondary)')}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-6" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            © {new Date().getFullYear()} NTHU Observatory. {t('rights')}
          </p>
          <div className="flex gap-5">
            {[
              { href: `/${locale}/about`, label: t('observatory') },
              { href: `/${locale}/visit`, label: t('visit') },
              { href: `/${locale}/calendar`, label: t('calendar') },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs transition-colors"
                style={{ color: 'var(--ink-faint)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
