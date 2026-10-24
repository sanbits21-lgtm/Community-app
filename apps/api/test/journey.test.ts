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
