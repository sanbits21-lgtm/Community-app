import { useState } from 'react';
import { useLang, type StrKey } from '../lib/i18n';
import type { Sponsor } from '../lib/types';

/** Logo width per tier: the bigger the support, the bigger the logo. */
const BOX: Record<Sponsor['tier'], string> = {
  title: 'h-16 w-44',
  gold: 'h-14 w-36',
  silver: 'h-12 w-32',
  community: 'h-12 w-28',
};

function Logo({ s, highlight }: { s: Sponsor; highlight?: boolean }) {
  const [broken, setBroken] = useState(false);
  const inner = (
    <span className={`flex items-center justify-center rounded-xl border bg-white px-3 text-center text-neutral-900 ${BOX[s.tier]} ${highlight ? 'border-kred ring-2 ring-kred' : 'border-line'}`}>
      {s.logo && !broken ? (
        <img src={s.logo} alt={s.name} loading="lazy" className="max-h-full max-w-full object-contain py-1" onError={() => setBroken(true)} />
      ) : (
        <span className="font-display text-sm font-extrabold leading-tight">{s.name}</span>
      )}
    </span>
  );
  return s.website ? (
    <a href={s.website} target="_blank" rel="sponsored noopener noreferrer" aria-label={`${s.name} (opens in a new tab)`} className="shrink-0">
      {inner}
    </a>
  ) : (
    <span className="shrink-0">{inner}</span>
  );
}

/**
 * A slim, always-visible strip of sponsor logos that glides across the page (no scrolling down to find it).
 * Pauses on hover or keyboard focus; with "reduce motion" on the device it stops and can be swiped instead.
 * `clearNext`: on the home page the next-event card overlaps the banner by 2rem; this keeps it from covering the strip.
 * `highlightIds`: sponsors of the featured event get a red outline and come first.
 */
export function SponsorStrip({ sponsors, label, highlightIds = [], clearNext = false }: { sponsors: Sponsor[]; label: StrKey; highlightIds?: string[]; clearNext?: boolean }) {
  const { t } = useLang();
  if (!sponsors.length) return null;
  const hi = new Set(highlightIds);
  const list = [...sponsors].sort((a, b) => Number(hi.has(b._id)) - Number(hi.has(a._id)));
  // Few logos would leave gaps in the loop, so repeat the set until the track is wide enough.
  const reps = Math.max(1, Math.ceil(8 / list.length));
  const one = Array.from({ length: reps }, () => list).flat();
  return (
    <section aria-label={t(label)} className={`sponsor-strip relative z-10 border-b border-line bg-paper ${clearNext ? 'mb-8' : ''}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <h2 className="shrink-0 text-xs font-bold uppercase tracking-wide text-accent sm:text-sm">{t(label)}</h2>
        <div className="sponsor-viewport min-w-0 flex-1 overflow-hidden">
          <ul className="sponsor-track flex w-max items-center gap-4">
            {one.map((s, i) => (
              <li key={`a${i}`}>
                <Logo s={s} highlight={hi.has(s._id)} />
              </li>
            ))}
            {/* Second copy makes the loop seamless; hidden from screen readers and the tab order. */}
            {one.map((s, i) => (
              <li key={`b${i}`} aria-hidden="true" className="sponsor-copy" inert>
                <Logo s={s} highlight={hi.has(s._id)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
