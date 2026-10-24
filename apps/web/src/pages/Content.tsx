import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlbumCard, Avatar, BlogCard } from '../components/cards';
import { PaymentStep } from '../components/PaymentPanel';
import { Stepper } from '../components/registration';
import { saveItem } from '../lib/mine';
import { loadAttendee, saveAttendee } from '../lib/remember';
import { eur } from '../lib/format';
import { FilterBar, matches, yearsOf } from '../components/filters';
import { Cover, EmptyState, ErrorNote, Loader, PageHeader, SocialLinks, usePageTitle, useSite } from '../components/ui';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import type { AlbumItem, BlogPost, BoardMember, RegistrationStatus } from '../lib/types';

export function Blogs() {
  const { t, L } = useLang();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['blogs'], queryFn: () => api<BlogPost[]>('/blogs') });
  const cats = [...new Set((data ?? []).map((p) => p.category).filter(Boolean))].sort();
  const shown = (data ?? []).filter((p) => matches(q, L(p.title), L(p.excerpt), p.category, p.author) && (!cat || p.category === cat));
  const filtered = q !== '' || cat !== '';
  const clear = () => {
    setQ('');
    setCat('');
  };
  return (
    <>
      <PageHeader page="blog" title={t('blog')} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <FilterBar q={q} onQ={setQ} active={filtered} onClear={clear}>
          {cats.length > 1 && (
            <select className="input w-auto" aria-label={t('allCategories')} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">{t('allCategories')}</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </FilterBar>
        {isLoading ? <Loader /> : error ? <ErrorNote /> : shown.length === 0 ? (
          filtered ? <EmptyState title={t('noMatches')} action={{ label: t('clearFilters'), onClick: clear }} /> : <EmptyState title={t('empty')} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{shown.map((p) => <BlogCard key={p._id} post={p} />)}</div>
        )}
      </div>
    </>
  );
}

export function BlogDetail() {
  const { slug = '' } = useParams();
  const { L, t, date } = useLang();
  const { data: post, isLoading, error } = useQuery({ queryKey: ['blog', slug], queryFn: () => api<BlogPost>(`/blogs/${slug}`), retry: false });
  usePageTitle(post ? L(post.title) : undefined);
  if (isLoading) return <Loader />;
  if (error || !post) return <ErrorNote message={t('notFound')} />;
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/blog" className="font-semibold text-accent">← {t('blog')}</Link>
      <Cover src={post.cover} className="mt-4 aspect-[16/8] w-full rounded-2xl" />
      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-accent">
        {post.category && `${post.category} · `}{date(post.publishedAt)}{post.author && ` · ${post.author}`}
      </p>
      <h1 className="mt-1 font-display text-4xl font-extrabold">{L(post.title)}</h1>
      {/* Plain text on purpose: React escapes it, and blank lines become paragraph breaks. */}
      <div className="prose-lines mt-6 whitespace-pre-line text-lg leading-8">{L(post.body)}</div>
    </article>
  );
}

