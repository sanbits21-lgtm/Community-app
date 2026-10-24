import { EVENT_TZ } from '@sangha/shared';
import type { Doc, Field } from './fields';

export interface ResourceConfig {
  path: string;
  title: string;
  singular: string;
  fields: Field[];
  /** What to show in the list row. */
  summary: (d: Doc) => { title: string; sub?: string; image?: string; badges?: string[] };
  blank: () => Doc;
  /** Lists with an `order` field get up/down buttons. */
  orderable?: boolean;
  /** Shows a live preview of the draft above the form. */
  preview?: 'banner';
}

const bi = () => ({ en: '', kn: '' });
const name = (b?: { en?: string; kn?: string }) => b?.en || b?.kn || '(untitled)';
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: EVENT_TZ, dateStyle: 'medium', timeStyle: 'short' }) : '');

export const RESOURCES: Record<string, ResourceConfig> = {
  banners: {
    path: 'banners',
    title: 'Home banners',
    singular: 'banner',
    orderable: true,
    preview: 'banner',
    fields: [
      { key: 'title', label: 'Headline', type: 'bi' },
      { key: 'subtitle', label: 'Sub-text', type: 'bi' },
      { key: 'image', label: 'Background image', type: 'image', help: 'Wide photos (1600×700 or larger) look best. Leave empty for the patterned default.' },
      { key: 'ctaLabel', label: 'Button text', type: 'bi', help: 'Leave empty for no button.' },
      { key: 'ctaLink', label: 'Button link', type: 'text', placeholder: '/events  or  https://…' },
      { key: 'startsAt', label: 'Show from', type: 'datetime', help: 'Optional.' },
      { key: 'endsAt', label: 'Show until', type: 'datetime', help: 'Optional. The banner hides itself afterwards.' },
      { key: 'active', label: 'Active', type: 'bool' },
    ],
    summary: (d) => ({ title: name(d.title), sub: name(d.subtitle), image: d.image, badges: d.active ? [] : ['Hidden'] }),
    blank: () => ({ title: bi(), subtitle: bi(), ctaLabel: bi(), ctaLink: '', image: '', order: 99, active: true, startsAt: '', endsAt: '' }),
  },
  notifications: {
    path: 'notifications',
    title: 'Notifications',
    singular: 'notification',
    fields: [
      { key: 'text', label: 'Message', type: 'bi' },
      { key: 'link', label: 'Link', type: 'text', placeholder: '/events  or  https://…' },
      { key: 'pinned', label: 'Pin to top', type: 'bool' },
      { key: 'expiresAt', label: 'Expires', type: 'datetime', help: 'Optional. Disappears from the home page afterwards.' },
      { key: 'active', label: 'Active', type: 'bool' },
    ],
    summary: (d) => ({ title: name(d.text), sub: d.expiresAt ? `Expires ${dt(d.expiresAt)}` : '', badges: [d.pinned && 'Pinned', !d.active && 'Hidden'].filter(Boolean) as string[] }),
    blank: () => ({ text: bi(), link: '', pinned: false, active: true, expiresAt: '' }),
  },
  board: {
    path: 'board',
    title: 'Board members',
    singular: 'board member',
    orderable: true,
    fields: [
      { key: 'name', label: 'Name', type: 'bi' },
      { key: 'role', label: 'Role', type: 'bi', help: 'e.g. President / ಅಧ್ಯಕ್ಷರು. The first member in the list is featured on the home page.' },
      { key: 'photo', label: 'Photo', type: 'image', help: 'Square photos work best. Initials are shown if empty.' },
      { key: 'term', label: 'Term', type: 'text', placeholder: '2026–28' },
      { key: 'bio', label: 'Short bio', type: 'bitext' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'active', label: 'Show on website', type: 'bool' },
    ],
    summary: (d) => ({ title: name(d.name), sub: name(d.role), image: d.photo, badges: d.active ? [] : ['Hidden'] }),
    blank: () => ({ name: bi(), role: bi(), bio: bi(), photo: '', email: '', phone: '', term: '', order: 99, active: true }),
  },
  sponsors: {
    path: 'sponsors',
    title: 'Sponsors',
    singular: 'sponsor',
    orderable: true,
    fields: [
      { key: 'name', label: 'Sponsor name', type: 'text' },
      { key: 'logo', label: 'Logo', type: 'image', help: 'A wide logo on a plain or transparent background works best. The name is shown if there is no logo.' },
      { key: 'website', label: 'Website (optional)', type: 'text', placeholder: 'https://', help: 'The logo links here (opens in a new tab).' },
      {
        key: 'tier',
        label: 'Tier',
        type: 'select',
        options: [['title', 'Title sponsor (largest)'], ['gold', 'Gold'], ['silver', 'Silver'], ['community', 'Community partner']],
        help: 'Sponsors are grouped by tier on the home page; bigger tiers get bigger logos. Use the up/down buttons for the order inside a tier.',
      },
      { key: 'events', label: 'Events this sponsor supports', type: 'eventrefs', help: 'Tick events to show this sponsor on their event page and highlight it on the home page while that event is next. Leave all unticked for a general sponsor.' },
      { key: 'active', label: 'Show on website', type: 'bool' },
    ],
    summary: (d) => ({ title: d.name || '(unnamed)', sub: String(d.tier), image: d.logo, badges: d.active ? [] : ['Hidden'] }),
    blank: () => ({ name: '', logo: '', website: '', tier: 'community', events: [], note: bi(), order: 99, active: true }),
  },
  events: {
    path: 'events',
    title: 'Events',
    singular: 'event',
    fields: [
      { key: 'title', label: 'Title', type: 'bi' },
      { key: 'startsAt', label: 'Starts', type: 'datetime' },
      { key: 'endsAt', label: 'Ends', type: 'datetime' },
      { key: 'venue', label: 'Venue', type: 'bi' },
      { key: 'cover', label: 'Cover image', type: 'image' },
      { key: 'description', label: 'Description', type: 'bitext', help: 'Blank lines separate paragraphs.' },
      { key: 'isPaid', label: 'Paid event', type: 'bool', help: 'Attendees get a bank-transfer QR (and Wero) with the amount and their registration code as the reference.' },
      { key: 'tickets', label: 'Ticket types & prices', type: 'tickets', help: 'Only used for paid events.' },
      { key: 'capacity', label: 'Capacity (people)', type: 'number', help: 'Leave empty for unlimited.' },
      { key: 'registrationOpen', label: 'Registration open', type: 'bool' },
      { key: 'published', label: 'Published', type: 'bool' },
    ],
    summary: (d) => ({ title: name(d.title), sub: dt(d.startsAt), image: d.cover, badges: [d.isPaid ? 'Paid' : 'Free', !d.published && 'Draft'].filter(Boolean) as string[] }),
    blank: () => ({ title: bi(), description: bi(), venue: bi(), startsAt: '', endsAt: '', cover: '', isPaid: false, tickets: [], capacity: '', registrationOpen: true, published: true }),
  },
  blogs: {
    path: 'blogs',
    title: 'Blog posts',
    singular: 'post',
    fields: [
      { key: 'title', label: 'Title', type: 'bi' },
      { key: 'excerpt', label: 'Summary', type: 'bi' },
      { key: 'cover', label: 'Cover image', type: 'image' },
      { key: 'body', label: 'Article', type: 'bitext', help: 'Plain text. A blank line starts a new paragraph.' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'publishedAt', label: 'Publish date', type: 'datetime', help: 'A future date schedules the post.' },
      { key: 'published', label: 'Published', type: 'bool' },
    ],
    summary: (d) => ({ title: name(d.title), sub: `${d.category || 'No category'} · ${dt(d.publishedAt)}`, image: d.cover, badges: d.published ? [] : ['Draft'] }),
    blank: () => ({ title: bi(), excerpt: bi(), body: bi(), cover: '', category: '', author: '', published: true, publishedAt: new Date().toISOString() }),
  },
  albums: {
    path: 'albums',
    title: 'Gallery albums',
    singular: 'album',
    fields: [
      { key: 'title', label: 'Album title', type: 'bi' },
      { key: 'event', label: 'Linked event', type: 'eventref' },
      { key: 'date', label: 'Date', type: 'datetime' },
      { key: 'cover', label: 'Cover image', type: 'image', help: 'Defaults to the first photo.' },
      { key: 'images', label: 'Photos', type: 'images' },
      { key: 'published', label: 'Published', type: 'bool' },
    ],
    summary: (d) => ({ title: name(d.title), sub: `${(d.images ?? []).length} photos · ${dt(d.date)}`, image: d.cover || d.images?.[0]?.url, badges: d.published ? [] : ['Draft'] }),
    blank: () => ({ title: bi(), event: '', cover: '', images: [], date: new Date().toISOString(), published: true }),
  },
};

