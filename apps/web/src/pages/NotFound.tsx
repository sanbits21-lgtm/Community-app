import { useEffect } from 'react';
import { EmptyState, usePageTitle } from '../components/ui';
import { useLang } from '../lib/i18n';

export function NotFound() {
  const { t } = useLang();
  usePageTitle(t('notFound'));
  // Search engines should not index a page that does not exist.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  return <EmptyState title="404" hint={t('notFound')} action={{ to: '/', label: t('home') }} />;
}