export function Gallery() {
  const { t, L } = useLang();
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['gallery'], queryFn: () => api<AlbumItem[]>('/gallery') });
  const years = yearsOf((data ?? []).map((a) => a.date));
  const shown = (data ?? []).filter((a) => matches(q, L(a.title)) && (!year || new Date(a.date).getFullYear() === Number(year)));
  const filtered = q !== '' || year !== '';
  const clear = () => {
    setQ('');
    setYear('');
  };
  return (
    <>
      <PageHeader page="gallery" title={t('gallery')} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <FilterBar q={q} onQ={setQ} active={filtered} onClear={clear}>
          {years.length > 1 && (
            <select className="input w-auto" aria-label={t('allYears')} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">{t('allYears')}</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </FilterBar>
        {isLoading ? <Loader /> : error ? <ErrorNote /> : shown.length === 0 ? (
          filtered ? <EmptyState title={t('noMatches')} action={{ label: t('clearFilters'), onClick: clear }} /> : <EmptyState title={t('empty')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((a) => <AlbumCard key={a._id} album={a} />)}</div>
        )}
      </div>
    </>
  );
}

export function AlbumDetail() {
  const { id = '' } = useParams();
  const { L, t, date } = useLang();
  const { data: album, isLoading, error } = useQuery({ queryKey: ['album', id], queryFn: () => api<AlbumItem>(`/gallery/${id}`), retry: false });
  const [open, setOpen] = useState<number | null>(null);
  const n = album?.images.length ?? 0;

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((o) => (o == null ? o : (o + 1) % n));
      if (e.key === 'ArrowLeft') setOpen((o) => (o == null ? o : (o - 1 + n) % n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, n]);

  if (isLoading) return <Loader />;
  if (error || !album) return <ErrorNote message={t('notFound')} />;
  const current = open == null ? null : album.images[open];

  return (
    <>
      <PageHeader page="gallery" title={L(album.title)} intro={`${date(album.date)} · ${n} ${t('photos')}`} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/gallery" className="font-semibold text-accent">← {t('gallery')}</Link>
        {n === 0 ? <EmptyState title={t('empty')} /> : (
          <ul className="mt-4 columns-2 gap-3 sm:columns-3 lg:columns-4">
            {album.images.map((im, i) => (
              <li key={im.url} className="mb-3 break-inside-avoid">
                <button type="button" onClick={() => setOpen(i)} className="block w-full overflow-hidden rounded-xl">
                  <img src={im.url} alt={im.caption} loading="lazy" className="w-full transition-transform duration-300 hover:scale-105" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {current && (
        <div role="dialog" aria-modal="true" aria-label={current.caption || L(album.title)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <img src={current.url} alt={current.caption} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          {current.caption && <p className="absolute inset-x-0 bottom-4 text-center text-white">{current.caption}</p>}
          <button type="button" className="absolute right-4 top-4 size-11 rounded-full bg-white/20 text-2xl text-white" aria-label={t('close')} onClick={() => setOpen(null)}>✕</button>
          {n > 1 && (
            <>
              <button type="button" className="absolute left-3 top-1/2 size-11 -translate-y-1/2 rounded-full bg-white/20 text-3xl text-white" aria-label={t('prev')} onClick={(e) => { e.stopPropagation(); setOpen((open! - 1 + n) % n); }}>‹</button>
              <button type="button" className="absolute right-3 top-1/2 size-11 -translate-y-1/2 rounded-full bg-white/20 text-3xl text-white" aria-label={t('next')} onClick={(e) => { e.stopPropagation(); setOpen((open! + 1) % n); }}>›</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

export function BoardPage() {
  const { t, L } = useLang();
  const { data, isLoading, error } = useQuery({ queryKey: ['board'], queryFn: () => api<BoardMember[]>('/board') });
  return (
    <>
      <PageHeader page="board" title={t('board')} intro={t('boardIntro')} />
      <div className="mx-auto max-w-6xl px-4 py-10">
        {isLoading ? <Loader /> : error ? <ErrorNote /> : !data?.length ? <EmptyState title={t('empty')} /> : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((m) => (
              <li key={m._id} className="card flex flex-col items-center p-6 text-center">
                <Avatar member={m} size="size-32" />
                <h2 className="mt-3 font-display text-2xl font-extrabold">{L(m.name)}</h2>
                <p className="font-semibold text-accent">{L(m.role)}</p>
                {m.term && <p className="text-sm text-muted">{m.term}</p>}
                {L(m.bio) && <p className="mt-3 text-muted">{L(m.bio)}</p>}
                {(m.email || m.phone) && (
                  <p className="mt-3 text-sm">
                    {m.email && <a className="underline" href={`mailto:${m.email}`}>{m.email}</a>}
                    {m.email && m.phone && ' · '}
                    {m.phone && <a className="underline" href={`tel:${m.phone.replace(/\s/g, '')}`}>{m.phone}</a>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

const PRESETS = [10, 25, 50, 100, 250];

export function Contribute() {
  const { t } = useLang();
  const saved = useMemo(loadAttendee, []);
  const [form, setForm] = useState({ name: saved?.name ?? '', phone: saved?.phone ?? '', email: saved?.email ?? '', amount: 25, message: '', website: '' });
  const [remember, setRemember] = useState(true);
  const [done, setDone] = useState<{ code: string; amount: number } | null>(null);
  const [payState, setPayState] = useState<'paying' | 'sent' | 'later'>('paying');
  const send = useMutation({
    mutationFn: () => api<{ code: string; amount: number }>('/contributions', { method: 'POST', body: form }),
    onSuccess: (d) => {
      saveAttendee(remember ? { name: form.name, phone: form.phone, email: form.email } : null);
      saveItem({ kind: 'contribution', code: d.code, amount: d.amount, savedAt: new Date().toISOString() });
      setDone(d);
    },
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (done) {
    return (
      <>
        <PageHeader page="contribute" title={t('contribute')} intro={t('contributeIntro')} />
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Stepper current={payState === 'paying' ? 1 : 2} />
          <PaymentStep kind="contributions" code={done.code} amount={done.amount} description="Contribution" emailed={Boolean(form.email)} onSent={() => setPayState('sent')} onLater={() => setPayState('later')} />
        </div>
      </>
    );
  }
  const submit = (e: FormEvent) => { e.preventDefault(); send.mutate(); };

  return (
    <>
      <PageHeader page="contribute" title={t('contribute')} intro={t('contributeIntro')} />
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <Stepper current={0} />
        <div className="card space-y-4 p-5">
          <fieldset>
            <legend className="font-semibold">{t('amount')}</legend>
                {/* Honeypot: invisible to people, tempting to bots. Anything typed here means "not a person". */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-0 opacity-0" value={form.website} onChange={(e) => set('website', e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((a) => (
                <button type="button" key={a} onClick={() => set('amount', a)} aria-pressed={form.amount === a} className={`min-h-11 rounded-full border-2 px-4 py-2 font-semibold ${form.amount === a ? 'border-kred bg-kred text-white' : 'border-line'}`}>{eur(a)}</button>
              ))}
              <input className="input w-32" type="number" min={1} step="0.01" aria-label={t('amount')} value={form.amount} onChange={(e) => set('amount', Number(e.target.value))} />
            </div>
          </fieldset>
          <label className="block"><span className="font-semibold">{t('name')} *</span><input className="input mt-1" required minLength={2} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="block"><span className="font-semibold">{t('phone')} *</span><input className="input mt-1" required type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label className="block"><span className="font-semibold">{t('email')}</span><input className="input mt-1" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
          <label className="block"><span className="font-semibold">{t('message')}</span><textarea className="input mt-1" rows={2} maxLength={500} value={form.message} onChange={(e) => set('message', e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-kred" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t('rememberMe')}
          </label>
        </div>
        {send.error && <p role="alert" className="rounded-xl bg-kred/10 p-3 text-accent">{send.error.message}</p>}
        <button className="btn btn-primary w-full text-lg" disabled={send.isPending}>{send.isPending ? t('submitting') : t('continuePay')}</button>
      </form>
    </>
  );
}

interface Credit {
  file: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

export function Credits() {
  const { t } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ['credits'], queryFn: () => api<Credit[]>('/credits') });
  return (
    <>
      <PageHeader title={t('credits')} intro={t('creditsIntro')} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        {isLoading && <Loader />}
        <ul className="grid gap-4 sm:grid-cols-2">
          {data?.map((c) => (
            <li key={c.file} className="card flex min-w-0 gap-3 p-3">
              <img src={`/uploads/seed-${c.file}`} alt="" loading="lazy" className="size-20 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 text-sm">
                <a href={c.source} target="_blank" rel="noopener noreferrer" className="block truncate py-1 font-semibold underline">{c.title.replace(/\.jpg$/i, '')}</a>
                <p className="text-muted">{c.author}</p>
                {c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" className="inline-block py-1 underline">{c.license}</a> : <span>{c.license}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function Contact() {
  const { t, L } = useLang();
  const { data: s } = useSite();
  return (
    <>
      <PageHeader page="contact" title={t('contact')} intro={L(s?.about)} />
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-10 text-lg">
        {s?.address && <p>📍 {L(s.address)}</p>}
        {s?.phone && <p>📞 <a className="inline-block py-1.5 underline" href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a></p>}
        {s?.email && <p>✉️ <a className="inline-block py-1.5 underline" href={`mailto:${s.email}`}>{s.email}</a></p>}
        <SocialLinks site={s} className="pt-3" />
      </div>
    </>
  );
}

export function RegistrationLookup() {
  const { code: param } = useParams();
  const navigate = useNavigate();
  const { t, L, date } = useLang();
  const [code, setCode] = useState(param ?? '');
  const { data, error, isFetching } = useQuery({ queryKey: ['reg', param], queryFn: () => api<RegistrationStatus>(`/registrations/${param}`), enabled: Boolean(param), retry: false });

  return (
    <>
      <PageHeader title={t('checkStatus')} />
      <div className="mx-auto max-w-md space-y-6 px-4 py-8">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate(`/registration/${code.trim().toUpperCase()}`); }}>
          <input className="input font-mono uppercase" placeholder="KS-XXXXXX" aria-label={t('code')} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary">{t('lookup')}</button>
        </form>
        {isFetching && <Loader />}
        {error && <ErrorNote message={error.message} />}
        {data && (
          <div className="card space-y-1 p-5">
            <p className="font-mono text-2xl font-bold">{data.code}</p>
            <p className="font-display text-xl font-extrabold">{L(data.event.title)}</p>
            <p className="text-muted">{date(data.event.startsAt)} · {L(data.event.venue)}</p>
            <p>{data.name} · {data.attendees}</p>
            <p className={`pt-2 font-bold ${data.status === 'verified' ? 'text-green-700 dark:text-green-400' : data.status === 'rejected' ? 'text-accent' : 'text-amber-700 dark:text-saffron'}`}>{t(data.status)}</p>
          </div>
        )}
      </div>
    </>
  );
}