export const PAYMENT_FIELDS: Field[] = [
  { key: 'accountName', label: 'Account holder (beneficiary)', type: 'text', help: 'Exactly as on the bank account, up to 70 characters.' },
  { key: 'iban', label: 'IBAN', type: 'text', placeholder: 'LU28 0019 4006 4475 0000', help: 'Checked for typos when you save. The SEPA (EPC) QR code is generated from this.' },
  { key: 'bic', label: 'BIC (optional)', type: 'text', help: 'Not needed for payments inside the euro area.' },
  { key: 'bankName', label: 'Bank name', type: 'text' },
  { key: 'epcEnabled', label: 'Show the SEPA bank-transfer QR code', type: 'bool', help: 'Amount and registration code are filled in automatically.' },
  { key: 'weroQr', label: 'Wero QR code (optional)', type: 'image', help: 'Upload the QR image from your Wero / bank app. It does not carry the amount, so payers are told to add their reference.' },
  { key: 'weroHandle', label: 'Wero phone number / handle (optional)', type: 'text' },
  { key: 'instructions', label: 'Instructions shown to payers', type: 'bitext' },
];

export const JOURNEY_FIELDS: Field[] = [
  { key: 'title', label: 'Page title', type: 'bi', help: 'Leave empty to use "Our journey".' },
  { key: 'intro', label: 'Short introduction (under the title)', type: 'bi' },
  { key: 'heroImage', label: 'Header picture', type: 'image', help: 'Optional. Without one the page uses the default page banner.' },
  { key: 'numbers', label: 'Numbers strip', type: 'stats', help: 'Up to 4, e.g. 12 Founders, 55 Volunteers. Leave empty to hide.' },
  { key: 'chapters', label: 'Chapters (the timeline)', type: 'chapters', help: 'Each chapter has a date tag, a heading, text and an optional picture. They appear in this order.' },
  { key: 'peopleTitle', label: 'Heading for the list of people', type: 'bi', help: 'For example "Our founders". Leave empty to use that.' },
  { key: 'people', label: 'People (numbered list)', type: 'names', help: 'One name per row, e.g. the founding members.' },
  { key: 'credit', label: 'Line at the end', type: 'bi', help: 'For example "Written by ...".' },
];

