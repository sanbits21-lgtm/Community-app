import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PAYMENT_STATUSES, type PaymentStatus } from '@sangha/shared';
import { api } from '../lib/api';
import { eur } from '../lib/format';
import type { Doc } from './fields';

const BADGE: Record<PaymentStatus, string> = {
  pending: 'bg-amber-200 text-amber-900',
  verified: 'bg-green-200 text-green-900',
  rejected: 'bg-red-200 text-red-900',
};

/** Registrations and contributions share one table: both are "someone says they paid, check the bank". */
export function PaymentsPage({ kind }: { kind: 'registrations' | 'contributions' }) {
  const qc = useQueryClient();
  const [event, setEvent] = useState('');
  const [status, setStatus] = useState('');
  const events = useQuery({ queryKey: ['admin', 'events'], queryFn: () => api<Doc[]>('/admin/events'), enabled: kind === 'registrations' });
  const qs = new URLSearchParams({ ...(event ? { event } : {}), ...(status ? { status } : {}) }).toString();
  const key = ['admin', kind, qs];
  const list = useQuery({ queryKey: key, queryFn: () => api<Doc[]>(`/admin/${kind}${qs ? `?${qs}` : ''}`) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', kind] });
    qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };
  const setStatusM = useMutation({ mutationFn: ({ id, s }: { id: string; s: PaymentStatus }) => api(`/admin/${kind}/${id}`, { method: 'PATCH', body: { status: s } }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/${kind}/${id}`, { method: 'DELETE' }), onSuccess: refresh });

  const rows = list.data ?? [];
  const total = rows.filter((r) => r.status === 'verified').reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">{kind === 'registrations' ? 'Registrations' : 'Contributions'}</h2>
        {kind === 'registrations' && <a className="btn btn-gold" href={`/api/admin/registrations/export${event ? `?event=${event}` : ''}`}>Download CSV</a>}
      </div>

      <div className="flex flex-wrap gap-3">
        {kind === 'registrations' && (
          <select className="input w-auto" aria-label="Filter by event" value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">All events</option>
            {events.data?.map((e) => <option key={e._id} value={e._id}>{e.title?.en || e.title?.kn}</option>)}
          </select>
        )}
        <select className="input w-auto" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="self-center text-sm text-muted">{rows.length} shown · verified total {eur(total)}</p>
      </div>

      {list.isLoading && <p className="text-muted">Loading…</p>}
      {list.error && <p role="alert" className="text-accent">{list.error.message}</p>}
      {(setStatusM.error || del.error) && <p role="alert" className="text-accent">{(setStatusM.error ?? del.error)?.message}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Contact</th>
              {kind === 'registrations' && <th className="p-3">Event</th>}
              <th className="p-3">{kind === 'registrations' ? 'People' : 'Message'}</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Bank ref / proof</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-b border-line align-top last:border-0">
                <td className="p-3 font-mono">{r.code}</td>
                <td className="p-3 font-semibold">{r.name}</td>
                <td className="p-3">{r.phone}<br /><span className="text-muted">{r.email}</span></td>
                {kind === 'registrations' && <td className="p-3">{r.event?.title?.en}<br /><span className="text-muted">{r.ticketName}</span></td>}
                <td className="max-w-48 p-3">{kind === 'registrations' ? r.attendees : r.message}</td>
                <td className="p-3">{eur(r.amount ?? 0)}</td>
                <td className="p-3 font-mono">
                  {r.utr || '—'}
                  {r.screenshot && <><br /><a className="font-sans text-accent underline" href={r.screenshot} target="_blank" rel="noopener noreferrer">Screenshot</a></>}
                </td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[r.status as PaymentStatus]}`}>{r.status}</span></td>
                <td className="p-3"><div className="flex flex-col items-start gap-1">
                  {r.status !== 'verified' && <button className="btn btn-gold min-h-8 px-3 text-xs" disabled={setStatusM.isPending} onClick={() => setStatusM.mutate({ id: r._id, s: 'verified' })}>Verify</button>}
                  {r.status !== 'rejected' && <button className="btn btn-ghost min-h-8 px-3 text-xs" disabled={setStatusM.isPending} onClick={() => setStatusM.mutate({ id: r._id, s: 'rejected' })}>Reject</button>}
                  <button className="min-h-8 px-2 text-xs text-accent underline" onClick={() => { if (confirm('Delete this record?')) del.mutate(r._id); }}>Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && rows.length === 0 && <p className="p-6 text-center text-muted">Nothing here yet.</p>}
      </div>
    </div>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<Doc[]>('/admin/users') });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const add = useMutation({
    mutationFn: () => api('/admin/users', { method: 'POST', body: form }),
    onSuccess: () => { setForm({ name: '', email: '', password: '', role: 'admin' }); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }) });
  const submit = (e: FormEvent) => { e.preventDefault(); add.mutate(); };

  if (list.error) return <p role="alert" className="text-accent">{list.error.message}</p>;
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-extrabold">Admin users</h2>
      <ul className="space-y-2">
        {list.data?.map((u) => (
          <li key={u._id} className="card flex items-center justify-between gap-3 p-3">
            <span><strong>{u.name}</strong> · {u.email} · <em>{u.role}</em></span>
            <button className="text-sm text-accent underline" onClick={() => { if (confirm(`Remove ${u.email}?`)) del.mutate(u._id); }}>Remove</button>
          </li>
        ))}
      </ul>
      {del.error && <p role="alert" className="text-accent">{del.error.message}</p>}
      <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2">
        <h3 className="font-semibold sm:col-span-2">Add an admin</h3>
        <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" />
        <input className="input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" />
        <input className="input" type="password" placeholder="Password (12+ characters)" required minLength={12} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-label="Password" />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="Role"><option value="admin">Admin</option><option value="owner">Owner</option></select>
        {add.error && <p role="alert" className="text-accent sm:col-span-2">{add.error.message}</p>}
        <button className="btn btn-primary sm:col-span-2" disabled={add.isPending}>Add admin</button>
      </form>
    </div>
  );
}
