import { isoToZonedLocal, PALETTE_IDS, zonedLocalToIso, type PaletteId } from '@sangha/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, uploadImages } from '../lib/api';
import { applyPalette, DEFAULT_PALETTE, PALETTES } from '../lib/palettes';

export type FieldType = 'text' | 'textarea' | 'bi' | 'bitext' | 'image' | 'images' | 'datetime' | 'number' | 'bool' | 'tickets' | 'eventref' | 'stats' | 'palette' | 'chapters' | 'names' | 'links' | 'select' | 'eventrefs';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  /** For type 'select': [stored value, label] pairs. */
  options?: Array<[string, string]>;
}

// biome-ignore lint/suspicious/noExplicitAny: admin documents are schema-less JSON from the API
export type Doc = Record<string, any>;

const label = 'block text-sm font-semibold';
const help = 'mt-0.5 text-xs text-muted';

function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="mt-1 flex items-center gap-3">
      {value ? <img src={value} alt="" className="size-20 rounded-lg border border-line object-cover" /> : <div className="flex size-20 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">No image</div>}
      <div className="space-y-1">
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            setErr('');
            try {
              const [url] = await uploadImages([f], true);
              if (url) onChange(url);
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Upload failed');
            } finally {
              setBusy(false);
            }
          }}
        />
        <button type="button" className="btn btn-gold min-h-9 px-3 text-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}</button>
        {value && <button type="button" className="ml-2 text-sm text-accent underline" onClick={() => onChange('')}>Remove</button>}
        {err && <p role="alert" className="text-xs text-accent">{err}</p>}
      </div>
    </div>
  );
}

