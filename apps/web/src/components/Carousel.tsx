import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../lib/i18n';
import type { Banner } from '../lib/types';
import { Cover } from './ui';

const INTERVAL_MS = 6000;

function CtaLink({ to, children }: { to: string; children: string }) {
  const cls = 'btn btn-gold mt-5 self-start';
  return /^https?:\/\//.test(to) ? (
    <a href={to} className={cls} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

export function Carousel({ banners }: { banners: Banner[] }) {
  const { L, t } = useLang();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const n = banners.length;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Banners can be removed in the admin screen while a visitor is on the page.
  useEffect(() => {
    if (i >= n) setI(0);
  }, [i, n]);

  useEffect(() => {
    if (n < 2 || paused || reduced) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), INTERVAL_MS);
    return () => clearInterval(id);
  }, [n, paused, reduced]);

  const go = (d: number) => setI((x) => (x + d + n) % n);

  if (n === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      className="relative overflow-hidden bg-neutral-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current == null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }} aria-live={paused ? 'polite' : 'off'}>
        {banners.map((b, idx) => (
          <article
            key={b._id}
            className="relative min-h-[26rem] w-full shrink-0 sm:min-h-[30rem] lg:min-h-[34rem]"
            aria-roledescription="slide"
            aria-label={`${idx + 1} / ${n}`}
            aria-hidden={idx !== i}
            // `inert` also takes the hidden slides' buttons out of the tab order, which aria-hidden alone does not.
            inert={idx !== i}
          >
            <Cover src={b.image} glyph={false} eager={idx === 0}className="absolute inset-0 size-full" />
            <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/50 to-transparent sm:bg-linear-to-r sm:from-black/80 sm:via-black/45" />
            <div className="relative mx-auto flex h-full min-h-[inherit] max-w-6xl flex-col justify-end px-4 pb-24 pt-12 text-white sm:justify-center sm:pb-12">
              <p className="mb-2 font-display text-lg text-saffron">{t('namaskara')}</p>
              <h2 className="max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">{L(b.title)}</h2>
              {L(b.subtitle) && <p className="mt-3 max-w-xl text-lg text-white/90">{L(b.subtitle)}</p>}
              {b.ctaLink && L(b.ctaLabel) && <CtaLink to={b.ctaLink}>{L(b.ctaLabel)}</CtaLink>}
            </div>
          </article>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 rounded-full bg-black/40 text-2xl text-white hover:bg-black/60 sm:block" aria-label={t('prev')}>
            ‹
          </button>
          <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 rounded-full bg-black/40 text-2xl text-white hover:bg-black/60 sm:block" aria-label={t('next')}>
            ›
          </button>
          <div className="absolute inset-x-0 bottom-10 flex justify-center gap-2">
            {banners.map((b, idx) => (
              <button
                key={b._id}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`${idx + 1}`}
                aria-current={idx === i}
                className="flex size-6 items-center justify-center"
              >
                <span className={`block h-2.5 rounded-full transition-all ${idx === i ? 'w-8 bg-saffron' : 'w-2.5 bg-white/60'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
