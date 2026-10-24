import { z } from 'zod';

/** Every piece of public text is bilingual. Kannada may be empty; the UI falls back to English. */
export const bilingual = z
  .object({
    en: z.string().trim().default(''),
    kn: z.string().trim().default(''),
  })
  .default({ en: '', kn: '' });
export type Bilingual = z.infer<typeof bilingual>;

/** Admin forms send '' for "no date". */
const optionalDate = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.date().nullable(),
);
const requiredDate = z.coerce.date();
// Links and image addresses are shown to every visitor, so only plain web addresses are allowed:
// no javascript:, data: or protocol-relative (//host) forms.
const SAFE_LINK = /^(\/(?!\/)\S*|https?:\/\/\S+)$/i;
const WEB_LINK = /^https?:\/\/\S+$/i;
const safeLink = (max: number) =>
  z.string().trim().max(max).refine((v) => v === '' || SAFE_LINK.test(v), 'Use a full link starting with https:// (or / for a page on this site)').default('');
const webLink = (max: number) => z.string().trim().max(max).refine((v) => v === '' || WEB_LINK.test(v), 'Use a full link starting with https://').default('');
const imageUrl = safeLink(500);

export const bannerInput = z.object({
  title: bilingual,
  subtitle: bilingual,
  ctaLabel: bilingual,
  ctaLink: safeLink(300),
  image: imageUrl,
  order: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
  startsAt: optionalDate.default(null),
  endsAt: optionalDate.default(null),
});

export const notificationInput = z.object({
  text: bilingual,
  link: safeLink(300),
  pinned: z.boolean().default(false),
  active: z.boolean().default(true),
  expiresAt: optionalDate.default(null),
});

export const boardMemberInput = z.object({
  name: bilingual,
  role: bilingual,
  bio: bilingual,
  photo: imageUrl,
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(30).default(''),
  term: z.string().trim().max(40).default(''),
  order: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

/** Sponsor tiers, biggest first. The home page groups sponsors by tier in this order. */
export const SPONSOR_TIERS = ['title', 'gold', 'silver', 'community'] as const;
export type SponsorTier = (typeof SPONSOR_TIERS)[number];

export const sponsorInput = z.object({
  name: z.string().trim().min(1, 'Give the sponsor a name').max(120),
  logo: imageUrl,
  website: webLink(300),
  tier: z.enum(SPONSOR_TIERS).default('community'),
  /** Events this sponsor supports (shown on those event pages and highlighted on the home page). Empty = supports the sangha in general. */
  events: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(100).default([]),
  /** One line shown under the name, e.g. "Bakery in Kirchberg". */
  note: bilingual,
  order: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

export const ticketType = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.coerce.number().min(0).max(1_000_000),
});
export type TicketType = z.infer<typeof ticketType>;

export const eventInput = z.object({
  title: bilingual,
  description: bilingual,
  venue: bilingual,
  startsAt: requiredDate,
  endsAt: optionalDate.default(null),
  cover: imageUrl,
  isPaid: z.boolean().default(false),
  tickets: z.array(ticketType).max(10).default([]),
  capacity: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().min(1).nullable()).default(null),
  registrationOpen: z.boolean().default(true),
  published: z.boolean().default(true),
})
  .superRefine((v, ctx) => {
    if (v.endsAt && v.endsAt.getTime() <= v.startsAt.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end time must be after the start time' });
    }
    // A paid event with nothing to charge would collect "pending EUR 0" registrations that can never be verified.
    if (v.isPaid && !v.tickets.some((t) => t.price > 0)) {
      ctx.addIssue({ code: 'custom', path: ['tickets'], message: 'A paid event needs at least one ticket type with a price above 0' });
    }
  });

export const blogInput = z.object({
  title: bilingual,
  excerpt: bilingual,
  /** Plain text; blank lines separate paragraphs. */
  body: bilingual,
  cover: imageUrl,
  category: z.string().trim().max(60).default(''),
  author: z.string().trim().max(80).default(''),
  published: z.boolean().default(true),
  publishedAt: requiredDate.default(() => new Date()),
});

export const albumImage = z.object({
  url: z.string().trim().min(1).max(500).refine((v) => SAFE_LINK.test(v), 'Not a valid image address'),
  caption: z.string().trim().max(200).default(''),
});
export const albumInput = z.object({
  title: bilingual,
  event: z.preprocess((v) => (v === '' ? null : v), z.string().nullable()).default(null),
  cover: imageUrl,
  images: z.array(albumImage).max(300).default([]),
  date: requiredDate.default(() => new Date()),
  published: z.boolean().default(true),
});

/** IBAN checksum (ISO 13616 mod 97). Catches typos before they end up in a QR code people pay into. */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= 'A' ? ch.charCodeAt(0) - 55 : Number(ch);
    rem = Number(String(rem) + String(v)) % 97;
  }
  return rem === 1;
}

