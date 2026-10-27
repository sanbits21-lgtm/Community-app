import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ensureOwner } from '../src/auth';
import { config } from '../src/config';

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

describe('footer useful links', () => {
  it('are saved from the admin and served publicly', async () => {
    await agent
      .put('/api/admin/settings/site')
      .send({ usefulLinks: [{ label: { en: 'Embassy', kn: '' }, url: 'https://example.org/' }] })
      .expect(200);
    const res = await request(app).get('/api/settings').expect(200);
    expect(res.body.usefulLinks).toEqual([{ label: { en: 'Embassy', kn: '' }, url: 'https://example.org/' }]);
  });
  it('refuse unsafe or empty links', async () => {
    await agent.put('/api/admin/settings/site').send({ usefulLinks: [{ label: { en: 'x' }, url: 'javascript:alert(1)' }] }).expect(400);
    await agent.put('/api/admin/settings/site').send({ usefulLinks: [{ label: { en: 'x' }, url: '' }] }).expect(400);
  });
});

describe('"Our journey" page content', () => {
  it('is empty but valid before anything is written', async () => {
    const res = await request(app).get('/api/journey').expect(200);
    expect(res.body.chapters).toEqual([]);
    expect(res.body.people).toEqual([]);
  });

  it('only admins can change it', async () => {
    await request(app).put('/api/admin/settings/journey').send({}).expect(401);
  });

  it('saves chapters, people and numbers, and the public page returns them in order', async () => {
    await agent
      .put('/api/admin/settings/journey')
      .send({
        title: { en: 'Our journey', kn: 'ನಮ್ಮ ಪಯಣ' },
        numbers: [{ value: '12', label: { en: 'Founders', kn: '' } }],
        chapters: [
          { label: '22 Feb 2022', heading: { en: 'Start', kn: '' }, body: { en: 'One\n\nTwo', kn: '' }, image: '/uploads/a.jpg' },
          { label: '2023', heading: { en: 'Growth', kn: '' }, body: { en: '', kn: '' }, image: '' },
        ],
        people: [{ name: 'Asha' }, { name: 'Ravi' }],
      })
      .expect(200);
    const res = await request(app).get('/api/journey').expect(200);
    expect(res.body.title.kn).toBe('ನಮ್ಮ ಪಯಣ');
    expect(res.body.chapters.map((c: { label: string }) => c.label)).toEqual(['22 Feb 2022', '2023']);
    expect(res.body.chapters[0].body.en).toBe('One\n\nTwo');
    expect(res.body.people.map((p: { name: string }) => p.name)).toEqual(['Asha', 'Ravi']);
  });

  it('rejects unsafe picture links and blank names', async () => {
    await agent.put('/api/admin/settings/journey').send({ chapters: [{ label: 'x', image: 'javascript:alert(1)' }] }).expect(400);
    await agent.put('/api/admin/settings/journey').send({ people: [{ name: '' }] }).expect(400);
  });
});

describe('sponsors', () => {
  it('are managed by admins and only active ones reach the home page, in order', async () => {
    await request(app).post('/api/admin/sponsors').send({ name: 'X' }).expect(401);
    await agent.post('/api/admin/sponsors').send({ name: 'Gold Co', tier: 'gold', website: 'https://example.org', order: 2 }).expect(201);
    await agent.post('/api/admin/sponsors').send({ name: 'Title Co', tier: 'title', order: 1 }).expect(201);
    await agent.post('/api/admin/sponsors').send({ name: 'Hidden Co', active: false }).expect(201);
    const home = await request(app).get('/api/home').expect(200);
    expect(home.body.sponsors.map((s: { name: string }) => s.name)).toEqual(['Title Co', 'Gold Co']);
  });
  it('link to events: shown on that event page only', async () => {
    const ev = await agent.post('/api/admin/events').send({ title: { en: 'Gala' }, startsAt: new Date(Date.now() + 5 * 864e5).toISOString() }).expect(201);
    const other = await agent.post('/api/admin/events').send({ title: { en: 'Picnic' }, startsAt: new Date(Date.now() + 6 * 864e5).toISOString() }).expect(201);
    await agent.post('/api/admin/sponsors').send({ name: 'Gala Co', events: [ev.body._id] }).expect(201);
    const a = await request(app).get('/api/events/' + ev.body.slug).expect(200);
    const b = await request(app).get('/api/events/' + other.body.slug).expect(200);
    expect(a.body.sponsors.map((s: { name: string }) => s.name)).toEqual(['Gala Co']);
    expect(b.body.sponsors).toEqual([]);
    await agent.post('/api/admin/sponsors').send({ name: 'Bad', events: ['nope'] }).expect(400);
  });
  it('refuse a bad link, a bad tier and a missing name', async () => {
    await agent.post('/api/admin/sponsors').send({ name: 'A', website: 'javascript:alert(1)' }).expect(400);
    await agent.post('/api/admin/sponsors').send({ name: 'A', tier: 'platinum' }).expect(400);
    await agent.post('/api/admin/sponsors').send({ name: '' }).expect(400);
  });
});

