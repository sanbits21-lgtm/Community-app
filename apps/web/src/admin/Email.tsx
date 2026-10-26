import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

interface Status {
  configured: boolean;
  host: string;
  from: string;
  fromLooksDefault: boolean;
}

/** Shows whether the site can send email (registration and payment confirmations) and lets the owner send a test. */
export function EmailPage() {
  const status = useQuery({ queryKey: ['admin', 'email'], queryFn: () => api<Status>('/admin/email/status') });
  const [to, setTo] = useState('');
  const test = useMutation({ mutationFn: () => api<{ ok: true }>('/admin/email/test', { method: 'POST', body: { to } }) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    test.mutate();
  };
  const s = status.data;
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="font-display text-2xl font-extrabold">Email</h2>
      <div className="card space-y-2 p-5">
        <h3 className="font-semibold">Status</h3>
        {status.isLoading && <p className="text-muted">Checking…</p>}
        {s && (
          <>
            <p className={s.configured ? 'font-semibold text-green-700 dark:text-green-400' : 'font-semibold text-accent'}>
              {s.configured ? 'Email is switched on ✓' : 'Email is OFF: nothing is sent yet'}
            </p>
            {s.configured && <p className="text-sm">Mail server: <code>{s.host || 'custom'}</code><br />Sent from: <code>{s.from}</code></p>}
            {s.configured && s.fromLooksDefault && (
              <p role="alert" className="rounded-lg bg-kred/10 p-3 text-sm text-accent">
                The "from" address is still the placeholder. Set <code>MAIL_FROM</code> to an address on your own domain, or mail providers may reject or spam-filter your emails.
              </p>
            )}
          </>
        )}
        {s && !s.configured && (
          <div className="text-sm text-muted">
            <p>To switch it on, add these settings where the app runs (the <code>.env</code> file on a server, or Environment on Render), then restart:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-soft p-3 text-ink">{'SMTP_URL=smtp://LOGIN:SMTP_KEY@smtp-relay.brevo.com:587\nMAIL_FROM=Kannada Sangha <hello@yourdomain>'}</pre>
            <p className="mt-2">Ask your email provider (for example Brevo) to verify your domain (SPF and DKIM) so the emails do not go to spam.</p>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="card space-y-3 p-5">
        <h3 className="font-semibold">Send a test email</h3>
        <label className="block"><span className="text-sm font-semibold">Send to</span>
          <input className="input mt-1" type="email" required autoComplete="email" placeholder="you@example.com" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <p className="text-xs text-muted">Only the owner can send a test. Check the spam folder too.</p>
        {test.error && <p role="alert" className="rounded-lg bg-kred/10 p-3 text-accent">{test.error.message}</p>}
        {test.isSuccess && <p role="status" className="font-semibold text-green-700 dark:text-green-400">Sent ✓ Check that inbox now.</p>}
        <button className="btn btn-primary" disabled={test.isPending}>{test.isPending ? 'Sending…' : 'Send test email'}</button>
      </form>
    </div>
  );
}