const ibanField = z
  .string()
  .default('')
  .transform((s) => s.replace(/\s/g, '').toUpperCase())
  .refine((s) => s === '' || isValidIban(s), 'That IBAN is not valid — check for a typo');
const bicField = z
  .string()
  .default('')
  .transform((s) => s.replace(/\s/g, '').toUpperCase())
  .refine((s) => /^([A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?)?$/.test(s), 'A BIC is 8 or 11 letters/digits');

export const paymentSettingsInput = z.object({
  accountName: z.string().trim().max(70).default(''),
  iban: ibanField,
  bic: bicField,
  bankName: z.string().trim().max(100).default(''),
  /** Turn the generated SEPA (EPC) QR off, e.g. while the account is being set up. */
  epcEnabled: z.boolean().default(true),
  /** Static Wero QR image and/or the Wero phone number/handle people can pay. Both optional. */
  weroQr: imageUrl,
  weroHandle: z.string().trim().max(100).default(''),
  instructions: bilingual,
});

/** The "Our journey" page: a timeline of chapters, a numbered list of people (e.g. founders) and a few numbers. All optional. */
export const journeyInput = z.object({
  title: bilingual,
  intro: bilingual,
  heroImage: imageUrl,
  numbers: z.array(z.object({ value: z.string().trim().min(1).max(20), label: bilingual })).max(4).default([]),
  chapters: z
    .array(
      z.object({
        /** Short date or period shown on a yellow tag, e.g. "22 Feb 2022". */
        label: z.string().trim().max(60).default(''),
        heading: bilingual,
        body: bilingual,
        image: imageUrl,
      }),
    )
    .max(40)
    .default([]),
  peopleTitle: bilingual,
  people: z.array(z.object({ name: z.string().trim().min(1).max(100) })).max(100).default([]),
  /** Small line at the end, e.g. "Written by ...". */
  credit: bilingual,
});
export type JourneyInput = z.infer<typeof journeyInput>;

/** Colour themes the admin can choose (the colours themselves live in apps/web/src/index.css). */
export const PALETTE_IDS = ['turmeric', 'silk', 'flag', 'classic'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export const siteSettingsInput = z.object({
  palette: z.enum(PALETTE_IDS).default('turmeric'),
  name: bilingual,
  tagline: bilingual,
  logo: imageUrl,
  about: bilingual,
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(30).default(''),
  address: bilingual,
  facebook: webLink(300),
  instagram: webLink(300),
  youtube: webLink(300),
  whatsapp: webLink(300),
  /** Footer "Useful links" (embassy, government, tourism...). Shown on every page. */
  usefulLinks: z
    .array(z.object({ label: bilingual.refine((l) => Boolean(l.en || l.kn), 'Give the link a name'), url: webLink(300).refine((v) => v !== '', 'Add the full link, starting with https://') }))
    .max(12)
    .default([]),
  /** Page-header background images. A page without its own falls back to bannerDefault, then to plain white. */
  /** Home-page "numbers" strip, e.g. 120+ / Families. Up to 4. */
  stats: z.array(z.object({ value: z.string().trim().min(1).max(20), label: bilingual })).max(4).default([]),
  /** Photo beside the About text in the home-page "Our story" block. */
  storyImage: imageUrl,
  bannerDefault: imageUrl,
  bannerEvents: imageUrl,
  bannerBlog: imageUrl,
  bannerGallery: imageUrl,
  bannerBoard: imageUrl,
  bannerContribute: imageUrl,
  bannerContact: imageUrl,
});

const payerFields = {
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number'),
  email: z.union([z.literal(''), z.string().trim().email().max(200)]).default(''),
};

export const registrationInput = z.object({
  ...payerFields,
  attendees: z.coerce.number().int().min(1).max(20).default(1),
  /** Index into event.tickets; ignored for free events. */
  ticketIndex: z.coerce.number().int().min(0).default(0),
  /** Honeypot: hidden from people, filled in by form-filling bots. Anything in here means "not a person". */
  website: z.string().max(200).optional(),
});

export const contributionInput = z.object({
  ...payerFields,
  amount: z.coerce.number().min(1).max(100_000).transform((n) => Math.round(n * 100) / 100),
  message: z.string().trim().max(500).default(''),
  website: z.string().max(200).optional(),
});

/** Sent after the payer has made the transfer. The bank statement (matched by code) is the real proof. */
export const proofInput = z.object({
  utr: z.string().trim().max(40).default(''),
  // Only a file we stored privately (see uploads.ts); never an arbitrary address a payer typed in.
  screenshot: z.string().max(100).refine((v) => v === '' || /^\/api\/admin\/proofs\/[0-9a-f]{24}\.(jpg|png|webp|gif)$/.test(v), 'Not a valid uploaded screenshot').default(''),
});

export const PAYMENT_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const statusInput = z.object({ status: z.enum(PAYMENT_STATUSES) });

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
const EASY_WORDS = ['password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'changeme', 'admin', 'iloveyou', 'abc123', 'sangha', 'kannada', 'karnataka', 'bangalore', 'luxembourg'];

/**
 * Admin passwords: long, not a few repeated characters, and not an easy word with a little decoration.
 * (Length matters far more than symbols, so we ask for length and refuse the obvious.)
 */
export const strongPassword = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200)
  .refine((p) => new Set(p).size >= 5, 'Use a wider mix of characters')
  .refine((p) => !/^\d+$/.test(p), 'Add some letters: numbers alone are too easy to guess')
  .refine((p) => {
    const lower = p.toLowerCase();
    return !EASY_WORDS.some((w) => lower.includes(w) && lower.length - w.length < 8);
  }, 'That password is too easy to guess');

export const changePasswordInput = z.object({
  current: z.string().min(1).max(200),
  next: strongPassword,
});

export const adminUserInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(80),
  password: strongPassword,
  role: z.enum(['owner', 'admin']).default('admin'),
});

