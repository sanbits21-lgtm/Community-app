import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { eur } from '../lib/format';
import { useLang } from '../lib/i18n';
import { loadSaved, removeSaved, type SavedItem } from '../lib/mine';
import type { RegistrationStatus } from '../lib/types';

function StatusChip({ code }: { code: string }) {
  const { t } = useLang();
  // Live status only when there's a connection; offline the saved card still works, it just can't ask the server.
  const { data, isError } = useQuery({
    queryKey: ['reg', code],
    queryFn: () => api<RegistrationStatus>(`/registrations/${code}`),
    enabled: navigator.onLine,
    retry: false,
    staleTime: 60_000,
  });
  if (data) {
    const tone = data.status === 'verified' ? 'bg-green-100 text-green-900' : data.status === 'rejected' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900';
    return <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${tone}`}>{t(data.status)}</span>;
  }
  return <span className="text-sm text-muted">{isError || !navigator.onLine ? t('statusNeedsNet') : t('loading')}</span>;
}

function Card({ item, onRemove }: { item: SavedItem; onRemove: () => void }) {
  const { t, L, date, time } = useLang();
  return (
    <li className="card space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">{item.kind === 'registration' ? t('registerLabel') : t('contribute')}</p>
          {item.kind === 'registration' ? (
            <h2 className="font-display text-xl font-extrabold">{L(item.title)}</h2>
          ) : (
            <h2 className="font-display text-xl font-extrabold">{eur(item.amount)}</h2>
          )}
        </div>
        {item.kind === 'registration' && <StatusChip code={item.code} />}
      </div>

      <p className="rounded-xl bg-saffron/25 py-3 text-center font-mono text-3xl font-bold tracking-widest">{item.code}</p>

      {item.kind === 'registration' && item.startsAt && (
        <p className="text-sm text-muted">
          <span aria-hidden="true">📅</span> {date(item.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {time(item.startsAt)}
          {L(item.venue) && (
            <>
              <br />
              <span aria-hidden="true">📍</span> {L(item.venue)}
            </>
          )}
          <br />
          {item.attendees} × · {eur(item.amount)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {item.kind === 'registration' && (
          <>
            <Link to={`/registration/${item.code}`} className="btn btn-primary min-h-10 px-4 text-sm">{t('checkStatus')}</Link>
            {item.eventSlug && <Link to={`/events/${item.eventSlug}`} className="btn btn-ghost min-h-10 px-4 text-sm">{t('openEvent')}</Link>}
          </>
        )}
        <button type="button" className="ml-auto text-sm font-semibold text-accent underline" onClick={onRemove}>{t('remove')}</button>
      </div>
    </li>
  );
}

/** Codes this device has registered with. Lives in the browser, so it opens with no signal at the venue door. */
export function MyRegistrations() {
  const { t } = useLang();
  const [items, setItems] = useState(loadSaved);

  useEffect(() => {
    const sync = () => setItems(loadSaved());
    window.addEventListener('sangha-saved-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sangha-saved-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <>
      <PageHeader title={t('myRegs')} intro={t('myRegsIntro')} />
      <div className="mx-auto max-w-2xl px-4 py-8">
        {items.length === 0 ? (
          <EmptyState title={t('myRegsEmpty')} hint={t('myRegsEmptyHint')} action={{ to: '/events', label: t('events') }} />
        ) : (
          <>
            <ul className="space-y-4">
              {items.map((i) => (
                <Card key={i.code} item={i} onRemove={() => removeSaved(i.code)} />
              ))}
            </ul>
            <p className="mt-6 text-center text-sm text-muted">🔒 {t('savedHere')}</p>
          </>
        )}
      </div>
    </>
  );
}