function MultiImages({ value, onChange }: { value: Array<{ url: string; caption: string }>; onChange: (v: Array<{ url: string; caption: string }>) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="mt-1 space-y-3">
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          setBusy(true);
          setErr('');
          try {
            const urls = await uploadImages(files, true);
            onChange([...value, ...urls.map((url) => ({ url, caption: '' }))]);
          } catch (x) {
            setErr(x instanceof Error ? x.message : 'Upload failed');
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" className="btn btn-gold min-h-9 px-3 text-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Uploading…' : 'Add photos'}</button>
      {err && <p role="alert" className="text-xs text-accent">{err}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {value.map((im, i) => (
          <li key={im.url} className="space-y-1 rounded-lg border border-line p-2">
            <img src={im.url} alt="" className="aspect-square w-full rounded object-cover" />
            <input className="input min-h-9 text-sm" placeholder="Caption" value={im.caption} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
            <button type="button" className="text-xs text-accent underline" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Colour-theme picker. Choosing one previews it on this very page; nothing is published until Save. */
function PaletteField({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const current = ((PALETTE_IDS as readonly string[]).includes(String(value)) ? value : DEFAULT_PALETTE) as PaletteId;
  useEffect(() => {
    // Leaving the screen without saving puts back the theme the site actually uses.
    return () => {
      const saved = localStorage.getItem('palette');
      applyPalette((PALETTE_IDS as readonly string[]).includes(String(saved)) ? (saved as PaletteId) : DEFAULT_PALETTE, false);
    };
  }, []);
  return (
    <div>
      <span className={label}>{field.label}</span>
      <div role="radiogroup" aria-label={field.label} className="mt-2 grid gap-3 sm:grid-cols-2">
        {PALETTE_IDS.map((id) => {
          const p = PALETTES[id];
          const on = current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                applyPalette(id, false);
                onChange(id);
              }}
              className={`rounded-xl border-2 p-3 text-left ${on ? 'border-kred ring-2 ring-kred/30' : 'border-line'}`}
            >
              <span className="flex gap-1.5" aria-hidden="true">
                {p.swatches.map((c) => (
                  <span key={c} style={{ background: c }} className="size-7 rounded-full border border-black/20" />
                ))}
              </span>
              <span className="mt-2 block font-semibold">
                {p.name}
                {id === DEFAULT_PALETTE && <span className="ml-2 text-xs font-normal text-muted">recommended</span>}
              </span>
              <span className="block text-xs text-muted">{p.note}</span>
            </button>
          );
        })}
      </div>
      {field.help && <p className={help}>{field.help}</p>}
    </div>
  );
}

export function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const events = useQuery({ queryKey: ['admin', 'events'], queryFn: () => api<Doc[]>('/admin/events'), enabled: field.type === 'eventref' || field.type === 'eventrefs' });
  const id = `f-${field.key}`;

  switch (field.type) {
    case 'bi':
    case 'bitext': {
      const v = (value ?? { en: '', kn: '' }) as { en: string; kn: string };
      const Tag = field.type === 'bitext' ? 'textarea' : 'input';
      const rows = field.type === 'bitext' ? 5 : undefined;
      return (
        <div>
          <span className={label}>{field.label}</span>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-en`} className="text-xs text-muted">English</label>
              <Tag id={`${id}-en`} rows={rows} className="input" value={v.en} onChange={(e) => onChange({ ...v, en: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`${id}-kn`} className="text-xs text-muted">ಕನ್ನಡ</label>
              <Tag id={`${id}-kn`} rows={rows} lang="kn" className="input" value={v.kn} onChange={(e) => onChange({ ...v, kn: e.target.value })} />
            </div>
          </div>
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    }
    case 'image':
      return (
        <div>
          <span className={label}>{field.label}</span>
          <ImageUploader value={String(value ?? '')} onChange={onChange} />
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    case 'images':
      return (
        <div>
          <span className={label}>{field.label}</span>
          <MultiImages value={(value ?? []) as Array<{ url: string; caption: string }>} onChange={onChange} />
        </div>
      );
    case 'bool':
      return (
        <label className="flex items-center gap-3 py-1">
          <input type="checkbox" className="size-5 accent-kred" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span className="font-semibold">{field.label}</span>
          {field.help && <span className="text-xs text-muted">{field.help}</span>}
        </label>
      );
    case 'datetime':
      return (
        <div>
          <label htmlFor={id} className={label}>{field.label} <span className="font-normal text-muted">(Luxembourg time)</span></label>
          {/* Read and written as Luxembourg time, so the admin's own computer clock or time zone can never shift an event. */}
          <input id={id} type="datetime-local" className="input mt-1" value={isoToZonedLocal(String(value ?? ''))} onChange={(e) => onChange(e.target.value ? zonedLocalToIso(e.target.value) : '')} />
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    case 'number':
      return (
        <div>
          <label htmlFor={id} className={label}>{field.label}</label>
          <input id={id} type="number" className="input mt-1" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    case 'textarea':
      return (
        <div>
          <label htmlFor={id} className={label}>{field.label}</label>
          <textarea id={id} rows={4} className="input mt-1" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    case 'tickets': {
      const rows = (value ?? []) as Array<{ name: string; price: number | '' }>;
      return (
        <div>
          <span className={label}>{field.label}</span>
          <div className="mt-1 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder="Name (e.g. Adult)" aria-label="Ticket name" value={r.name} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input w-32" type="number" min={0} step="0.01" placeholder="€ price" aria-label="Ticket price" value={r.price} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, price: e.target.value === '' ? '' : Number(e.target.value) } : x)))} />
                <button type="button" className="px-2 text-accent" aria-label="Remove ticket" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => onChange([...rows, { name: '', price: 0 }])}>+ Add ticket type</button>
          </div>
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    }
    case 'stats': {
      const rows = (value ?? []) as Array<{ value: string; label: { en: string; kn: string } }>;
      return (
        <div>
          <span className={label}>{field.label}</span>
          <div className="mt-1 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[6rem_1fr_1fr_auto] gap-2">
                <input className="input" placeholder="120+" aria-label="Number" maxLength={20} value={r.value} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <input className="input" placeholder="Label (English)" aria-label="Label in English" value={r.label.en} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: { ...x.label, en: e.target.value } } : x)))} />
                <input className="input" lang="kn" placeholder="ಲೇಬಲ್ (ಕನ್ನಡ)" aria-label="Label in Kannada" value={r.label.kn} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: { ...x.label, kn: e.target.value } } : x)))} />
                <button type="button" className="px-2 text-accent" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {rows.length < 4 && (
              <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => onChange([...rows, { value: '', label: { en: '', kn: '' } }])}>+ Add a number</button>
            )}
          </div>
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    }
    case 'chapters': {
      type Chapter = { label: string; heading: { en: string; kn: string }; body: { en: string; kn: string }; image: string };
      const rows = (value ?? []) as Chapter[];
      const set = (i: number, patch: Partial<Chapter>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
      const move = (i: number, d: -1 | 1) => {
        const next = [...rows];
        const [item] = next.splice(i, 1);
        next.splice(i + d, 0, item!);
        onChange(next);
      };
      return (
        <div>
          <span className={label}>{field.label}</span>
          <div className="mt-1 space-y-3">
            {rows.map((r, i) => (
              <fieldset key={i} className="space-y-2 rounded-xl border border-line p-3">
                <legend className="px-1 text-sm font-semibold">Chapter {i + 1}</legend>
                <input className="input" placeholder="Date or period, e.g. 22 Feb 2022" aria-label="Date tag" maxLength={60} value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
                <input className="input" placeholder="Heading (English)" aria-label="Heading in English" value={r.heading.en} onChange={(e) => set(i, { heading: { ...r.heading, en: e.target.value } })} />
                <input className="input" lang="kn" placeholder="ಶೀರ್ಷಿಕೆ (ಕನ್ನಡ)" aria-label="Heading in Kannada" value={r.heading.kn} onChange={(e) => set(i, { heading: { ...r.heading, kn: e.target.value } })} />
                <textarea className="input min-h-28" placeholder="Text (English). A blank line starts a new paragraph." aria-label="Text in English" value={r.body.en} onChange={(e) => set(i, { body: { ...r.body, en: e.target.value } })} />
                <textarea className="input min-h-28" lang="kn" placeholder="ಪಠ್ಯ (ಕನ್ನಡ)" aria-label="Text in Kannada" value={r.body.kn} onChange={(e) => set(i, { body: { ...r.body, kn: e.target.value } })} />
                <ImageUploader value={r.image} onChange={(url) => set(i, { image: url })} />
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" disabled={i === 0} onClick={() => move(i, -1)}>↑ Up</button>
                  <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓ Down</button>
                  <button type="button" className="ml-auto text-sm text-accent underline" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove chapter</button>
                </div>
              </fieldset>
            ))}
            {rows.length < 40 && (
              <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => onChange([...rows, { label: '', heading: { en: '', kn: '' }, body: { en: '', kn: '' }, image: '' }])}>+ Add a chapter</button>
            )}
          </div>
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    }
    case 'links': {
      const rows = (value ?? []) as Array<{ label: { en: string; kn: string }; url: string }>;
      const set = (i: number, patch: Partial<(typeof rows)[number]>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
      return (
        <div>
          <span className={label}>{field.label}</span>
          <div className="mt-1 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                <input className="input" placeholder="Name (English)" aria-label="Name in English" value={r.label.en} onChange={(e) => set(i, { label: { ...r.label, en: e.target.value } })} />
                <input className="input" lang="kn" placeholder="ಹೆಸರು (ಕನ್ನಡ)" aria-label="Name in Kannada" value={r.label.kn} onChange={(e) => set(i, { label: { ...r.label, kn: e.target.value } })} />
                <input className="input" type="url" placeholder="https://…" aria-label="Link" value={r.url} onChange={(e) => set(i, { url: e.target.value })} />
                <button type="button" className="px-2 text-accent" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {rows.length < 12 && <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => onChange([...rows, { label: { en: '', kn: '' }, url: '' }])}>+ Add a link</button>}
          </div>
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    }
    case 'eventrefs': {
      const chosen = new Set(((value ?? []) as unknown[]).map(String));
      return (
        <fieldset>
          <legend className={label}>{field.label}</legend>
          <div className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
            {events.data?.length ? events.data.map((e) => (
              <label key={e._id} className="flex min-h-9 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={chosen.has(e._id)}
                  onChange={(ev) => onChange(ev.target.checked ? [...chosen, e._id] : [...chosen].filter((x) => x !== e._id))}
                />
                <span>{e.title?.en || e.title?.kn}</span>
              </label>
            )) : <p className="text-sm text-muted">No events yet.</p>}
          </div>
          {field.help && <p className={help}>{field.help}</p>}
        </fieldset>
      );
    }
    case 'select':
      return (
        <div>
          <label htmlFor={id} className={label}>{field.label}</label>
          <select id={id} className="input mt-1" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            {field.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    case 'names': {
      const rows = (value ?? []) as Array<{ name: string }>;
      return (
        <div>
          <span className={label}>{field.label}</span>
          <div className="mt-1 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <span className="w-6 pt-2 text-right text-sm text-muted" aria-hidden="true">{i + 1}.</span>
                <input className="input" aria-label={`Name ${i + 1}`} maxLength={100} value={r.name} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { name: e.target.value } : x)))} />
                <button type="button" className="px-2 text-accent" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => onChange([...rows, { name: '' }])}>+ Add a name</button>
          </div>
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
    }
    case 'palette':
      return <PaletteField field={field} value={value} onChange={onChange} />;
    case 'eventref':
      return (
        <div>
          <label htmlFor={id} className={label}>{field.label}</label>
          <select id={id} className="input mt-1" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            <option value="">— none —</option>
            {events.data?.map((e) => <option key={e._id} value={e._id}>{e.title?.en || e.title?.kn}</option>)}
          </select>
        </div>
      );
    default:
      return (
        <div>
          <label htmlFor={id} className={label}>{field.label}</label>
          <input id={id} className="input mt-1" placeholder={field.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
          {field.help && <p className={help}>{field.help}</p>}
        </div>
      );
  }
}
