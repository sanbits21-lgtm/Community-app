import path from 'node:path';
import { Router } from 'express';
import {
  adminUserInput,
  albumInput,
  bannerInput,
  blogInput,
  boardMemberInput,
  journeyInput,
  eventInput,
  notificationInput,
  paymentSettingsInput,
  siteSettingsInput,
  sponsorInput,
  statusInput,
} from '@sangha/shared';
import { z, type ZodType } from 'zod';
import type { Model } from 'mongoose';
import { hashPassword, requireAdmin, requireOwner } from '../auth';
import { config } from '../config';
import { crud } from '../crud';
import {
  Admin,
  Album,
  Sponsor,
  Banner,
  Blog,
  BoardMember,
  Contribution,
  Event,
  Notification,
  JourneyPage,
  PaymentSettings,
  Registration,
  SiteSettings,
} from '../models';
import { verifiedEmail } from '../emails';
import { mailStatus, sendMail, sendTestMail } from '../mailer';
import { releaseSeats, reserveSeats, syncBookedCounts } from '../seats';
import { seedSampleContent } from '../seed';
import { imageUpload, PROOF_NAME } from '../uploads';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.post('/upload', ...imageUpload);

// Payment screenshots: only signed-in admins can open them, and browsers must not keep a copy.
adminRouter.get('/proofs/:name', (req, res) => {
  const name = String(req.params.name);
  if (!PROOF_NAME.test(name)) return void res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(config.privateDir, name), { headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Not found' });
  });
});

adminRouter.use('/banners', crud(Banner, bannerInput, { sort: { order: 1, createdAt: -1 } }));
adminRouter.use('/notifications', crud(Notification, notificationInput, { sort: { pinned: -1, createdAt: -1 } }));
adminRouter.use('/board', crud(BoardMember, boardMemberInput, { sort: { order: 1, createdAt: 1 } }));
adminRouter.use('/sponsors', crud(Sponsor, sponsorInput, { sort: { order: 1, createdAt: 1 } }));
adminRouter.use('/events', crud(Event, eventInput, { sort: { startsAt: -1 } }));
adminRouter.use('/blogs', crud(Blog, blogInput, { sort: { publishedAt: -1 } }));
adminRouter.use('/albums', crud(Album, albumInput, { sort: { date: -1 } }));

// biome-ignore lint/suspicious/noExplicitAny: generic over the two singleton models
function singletonRoutes(path: string, model: Model<any>, schema: ZodType<any>) {
  adminRouter.get(path, async (_req, res) => {
    res.json(await model.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true, new: true }).lean());
  });
  adminRouter.put(path, async (req, res) => {
    const data = schema.parse(req.body);
    res.json(await model.findOneAndUpdate({ key: 'main' }, { $set: data }, { upsert: true, new: true }).lean());
  });
}
singletonRoutes('/settings/payment', PaymentSettings, paymentSettingsInput);
singletonRoutes('/settings/site', SiteSettings, siteSettingsInput);
singletonRoutes('/settings/journey', JourneyPage, journeyInput);

// Demo sites only: put the sample content back (wipes content and registrations). Plain 404 anywhere else.
adminRouter.post('/demo/reset', requireOwner, async (_req, res) => {
  if (!config.demoMode) return void res.status(404).json({ error: 'Not found' });
  await seedSampleContent();
  await syncBookedCounts();
  res.json({ ok: true });
});

