import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang, type StrKey } from '../lib/i18n';
import { TextSizeToggle } from '../lib/textsize';
import { ThemeToggle } from '../lib/theme';
import { InstallPrompt, OfflineBar } from './pwa';
import { Silk, SocialLinks, useSite } from './ui';

const NAV: Array<{ to: string; key: StrKey }> = [
  { to: '/', key: 'home' },
  { to: '/events', key: 'events' },
  { to: '/blog', key: 'blog' },
  { to: '/gallery', key: 'gallery' },
  { to: '/journey', key: 'journey' },
  { to: '/board', key: 'board' },
  { to: '/contact', key: 'contact' },
];

// Lucide-style 24px stroke icons for the phone bottom bar.
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21H3zM9 21v-6h6v6',
  events: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z',
  gallery: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  contribute: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  more: 'M4 6h16M4 12h16M4 18h16',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** Two labelled choices instead of one button that names the *other* language. */
function LanguageSwitch() {
  const { lang, setLang } = useLang();
  const opt = (value: 'kn' | 'en', label: string, aria: string) => (
    <button
      type="button"
      lang={value}
      aria-pressed={lang === value}
      aria-label={aria}
      onClick={() => setLang(value)}
      className={`min-h-10 rounded-full px-3 text-sm font-bold transition-colors ${lang === value ? 'bg-kred text-white' : 'text-ink hover:bg-ink/10'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Language" className="flex rounded-full border-2 border-line bg-card p-0.5">
      {opt('kn', 'ಕನ್ನಡ', 'ಕನ್ನಡದಲ್ಲಿ ನೋಡಿ')}
      {opt('en', 'EN', 'View in English')}
    </div>
  );
}

export function Layout() {
  const { t, L } = useLang();
  const { data: site } = useSite();
  const { data: credits } = useQuery({ queryKey: ['credits'], queryFn: () => api<unknown[]>('/credits'), staleTime: 10 * 60_000 });
  const hasCredits = (credits?.length ?? 0) > 0;
  // The journey page is optional: no menu link until the admin has written something on it.
  const { data: journey } = useQuery({ queryKey: ['journey'], queryFn: () => api<{ chapters: unknown[]; people: unknown[] }>('/journey'), staleTime: 10 * 60_000 });
  const hasJourney = (journey?.chapters.length ?? 0) + (journey?.people.length ?? 0) > 0;
  const nav = NAV.filter((n) => n.to !== '/journey' || hasJourney);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const firstRender = useRef(true);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    // After a page change, put keyboard/screen-reader focus on the new content (not on the link that was clicked).
    if (!firstRender.current) document.getElementById('main')?.focus({ preventScroll: true });
    firstRender.current = false;
  }, [pathname]);

  const name = L(site?.name) || 'ಕನ್ನಡ ಸಂಘ';
  const link = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-3 py-2 font-semibold transition-colors ${isActive ? 'bg-saffron text-neutral-900' : 'hover:bg-ink/10'}`;
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-accent' : 'text-muted'}`;

  return (
    <div className="flex min-h-dvh flex-col">
      {site?.demo && (
        <div role="note" className="bg-neutral-900 px-4 py-1.5 text-center text-xs font-bold tracking-wide text-saffron sm:text-sm">
          {t('demoBanner')}
        </div>
      )}
      <OfflineBar />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-saffron focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 text-ink shadow-sm backdrop-blur">
        <Silk />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            {site?.logo ? (
              <img src={site.logo} alt="" className="size-11 shrink-0 rounded-full border-2 border-kred object-cover" />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-kred bg-saffron font-display text-2xl text-neutral-900" aria-hidden="true">
                ಕ
              </span>
            )}
            <span className="truncate font-display text-xl font-extrabold leading-tight sm:text-2xl">{name}</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link}>
                {t(n.key)}
              </NavLink>
            ))}
            <Link to="/contribute" className="btn btn-gold ml-2">
              {t('contribute')}
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <TextSizeToggle className="hidden sm:inline-flex" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <LanguageSwitch />
            <button
              type="button"
              className="btn btn-ghost hidden min-h-10 px-3 md:inline-flex xl:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? '✕' : '☰'}
              <span className="sr-only">{t('menu')}</span>
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Menu" className="flex flex-col gap-1 border-t border-line px-4 pb-4 pt-2 xl:hidden">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link}>
                {t(n.key)}
              </NavLink>
            ))}
            <div className="flex items-center gap-2 pt-2 sm:hidden">
              <span className="text-sm text-muted">{t('textSize')}</span>
              <TextSizeToggle />
              <ThemeToggle />
            </div>
            <NavLink to="/my" className={link}>{t('myRegs')}</NavLink>
            <Link to="/contribute" className="btn btn-gold mt-2">
              {t('contribute')}
            </Link>
          </nav>
        )}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 pb-16 outline-none md:pb-0">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-soft pb-16 text-ink md:pb-0">
        <Silk />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-2xl font-extrabold text-accent">{name}</p>
            <p className="mt-1">{L(site?.tagline)}</p>
            <p className="mt-1"><Link to="/my" className="inline-block py-2 font-semibold underline">{t('myRegs')}</Link></p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-accent">{t('contact')}</p>
            {site?.address && <p>{L(site.address)}</p>}
            {site?.phone && <p><a className="inline-block py-1.5" href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a></p>}
            {site?.email && <p><a className="inline-block py-1.5" href={`mailto:${site.email}`}>{site.email}</a></p>}
          </div>
          {(site?.usefulLinks?.length ?? 0) > 0 && (
            <nav aria-label={t('usefulLinks')}>
              <p className="font-semibold text-accent">{t('usefulLinks')}</p>
              <ul>
                {site?.usefulLinks?.map((l, i) => (
                  <li key={i}>
                    <a className="inline-block py-1.5 underline" href={l.url} target="_blank" rel="noopener noreferrer">{L(l.label) || l.url}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="space-y-1">
            <p className="font-semibold text-accent">{t('followUs')}</p>
            <SocialLinks site={site} />
            <p className="pt-3 text-sm text-muted">
              {t('footerNote')}
              {hasCredits && (
                <>
                  {' · '}
                  <Link to="/credits" className="inline-block py-2 underline">{t('credits')}</Link>
                </>
              )}
            </p>
          </div>
        </div>
      </footer>

      <InstallPrompt />

      {/* Phone bottom bar: the four things people do most, one thumb away. */}
      <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper/95 backdrop-blur md:hidden">
        <NavLink to="/" end className={tab}><Icon name="home" />{t('home')}</NavLink>
        <NavLink to="/events" className={tab}><Icon name="events" />{t('events')}</NavLink>
        <NavLink to="/gallery" className={tab}><Icon name="gallery" />{t('gallery')}</NavLink>
        <NavLink to="/contribute" className={tab}><Icon name="contribute" />{t('contribute')}</NavLink>
        <button
          type="button"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => {
            setOpen((o) => !o);
            window.scrollTo(0, 0);
          }}
        >
          <Icon name="more" />
          {t('more')}
        </button>
      </nav>
    </div>
  );
}
