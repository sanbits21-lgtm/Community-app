import { buildIcs } from '@sangha/shared';
import { Link } from 'react-router-dom';
import { useLang } from '../lib/i18n';
import type { EventItem } from '../lib/types';

/** Details → Pay → Confirmed. `current` is 0-based; free events skip straight from 0 to 2. */
export function Stepper({ current, skipPay = false }: { current: number; skipPay?: boolean }) {
  const { t } = useLang();
  const steps = skipPay ? [t('stepDetails'), t('stepDone')] : [t('stepDetails'), t('stepPay'), t('stepDone')];
  const idx = skipPay && current === 2 ? 1 : current;
  return (
    <ol className="mb-4 flex items-center" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < idx;
        const now = i === idx;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={now ? 'step' : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-done text-white' : now ? 'bg-saffron text-neutral-900 ring-2 ring-kred' : 'border-2 border-line text-muted'}`}
              >
                {done ? '✓' : i + 1}
              </span>
              {/* On a very narrow phone only the current step keeps its label, so the bar never overflows. */}
              <span className={`text-sm font-semibold ${now ? 'text-ink' : 'hidden text-muted sm:inline'}`}>{label}</span>
            </span>
            {i < steps.length - 1 && <span className={`mx-2 h-0.5 flex-1 rounded ${done ? 'bg-done' : 'bg-line'}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function downloadIcs(ev: EventItem, code: string, title: string, venue: string): void {
  const text = buildIcs({
    uid: `${code}@kannada-sangha`,
    title,
    start: new Date(ev.startsAt),
    end: ev.endsAt ? new Date(ev.endsAt) : null,
    location: venue,
    description: `Registration ${code}`,
    url: `${location.origin}/events/${ev.slug}`,
  });
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.slug}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The "you're in" card: code, status, add-to-calendar, WhatsApp share. */
export function ConfirmedCard({ ev, code, status, emailed, note }: { ev: EventItem; code: string; status: 'verified' | 'pending' | string; emailed?: boolean; note?: string }) {
  const { t, L, date, time } = useLang();
  const title = L(ev.title);
  const share = `https://wa.me/?text=${encodeURIComponent(`${title} — ${date(ev.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} ${time(ev.startsAt)}\n${location.origin}/events/${ev.slug}`)}`;
  return (
    <div className="card rise space-y-3 p-6 text-center" role="status">
      <p className="text-5xl" aria-hidden="true">🎉</p>
      <h2 className="font-display text-2xl font-extrabold">{t('thanks')}</h2>
      <p className="text-muted">{t('yourCode')}</p>
      <p className="rounded-xl bg-saffron/25 py-3 font-mono text-3xl font-bold tracking-widest">{code}</p>
      <p className="text-sm text-muted">{t('keepCode')}</p>
      <p className="font-semibold">{status === 'verified' ? t('verified') : t('pending')}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
      {emailed && <p className="text-sm text-muted">{t('emailSent')}</p>}
      <div className="grid gap-2 pt-1">
        <button type="button" className="btn btn-gold" onClick={() => downloadIcs(ev, code, title, L(ev.venue))}>
          📅 {t('addCalendar')}
        </button>
        <a className="btn btn-ghost" href={share} target="_blank" rel="noopener noreferrer">
          {t('shareWhatsapp')}
        </a>
        <Link to={`/registration/${code}`} className="btn btn-primary">{t('checkStatus')}</Link>
      </div>
    </div>
  );
}
