import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

/** Every admin can change their own password; doing so signs out every other device. */
export function AccountPage() {
  const [form, setForm] = useState({ current: '', next: '', again: '' });
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationFn: () => api('/auth/password', { method: 'POST', body: { current: form.current, next: form.next } }),
    onSuccess: () => setForm({ current: '', next: '', again: '' }),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const same = form.next === form.again;
    setMismatch(!same);
    if (same) change.mutate();
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="font-display text-2xl font-extrabold">My account</h2>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <h3 className="font-semibold">Change my password</h3>
        <label className="block"><span className="text-sm font-semibold">Current password</span>
          <input className="input mt-1" type="password" required autoComplete="current-password" value={form.current} onChange={set('current')} /></label>
        <label className="block"><span className="text-sm font-semibold">New password</span>
          <input className="input mt-1" type="password" required minLength={12} autoComplete="new-password" value={form.next} onChange={set('next')} />
          <span className="text-xs text-muted">At least 12 characters. A few random words works well. Not an easy word with a number on the end.</span></label>
        <label className="block"><span className="text-sm font-semibold">New password again</span>
          <input className="input mt-1" type="password" required autoComplete="new-password" value={form.again} onChange={set('again')} /></label>
        {mismatch && <p role="alert" className="rounded-lg bg-kred/10 p-3 text-accent">The two new passwords are not the same.</p>}
        {change.error && <p role="alert" className="rounded-lg bg-kred/10 p-3 text-accent">{change.error.message.replace(/^next:\s*/, '')}</p>}
        {change.isSuccess && <p role="status" className="font-semibold text-green-700 dark:text-green-400">Password changed ✓ Every other device has been signed out.</p>}
        <button className="btn btn-primary" disabled={change.isPending}>{change.isPending ? 'Saving…' : 'Change password'}</button>
      </form>
    </div>
  );
}
