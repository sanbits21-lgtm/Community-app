import { useState } from 'react';
import { Link } from 'react-router-dom';
import { eur } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { AlbumItem, BlogPost, BoardMember, EventItem } from '../lib/types';
import { Cover, initials } from './ui';

/** "Few spots left" once under 10 seats or a fifth of capacity remains; "Full" at zero. */
export function seatState(ev: Pick<EventItem, 'spotsLeft' | 'capacity'>): 'full' | 'few' | 'ok' {
  if (ev.spotsLeft == null) return 'ok';
  if (ev.spotsLeft <= 0) return 'full';
  return ev.spotsLeft <= 10 || (ev.capacity != null && ev.spotsLeft <= ev.capacity * 0.2) ? 'few' : 'ok';
}

export function PriceLabel({ ev }: { ev: EventItem }) {
  const { t } = useLang();
  const prices = ev.tickets.map((x) => x.price);
  return <>{!ev.isPaid || prices.length === 0 ? t('free') : `${eur(Math.min(...prices))}${prices.length > 1 ? '+' : ''}`}</>;
}

export function EventCard({ ev }: { ev: EventItem }) {
  const { L, t, date, time } = useLang();
  const d = new Date(ev.startsAt);
  const past = d.getTime() < Date.now();
  const seats = seatState(ev);
  return (
    <Link to={`/events/${ev.slug}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-xl">
      <div className="relative overflow-hidden">
        <Cover src={ev.cover} className="aspect-[16/9] w-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 rounded-xl bg-saffron px-3 py-1 text-center font-display leading-none text-neutral-900 shadow">
          <div className="text-2xl font-extrabold">{date(ev.startsAt, { day: 'numeric' })}</div>
          <div className="text-xs uppercase">{date(ev.startsAt, { month: 'short' })}</div>
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {past && <span className="rounded-full bg-neutral-900/85 px-2.5 py-0.5 text-xs font-bold text-white">{t('pastBadge')}</span>}
          {!past && seats === 'few' && <span className="rounded-full bg-kred px-2.5 py-0.5 text-xs font-bold text-white">{t('fewSpots')}</span>}
          {!past && seats === 'full' && <span className="rounded-full bg-neutral-900/85 px-2.5 py-0.5 text-xs font-bold text-white">{t('full')}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-display text-xl font-extrabold">{L(ev.title)}</h3>
        <p className="text-sm text-muted">
          <span aria-hidden="true">🕐</span> {time(ev.startsAt)}
          {L(ev.venue) && (
            <>
              {' · '}
              <span aria-hidden="true">📍</span> {L(ev.venue)}
            </>
          )}
        </p>
        <p className="mt-auto flex items-center justify-between pt-2 font-semibold text-accent">
          <span>
            <PriceLabel ev={ev} />
          </span>
          {!past && ev.spotsLeft != null && ev.spotsLeft > 0 && <span className="text-sm font-normal text-muted">{ev.spotsLeft} {t('spotsLeft')}</span>}
        </p>
      </div>
    </Link>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  const { L, t, date } = useLang();
  return (
    <Link to={`/blog/${post.slug}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-xl">
      <div className="overflow-hidden">
        <Cover src={post.cover} className="aspect-[16/9] w-full transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {post.category && `${post.category} · `}
          {date(post.publishedAt)}
        </p>
        <h3 className="font-display text-xl font-extrabold">{L(post.title)}</h3>
        <p className="line-clamp-3 text-muted">{L(post.excerpt)}</p>
        <span className="mt-auto pt-2 font-semibold text-accent group-hover:underline">{t('readMore')} →</span>
      </div>
    </Link>
  );
}

export function AlbumCard({ album }: { album: AlbumItem }) {
  const { L, t, date } = useLang();
  const cover = album.cover || album.images[0]?.url;
  return (
    <Link to={`/gallery/${album._id}`} className="group relative block overflow-hidden rounded-2xl">
      <Cover src={cover} className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <h3 className="font-display text-xl font-extrabold">{L(album.title)}</h3>
        <p className="text-sm text-white/80">
          {date(album.date)} · {album.count ?? album.images.length} {t('photos')}
        </p>
      </div>
    </Link>
  );
}

export function Avatar({ member, size }: { member: BoardMember; size: string }) {
  const { L } = useLang();
  const name = L(member.name);
  return member.photo ? (
    <img src={member.photo} alt={name} loading="lazy" className={`${size} rounded-full border-4 border-saffron object-cover`} />
  ) : (
    <span
      className={`${size} flex items-center justify-center rounded-full border-4 border-kred bg-saffron font-display text-3xl font-extrabold text-neutral-900`}
      role="img"
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

/** Tap (or hover, on desktop) a member to read their bio. Members without one are plain cards. */
export function BoardCard({ member, featured = false }: { member: BoardMember; featured?: boolean }) {
  const { L, t } = useLang();
  const [open, setOpen] = useState(false);
  const bio = L(member.bio);
  const header = (
    <>
      <Avatar member={member} size={featured ? 'size-36 sm:size-44' : 'size-24 sm:size-28'} />
      <h3 className={`mt-3 font-display font-extrabold ${featured ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{L(member.name)}</h3>
      <p className="font-semibold text-accent">{L(member.role)}</p>
      {member.term && <p className="text-xs text-muted">{member.term}</p>}
    </>
  );
  return (
    <article className={`card group flex flex-col items-center text-center text-ink ${featured ? 'sm:p-4' : ''}`}>
      {bio ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full flex-col items-center rounded-[inherit] p-5 text-center"
        >
          {header}
          <span className="mt-2 text-xs font-semibold text-accent">{open ? '▲' : '▼'} {t('readBio')}</span>
        </button>
      ) : (
        <div className="flex w-full flex-col items-center p-5">{header}</div>
      )}
      {bio && <p className={`px-5 pb-5 text-sm text-muted ${open ? 'block' : 'hidden md:group-hover:block'}`}>{bio}</p>}
    </article>
  );
}
