import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Model } from 'mongoose';
import { contributionInput, proofInput, registrationInput, ticketAmount } from '@sangha/shared';
import { contributionEmail, registrationEmail } from '../emails';
import { sendMail } from '../mailer';
import { config } from '../config';
import { mayEmail } from '../emailGuard';
import { releaseSeats, reserveSeats, spotsLeft } from '../seats';
import { proofUpload } from '../uploads';
import {
  Album,
  Sponsor,
  Blog,
  BoardMember,
  Banner,
  Contribution,
  Event,
  Notification,
  JourneyPage,
  PaymentSettings,
  Registration,
  SiteSettings,
} from '../models';

export const publicRouter = Router();

const writeLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

// Registration codes are short enough to type, so guessing them has to be slow.
const lookupLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

const now = () => new Date();

/** What a bot sees after tripping the honeypot: something that looks like a normal success. */
const decoy = () => ({ code: `KS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, status: 'pending', amount: 0 });
const windowOpen = (from: string, to: string) => ({
  $and: [
    { $or: [{ [from]: null }, { [from]: { $lte: now() } }] },
    { $or: [{ [to]: null }, { [to]: { $gte: now() } }] },
  ],
});

/** Adds spotsLeft (null = unlimited) and hides the internal seat counter. */
function withSpots<T extends { capacity?: number | null; booked?: number | null }>(events: T[]): Array<Omit<T, 'booked'> & { spotsLeft: number | null }> {
  return events.map(({ booked, ...rest }) => ({ ...rest, spotsLeft: spotsLeft({ capacity: rest.capacity, booked }) }));
}

// biome-ignore lint/suspicious/noExplicitAny: shared by the two singleton models
async function singleton(m: Model<any>) {
  return (await m.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true, new: true }).lean())!;
}

publicRouter.get('/home', async (_req, res) => {
  const [banners, notifications, events, blogs, board, albums, site, sponsors] = await Promise.all([
    Banner.find({ active: true, ...windowOpen('startsAt', 'endsAt') }).sort({ order: 1, createdAt: -1 }).lean(),
    Notification.find({ active: true, $or: [{ expiresAt: null }, { expiresAt: { $gte: now() } }] })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(8)
      .lean(),
    Event.find({ published: true, startsAt: { $gte: now() } }).sort({ startsAt: 1 }).limit(3).lean(),
    Blog.find({ published: true, publishedAt: { $lte: now() } }).sort({ publishedAt: -1 }).limit(3).lean(),
    BoardMember.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean(),
    Album.find({ published: true }).sort({ date: -1 }).limit(4).lean(),
    singleton(SiteSettings),
    Sponsor.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);
  res.json({ banners, notifications, events: withSpots(events), blogs, board, albums, site, sponsors });
});

// Attribution for the sample photos (CC BY / CC BY-SA require it to be shown).
const CREDITS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../seed-assets/credits.json');
publicRouter.get('/credits', (_req, res) => {
  try {
    const all = JSON.parse(readFileSync(CREDITS_FILE, 'utf8')) as Array<{ file: string }>;
    res.json(all.filter((c) => existsSync(path.join(config.uploadDir, `seed-${c.file}`))));
  } catch {
    res.json([]);
  }
});

// `palette` first so a site saved before colour themes existed still reports the default.
publicRouter.get('/settings', async (_req, res) => res.json({ palette: 'turmeric', ...(await singleton(SiteSettings)), demo: config.demoMode }));
publicRouter.get('/journey', async (_req, res) => res.json(await singleton(JourneyPage)));
publicRouter.get('/payment', async (_req, res) => res.json(await singleton(PaymentSettings)));

publicRouter.get('/board', async (_req, res) => {
  res.json(await BoardMember.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean());
});

publicRouter.get('/events', async (req, res) => {
  const when = req.query.when === 'past' ? 'past' : 'upcoming';
  const upcoming = when === 'upcoming';
  const events = await Event.find({ published: true, startsAt: upcoming ? { $gte: now() } : { $lt: now() } })
    .sort({ startsAt: upcoming ? 1 : -1 })
    .lean();
  res.json(withSpots(events));
});

publicRouter.get('/events/:slug', async (req, res) => {
  const event = await Event.findOne({ slug: req.params.slug, published: true }).lean();
  if (!event) return void res.status(404).json({ error: 'Event not found' });
  const sponsors = await Sponsor.find({ active: true, events: event._id }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ ...withSpots([event])[0], sponsors });
});

publicRouter.post('/events/:slug/register', writeLimiter, async (req, res) => {
  const event = await Event.findOne({ slug: req.params.slug, published: true });
  if (!event) return void res.status(404).json({ error: 'Event not found' });
  if (!event.registrationOpen || event.startsAt < now()) {
    return void res.status(409).json({ error: 'Registration is closed for this event' });
  }
  const input = registrationInput.parse(req.body);
  if (input.website) return void res.status(201).json(decoy()); // a bot filled the hidden field: pretend it worked, save nothing
  const tickets = event.tickets.map((t) => ({ name: t.name ?? '', price: t.price ?? 0 }));
  if (event.isPaid) {
    if (!tickets.some((t) => t.price > 0)) return void res.status(409).json({ error: 'Registration for this event is not set up yet. Please contact us.' });
    if (input.ticketIndex >= tickets.length) return void res.status(400).json({ error: 'Choose one of the ticket types' });
  }
  const amount = ticketAmount(event.isPaid, tickets, input.ticketIndex, input.attendees);
  // Take the seats first, atomically. If the booking then fails for any reason, hand them back.
  if (!(await reserveSeats(event._id, input.attendees))) {
    const fresh = await Event.findById(event._id).lean();
    const left = spotsLeft({ capacity: fresh?.capacity, booked: fresh?.booked }) ?? 0;
    return void res.status(409).json({ error: left > 0 ? `Only ${left} seat(s) left` : 'This event is full' });
  }
  let reg;
  try {
    reg = await Registration.create({
    event: event._id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    attendees: input.attendees,
    ticketName: event.isPaid ? (tickets[input.ticketIndex]?.name ?? '') : '',
    amount,
    // Free events need no verification.
    status: event.isPaid ? 'pending' : 'verified',
    });
  } catch (e) {
    await releaseSeats(event._id, input.attendees);
    throw e;
  }
  // Email is best-effort and optional: it must never fail or slow the registration.
  if (input.email && mayEmail(input.email, req.ip ?? 'unknown')) {
    const pay = await PaymentSettings.findOne({ key: 'main' }).lean();
    const mail = registrationEmail(reg, event, pay ?? {});
    void sendMail({ to: input.email, ...mail });
  }
  res.status(201).json({ code: reg.code, status: reg.status, amount: reg.amount });
});

publicRouter.get('/registrations/:code', lookupLimiter, async (req, res) => {
  const reg = await Registration.findOne({ code: String(req.params.code).toUpperCase() }).populate<{
    event: { title: unknown; slug: string; startsAt: Date; venue: unknown };
  }>('event', 'title slug startsAt venue');
  if (!reg) return void res.status(404).json({ error: 'No registration with that code' });
  // Deliberately omits phone/email/UTR: the code alone is not enough to see personal details.
  res.json({
    code: reg.code,
    name: reg.name,
    attendees: reg.attendees,
    amount: reg.amount,
    status: reg.status,
    event: reg.event,
  });
});

publicRouter.get('/blogs', async (_req, res) => {
  res.json(
    await Blog.find({ published: true, publishedAt: { $lte: now() } })
      .select('-body')
      .sort({ publishedAt: -1 })
      .lean(),
  );
});

publicRouter.get('/blogs/:slug', async (req, res) => {
  const post = await Blog.findOne({ slug: req.params.slug, published: true }).lean();
  if (!post) return void res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

publicRouter.get('/gallery', async (_req, res) => {
  const albums = await Album.find({ published: true }).sort({ date: -1 }).lean();
  res.json(albums.map((a) => ({ ...a, count: a.images.length, images: a.images.slice(0, 1) })));
});

publicRouter.get('/gallery/:id', async (req, res) => {
  const album = await Album.findOne({ _id: req.params.id, published: true }).lean();
  if (!album) return void res.status(404).json({ error: 'Album not found' });
  res.json(album);
});

publicRouter.post('/contributions', writeLimiter, async (req, res) => {
  const input = contributionInput.parse(req.body);
  if (input.website) return void res.status(201).json(decoy());
  const c = await Contribution.create(input);
  if (input.email && mayEmail(input.email, req.ip ?? 'unknown')) {
    const pay = await PaymentSettings.findOne({ key: 'main' }).lean();
    void sendMail({ to: input.email, ...contributionEmail(c, pay ?? {}) });
  }
  res.status(201).json({ code: c.code, status: c.status, amount: c.amount });
});

// The payer tells us they've sent the transfer. The code is the secret; only pending items accept it.
// biome-ignore lint/suspicious/noExplicitAny: shared by two models with the same code/status/proof fields
async function attachProof(model: Model<any>, code: string, body: unknown) {
  const proof = proofInput.parse(body);
  const doc = await model.findOneAndUpdate({ code: code.toUpperCase(), status: 'pending' }, { $set: proof });
  return doc !== null;
}
publicRouter.post('/registrations/:code/proof', writeLimiter, async (req, res) => {
  if (!(await attachProof(Registration, String(req.params.code), req.body))) return void res.status(404).json({ error: 'No pending registration with that code' });
  res.json({ ok: true });
});
publicRouter.post('/contributions/:code/proof', writeLimiter, async (req, res) => {
  if (!(await attachProof(Contribution, String(req.params.code), req.body))) return void res.status(404).json({ error: 'No pending contribution with that code' });
  res.json({ ok: true });
});

// One payment screenshot per request, kept private. Few per visitor: a person needs one or two, a vandal needs thousands.
const uploadLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
publicRouter.post('/upload', uploadLimiter, ...proofUpload);