adminRouter.get('/stats', async (_req, res) => {
  const [pendingRegs, pendingContribs, registrations, upcoming, blogs, albums, banners, board, events, pay, site] = await Promise.all([
    Registration.countDocuments({ status: 'pending' }),
    Contribution.countDocuments({ status: 'pending' }),
    Registration.countDocuments({ status: { $ne: 'rejected' } }),
    Event.countDocuments({ startsAt: { $gte: new Date() } }),
    Blog.countDocuments({ published: true }),
    Album.countDocuments({ published: true }),
    Banner.countDocuments({ active: true }),
    BoardMember.countDocuments({ active: true }),
    Event.countDocuments({ published: true }),
    PaymentSettings.findOne({ key: 'main' }).lean(),
    SiteSettings.findOne({ key: 'main' }).lean(),
  ]);
  const raised = await Promise.all([
    Registration.aggregate<{ t: number }>([{ $match: { status: 'verified' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
    Contribution.aggregate<{ t: number }>([{ $match: { status: 'verified' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
  ]);
  res.json({
    pendingRegs,
    pendingContribs,
    registrations,
    upcoming,
    blogs,
    albums,
    // First-run checklist on the dashboard.
    setup: {
      banners: banners > 0,
      board: board > 0,
      events: events > 0,
      payment: Boolean(pay?.iban && pay.accountName),
      site: Boolean(site?.name?.en && (site.email || site.phone)),
      social: Boolean(site?.facebook || site?.instagram || site?.youtube || site?.whatsapp),
    },
    verifiedTotal: (raised[0][0]?.t ?? 0) + (raised[1][0]?.t ?? 0),
  });
});

// --- Registrations -------------------------------------------------------------------

adminRouter.get('/registrations', async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.event === 'string' && req.query.event) filter.event = req.query.event;
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  res.json(await Registration.find(filter).populate('event', 'title slug').sort({ createdAt: -1 }).lean());
});

/** Spreadsheet apps run text starting with = + - @ as formulas; neutralise attendee-supplied text. */
const csvCell = (v: unknown): string => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

adminRouter.get('/registrations/export', async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.event === 'string' && req.query.event) filter.event = req.query.event;
  const rows = await Registration.find(filter).populate<{ event: { title: { en: string } } }>('event', 'title').sort({ createdAt: 1 }).lean();
  const head = ['Code', 'Event', 'Name', 'Phone', 'Email', 'Attendees', 'Ticket', 'Amount (EUR)', 'Bank reference', 'Status', 'Registered'];
  const lines = rows.map((r) =>
    [r.code, r.event?.title?.en, r.name, r.phone, r.email, r.attendees, r.ticketName, r.amount, r.utr, r.status, (r as { createdAt?: Date }).createdAt?.toISOString()]
      .map(csvCell)
      .join(','),
  );
  res.type('text/csv').attachment('registrations.csv').send([head.map(csvCell).join(','), ...lines].join('\r\n'));
});

adminRouter.patch('/registrations/:id', async (req, res) => {
  const { status } = statusInput.parse(req.body);
  const before = await Registration.findById(req.params.id).lean();
  if (!before) return void res.status(404).json({ error: 'Not found' });
  // Rejecting frees the seats; bringing a rejected registration back must win them again (they may be gone).
  if (before.status !== 'rejected' && status === 'rejected') await releaseSeats(before.event, before.attendees);
  if (before.status === 'rejected' && status !== 'rejected' && !(await reserveSeats(before.event, before.attendees))) {
    return void res.status(409).json({ error: 'Not enough seats are left to restore this registration' });
  }
  const doc = await Registration.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
  if (!doc) return void res.status(404).json({ error: 'Not found' });
  if (status === 'verified' && before?.status !== 'verified' && doc.email) {
    const ev = await Event.findById(doc.event).lean();
    if (ev) void sendMail({ to: doc.email, ...verifiedEmail(doc, ev) });
  }
  res.json(doc);
});

adminRouter.delete('/registrations/:id', async (req, res) => {
  const gone = await Registration.findByIdAndDelete(req.params.id);
  if (gone && gone.status !== 'rejected') await releaseSeats(gone.event, gone.attendees);
  res.json({ ok: true });
});

// --- Contributions -------------------------------------------------------------------

adminRouter.get('/contributions', async (_req, res) => {
  res.json(await Contribution.find().sort({ createdAt: -1 }).lean());
});
adminRouter.patch('/contributions/:id', async (req, res) => {
  const { status } = statusInput.parse(req.body);
  const doc = await Contribution.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
  if (!doc) return void res.status(404).json({ error: 'Not found' });
  res.json(doc);
});
adminRouter.delete('/contributions/:id', async (req, res) => {
  await Contribution.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// --- Admin users (owner only) --------------------------------------------------------

adminRouter.get('/email/status', (_req, res) => res.json(mailStatus()));
adminRouter.post('/email/test', requireOwner, async (req, res) => {
  const { to } = z.object({ to: z.string().trim().email().max(200) }).parse(req.body);
  const result = await sendTestMail({
    to,
    subject: 'Test email from your Sangha website',
    text: ['This is a test message sent from the admin screen.', '', 'If you can read this, registration and payment emails will reach people too.', 'Check that it did not land in the spam folder.'].join('\n'),
  });
  res.status(result.ok ? 200 : 502).json(result);
});
adminRouter.get('/users', requireOwner, async (_req, res) => {
  res.json(await Admin.find().select('-passwordHash').sort({ createdAt: 1 }).lean());
});
adminRouter.post('/users', requireOwner, async (req, res) => {
  const { password, ...rest } = adminUserInput.parse(req.body);
  if (await Admin.exists({ email: rest.email })) return void res.status(409).json({ error: 'That email already has an account' });
  const u = await Admin.create({ ...rest, passwordHash: await hashPassword(password) });
  res.status(201).json({ id: u.id, email: u.email, name: u.name, role: u.role });
});
adminRouter.delete('/users/:id', requireOwner, async (req, res) => {
  if (req.params.id === req.admin!.id) return void res.status(400).json({ error: "You can't delete your own account" });
  await Admin.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
