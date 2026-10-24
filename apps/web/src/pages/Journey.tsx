import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorNote, Loader, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import type { Journey } from '../lib/types';

/** "Our journey": the story of the sangha. Everything on it is written in Admin > Our journey. */
export function JourneyPage() {
  const { t, L } = useLang();
  const { data, isLoading, error } = useQuery({ queryKey: ['journey'], queryFn: () => api<Journey>('/journey') });
  const chapters = data?.chapters ?? [];
  const people = data?.people ?? [];
  const numbers = data?.numbers ?? [];
  return (
    <>
      <PageHeader title={L(data?.title) || t('journey')} intro={L(data?.intro)} image={data?.heroImage} />
      <div className="mx-auto max-w-4xl px-4 py-10">
        {isLoading ? <Loader /> : error ? <ErrorNote /> : !chapters.length && !people.length ? <EmptyState title={t('empty')} /> : (
          <>
            {numbers.length > 0 && (
              <ul className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {numbers.map((n) => (
                  <li key={n.value + L(n.label)} className="card p-4 text-center">
                    <span className="block font-display text-4xl font-extrabold text-accent">{n.value}</span>
                    <span className="text-sm text-muted">{L(n.label)}</span>
                  </li>
                ))}
              </ul>
            )}

            {chapters.length > 0 && (
              <ol className="relative space-y-8 border-l-4 border-saffron pl-6 sm:pl-8">
                {chapters.map((c, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden="true" className="absolute -left-[2.15rem] top-1.5 size-4 rounded-full border-4 border-paper bg-kred sm:-left-[2.65rem]" />
                    {c.label && <span className="inline-block rounded-full bg-saffron px-3 py-0.5 text-sm font-bold text-(--on-yellow)">{c.label}</span>}
                    {L(c.heading) && <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">{L(c.heading)}</h2>}
                    {c.image && <img src={c.image} alt="" loading="lazy" className="mt-3 max-h-96 w-full rounded-2xl border border-line object-cover" />}
                    {L(c.body) && <p className="prose-lines mt-3 whitespace-pre-line text-lg leading-8">{L(c.body)}</p>}
                  </li>
                ))}
              </ol>
            )}

            {people.length > 0 && (
              <section className="mt-12" aria-labelledby="journey-people">
                <h2 id="journey-people" className="font-display text-2xl font-extrabold sm:text-3xl">{L(data?.peopleTitle) || t('journeyPeople')}</h2>
                <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {people.map((p, i) => (
                    <li key={i} className="card flex items-center gap-3 p-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-saffron font-bold text-(--on-yellow)" aria-hidden="true">{i + 1}</span>
                      <span className="font-semibold">{p.name}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {L(data?.credit) && <p className="mt-10 text-right italic text-muted">{L(data?.credit)}</p>}
          </>
        )}
      </div>
    </>
  );
}