export const SITE_FIELDS: Field[] = [
  { key: 'palette', label: 'Colour theme', type: 'palette', help: 'Changes the whole site in light and dark mode. Pick one to preview it right here, then press Save to publish it.' },
  { key: 'name', label: 'Sangha name', type: 'bi' },
  { key: 'tagline', label: 'Tagline', type: 'bi' },
  { key: 'logo', label: 'Logo', type: 'image' },
  { key: 'about', label: 'About / Our story', type: 'bitext', help: 'Shown in the "Our story" block on the home page.' },
  { key: 'storyImage', label: 'Our story photo', type: 'image', help: 'A real photo of your community works best.' },
  { key: 'stats', label: 'Numbers strip (home page)', type: 'stats', help: 'Up to 4 short facts, e.g. 120+ Families. Leave empty to hide the strip.' },
  { key: 'usefulLinks', label: 'Useful links (footer)', type: 'links', help: 'Shown in the footer of every page, e.g. the embassy or the government. Opens in a new tab. Up to 12.' },
  { key: 'address', label: 'Address', type: 'bi' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'facebook', label: 'Facebook URL', type: 'text' },
  { key: 'instagram', label: 'Instagram URL', type: 'text' },
  { key: 'youtube', label: 'YouTube URL', type: 'text' },
  { key: 'whatsapp', label: 'WhatsApp group/chat URL', type: 'text' },
  { key: 'bannerDefault', label: 'Page banner — default image', type: 'image', help: 'Shown behind the title of every page that has no image of its own. Leave empty for a plain white header. Wide images (1600×500+) work best.' },
  { key: 'bannerEvents', label: 'Page banner — Events', type: 'image', help: 'Optional. Overrides the default on the Events pages.' },
  { key: 'bannerBlog', label: 'Page banner — Blog', type: 'image' },
  { key: 'bannerGallery', label: 'Page banner — Gallery', type: 'image' },
  { key: 'bannerBoard', label: 'Page banner — Our Board', type: 'image' },
  { key: 'bannerContribute', label: 'Page banner — Contribute', type: 'image' },
  { key: 'bannerContact', label: 'Page banner — Contact', type: 'image' },
];
