import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { pick } from '@sangha/shared';
import { Cover } from '../components/ui';
import { useToast } from '../components/toast';
import { api } from '../lib/api';
import { RESOURCES, JOURNEY_FIELDS, PAYMENT_FIELDS, SITE_FIELDS } from './configs';
import { FieldInput, type Doc, type Field } from './fields';

/** What the visitor will see: the same layers as the home-page carousel, updated as you type. */
function BannerPreview({ draft }: { draft: Doc }) {
  const [lang, setLang] = useState<'en' | 'kn'>('en');
  const title = pick(draft.title, lang);
  const sub = pick(draft.subtitle, lang);
  const cta = pick(draft.ctaLabel, lang);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold">Live preview</span>
        <div role="group" aria-label="Preview language" className="flex rounded-full border border-line p-0.5 text-xs font-bold">
          {(['en', 'kn'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 ${lang === l ? 'bg-kred text-white' : ''}`}>
              {l === 'en' ? 'EN' : 'ಕನ್ನಡ'}
            </button>
          ))}
        </div>
      </div>
      <div className="relative flex min-h-48 flex-col justify-end overflow-hidden rounded-xl bg-neutral-900 p-5 text-white">
        <Cover src={draft.image} glyph={false} eager className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/50 to-transparent" />
        <div className="relative">
          <p className="font-display text-sm text-saffron">ನಮಸ್ಕಾರ</p>
          <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{title || <span className="opacity-50">Headline…</span>}</p>
          {sub && <p className="mt-1 text-white/90">{sub}</p>}
          {cta && draft.ctaLink && <span className="btn btn-gold mt-3 min-h-9 px-4 text-sm">{cta}</span>}
        </div>
      </div>
    </div>
  );
}

/** Shared form body: renders each configured field and tracks the draft. */
function DocForm({
  fields,
  initial,
  onSave,
  onCancel,
  saving,
  error,
  saveLabel = 'Save',
  preview,
}: {
  fields: Field[];
  initial: Doc;
  onSave: (d: Doc) => void;
  onCancel?: () => void;
  saving: boolean;
  error?: string;
  saveLabel?: string;
  preview?: 'banner';
}) {
  const [draft, setDraft] = useState<Doc>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // Closing the tab or reloading with unsaved edits asks first. (In-app Cancel asks too, below.)
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(draft);
  };
  return (
    <form onSubmit={submit} className="card space-y-5 p-5">
      {preview === 'banner' && <BannerPreview draft={draft} />}
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
      ))}
      {error && <p role="alert" className="rounded-lg bg-kred/10 p-3 text-accent">{error}</p>}
      <div className="flex gap-3">
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={() => { if (!dirty || confirm('Discard your unsaved changes?')) onCancel(); }}>
            Cancel
          </button>
        )}
        {dirty && <span className="self-center rounded-full bg-saffron/30 px-3 py-1 text-sm font-semibold" role="status">Unsaved changes</span>}
      </div>
    </form>
  );
}

export function ResourcePage({ id }: { id: string }) {
  const cfg = RESOURCES[id]!;
  const qc = useQueryClient();
  const key = ['admin', cfg.path];
  const list = useQuery({ queryKey: key, queryFn: () => api<Doc[]>(`/admin/${cfg.path}`) });
  const [editing, setEditing] = useState<Doc | 'new' | null>(null);

  const save = useMutation({
    mutationFn: (d: Doc) => (d._id ? api(`/admin/${cfg.path}/${d._id}`, { method: 'PUT', body: d }) : api(`/admin/${cfg.path}`, { method: 'POST', body: d })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setEditing(null);
    },
  });
  const toast = useToast();
  const restore = useMutation({
    mutationFn: (d: Doc) => api(`/admin/${cfg.path}`, { method: 'POST', body: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: (d: Doc) => api(`/admin/${cfg.path}/${d._id}`, { method: 'DELETE' }),
    onSuccess: (_r, d) => {
      qc.invalidateQueries({ queryKey: key });
      // Undo re-creates the item from what we just deleted (it gets a new id; the server ignores stale fields).
      toast(`Deleted "${cfg.summary(d).title}"`, { label: 'Undo', run: () => restore.mutate(d) });
    },
  });
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const reorder = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const items = [...(list.data ?? [])];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved!);
      // Renumber everything so equal `order` values can never make the swap ambiguous.
      await Promise.all(items.map((d, i) => (d.order === i + 1 ? null : api(`/admin/${cfg.path}/${d._id}`, { method: 'PUT', body: { ...d, order: i + 1 } }))));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (editing) {
    const initial = editing === 'new' ? cfg.blank() : editing;
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl font-extrabold">{editing === 'new' ? `New ${cfg.singular}` : `Edit ${cfg.singular}`}</h2>
        <DocForm
          key={editing === 'new' ? 'new' : editing._id}
          fields={cfg.fields}
          initial={initial}
          {...(cfg.preview ? { preview: cfg.preview } : {})}
          saving={save.isPending}
          error={save.error?.message}
          onSave={(d) => save.mutate(d)}
          onCancel={() => { save.reset(); setEditing(null); }}
        />
      </div>
    );
  }

  const items = list.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">{cfg.title}</h2>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add {cfg.singular}</button>
      </div>
      {list.isLoading && <p className="text-muted">Loading…</p>}
      {list.error && <p role="alert" className="text-accent">{list.error.message}</p>}
      {list.data && items.length === 0 && <p className="card p-6 text-center text-muted">No {cfg.title.toLowerCase()} yet.</p>}
      {(remove.error || reorder.error) && <p role="alert" className="text-accent">{(remove.error ?? reorder.error)?.message}</p>}
      <ul className="space-y-3">
        {items.map((d, i) => {
          const s = cfg.summary(d);
          return (
            <li
              key={d._id}
              className={`card flex flex-wrap items-center gap-3 p-3 ${dragOver === i && dragFrom !== null && dragFrom !== i ? 'ring-2 ring-kred' : ''}`}
              draggable={Boolean(cfg.orderable)}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(i);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) reorder.mutate({ from: dragFrom, to: i });
                setDragFrom(null);
                setDragOver(null);
              }}
            >
              {cfg.orderable && <span className="cursor-grab select-none text-xl text-muted" title="Drag to reorder" aria-hidden="true">⠿</span>}
              {s.image ? <img src={s.image} alt="" className="size-16 rounded-lg object-cover" /> : <div className="flex size-16 items-center justify-center rounded-lg bg-saffron/20 text-2xl" aria-hidden="true">ಕ</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.title}</p>
                {s.sub && <p className="truncate text-sm text-muted">{s.sub}</p>}
                <div className="mt-1 flex gap-1">{s.badges?.map((b) => <span key={b} className="rounded-full bg-saffron/30 px-2 text-xs font-semibold">{b}</span>)}</div>
              </div>
              <div className="flex items-center gap-1">
                {cfg.orderable && (
                  <>
                    <button className="btn btn-ghost min-h-9 px-3" disabled={i === 0 || reorder.isPending} onClick={() => reorder.mutate({ from: i, to: i - 1 })} aria-label="Move up">↑</button>
                    <button className="btn btn-ghost min-h-9 px-3" disabled={i === items.length - 1 || reorder.isPending} onClick={() => reorder.mutate({ from: i, to: i + 1 })} aria-label="Move down">↓</button>
                  </>
                )}
                <button className="btn btn-gold min-h-9 px-4" onClick={() => setEditing(d)}>Edit</button>
                <button className="btn btn-ghost min-h-9 px-4 text-accent" disabled={remove.isPending} onClick={() => {
                    // Events can have registrations attached; undo can't re-attach them, so those still ask first.
                    if (id !== 'events' || confirm('Delete this event? Its registrations will lose their link, and Undo cannot restore that.')) remove.mutate(d);
                  }}>Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SettingsPage({ which }: { which: 'payment' | 'site' | 'journey' }) {
  const qc = useQueryClient();
  const path = `/admin/settings/${which}`;
  const q = useQuery({ queryKey: ['admin', 'settings', which], queryFn: () => api<Doc>(path) });
  const save = useMutation({
    mutationFn: (d: Doc) => api<Doc>(path, { method: 'PUT', body: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings', which] });
      // Public pages cache these; make the change visible without a hard refresh.
      qc.invalidateQueries({ queryKey: [which === 'journey' ? 'journey' : which === 'payment' ? 'payment' : 'site'] });
    },
  });
  if (q.isLoading) return <p className="text-muted">Loading…</p>;
  if (q.error || !q.data) return <p role="alert" className="text-accent">{q.error?.message ?? 'Failed to load'}</p>;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-extrabold">{which === 'payment' ? 'Payment options' : which === 'journey' ? 'Our journey page' : 'Site settings'}</h2>
      <DocForm fields={which === 'payment' ? PAYMENT_FIELDS : which === 'journey' ? JOURNEY_FIELDS : SITE_FIELDS} initial={q.data} saving={save.isPending} error={save.error?.message} onSave={(d) => save.mutate(d)} saveLabel="Save changes" />
      {save.isSuccess && <p role="status" className="font-semibold text-green-700 dark:text-green-400">Saved ✓</p>}
    </div>
  );
}
