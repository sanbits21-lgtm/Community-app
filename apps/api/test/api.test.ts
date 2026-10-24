import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { ensureOwner } from '../src/auth';
import { config } from '../src/config';
import { setTransport } from '../src/mailer';
import { Banner, Contribution, Event, Registration } from '../src/models';

let mongod: MongoMemoryServer;
const app = createApp();
const agent = request.agent(app);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({ binary: { version: process.env.MONGOMS_VERSION ?? '8.2.6' } });
  await mongoose.connect(mongod.getUri('test'));
  await ensureOwner();
  await agent.post('/api/auth/login').send({ email: config.adminEmail, password: config.adminPassword }).expect(200);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([Banner.deleteMany({}), Event.deleteMany({}), Registration.deleteMany({}), Contribution.deleteMany({})]);
});

const bi = (en: string, kn = '') => ({ en, kn });
const future = () => new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();

async function makeEvent(over: Record<string, unknown> = {}) {
  const res = await agent
    .post('/api/admin/events')
    .send({ title: bi('Test event'), startsAt: future(), isPaid: true, tickets: [{ name: 'Adult', price: 300 }], ...over })
    .expect(201);
  return res.body as { _id: string; slug: string };
}

describe('admin access', () => {
  it('rejects anonymous admin calls', async () => {
    await request(app).get('/api/admin/banners').expect(401);
    await request(app).post('/api/admin/banners').send({}).expect(401);
  });

  it('rejects a wrong password', async () => {
    await request(app).post('/api/auth/login').send({ email: config.adminEmail, password: 'nope' }).expect(401);
  });
});

describe('banners', () => {
  it('admin edits show on the home page; inactive and expired ones do not', async () => {
    await agent.post('/api/admin/banners').send({ title: bi('Live', 'ಲೈವ್'), order: 1 }).expect(201);
    await agent.post('/api/admin/banners').send({ title: bi('Hidden'), active: false }).expect(201);
    await agent.post('/api/admin/banners').send({ title: bi('Expired'), endsAt: new Date(Date.now() - 1000).toISOString() }).expect(201);

    const home = await request(app).get('/api/home').expect(200);
    expect(home.body.banners.map((b: { title: { en: string } }) => b.title.en)).toEqual(['Live']);
  });

  it('rejects an invalid body with a readable message', async () => {
    const res = await agent.post('/api/admin/events').send({ title: bi('No date') }).expect(400);
    expect(res.body.error).toMatch(/startsAt/);
  });
});

