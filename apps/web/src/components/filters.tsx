import type { ReactNode } from 'react';
import { useLang } from '../lib/i18n';

/** Case-insensitive "does any field contain the query". Empty query matches everything. */
export function matches(q: string, ...fields: Array<string | undefined>): boolean {
  const needle = q.trim().toLowerCase();
  return needle === '' || fields.some((f) => (f ?? '').toLowerCase().includes(needle));
}

export function yearsOf(dates: string[]): number[] {
  return [...new Set(dates.map((d) => new Date(d).getFullYear()))].sort((a, b) => b - a);
}

/** Search box plus any selects, with a clear button when something is active. */
export function FilterBar({ q, onQ, active, onClear, children }: { q: string; onQ: (v: string) => void; active: boolean; onClear: () => void; children?: ReactNode }) {
  const { t } = useLang();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <label className="min-w-56 flex-1">
        <span className="sr-only">{t('search')}</span>
        <input type="search" className="input" placeholder={`🔍 ${t('search')}…`} value={q} onChange={(e) => onQ(e.target.value)} />
      </label>
      {children}
      {active && (
        <button type="button" className="font-semibold text-accent underline" onClick={onClear}>
          {t('clearFilters')}
        </button>
      )}
    </div>
  );
}
