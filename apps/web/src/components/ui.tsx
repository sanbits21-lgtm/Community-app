import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import type { SiteSettings } from '../lib/types';

export function useSite() {
  return useQuery({ queryKey: ['site'], queryFn: () => api<SiteSettings>('/settings'), staleTime: 5 * 60_000 });
}

/** Sets the browser-tab title ("Events · Kannada Sangha"), which tabs, history and screen readers all rely on. */
export function usePageTitle(title?: string): void {
  const { data: site } = useSite();
  const { L } = useLang();
  const base = L(site?.name) || 'Kannada Sangha';
  useEffect(() => {
    document.title = title ? `${title} · ${base}` : base;
  }, [title, base]);
}

export function Silk() {
  return <div className="silk" aria-hidden="true" />;
}

/** Section divider: two rules around a small rangoli, in the flag colours. */
export function RangoliDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`mx-auto flex max-w-xs items-center gap-3 text-line ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-current" />
      <svg width="28" height="28" viewBox="0 0 48 48">
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="24" cy="10" rx="4" ry="9" fill={i % 2 ? 'var(--red)' : 'var(--yellow)'} transform={`rotate(${i * 45} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="3.5" fill="currentColor" className="text-ink" />
      </svg>
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}

/** Rotating eight-petal rangoli used as the loading indicator. */
export function Loader() {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted" role="status">
      <svg className="rangoli" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="24" cy="10" rx="4" ry="9" fill={i % 2 ? 'var(--red)' : 'var(--yellow)'} transform={`rotate(${i * 45} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="4" fill="var(--ink)" />
      </svg>
      <span>{t('loading')}</span>
    </div>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  const { t } = useLang();
  return (
    <p role="alert" className="mx-auto my-12 max-w-md rounded-xl bg-kred/10 p-4 text-center text-accent">
      {message ?? t('error')}
    </p>
  );
}

/** Friendly "nothing here" state that always offers a next step. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: { label: string; to?: string; onClick?: () => void } }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-14 text-center">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
        <rect x="14" y="20" width="68" height="56" rx="10" fill="var(--soft)" stroke="var(--line)" strokeWidth="2" />
        <rect x="14" y="20" width="68" height="14" rx="7" fill="var(--yellow)" />
        <rect x="14" y="27" width="68" height="7" fill="var(--red)" />
        <path d="M30 50h36M30 60h24" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      {hint && <p className="text-muted">{hint}</p>}
      {action &&
        (action.to ? (
          <Link to={action.to} className="btn btn-primary mt-1">
            {action.label}
          </Link>
        ) : (
          <button type="button" className="btn btn-primary mt-1" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

export type BannerPage = 'events' | 'blog' | 'gallery' | 'board' | 'contribute' | 'contact';

const BANNER_KEY = {
  events: 'bannerEvents',
  blog: 'bannerBlog',
  gallery: 'bannerGallery',
  board: 'bannerBoard',
  contribute: 'bannerContribute',
  contact: 'bannerContact',
} as const satisfies Record<BannerPage, keyof SiteSettings>;

/**
 * Page title band. Background image: the page's own (admin > Site settings), else the default,
 * else plain paper (white in light mode) with dark text. A broken image URL also falls back.
 */
export function PageHeader({ title, intro, page, image }: { title: string; intro?: string; page?: BannerPage; image?: string | undefined }) {
  const { data: site } = useSite();
  usePageTitle(title);
  const [failed, setFailed] = useState('');
  const src = image || (page ? site?.[BANNER_KEY[page]] : '') || site?.bannerDefault || '';
  const hasImage = Boolean(src) && failed !== src;
  return (
    <header className={`relative overflow-hidden border-b border-line ${hasImage ? 'bg-neutral-900 text-white' : 'bg-paper text-ink'}`}>
      {hasImage && (
        <>
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" onError={() => setFailed(src)} />
          <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/45 to-black/15" />
        </>
      )}
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {intro && <p className={`mt-2 max-w-2xl text-lg ${hasImage ? 'text-white/85' : 'text-muted'}`}>{intro}</p>}
      </div>
      <Silk />
    </header>
  );
}

export function Section({ title, action, children, className = '' }: { title: string; action?: { to: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <section className={`mx-auto max-w-6xl px-4 py-10 ${className}`}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="flex items-center gap-3 font-display text-3xl font-extrabold text-ink"><span aria-hidden="true" className="h-8 w-1.5 rounded bg-linear-to-b from-saffron from-50% to-kred to-50%" />{title}</h2>
        {action && (
          <Link to={action.to} className="shrink-0 font-semibold text-accent underline-offset-4 hover:underline">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * The uploaded image or, when none was set, the flag, so a page never has a hole in it.
 * While an image loads it shows as a soft tinted block that sharpens in (blur-up), not a blank gap.
 */
export function Cover({ src, alt = '', className = '', glyph = true, eager = false }: { src?: string; alt?: string; className?: string; glyph?: boolean; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        ref={(el) => {
          // Cached images can finish before React attaches onLoad.
          if (el?.complete && !loaded) setLoaded(true);
        }}
        onLoad={() => setLoaded(true)}
        className={`object-cover bg-soft transition-[filter] duration-500 ${loaded ? '' : 'blur-md'} ${className}`}
      />
    );
  }
  return (
    <div className={`flag-fallback flex items-center justify-center text-5xl text-white ${className}`} aria-hidden="true">
      {glyph && <span className="font-display opacity-80 drop-shadow">ಕ</span>}
    </div>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase();
}

const SOCIALS = [
  { key: 'facebook', label: 'Facebook', path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
  { key: 'instagram', label: 'Instagram', path: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM17.5 6.5h.01' },
  { key: 'youtube', label: 'YouTube', path: 'M3 7a4 4 0 0 1 4-2h10a4 4 0 0 1 4 2v10a4 4 0 0 1-4 2H7a4 4 0 0 1-4-2zM10 9l5 3-5 3z' },
  { key: 'whatsapp', label: 'WhatsApp', path: 'M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5zM9 8.5c0 3 2.5 5.5 5.5 6.5l1.5-1.5-2-1-1 .8c-.8-.4-1.5-1.1-1.9-1.9l.8-1-1-2z' },
] as const;

/** Round icon links for whichever social URLs are set in Admin > Site settings. Renders nothing if none are. */
export function SocialLinks({ site, className = '' }: { site?: SiteSettings; className?: string }) {
  const items = SOCIALS.filter((s) => site?.[s.key]);
  if (!site || items.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-3 ${className}`}>
      {items.map((s) => (
        <li key={s.key}>
          <a
            href={site[s.key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className="flex size-11 items-center justify-center rounded-full border-2 border-line bg-card text-ink transition-colors hover:border-kred hover:bg-saffron hover:text-neutral-900"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={s.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
