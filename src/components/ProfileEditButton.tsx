'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ProfileModal from '@/components/ProfileModal';

export default function ProfileEditButton() {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-outline text-xs">
        {t('editProfile')}
      </button>
      <ProfileModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
