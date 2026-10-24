import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlbumCard, BlogCard, BoardCard, EventCard, PriceLabel, seatState } from '../components/cards';
import { Carousel } from '../components/Carousel';
import { SponsorStrip } from '../components/Sponsors';
import { Cover, ErrorNote, Loader, RangoliDivider, Section, Silk, usePageTitle } from '../components/ui';
import { api } from '../lib/api';
import { NUDI, useLang } from '../lib/i18n';
import type { EventItem, HomeData, SiteSettings } from '../lib/types';

const WEEK = 7 * 24 * 3600 * 1000;

function WordOfTheDay() {
  const { t } = useLang();
  const w = NUDI[Math.floor(Date.now() / 86_400_000) % NUDI.length]!;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 bg-saffron px-4 py-2 text-center text-neutral-900">
      <span className="text-xs font-bold uppercase tracking-wider">{t('nudi')}</span>
      <span className="font-display text-xl font-extrabold">{w.kn}</span>
      <span className="text-sm">— {w.en}</span>
    </div>
  );
}

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** The one thing most visitors came for: when is the next event, and how do I get in. */
function NextEvent({ ev }: { ev: EventItem }) {
  const { L, t, date, time } = useLang();
  const now = useNow(30_000);
  const ms = new Date(ev.startsAt).getTime() - now;
  const live = ms <= 0;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const seats = seatState(ev);
  const open = ev.registrationOpen && seats !== 'full';

  const unit = (n: number, label: string) => (
    <div className="min-w-16 rounded-xl bg-soft px-3 py-2 text-center">
      <div className="font-display text-3xl font-extrabold leading-none text-accent">{n}</div>
      <div className="mt-1 text-xs font-semibold uppercase text-muted">{label}</div>
    </div>
  );

  return (
    <section className="mx-auto -mt-8 max-w-6xl px-4" aria-label={t('nextEvent')}>
      <div className="card relative z-10 grid overflow-hidden shadow-xl lg:grid-cols-[2fr_3fr]">
        <Link to={`/events/${ev.slug}`} className="relative block overflow-hidden" tabIndex={-1} aria-hidden="true">
          <Cover src={ev.cover} className="aspect-[16/9] size-full lg:aspect-auto lg:min-h-64" />
        </Link>
        <div className="flex flex-col gap-3 p-5 sm:p-7">
          <p className="text-sm font-bold uppercase tracking-wider text-accent">{t('nextEvent')}</p>
          <h2 className="font-display text-3xl font-extrabold leading-tight">{L(ev.title)}</h2>
          <p className="text-muted">
            <span aria-hidden="true">📅</span> {date(ev.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {time(ev.startsAt)}
            {L(ev.venue) && (
              <>
                <br />
                <span aria-hidden="true">📍</span> {L(ev.venue)}
              </>
            )}
          </p>
          {live ? (
            <p className="font-display text-xl font-extrabold text-accent">{t('happeningNow')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2" role="timer" aria-label={`${t('startsIn')} ${days} ${t('days')} ${hours} ${t('hours')}`}>
              <span className="mr-1 text-sm text-muted">{t('startsIn')}</span>
              {unit(days, t('days'))}
              {unit(hours, t('hours'))}
              {unit(mins, t('minutes'))}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Link to={`/events/${ev.slug}`} className="btn btn-primary">
              {open ? t('registerNow') : t('readMore')} →
            </Link>
            <span className="font-semibold">
              <PriceLabel ev={ev} />
            </span>
            {seats === 'few' && <span className="rounded-full bg-kred px-2.5 py-0.5 text-xs font-bold text-white">{t('fewSpots')}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats({ site }: { site: SiteSettings }) {
  const { L } = useLang();
  if (!site.stats?.length) return null;
  return (
    <dl className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 py-10 text-center sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
      {site.stats.map((s) => (
        <div key={s.value + L(s.label)}>
          <dd className="font-display text-4xl font-extrabold text-accent sm:text-5xl">{s.value}</dd>
          <dt className="mt-1 font-semibold text-muted">{L(s.label)}</dt>
        </div>
      ))}
    </dl>
  );
}

function Story({ site }: { site: SiteSettings }) {
  const { t, L } = useLang();
  if (!L(site.about)) return null;
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2">
      {site.storyImage && (
        <div className="relative">
          <div aria-hidden="true" className="absolute -bottom-3 -right-3 size-full rounded-3xl bg-linear-to-b from-saffron from-50% to-kred to-50%" />
          <Cover src={site.storyImage} className="relative aspect-[4/3] w-full rounded-3xl" />
        </div>
      )}
      <div className={site.storyImage ? '' : 'md:col-span-2 md:mx-auto md:max-w-2xl md:text-center'}>
        <h2 className="font-display text-3xl font-extrabold">{t('ourStory')}</h2>
        <p className="mt-3 whitespace-pre-line text-lg text-muted">{L(site.about)}</p>
        <Link to="/contact" className="btn btn-ghost mt-5">{t('joinTeam')} →</Link>
      </div>
    </section>
  );
}

export function Home() {
  const { t, L } = useLang();
  const { data, isLoading, error } = useQuery({ queryKey: ['home'], queryFn: () => api<HomeData>('/home') });
  usePageTitle();

  if (isLoading) return <Loader />;
  if (error || !data) return <ErrorNote />;
  const { banners, notifications, events, blogs, board, albums, site, sponsors = [] } = data;
  const [lead, ...others] = board;
  const [next, ...laterEvents] = events;

  return (
    <>
      {/* The page's one main heading (the banners use h2, since they change every few seconds). */}
      <h1 className="sr-only">{[L(site.name), L(site.tagline)].filter(Boolean).join(' — ')}</h1>
      <WordOfTheDay />
      <Carousel banners={banners} />
      <SponsorStrip sponsors={sponsors} label="sponsors" clearNext highlightIds={sponsors.filter((s) => next && s.events?.includes(next._id)).map((s) => s._id)} />
      {next && <NextEvent ev={next} />}
      <Stats site={site} />

      {notifications.length > 0 && (
        <Section title={t('whatsNew')}>
          <ul className="grid gap-3 md:grid-cols-2">
            {notifications.map((n) => {
              const isNew = Date.now() - new Date(n.createdAt).getTime() < WEEK;
              const body = (
                <>
                  <span aria-hidden="true" className="mt-0.5 text-xl">{n.pinned ? '📌' : '🔔'}</span>
                  <span className="flex-1">{L(n.text)}</span>
                  {isNew && <span className="rounded-full bg-kred px-2 py-0.5 text-xs font-bold text-white">{t('newBadge')}</span>}
                </>
              );
              const cls = 'card flex items-start gap-3 p-4';
              return (
                <li key={n._id}>
                  {n.link ? (
                    <Link to={n.link} className={`${cls} transition-shadow hover:shadow-lg`}>{body}</Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {laterEvents.length > 0 && (
        <Section title={t('upcoming')} action={{ to: '/events', label: t('viewAll') }} className="pt-2">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {laterEvents.map((e) => <EventCard key={e._id} ev={e} />)}
          </div>
        </Section>
      )}
      {!next && (
        <Section title={t('upcoming')} action={{ to: '/events', label: t('seePast') }} className="pt-2">
          <p className="text-muted">{t('noUpcomingHint')}</p>
        </Section>
      )}

      <RangoliDivider className="my-4" />
      <Story site={site} />

      {/* Board: its own full-bleed band so it reads as a feature, not a footnote. */}
      {lead && (
        <section className="mt-6 border-y border-line bg-soft text-ink" aria-labelledby="board-h">
          <Silk />
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="mb-10 text-center">
              <p className="font-display text-accent">ನಮ್ಮ ತಂಡ</p>
              <h2 id="board-h" className="font-display text-3xl font-extrabold sm:text-4xl">{t('meetBoard')}</h2>
              <p className="mx-auto mt-2 max-w-xl text-muted">{t('boardIntro')}</p>
            </div>
            <div className="mx-auto max-w-md">
              <BoardCard member={lead} featured />
            </div>
            {others.length > 0 && (
              <ul className="scroll-hide -mx-4 mt-8 flex snap-x items-start gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
                {others.map((m) => (
                  <li key={m._id} className="w-44 shrink-0 snap-center sm:w-auto">
                    <BoardCard member={m} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/board" className="btn btn-gold">{t('allBoard')} →</Link>
              <Link to="/contact" className="btn btn-ghost" title={t('joinTeamHint')}>{t('joinTeam')}</Link>
            </div>
          </div>
          <Silk />
        </section>
      )}

      {blogs.length > 0 && (
        <Section title={t('latestBlogs')} action={{ to: '/blog', label: t('viewAll') }}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {blogs.map((b) => <BlogCard key={b._id} post={b} />)}
          </div>
        </Section>
      )}

      {albums.length > 0 && (
        <Section title={t('moments')} action={{ to: '/gallery', label: t('viewAll') }} className="pt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {albums.map((a) => <AlbumCard key={a._id} album={a} />)}
          </div>
        </Section>
      )}

      <section className="bg-saffron py-12 text-center text-neutral-900">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="font-display text-3xl font-extrabold">{t('contribute')}</h2>
          <p className="mt-2 text-neutral-800">{t('contributeIntro')}</p>
          <Link to="/contribute" className="btn btn-primary mt-5">{t('contribute')} →</Link>
        </div>
      </section>
    </>
  );
}