describe('event registration', () => {
  it('paid events start pending, priced from the ticket, and return the payment reference code', async () => {
    const ev = await makeEvent({ tickets: [{ name: 'Adult', price: 12.5 }] });
    const ok = await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Asha Rao', phone: '9876543210', attendees: 3 }).expect(201);
    expect(ok.body.status).toBe('pending');
    expect(ok.body.amount).toBe(37.5);
    expect(ok.body.code).toMatch(/^KS-[A-Z2-9]{6}$/);
  });

  it('payer can attach proof to a pending registration, once it is not pending it is refused', async () => {
    const ev = await makeEvent();
    const { body } = await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Asha Rao', phone: '9876543210' }).expect(201);
    await request(app).post(`/api/registrations/${body.code}/proof`).send({ utr: 'BANKREF1' }).expect(200);
    const list = await agent.get('/api/admin/registrations').expect(200);
    expect(list.body[0].utr).toBe('BANKREF1');
    await agent.patch(`/api/admin/registrations/${list.body[0]._id}`).send({ status: 'verified' }).expect(200);
    await request(app).post(`/api/registrations/${body.code}/proof`).send({ utr: 'CHANGED' }).expect(404);
    await request(app).post('/api/registrations/KS-NOPE00/proof').send({}).expect(404);
  });

  it('free events are confirmed immediately', async () => {
    const ev = await makeEvent({ isPaid: false, tickets: [] });
    const res = await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Free Guest', phone: '9876543210' }).expect(201);
    expect(res.body).toMatchObject({ status: 'verified', amount: 0 });
  });

  it('enforces capacity, and a rejected payment frees its seats', async () => {
    const ev = await makeEvent({ capacity: 3 });
    const reg = (n: number) =>
      request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Guest One', phone: '9876543210', attendees: n, utr: '123456789012' });

    const first = await reg(2).expect(201);
    await reg(2).expect(409);
    const left = await request(app).get(`/api/events/${ev.slug}`).expect(200);
    expect(left.body.spotsLeft).toBe(1);

    const list = await agent.get('/api/admin/registrations').expect(200);
    await agent.patch(`/api/admin/registrations/${list.body[0]._id}`).send({ status: 'rejected' }).expect(200);
    await reg(2).expect(201);
    expect(first.body.code).toBeTruthy();
  });

  it('refuses registration for a closed event', async () => {
    const ev = await makeEvent({ registrationOpen: false });
    await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Late Guest', phone: '9876543210', utr: '123456789012' }).expect(409);
  });

  it('status lookup by code hides contact details', async () => {
    const ev = await makeEvent();
    const { body } = await request(app)
      .post(`/api/events/${ev.slug}/register`)
      .send({ name: 'Asha Rao', phone: '9876543210', email: 'asha@example.com', utr: '123456789012' })
      .expect(201);
    const status = await request(app).get(`/api/registrations/${body.code.toLowerCase()}`).expect(200);
    expect(status.body.name).toBe('Asha Rao');
    expect(JSON.stringify(status.body)).not.toMatch(/9876543210|asha@example|123456789012/);
  });

  it('CSV export neutralises spreadsheet formulas in attendee names', async () => {
    const ev = await makeEvent({ isPaid: false, tickets: [] });
    await request(app).post(`/api/events/${ev.slug}/register`).send({ name: '=HYPERLINK("http://evil")', phone: '9876543210' }).expect(201);
    const csv = await agent.get('/api/admin/registrations/export').expect(200);
    expect(csv.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv.text).not.toMatch(/,"=HYPERLINK/);
  });
});

describe('email confirmations', () => {
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  beforeAll(() => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal stand-in for a nodemailer transport
    setTransport({ sendMail: async (m: any) => void sent.push(m) } as any);
  });
  beforeEach(() => void (sent.length = 0));

  it('emails payment details on registration and a confirmation when the admin verifies', async () => {
    await agent.put('/api/admin/settings/payment').send({ accountName: 'Test Sangha', iban: 'LU28 0019 4006 4475 0000', bic: 'BCEELULL' }).expect(200);
    const ev = await makeEvent({ tickets: [{ name: 'Adult', price: 20 }] });
    const { body } = await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Asha Rao', phone: '9876543210', email: 'asha@example.com', attendees: 2 }).expect(201);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.to).toBe('asha@example.com');
    expect(sent[0]!.subject).toContain(body.code);
    expect(sent[0]!.text).toContain('LU28 0019 4006 4475 0000');
    expect(sent[0]!.text).toContain('EUR 40.00');
    expect(sent[0]!.text).toContain(`/registration/${body.code}`);

    const list = await agent.get('/api/admin/registrations').expect(200);
    await agent.patch(`/api/admin/registrations/${list.body[0]._id}`).send({ status: 'verified' }).expect(200);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.subject).toMatch(/confirmed/);
    // Verifying twice must not email twice.
    await agent.patch(`/api/admin/registrations/${list.body[0]._id}`).send({ status: 'verified' }).expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(sent).toHaveLength(2);
  });

  it('sends nothing without an email address, and a failing mail server does not fail the registration', async () => {
    const ev = await makeEvent();
    await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'No Mail', phone: '9876543210' }).expect(201);
    await new Promise((r) => setTimeout(r, 50));
    expect(sent).toHaveLength(0);
    // biome-ignore lint/suspicious/noExplicitAny: failing transport
    setTransport({ sendMail: async () => { throw new Error('smtp down'); } } as any);
    await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Mail Down', phone: '9876543210', email: 'x@example.com' }).expect(201);
  });
});

describe('listing extras', () => {
  it('reports spotsLeft per event in lists, and the dashboard setup checklist', async () => {
    const ev = await makeEvent({ capacity: 10, isPaid: false, tickets: [] });
    await request(app).post(`/api/events/${ev.slug}/register`).send({ name: 'Guest One', phone: '9876543210', attendees: 4 }).expect(201);
    const list = await request(app).get('/api/events').expect(200);
    expect(list.body.find((e: { slug: string }) => e.slug === ev.slug).spotsLeft).toBe(6);
    const home = await request(app).get('/api/home').expect(200);
    expect(home.body.events.find((e: { slug: string }) => e.slug === ev.slug).spotsLeft).toBe(6);
    const stats = await agent.get('/api/admin/stats').expect(200);
    expect(stats.body.setup).toMatchObject({ events: true, payment: true });
  });
});

describe('uploads', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

  it('accepts a real image and refuses text posing as one', async () => {
    const ok = await agent.post('/api/admin/upload').attach('files', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    expect(ok.body.urls[0]).toMatch(/^\/uploads\/[0-9a-f]+\.png$/);
    await agent.post('/api/admin/upload').attach('files', Buffer.from('alert(1)'), { filename: 'evil.png', contentType: 'image/png' }).expect(400);
    await request(app).post('/api/upload').attach('files', Buffer.from('<html>'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
  });
});

describe('contributions', () => {
  it('records a pending contribution and needs admin to verify it', async () => {
    const c = await request(app).post('/api/contributions').send({ name: 'Donor', phone: '9876543210', amount: 25.555 }).expect(201);
    expect(c.body.status).toBe('pending');
    expect(c.body.code).toMatch(/^DN-[A-Z2-9]{6}$/);
    expect(c.body.amount).toBe(25.56);
    await request(app).post(`/api/contributions/${c.body.code}/proof`).send({ utr: 'REF42' }).expect(200);
    const all = await agent.get('/api/admin/contributions').expect(200);
    expect(all.body[0].utr).toBe('REF42');
    await request(app).patch(`/api/admin/contributions/${all.body[0]._id}`).send({ status: 'verified' }).expect(401);
    await agent.patch(`/api/admin/contributions/${all.body[0]._id}`).send({ status: 'verified' }).expect(200);
  });
});
