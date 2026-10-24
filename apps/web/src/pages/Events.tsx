import { useMutation, useQuery } from '@tanstack/react-query';
import { ticketAmount } from '@sangha/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EventCard } from '../components/cards';
import { PaymentStep } from '../components/PaymentPanel';
import { SponsorStrip } from '../components/Sponsors';
import { ConfirmedCard, Stepper } from '../components/registration';
import { saveItem } from '../lib/mine';
import { loadAttendee, saveAttendee } from '../lib/remember';
import { eur } from '../lib/format';
import { FilterBar, matches, yearsOf } from '../components/filters';
import { Cover, EmptyState, ErrorNote, Loader, PageHeader, usePageTitle } from '../components/ui';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import type { EventItem } from '../lib/types';

export function Events() {
  const { t, L } = useLang();
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['events', when], queryFn: () => api<EventItem[]>(`/events?when=${when}`) });

  const years = yearsOf((data ?? []).map((e) => e.startsAt));
  const shown = (data ?? []).filter((e) => matches(q, L(e.title), L(e.venue)) && (!year || new Date(e.startsAt).getFullYear() === Number(year)));
  const filtered = q !== '' || year !== '';
  const clear = () => {
    setQ('');
    setYear('');
  };

  return (
    <>
      <PageHeader page="events" title={t('events')} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div role="tablist" className="mb-6 inline-flex rounded-full border border-line bg-card p-1">
          {(['upcoming', 'past'] as const).map((w) => (
            <button
              key={w}
              role="tab"
              aria-selected={when === w}
              onClick={() => {
                setWhen(w);
                clear();
              }}
              className={`rounded-full px-5 py-2 font-semibold ${when === w ? 'bg-kred text-white' : ''}`}
            >
              {t(w)}
            </button>
          ))}
        </div>
        <FilterBar q={q} onQ={setQ} active={filtered} onClear={clear}>
          {years.length > 1 && (
            <select className="input w-auto" aria-label={t('allYears')} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">{t('allYears')}</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </FilterBar>
        {isLoading ? <Loader /> : error ? <ErrorNote /> : shown.length === 0 ? (
          filtered ? (
            <EmptyState title={t('noMatches')} action={{ label: t('clearFilters'), onClick: clear }} />
          ) : when === 'upcoming' ? (
            <EmptyState title={t('noUpcoming')} hint={t('noUpcomingHint')} action={{ label: t('seePast'), onClick: () => setWhen('past') }} />
          ) : (
            <EmptyState title={t('noEvents')} />
          )
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{shown.map((e) => <EventCard key={e._id} ev={e} />)}</div>
        )}
      </div>
    </>
  );
}

interface Done {
  code: string;
  status: string;
  amount: number;
}

export function EventDetail() {
  const { slug = '' } = useParams();
  const { t, L, date, time } = useLang();
  const { data: ev, isLoading, error } = useQuery({ queryKey: ['event', slug], queryFn: () => api<EventItem>(`/events/${slug}`), retry: false });
  const saved = useMemo(loadAttendee, []);
  const [form, setForm] = useState({ name: saved?.name ?? '', phone: saved?.phone ?? '', email: saved?.email ?? '', attendees: 1, ticketIndex: 0, website: '' });
  const [remember, setRemember] = useState(true);
  const [done, setDone] = useState<Done | null>(null);
  // 'paying' until the payer says they've sent it or will pay later.
  const [payState, setPayState] = useState<'paying' | 'sent' | 'later'>('paying');

  const register = useMutation({
    mutationFn: () => api<Done>(`/events/${slug}/register`, { method: 'POST', body: form }),
    onSuccess: (d) => {
      saveAttendee(remember ? { name: form.name, phone: form.phone, email: form.email } : null);
      if (ev) saveItem({ kind: 'registration', code: d.code, amount: d.amount, eventSlug: ev.slug, title: ev.title, venue: ev.venue, startsAt: ev.startsAt, attendees: form.attendees, savedAt: new Date().toISOString() });
      setDone(d);
    },
  });

  usePageTitle(ev ? L(ev.title) : undefined);

  if (isLoading) return <Loader />;
  if (error || !ev) return <ErrorNote message={t('notFound')} />;

  const amount = ticketAmount(ev.isPaid, ev.tickets, form.ticketIndex, form.attendees);
  const isOver = new Date(ev.startsAt) < new Date();
  const full = ev.spotsLeft === 0;
  const open = ev.registrationOpen && !isOver && !full;
  const needsPayment = Boolean(done && done.amount > 0 && done.status === 'pending');
  const step = !done ? 0 : needsPayment && payState === 'paying' ? 1 : 2;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate();
  };

  return (
    <>
      <div className="relative">
        <Cover src={ev.cover} className="h-56 w-full sm:h-80" />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-6 text-white">
          <h1 className="font-display text-3xl font-extrabold sm:text-5xl">{L(ev.title)}</h1>
        </div>
      </div>

      <SponsorStrip sponsors={ev.sponsors ?? []} label="eventSponsors" />

      <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-8 lg:grid-cols-[1fr_26rem]">
        <div>
          <dl className="card mb-6 grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-accent">{t('when')}</dt>
              <dd>{date(ev.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {time(ev.startsAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-accent">{t('where')}</dt>
              <dd>{L(ev.venue)}</dd>
            </div>
          </dl>
          <div className="prose-lines whitespace-pre-line text-lg">{L(ev.description)}</div>
        </div>

        {/* Sticky on desktop so the form stays beside the description while reading. */}
        <aside className="lg:sticky lg:top-24">
          {open || done ? <Stepper current={step} skipPay={!ev.isPaid || (done !== null && !needsPayment)} /> : null}
          {done && needsPayment && payState === 'paying' ? (
            <PaymentStep
              kind="registrations"
              code={done.code}
              amount={done.amount}
              description={L(ev.title)}
              emailed={Boolean(form.email)}
              doneLink={{ to: `/registration/${done.code}`, label: t('checkStatus') }}
              onSent={() => setPayState('sent')}
              onLater={() => setPayState('later')}
            />
          ) : done && payState === 'later' ? (
            <ConfirmedCard ev={ev} code={done.code} status={done.status} emailed={Boolean(form.email)} note={t('payLaterBody')} />
          ) : done ? (
            <ConfirmedCard ev={ev} code={done.code} status={done.status} emailed={Boolean(form.email)} {...(payState === 'sent' ? { note: t('paidThanks') } : {})} />
          ) : !open ? (
            <p className="card p-6 text-center font-semibold text-muted">{full ? t('full') : t('closed')}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="card space-y-4 p-5">
                <h2 className="font-display text-2xl font-extrabold text-ink">{t('registerNow')}</h2>
                {/* Honeypot: invisible to people, tempting to bots. Anything typed here means "not a person". */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-0 opacity-0" value={form.website} onChange={(e) => set('website', e.target.value)} />
                {ev.spotsLeft != null && <p className="text-sm font-semibold text-accent">{ev.spotsLeft} {t('spotsLeft')}</p>}
                <label className="block"><span className="font-semibold">{t('name')} *</span>
                  <input className="input mt-1" required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
                <label className="block"><span className="font-semibold">{t('phone')} *</span>
                  <input className="input mt-1" required type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
                <label className="block"><span className="font-semibold">{t('email')}</span>
                  <input className="input mt-1" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
                <div className="grid grid-cols-2 gap-3">
                  {ev.isPaid && ev.tickets.length > 0 && (
                    <label className="col-span-2 block"><span className="font-semibold">{t('ticket')}</span>
                      <select className="input mt-1" value={form.ticketIndex} onChange={(e) => set('ticketIndex', Number(e.target.value))}>
                        {ev.tickets.map((tk, i) => <option key={tk.name} value={i}>{tk.name} — {eur(tk.price)}</option>)}
                      </select></label>
                  )}
                  <label className="col-span-2 block"><span className="font-semibold">{t('attendees')}</span>
                    <input className="input mt-1" type="number" min={1} max={ev.spotsLeft ?? 20} value={form.attendees} onChange={(e) => set('attendees', Math.max(1, Number(e.target.value) || 1))} /></label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5 accent-kred" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {t('rememberMe')}
                </label>
              </div>

              {ev.isPaid && amount > 0 && (
                <p className="card p-4">
                  {t('total')}: <strong className="text-xl text-accent">{eur(amount)}</strong>
                  <span className="mt-1 block text-sm text-muted">{t('payNextStep')}</span>
                </p>
              )}

              {register.error && <p role="alert" className="rounded-xl bg-kred/10 p-3 text-accent">{register.error.message}</p>}
              <button className="btn btn-primary w-full text-lg" disabled={register.isPending}>
                {register.isPending ? t('submitting') : ev.isPaid && amount > 0 ? t('continuePay') : t('submit')}
              </button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