describe('email setup screen', () => {
  it('needs an admin, and never reveals the SMTP password', async () => {
    const { setTransport } = await import('../src/mailer');
    await request(app).get('/api/admin/email/status').expect(401);
    setTransport(null);
    const off = await agent.get('/api/admin/email/status').expect(200);
    expect(off.body.configured).toBe(false);
    expect(JSON.stringify(off.body)).not.toMatch(/password|secret/i);
  });
  it('test email: clear message when off, ok when on, readable error when the server refuses', async () => {
    const { setTransport } = await import('../src/mailer');
    setTransport(null);
    const off = await agent.post('/api/admin/email/test').send({ to: 'me@example.org' }).expect(502);
    expect(off.body.error).toMatch(/SMTP_URL/);

    const sent: Array<{ to: string }> = [];
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake transport
    setTransport({ sendMail: async (m: any) => void sent.push(m) } as any);
    await agent.post('/api/admin/email/test').send({ to: 'me@example.org' }).expect(200);
    expect(sent[0]?.to).toBe('me@example.org');

    // biome-ignore lint/suspicious/noExplicitAny: minimal fake transport
    setTransport({ sendMail: async () => { throw new Error('connect to smtp://user:hunter2@mail.example.org failed: auth rejected'); } } as any);
    const bad = await agent.post('/api/admin/email/test').send({ to: 'me@example.org' }).expect(502);
    expect(bad.body.error).toContain('auth rejected');
    expect(bad.body.error).not.toContain('hunter2');

    await agent.post('/api/admin/email/test').send({ to: 'not-an-email' }).expect(400);
    await request(app).post('/api/admin/email/test').send({ to: 'me@example.org' }).expect(401);
    setTransport(null);
  });
});

describe('Brevo HTTPS API sending', () => {
  it('sends over https with the key in a header, and hides the key in errors', async () => {
    const { config } = await import('../src/config');
    const { setTransport, sendTestMail, mailStatus } = await import('../src/mailer');
    const real = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit }> = [];
    config.brevoApiKey = 'xkeysib-secretvalue123';
    config.mailFrom = 'Kannada Sangha <hello@example.org>';
    setTransport(undefined as never); // rebuild from config
    try {
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ messageId: '<abc@x>' }), { status: 201 });
      }) as typeof fetch;
      const ok = await sendTestMail({ to: 'me@example.org', subject: 's', text: 't' });
      expect(ok).toMatchObject({ ok: true, accepted: ['me@example.org'] });
      expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
      expect((calls[0]?.init.headers as Record<string, string>)['api-key']).toBe('xkeysib-secretvalue123');
      expect(JSON.parse(String(calls[0]?.init.body)).sender).toEqual({ name: 'Kannada Sangha', email: 'hello@example.org' });
      expect(mailStatus().host).toContain('api.brevo.com');
      expect(JSON.stringify(mailStatus())).not.toContain('secretvalue');

      globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'Sender not valid xkeysib-secretvalue123' }), { status: 400 })) as typeof fetch;
      const bad = await sendTestMail({ to: 'me@example.org', subject: 's', text: 't' });
      expect(bad).toMatchObject({ ok: false });
      expect(JSON.stringify(bad)).toContain('400');
      expect(JSON.stringify(bad)).not.toContain('secretvalue');
    } finally {
      globalThis.fetch = real;
      config.brevoApiKey = '';
      setTransport(null);
    }
  });
});
