import { randomBytes } from 'node:crypto';
import { Schema, model, type InferSchemaType } from 'mongoose';

const bi = { en: { type: String, default: '' }, kn: { type: String, default: '' } };
const biField = { type: new Schema(bi, { _id: false }), default: () => ({ en: '', kn: '' }) };
const opts = { timestamps: true } as const;

/** Crockford-ish alphabet: no 0/O/1/I, so a code read over the phone or on a bank statement is unambiguous. */
function makeCode(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return prefix + Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

function slugify(s: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'item';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

const adminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin'], default: 'admin' },
    /** Raised when the password changes: every token issued before that stops working. */
    tokenVersion: { type: Number, default: 0 },
  },
  opts,
);

/** Signed-out tokens, kept only until they would have expired anyway (the TTL index cleans them up). */
const revokedTokenSchema = new Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

const bannerSchema = new Schema(
  {
    title: biField,
    subtitle: biField,
    ctaLabel: biField,
    ctaLink: { type: String, default: '' },
    image: { type: String, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  opts,
);

const notificationSchema = new Schema(
  {
    text: biField,
    link: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  opts,
);

const boardMemberSchema = new Schema(
  {
    name: biField,
    role: biField,
    bio: biField,
    photo: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    term: { type: String, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  opts,
);

const sponsorSchema = new Schema(
  {
    name: { type: String, required: true },
    logo: { type: String, default: '' },
    website: { type: String, default: '' },
    tier: { type: String, enum: ['title', 'gold', 'silver', 'community'], default: 'community' },
    events: [{ type: Schema.Types.ObjectId, ref: 'Event' }],
    note: biField,
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  opts,
);

const eventSchema = new Schema(
  {
    slug: { type: String, unique: true, index: true },
    title: biField,
    description: biField,
    venue: biField,
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, default: null },
    cover: { type: String, default: '' },
    isPaid: { type: Boolean, default: false },
    tickets: [new Schema({ name: String, price: Number }, { _id: false })],
    capacity: { type: Number, default: null },
    /** Seats held by pending and verified registrations (see seats.ts). */
    booked: { type: Number, default: 0 },
    registrationOpen: { type: Boolean, default: true },
    published: { type: Boolean, default: true },
  },
  opts,
);
eventSchema.pre('validate', function () {
  if (!this.slug) this.slug = slugify(this.title?.en || 'event');
});

const blogSchema = new Schema(
  {
    slug: { type: String, unique: true, index: true },
    title: biField,
    excerpt: biField,
    body: biField,
    cover: { type: String, default: '' },
    category: { type: String, default: '' },
    author: { type: String, default: '' },
    published: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
  },
  opts,
);
blogSchema.pre('validate', function () {
  if (!this.slug) this.slug = slugify(this.title?.en || 'post');
});

const albumSchema = new Schema(
  {
    title: biField,
    event: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    cover: { type: String, default: '' },
    images: [new Schema({ url: String, caption: { type: String, default: '' } }, { _id: false })],
    date: { type: Date, default: Date.now },
    published: { type: Boolean, default: true },
  },
  opts,
);

const paymentStatus = { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true };

const registrationSchema = new Schema(
  {
    code: { type: String, unique: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: String,
    phone: String,
    email: { type: String, default: '' },
    attendees: { type: Number, default: 1 },
    ticketName: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    utr: { type: String, default: '' },
    screenshot: { type: String, default: '' },
    status: paymentStatus,
  },
  opts,
);
registrationSchema.pre('validate', function () {
  if (!this.code) this.code = makeCode('KS-');
});

const contributionSchema = new Schema(
  {
    code: { type: String, unique: true, index: true },
    name: String,
    phone: String,
    email: { type: String, default: '' },
    amount: Number,
    message: { type: String, default: '' },
    utr: { type: String, default: '' },
    screenshot: { type: String, default: '' },
    status: paymentStatus,
  },
  opts,
);
contributionSchema.pre('validate', function () {
  if (!this.code) this.code = makeCode('DN-');
});

// Singletons: exactly one document each, keyed so upsert is trivial.
const paymentSettingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    accountName: { type: String, default: '' },
    iban: { type: String, default: '' },
    bic: { type: String, default: '' },
    bankName: { type: String, default: '' },
    epcEnabled: { type: Boolean, default: true },
    weroQr: { type: String, default: '' },
    weroHandle: { type: String, default: '' },
    instructions: biField,
  },
  opts,
);

const siteSettingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    name: biField,
    tagline: biField,
    logo: { type: String, default: '' },
    about: biField,
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: biField,
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    usefulLinks: [new Schema({ label: biField, url: String }, { _id: false })],
    palette: { type: String, enum: ['turmeric', 'silk', 'flag', 'classic'], default: 'turmeric' },
    stats: [new Schema({ value: String, label: biField }, { _id: false })],
    storyImage: { type: String, default: '' },
    bannerDefault: { type: String, default: '' },
    bannerEvents: { type: String, default: '' },
    bannerBlog: { type: String, default: '' },
    bannerGallery: { type: String, default: '' },
    bannerBoard: { type: String, default: '' },
    bannerContribute: { type: String, default: '' },
    bannerContact: { type: String, default: '' },
  },
  opts,
);

const journeySchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    title: biField,
    intro: biField,
    heroImage: { type: String, default: '' },
    numbers: [new Schema({ value: String, label: biField }, { _id: false })],
    chapters: [new Schema({ label: { type: String, default: '' }, heading: biField, body: biField, image: { type: String, default: '' } }, { _id: false })],
    peopleTitle: biField,
    people: [new Schema({ name: String }, { _id: false })],
    credit: biField,
  },
  opts,
);

export const Admin = model('Admin', adminSchema);
export const RevokedToken = model('RevokedToken', revokedTokenSchema);
export const Banner = model('Banner', bannerSchema);
export const Notification = model('Notification', notificationSchema);
export const BoardMember = model('BoardMember', boardMemberSchema);
export const Sponsor = model('Sponsor', sponsorSchema);
export const Event = model('Event', eventSchema);
export const Blog = model('Blog', blogSchema);
export const Album = model('Album', albumSchema);
export const Registration = model('Registration', registrationSchema);
export const Contribution = model('Contribution', contributionSchema);
export const PaymentSettings = model('PaymentSettings', paymentSettingsSchema);
export const JourneyPage = model('JourneyPage', journeySchema);
export const SiteSettings = model('SiteSettings', siteSettingsSchema);

export type EventDoc = InferSchemaType<typeof eventSchema>;
