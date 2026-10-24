// QA / security regression suite. Each test states the SECURE or CORRECT behaviour we want.
//
// Tests written as it.fails(...) are CONFIRMED, UNFIXED defects (see docs/QA-REPORT.md): the suite stays green while they
// exist. When you fix one, vitest reports "expected to fail but passed": change that it.fails to a plain it, and from then
// on it guards against the defect coming back.
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ensureOwner } from '../src/auth';
import { config } from '../src/config';
import { Admin, Event, Registration } from '../src/models';
import { resetEmailGuard } from '../src/emailGuard';
import { setTransport } from '../src/mailer';
import { syncBookedCounts } from '../src/seats';

let mongod: MongoMemoryServer;
const app = createApp();
const owner = request.agent(app);
const bi = (en: string) => ({ en, kn: '' });
const future = () => new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({ binary: { version: process.env.MONGOMS_VERSION ?? '8.2.6' } });
  await mongoose.connect(mongod.getUri('qa'));
  await ensureOwner();
  await owner.post('/api/auth/login').send({ email: config.adminEmail, password: config.adminPassword }).expect(200);
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function makeEvent(over: Record<string, unknown> = {}) {
  const r = await owner.post('/api/admin/events').send({ title: bi('QA event'), startsAt: future(), isPaid: false, tickets: [], ...over });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { _id: string; slug: string };
}

