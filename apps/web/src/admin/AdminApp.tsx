import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Silk, useSite } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { eur } from '../lib/format';
import { ThemeToggle } from '../lib/theme';
import { AccountPage } from './Account';
import { EmailPage } from './Email';
import { PaymentsPage, UsersPage } from './Payments';
import { ResourcePage, SettingsPage } from './Resource';

interface Me {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin';
}
interface Stats {
  pendingRegs: number;
  pendingContribs: number;
  registrations: number;
  upcoming: number;
  blogs: number;
  albums: number;
  verifiedTotal: number;
  setup: Record<'banners' | 'board' | 'events' | 'payment' | 'site' | 'social', boolean>;
}

function Login() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: () => api<Me>('/auth/login', { method: 'POST', body: { email, password } }),
    onSuccess: (me) => qc.setQueryData(['me'], me),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); login.mutate(); };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-soft px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-3xl font-extrabold text-ink">Admin sign in</h1>
        <label className="block"><span className="font-semibold">Email</span><input className="input mt-1" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="font-semibold">Password</span><input className="input mt-1" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {login.error && <p role="alert" className="text-accent">{login.error.message}</p>}
        <button className="btn btn-primary w-full" disabled={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'}</button>
        <Link to="/" className="block text-center text-sm underline">← Back to site</Link>
      </form>
    </div>
  );
}

/** Only appears on a demo site: puts the sample content back after a customer has played with it. */
function DemoReset() {
  const { data: site } = useSite();
  const qc = useQueryClient();
  const reset = useMutation({
    mutationFn: () => api('/admin/demo/reset', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  });
  if (!site?.demo) return null;
  return (
    <section className="card flex flex-wrap items-center justify-between gap-3 border-saffron p-4" aria-label="Demo site">
      <p className="text-sm"><strong>Demo site.</strong> Visitors can change things. This puts the sample content back (and removes any registrations made while testing).</p>
      <button className="btn btn-ghost min-h-10 px-4 text-sm" disabled={reset.isPending} onClick={() => { if (confirm('Reset the demo? All changes and test registrations will be erased.')) reset.mutate(); }}>
        {reset.isPending ? 'Resetting…' : reset.isSuccess ? 'Reset ✓' : 'Reset demo data'}
      </button>
    </section>
  );
}

function Dashboard() {
  const { data } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<Stats>('/admin/stats') });
  if (!data) return <p className="text-muted">Loading…</p>;
  const tiles: Array<[string, string | number, string?]> = [
    ['Payments to verify', data.pendingRegs + data.pendingContribs, data.pendingRegs + data.pendingContribs > 0 ? '/admin/registrations' : undefined],
    ['Registrations', data.registrations, '/admin/registrations'],
    ['Upcoming events', data.upcoming, '/admin/events'],
    ['Verified collected', eur(data.verifiedTotal)],
    ['Blog posts', data.blogs, '/admin/blogs'],
    ['Albums', data.albums, '/admin/albums'],
  ];
  const steps: Array<[keyof Stats['setup'], string, string]> = [
    ['payment', 'Add your IBAN so payments work', '/admin/payment'],
    ['site', 'Fill in your name and contact details', '/admin/site'],
    ['banners', 'Add a home-page banner', '/admin/banners'],
    ['board', 'Add your board members', '/admin/board'],
    ['events', 'Create your first event', '/admin/events'],
    ['social', 'Link your social pages', '/admin/site'],
  ];
  const doneCount = steps.filter(([k]) => data.setup[k]).length;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-extrabold">Dashboard</h2>
      <DemoReset />
      {doneCount < steps.length && (
        <section className="card p-5" aria-labelledby="setup-h">
          <div className="flex items-center justify-between gap-3">
            <h3 id="setup-h" className="font-semibold">Get started · {doneCount} of {steps.length} done</h3>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full bg-kred" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          </div>
          <ul className="mt-3 space-y-1">
            {steps.map(([k, text, to]) => (
              <li key={k} className="flex items-center gap-3">
                <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${data.setup[k] ? 'bg-kred text-white' : 'border-2 border-line'}`}>{data.setup[k] ? '✓' : ''}</span>
                {data.setup[k] ? <span className="text-muted line-through">{text}</span> : <Link to={to} className="font-semibold underline-offset-4 hover:underline">{text}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map(([label, value, to]) => {
          const inner = (<><p className="text-sm text-muted">{label}</p><p className="font-display text-3xl font-extrabold text-accent">{value}</p></>);
          return to ? <Link key={label} to={to} className="card p-4 hover:shadow-lg">{inner}</Link> : <div key={label} className="card p-4">{inner}</div>;
        })}
      </div>
    </div>
  );
}

const NAV: Array<[string, string, boolean?]> = [
  ['/admin', 'Dashboard'],
  ['/admin/banners', 'Banners'],
  ['/admin/notifications', 'Notifications'],
  ['/admin/board', 'Board members'],
  ['/admin/sponsors', 'Sponsors'],
  ['/admin/events', 'Events'],
  ['/admin/registrations', 'Registrations'],
  ['/admin/contributions', 'Contributions'],
  ['/admin/blogs', 'Blog'],
  ['/admin/albums', 'Gallery'],
  ['/admin/payment', 'Payment options'],
  ['/admin/journey', 'Our journey'],
  ['/admin/site', 'Site settings'],
  ['/admin/email', 'Email'],
  ['/admin/users', 'Admins', true],
  ['/admin/account', 'My account'],
];

export function AdminApp() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), retry: false, staleTime: 60_000 });
  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => { qc.setQueryData(['me'], null); qc.removeQueries({ queryKey: ['admin'] }); },
  });

  if (me.isLoading) return <p className="p-10 text-center text-muted">Loading…</p>;
  const unauth = me.error instanceof ApiError && me.error.status === 401;
  if (!me.data || unauth) return <Login />;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-paper text-ink">
        <Silk />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/admin" className="font-display text-xl font-extrabold">Sangha Admin</Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="underline">View site</Link>
            <ThemeToggle />
            <span className="hidden sm:inline">{me.data.name}</span>
            <button className="btn btn-ghost min-h-9 px-3" onClick={() => logout.mutate()}>Sign out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Admin" className="scroll-hide -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {NAV.filter(([, , ownerOnly]) => !ownerOnly || me.data.role === 'owner').map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `shrink-0 rounded-full px-4 py-2 font-semibold lg:rounded-xl ${isActive ? 'bg-kred text-white' : 'hover:bg-saffron/25'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0">
          <Routes>
            <Route index element={<Dashboard />} />
            {['banners', 'notifications', 'board', 'sponsors', 'events', 'blogs', 'albums'].map((id) => (
              <Route key={id} path={id} element={<ResourcePage key={id} id={id} />} />
            ))}
            <Route path="registrations" element={<PaymentsPage kind="registrations" />} />
            <Route path="contributions" element={<PaymentsPage kind="contributions" />} />
            <Route path="payment" element={<SettingsPage which="payment" />} />
            <Route path="site" element={<SettingsPage which="site" />} />
            <Route path="journey" element={<SettingsPage which="journey" />} />
            <Route path="email" element={<EmailPage />} />
            <Route path="account" element={<AccountPage />} />
            {me.data.role === 'owner' && <Route path="users" element={<UsersPage />} />}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