/** Pick the requested language, falling back to the other so a missing translation is never blank. */
export function pick(text: Bilingual | undefined | null, lang: 'en' | 'kn'): string {
  if (!text) return '';
  return (lang === 'kn' ? text.kn || text.en : text.en || text.kn) ?? '';
}

export function ticketAmount(isPaid: boolean, tickets: TicketType[], ticketIndex: number, attendees: number): number {
  if (!isPaid) return 0;
  const t = tickets[ticketIndex] ?? tickets[0];
  return Math.round((t?.price ?? 0) * attendees * 100) / 100;
}

export const CURRENCY = 'EUR';

/** Every event time is entered and shown in the sangha's own time zone, whatever zone the viewer's device is in. */
export const EVENT_TZ = 'Europe/Luxembourg';

/** How many minutes the zone is ahead of UTC at a given instant (60 in winter, 120 in summer for Luxembourg). */
function zoneOffsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wallAsUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return (wallAsUtc - Math.floor(utcMs / 1000) * 1000) / 60_000;
}

/** A date-picker value like "2026-11-13T19:00", read as a wall-clock time in `tz`, as the real instant (ISO, UTC). */
export function zonedLocalToIso(local: string, tz: string = EVENT_TZ): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return '';
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  let utc = wall - zoneOffsetMinutes(wall, tz) * 60_000;
  utc = wall - zoneOffsetMinutes(utc, tz) * 60_000; // second pass: the offset can differ right at a clock change
  return new Date(utc).toISOString();
}

/** The reverse: an instant as the "2026-11-13T19:00" wall-clock text a date picker needs. */
export function isoToZonedLocal(iso: string, tz: string = EVENT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}

/**
 * SEPA payment text is restricted to a Latin character set; banks reject or garble anything else
 * (Kannada, Devanagari, emoji). Accents are stripped (Müller -> Muller) and the rest is dropped.
 */
export function toSepaText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9 /\-?:().,'+&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * EPC QR ("GiroCode") payload for a SEPA credit transfer, per EPC069-12: banking apps that scan it
 * pre-fill beneficiary, IBAN, amount and reference. Lines are fixed-position, so blanks must stay.
 */
export function buildEpcPayload(p: { name: string; iban: string; bic?: string; amount?: number; remittance: string }): string {
  const amount = p.amount && p.amount > 0 ? `EUR${p.amount.toFixed(2)}` : '';
  return [
    'BCD', // service tag
    '002', // version 2: BIC optional inside the EEA
    '1', // UTF-8
    'SCT', // SEPA credit transfer
    (p.bic ?? '').replace(/\s/g, ''),
    toSepaText(p.name).slice(0, 70),
    p.iban.replace(/\s/g, '').toUpperCase(),
    amount,
    '', // purpose code
    '', // structured reference (unused: we use the free-text line)
    toSepaText(p.remittance).slice(0, 140),
    '', // beneficiary-to-originator note
  ].join('\n');
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545: lines are at most 75 octets; continuation lines start with one space. Counts UTF-8 bytes, not characters. */
function icsFold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) {
      out.push(cur);
      cur = ` ${ch}`;
      bytes = 1 + b;
    } else {
      cur += ch;
      bytes += b;
    }
  }
  out.push(cur);
  return out.join('\r\n');
}

/** A single-event .ics file that Apple/Google/Outlook calendars all import. */
export function buildIcs(e: { uid: string; title: string; start: Date; end?: Date | null; location?: string; description?: string; url?: string }): string {
  const end = e.end ?? new Date(e.start.getTime() + 2 * 3600 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kannada Sangha//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