describe('AUTHENTICATION', () => {
  it('every admin route refuses anonymous callers', async () => {
    const routes: Array<[string, string]> = [];
    for (const r of ['banners', 'notifications', 'board', 'events', 'blogs', 'albums', 'registrations', 'contributions', 'users']) {
      routes.push(['get', `/api/admin/${r}`], ['post', `/api/admin/${r}`]);
    }
    routes.push(['get', '/api/admin/stats'], ['get', '/api/admin/settings/payment'], ['put', '/api/admin/settings/payment'], ['get', '/api/admin/settings/site'], ['get', '/api/admin/registrations/export'], ['post', '/api/admin/upload'], ['delete', '/api/admin/events/000000000000000000000000'], ['put', '/api/admin/events/000000000000000000000000'], ['patch', '/api/admin/registrations/000000000000000000000000']);
    for (const [m, p] of routes) {
      const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[m]!(p).send({});
      expect(res.status, `${m.toUpperCase()} ${p}`).toBe(401);
    }
  });

  it('rejects forged tokens: wrong secret, alg=none, garbage', async () => {
    const id = (await Admin.findOne())!.id;
    const forged = jwt.sign({ id, role: 'owner' }, 'not-the-secret');
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id, role: 'owner' })).toString('base64url')}.`;
    for (const t of [forged, none, 'garbage', '']) {
      const r = await request(app).get('/api/admin/stats').set('Cookie', `sangha_token=${t}`);
      expect(r.status, t.slice(0, 20)).toBe(401);
    }
  });

  it('a plain admin cannot manage admins or escalate to owner', async () => {
    await owner.post('/api/admin/users').send({ email: 'plain@qa.test', name: 'Plain', password: 'a-long-password-1', role: 'admin' }).expect(201);
    const plain = request.agent(app);
    await plain.post('/api/auth/login').send({ email: 'plain@qa.test', password: 'a-long-password-1' }).expect(200);
    await plain.get('/api/admin/users').expect(403);
    await plain.post('/api/admin/users').send({ email: 'evil@qa.test', name: 'E', password: 'a-long-password-1', role: 'owner' }).expect(403);
    const me = await plain.get('/api/auth/me').expect(200);
    await plain.delete(`/api/admin/users/${(await Admin.findOne({ email: 'plain@qa.test' }))!.id}`).expect(403);
    expect(me.body.role).toBe('admin');
  });

  it('a deleted admin loses access immediately (token must not outlive the account)', async () => {
    await owner.post('/api/admin/users').send({ email: 'leaver@qa.test', name: 'Leaver', password: 'a-long-password-1', role: 'admin' }).expect(201);
    const leaver = request.agent(app);
    await leaver.post('/api/auth/login').send({ email: 'leaver@qa.test', password: 'a-long-password-1' }).expect(200);
    await leaver.get('/api/admin/stats').expect(200);
    await owner.delete(`/api/admin/users/${(await Admin.findOne({ email: 'leaver@qa.test' }))!.id}`).expect(200);
    const after = await leaver.get('/api/admin/stats');
    expect(after.status).toBe(401);
  });

  it('a demoted owner loses owner powers immediately', async () => {
    await owner.post('/api/admin/users').send({ email: 'ex-owner@qa.test', name: 'Ex', password: 'a-long-password-1', role: 'owner' }).expect(201);
    const ex = request.agent(app);
    await ex.post('/api/auth/login').send({ email: 'ex-owner@qa.test', password: 'a-long-password-1' }).expect(200);
    await Admin.updateOne({ email: 'ex-owner@qa.test' }, { role: 'admin' });
    const r = await ex.get('/api/admin/users');
    expect(r.status).toBe(403);
  });

  it('signing out ends only that session; changing the password ends all the others', async () => {
    await owner.post('/api/admin/users').send({ email: 'devices@qa.test', name: 'Devices', password: 'a-long-password-1', role: 'admin' }).expect(201);
    // Work with raw cookies, the way a thief who copied one would.
    const cookieFrom = (r: request.Response) => String((r.headers['set-cookie'] as unknown as string[])[0]).split(';')[0]!;
    const login = async (password = 'a-long-password-1') => cookieFrom(await request(app).post('/api/auth/login').send({ email: 'devices@qa.test', password }).expect(200));
    const stats = (cookie: string) => request(app).get('/api/admin/stats').set('Cookie', cookie);

    const phone = await login();
    const laptop = await login();
    await stats(phone).expect(200);
    await request(app).post('/api/auth/logout').set('Cookie', phone).expect(200);
    await stats(phone).expect(401); // a copied cookie is dead after sign-out
    await stats(laptop).expect(200); // the other device is untouched

    const change = (cookie: string, body: object) => request(app).post('/api/auth/password').set('Cookie', cookie).send(body);
    await change(laptop, { current: 'wrong-current-password', next: 'a-brand-new-passphrase-9' }).expect(400);
    await change(laptop, { current: 'a-long-password-1', next: 'short' }).expect(400);
    const other = await login();
    const changed = await change(laptop, { current: 'a-long-password-1', next: 'a-brand-new-passphrase-9' }).expect(200);
    await stats(cookieFrom(changed)).expect(200); // the device that changed it gets a fresh token and stays in
    await stats(laptop).expect(401); // its old token and every other device are signed out
    await stats(other).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'devices@qa.test', password: 'a-long-password-1' }).expect(401);
    await login('a-brand-new-passphrase-9');
  });

  it('a signed token in the old format (no session id) is refused', async () => {
    const id = (await Admin.findOne())!.id;
    const old = jwt.sign({ id, role: 'owner' }, config.jwtSecret);
    await request(app).get('/api/admin/stats').set('Cookie', `sangha_token=${old}`).expect(401);
  });

  it('login does not reveal which emails exist (response time)', async () => {
    const time = async (email: string) => {
      const t: number[] = [];
      for (let i = 0; i < 6; i++) {
        const s = performance.now();
        await request(app).post('/api/auth/login').set('X-Forwarded-For', `10.9.${i}.${Math.floor(Math.random() * 200)}`).send({ email, password: 'wrong-password' });
        t.push(performance.now() - s);
      }
      return t.sort((a, b) => a - b)[3]!;
    };
    const real = await time(config.adminEmail);
    const fake = await time('nobody-here@qa.test');
    console.log(`[timing] existing account ${real.toFixed(0)}ms vs unknown ${fake.toFixed(0)}ms`);
    expect(Math.max(real, fake) / Math.max(1, Math.min(real, fake))).toBeLessThan(2);
  });

  it('NoSQL operators in the login body are refused, not evaluated', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(r.status).toBe(400);
  });
});

describe('INPUT HANDLING', () => {
  it('malformed JSON is a 400, not a server error', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": bad');
    expect(r.status).toBe(400);
  });

  it('an oversized body is a 413, not a server error', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(2_000_000) }));
    expect(r.status).toBe(413);
  });

  it('registration rejects nonsense numbers and oversize text', async () => {
    const ev = await makeEvent();
    const base = { name: 'Valid Name', phone: '+352 621 123 456' };
    for (const bad of [{ attendees: 0 }, { attendees: -3 }, { attendees: 21 }, { attendees: 1.5 }, { attendees: 'abc' }, { name: 'x' }, { name: 'x'.repeat(101) }, { phone: 'abc' }, { email: 'not-an-email' }, { email: 'a@b.co,c@d.co' }]) {
      const r = await request(app).post(`/api/events/${ev.slug}/register`).send({ ...base, ...bad });
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('the price is always computed by the server; a client-supplied amount or status is ignored', async () => {
    const ev = await makeEvent({ isPaid: true, tickets: [{ name: 'Adult', price: 20 }] });
    const r = await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Cheat Person', phone: '+352 621 123 456', attendees: 2, amount: 0.01, status: 'verified' }).expect(201);
    expect(r.body.amount).toBe(40);
    expect(r.body.status).toBe('pending');
  });

  it('a ticket index outside the list is refused rather than silently priced as ticket 0', async () => {
    const ev = await makeEvent({ isPaid: true, tickets: [{ name: 'Adult', price: 20 }, { name: 'Child', price: 10 }] });
    const r = await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Index Tester', phone: '+352 621 123 456', ticketIndex: 7 });
    expect(r.status).toBe(400);
  });

  it('a paid event must have a priced ticket, and old data without one cannot take EUR 0 "pending" registrations', async () => {
    const bad = await owner.post('/api/admin/events').send({ title: bi('No tickets'), startsAt: future(), isPaid: true, tickets: [] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/ticket/i);
    const free = await owner.post('/api/admin/events').send({ title: bi('All free tickets'), startsAt: future(), isPaid: true, tickets: [{ name: 'Free', price: 0 }] });
    expect(free.status).toBe(400);
    // Data saved before the rule existed: register must still refuse rather than create a EUR 0 pending payment.
    const legacy = await Event.create({ title: bi('Legacy paid'), startsAt: new Date(Date.now() + 5 * 86_400_000), isPaid: true, tickets: [] });
    const r = await request(app).post(`/api/events/${legacy.slug}/register`).send({ name: 'Zero Tester', phone: '+352 621 123 456' });
    expect(r.status).toBe(409);
  });

  it('an event cannot end before it starts', async () => {
    const r = await owner.post('/api/admin/events').send({ title: bi('Backwards'), startsAt: future(), endsAt: new Date(Date.now() - 86_400_000).toISOString() });
    expect(r.status).toBe(400);
  });

  it('links in site settings must be http(s): a javascript: link would run on every visitor\'s click', async () => {
    const cur = (await owner.get('/api/admin/settings/site')).body;
    const r = await owner.put('/api/admin/settings/site').send({ ...cur, facebook: 'javascript:alert(document.domain)' });
    expect(r.status).toBe(400);
  });

  it('unpublished events cannot be registered for or viewed', async () => {
    const ev = await makeEvent({ published: false });
    await request(app).get(`/api/events/${ev.slug}`).expect(404);
    await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Ghost Event', phone: '+352 621 123 456' }).expect(404);
  });

  it('bad ids and unknown routes fail cleanly', async () => {
    await request(app).get('/api/gallery/not-an-id').expect(400);
    await request(app).get('/api/events/does-not-exist').expect(404);
    await request(app).get('/api/nope').expect(404);
    expect((await request(app).get('/api/events?when[$ne]=x')).status).toBe(200);
  });
});

describe('BUSINESS LOGIC', () => {
  it('never sells more seats than capacity, even when everyone clicks at once', async () => {
    const ev = await makeEvent({ capacity: 1 });
    const results = await Promise.all(Array.from({ length: 15 }, (_, i) => request(app).post(`/api/events/${ev.slug}/register`).set('X-Forwarded-For', `10.7.7.${i}`).send({ name: `Racer ${i}`, phone: '+352 621 123 456', attendees: 1 })));
    const ok = results.filter((r) => r.status === 201).length;
    const seats = await Registration.aggregate([{ $match: { event: new mongoose.Types.ObjectId(ev._id) } }, { $group: { _id: null, n: { $sum: '$attendees' } } }]);
    console.log(`[race] capacity 1, accepted ${ok}, seats booked ${seats[0]?.n}`);
    expect(seats[0]?.n).toBeLessThanOrEqual(1);
  });

  it('rejecting frees seats, restoring needs room, deleting frees seats', async () => {
    const ev = await makeEvent({ capacity: 2 });
    const reg = (n: number, ip: string) => request(app).post(`/api/events/${ev.slug}/register`).set('X-Forwarded-For', ip).send({ name: 'Seat Tester', phone: '+352 621 123 456', attendees: n });
    const booked = async () => (await Event.findById(ev._id))!.booked;
    await reg(2, '10.1.1.1').expect(201);
    expect(await booked()).toBe(2);
    await reg(1, '10.1.1.2').expect(409); // full
    const first = (await Registration.findOne({ event: ev._id }))!;
    await owner.patch(`/api/admin/registrations/${first.id}`).send({ status: 'rejected' }).expect(200);
    expect(await booked()).toBe(0);
    await reg(2, '10.1.1.3').expect(201); // someone else takes the seats
    await owner.patch(`/api/admin/registrations/${first.id}`).send({ status: 'pending' }).expect(409); // can't restore: no room
    expect(await booked()).toBe(2);
    const second = (await Registration.findOne({ event: ev._id, status: { $ne: 'rejected' } }))!;
    await owner.delete(`/api/admin/registrations/${second.id}`).expect(200);
    expect(await booked()).toBe(0);
    await owner.patch(`/api/admin/registrations/${first.id}`).send({ status: 'pending' }).expect(200); // now there is room
    expect(await booked()).toBe(2);
  });

  it('a seat counter that has drifted is repaired from the registrations at start-up', async () => {
    const ev = await makeEvent({ capacity: 10 });
    await request(app).post(`/api/events/${ev.slug}/register`).set('X-Forwarded-For', '10.2.2.2').send({ name: 'Sync Tester', phone: '+352 621 123 456', attendees: 3 }).expect(201);
    await Event.updateOne({ _id: ev._id }, { booked: 99 });
    await syncBookedCounts();
    expect((await Event.findById(ev._id))!.booked).toBe(3);
  });

  it('lookups by registration code are rate limited (codes are only ~30 bits)', async () => {
    let limited = false;
    for (let i = 0; i < 150 && !limited; i++) limited = (await request(app).get('/api/registrations/KS-AAAAAA')).status === 429;
    expect(limited).toBe(true);
  });
});

describe('FILES', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  it('refuses SVG (script carrier), HTML, oversize files and too many files', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await owner.post('/api/admin/upload').attach('files', svg, { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(400);
    await owner.post('/api/admin/upload').attach('files', Buffer.from('<html><script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
    const big = Buffer.concat([PNG, Buffer.alloc(7 * 1024 * 1024)]);
    expect((await owner.post('/api/admin/upload').attach('files', big, { filename: 'big.png', contentType: 'image/png' })).status).toBe(400);
    let req = owner.post('/api/admin/upload');
    for (let i = 0; i < 21; i++) req = req.attach('files', PNG, { filename: `a${i}.png`, contentType: 'image/png' });
    expect((await req).status).toBe(400);
  });

  it('ignores a malicious filename and serves uploads as images with nosniff', async () => {
    const r = await owner.post('/api/admin/upload').attach('files', PNG, { filename: '../../../../etc/passwd.png', contentType: 'image/png' }).expect(201);
    expect(r.body.urls[0]).toMatch(/^\/uploads\/[0-9a-f]{24}\.png$/);
    const got = await request(app).get(r.body.urls[0]).expect(200);
    expect(got.headers['content-type']).toMatch(/image\/png/);
    expect(got.headers['x-content-type-options']).toBe('nosniff');
  });

  it('refuses path traversal when reading files', async () => {
    for (const p of ['/uploads/..%2f..%2fpackage.json', '/uploads/../../package.json', '/uploads/%2e%2e/%2e%2e/.env']) {
      const r = await request(app).get(p);
      expect(r.text.includes('"dependencies"'), p).toBe(false);
    }
  });
});

describe('DEMO MODE', () => {
  it('is invisible and inert on a normal site: no reset route, no demo flag', async () => {
    config.demoMode = false;
    expect((await request(app).get('/api/settings').expect(200)).body.demo).toBe(false);
    await owner.post('/api/admin/demo/reset').expect(404); // even the owner: it does not exist here
  });

  it('on a demo site only the owner can restore the sample content', async () => {
    config.demoMode = true;
    try {
      expect((await request(app).get('/api/settings').expect(200)).body.demo).toBe(true);
      await request(app).post('/api/admin/demo/reset').expect(401);
      await owner.post('/api/admin/users').send({ email: 'demo-plain@qa.test', name: 'Plain', password: 'a-long-password-1', role: 'admin' }).expect(201);
      const plain = request.agent(app);
      await plain.post('/api/auth/login').send({ email: 'demo-plain@qa.test', password: 'a-long-password-1' }).expect(200);
      await plain.post('/api/admin/demo/reset').expect(403);

      await owner.post('/api/admin/banners').send({ title: bi('Customer was here') }).expect(201);
      await owner.post('/api/admin/demo/reset').expect(200);
      const home = (await request(app).get('/api/home').expect(200)).body;
      expect(home.banners.map((b: { title: { en: string } }) => b.title.en)).not.toContain('Customer was here');
      expect(home.banners.length).toBeGreaterThan(0); // sample content is back
      const pay = (await request(app).get('/api/payment').expect(200)).body;
      expect(pay.accountName).toMatch(/DEMO ONLY/); // nobody should ever pay the sample IBAN
    } finally {
      config.demoMode = false;
    }
  });
});

describe('SPAM AND EMAIL ABUSE', () => {
  const sent: Array<{ to: string }> = [];
  beforeAll(() => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal stand-in for a mail transport
    setTransport({ sendMail: async (m: any) => void sent.push(m) } as any);
  });
  beforeEach(() => {
    sent.length = 0;
    resetEmailGuard();
  });
  const person = { name: 'Real Person', phone: '+352 621 123 456' };

  it('a filled-in honeypot looks like success to the bot, but nothing is saved or emailed', async () => {
    const ev = await makeEvent();
    const before = await Registration.countDocuments();
    const r = await request(app).post(`/api/events/${ev.slug}/register`).set('X-Forwarded-For', '10.3.3.1').send({ ...person, email: 'bot-target@example.com', website: 'http://spam.example' });
    expect(r.status).toBe(201);
    expect(r.body.code).toMatch(/^KS-/);
    await new Promise((res) => setTimeout(res, 50));
    expect(await Registration.countDocuments()).toBe(before);
    expect(sent).toHaveLength(0);
    const c = await request(app).post('/api/contributions').set('X-Forwarded-For', '10.3.3.1').send({ ...person, amount: 10, website: 'x' });
    expect(c.status).toBe(201);
  });

  it('one inbox gets at most 3 emails a day, however many times it is entered', async () => {
    const ev = await makeEvent();
    for (let i = 0; i < 6; i++) {
      await request(app).post(`/api/events/${ev.slug}/register`).set('X-Forwarded-For', `10.3.4.${i}`).send({ ...person, email: 'Victim@Example.com' }).expect(201);
    }
    await new Promise((res) => setTimeout(res, 100));
    expect(sent).toHaveLength(3); // registrations still all succeed; only the email is capped
  });

  it('one visitor cannot use us to email a long list of strangers', async () => {
    const ev = await makeEvent();
    for (let i = 0; i < 25; i++) {
      await request(app).post(`/api/events/${ev.slug}/register`).set('X-Forwarded-For', '10.3.5.5').send({ ...person, email: `stranger${i}@example.com` });
    }
    await new Promise((res) => setTimeout(res, 100));
    // The registration limiter (30 per 10 minutes per visitor) and the daily email cap both apply.
    expect(sent.length).toBeLessThanOrEqual(25);
    const { mayEmail } = await import('../src/emailGuard');
    resetEmailGuard();
    const ok = Array.from({ length: 45 }, (_, i) => mayEmail(`a${i}@example.com`, '10.9.9.9')).filter(Boolean).length;
    expect(ok).toBe(40); // per-visitor daily cap
  });

  it('the limits reset after a day', async () => {
    const { mayEmail } = await import('../src/emailGuard');
    const t0 = Date.now();
    expect([1, 2, 3, 4].map(() => mayEmail('same@example.com', '10.8.8.8', t0))).toEqual([true, true, true, false]);
    expect(mayEmail('same@example.com', '10.8.8.8', t0 + 25 * 3600_000)).toBe(true);
  });
});

describe('ABUSE LIMITS', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  it('the PUBLIC upload takes one payment screenshot, not twenty files per request', async () => {
    let req = request(app).post('/api/upload');
    for (let i = 0; i < 20; i++) req = req.attach('files', PNG, { filename: `s${i}.png`, contentType: 'image/png' });
    const r = await req;
    console.log('[public upload] 20 files in one request ->', r.status, r.body.urls?.length ?? 0, 'stored');
    expect(r.status).toBe(400);
  });

  it('payment screenshots are private: only a signed-in admin can open them', async () => {
    const up = await request(app).post('/api/upload').set('X-Forwarded-For', '10.5.5.1').attach('files', PNG, { filename: 's.png', contentType: 'image/png' }).expect(201);
    const url = up.body.urls[0] as string;
    expect(url).toMatch(/^\/api\/admin\/proofs\/[0-9a-f]{24}\.png$/);
    await request(app).get(url).expect(401); // not public
    await request(app).get(url.replace('/api/admin/proofs', '/uploads')).then((r) => expect(r.body?.length ?? 0).toBe(0)); // not in the public folder either
    const seen = await owner.get(url).expect(200);
    expect(seen.headers['content-type']).toMatch(/image\/png/);
    expect(seen.headers['cache-control']).toMatch(/no-store/);
    expect(seen.headers['x-content-type-options']).toBe('nosniff');
    for (const bad of ['/api/admin/proofs/..%2f..%2fpackage.json', '/api/admin/proofs/not-a-name.png', '/api/admin/proofs/000000000000000000000000.png']) {
      expect((await owner.get(bad)).status, bad).toBe(404);
    }
  });

  it('a payment proof must point at a screenshot we stored, not an address the payer typed', async () => {
    const ev = await makeEvent({ isPaid: true, tickets: [{ name: 'Adult', price: 20 }] }); // only a pending (paid) registration takes proof
    const { body } = await request(app).post(`/api/events/${ev.slug}/register`).set('X-Forwarded-For', '10.5.5.2').send({ name: 'Proof Tester', phone: '+352 621 123 456' }).expect(201);
    await request(app).post(`/api/registrations/${body.code}/proof`).send({ screenshot: 'https://evil.example/track.png' }).expect(400);
    await request(app).post(`/api/registrations/${body.code}/proof`).send({ screenshot: 'javascript:alert(1)' }).expect(400);
    const up = await request(app).post('/api/upload').set('X-Forwarded-For', '10.5.5.2').attach('files', PNG, { filename: 's.png', contentType: 'image/png' }).expect(201);
    await request(app).post(`/api/registrations/${body.code}/proof`).send({ screenshot: up.body.urls[0], utr: 'REF1' }).expect(200);
  });

  it('housekeeping removes unused photos and old settled screenshots, and nothing else', async () => {
    const { writeFileSync, existsSync, utimesSync } = await import('node:fs');
    const path = await import('node:path');
    const { cleanupUploads } = await import('../src/maintenance');
    const { Banner } = await import('../src/models');
    const old = new Date(Date.now() - 40 * 86_400_000);
    const make = (dir: string, name: string, age: Date | null) => {
      const f = path.join(dir, name);
      writeFileSync(f, PNG);
      if (age) utimesSync(f, age, age);
      return f;
    };
    const pub = config.uploadDir;
    const orphanOld = make(pub, 'aaaaaaaaaaaaaaaaaaaaaaa1.png', old);
    const orphanNew = make(pub, 'aaaaaaaaaaaaaaaaaaaaaaa2.png', null);
    const usedOld = make(pub, 'aaaaaaaaaaaaaaaaaaaaaaa3.png', old);
    const sample = make(pub, 'seed-sample-photo.jpg', old);
    await Banner.create({ title: bi('Uses a photo'), image: '/uploads/aaaaaaaaaaaaaaaaaaaaaaa3.png' });

    const priv = config.privateDir;
    const strayProof = make(priv, 'bbbbbbbbbbbbbbbbbbbbbbb1.png', old);
    const pendingProof = make(priv, 'bbbbbbbbbbbbbbbbbbbbbbb2.png', old);
    const settledProof = make(priv, 'bbbbbbbbbbbbbbbbbbbbbbb3.png', old);
    const ev = await makeEvent();
    const mk = async (code: string, status: string, shot: string) =>
      (await Registration.create({ code, event: ev._id, name: 'Clean Up', phone: '1', attendees: 1, status, screenshot: `/api/admin/proofs/${shot}` }))._id;
    await mk('KS-CLEAN1', 'pending', 'bbbbbbbbbbbbbbbbbbbbbbb2.png');
    const settledId = await mk('KS-CLEAN2', 'verified', 'bbbbbbbbbbbbbbbbbbbbbbb3.png');
    await Registration.collection.updateOne({ _id: settledId }, { $set: { updatedAt: old } }); // settled long ago

    const r = await cleanupUploads();
    expect(r).toMatchObject({ photos: 1, strayProofs: 1, settledProofs: 1 });
    // A screenshot uploaded just now and not yet attached must survive.
    const fresh = make(priv, 'bbbbbbbbbbbbbbbbbbbbbbb4.png', null);
    await cleanupUploads();
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(orphanOld)).toBe(false); // unused and old
    expect(existsSync(orphanNew)).toBe(true); // unused but recent: grace period
    expect(existsSync(usedOld)).toBe(true); // still used by a banner
    expect(existsSync(sample)).toBe(true); // sample photos are never touched
    expect(existsSync(strayProof)).toBe(false); // nobody attached it
    expect(existsSync(pendingProof)).toBe(true); // payment still pending: needed
    expect(existsSync(settledProof)).toBe(false); // payment settled long ago: privacy
    expect((await Registration.findOne({ code: 'KS-CLEAN2' }))!.screenshot).toBe('');
    expect((await Registration.findOne({ code: 'KS-CLEAN1' }))!.screenshot).not.toBe('');
  });

  it('admin passwords must be reasonably strong', async () => {
    const r = await owner.post('/api/admin/users').send({ email: 'weak@qa.test', name: 'Weak', password: 'aaaaaaaa', role: 'admin' });
    expect(r.status).toBe(400);
  });
});

describe('HEADERS', () => {
  it('sends the expected security headers and hides the framework', async () => {
    const r = await request(app).get('/healthz');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toContain("default-src 'self'");
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps the offline cache from ever holding payment details that can go stale', () => {
    // A phone with a slow connection falls back to its saved copy; an old IBAN would send money to the wrong account.
    const rules = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../web/public/sw-rules.js'), 'utf8') as string;
    expect(rules).not.toMatch(/\|payment\|/);
  });
});

