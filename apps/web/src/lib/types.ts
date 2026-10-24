import type { Bilingual, PaletteId, SponsorTier, PaymentStatus, TicketType } from '@sangha/shared';

export interface Banner {
  _id: string;
  title: Bilingual;
  subtitle: Bilingual;
  ctaLabel: Bilingual;
  ctaLink: string;
  image: string;
}
export interface Notice {
  _id: string;
  text: Bilingual;
  link: string;
  pinned: boolean;
  createdAt: string;
}
export interface Sponsor {
  _id: string;
  name: string;
  logo: string;
  website: string;
  tier: SponsorTier;
  /** Ids of the events this sponsor supports (empty = the sangha in general). */
  events: string[];
  note: Bilingual;
}

export interface BoardMember {
  _id: string;
  name: Bilingual;
  role: Bilingual;
  bio: Bilingual;
  photo: string;
  email: string;
  phone: string;
  term: string;
}
export interface EventItem {
  /** Only on the single-event page. */
  sponsors?: Sponsor[];
  _id: string;
  slug: string;
  title: Bilingual;
  description: Bilingual;
  venue: Bilingual;
  startsAt: string;
  endsAt: string | null;
  cover: string;
  isPaid: boolean;
  tickets: TicketType[];
  capacity: number | null;
  registrationOpen: boolean;
  spotsLeft?: number | null;
}
export interface BlogPost {
  _id: string;
  slug: string;
  title: Bilingual;
  excerpt: Bilingual;
  body: Bilingual;
  cover: string;
  category: string;
  author: string;
  publishedAt: string;
}
export interface AlbumItem {
  _id: string;
  title: Bilingual;
  cover: string;
  date: string;
  images: { url: string; caption: string }[];
  count?: number;
}
export interface Journey {
  title: Bilingual;
  intro: Bilingual;
  heroImage: string;
  numbers: Array<{ value: string; label: Bilingual }>;
  chapters: Array<{ label: string; heading: Bilingual; body: Bilingual; image: string }>;
  peopleTitle: Bilingual;
  people: Array<{ name: string }>;
  credit: Bilingual;
}

export interface SiteSettings {
  name: Bilingual;
  tagline: Bilingual;
  logo: string;
  about: Bilingual;
  email: string;
  phone: string;
  address: Bilingual;
  facebook: string;
  instagram: string;
  youtube: string;
  whatsapp: string;
  /** The colour theme chosen in the admin (missing on very old data: treat as the default). */
  palette?: PaletteId;
  usefulLinks?: Array<{ label: Bilingual; url: string }>;
  /** True on a demo site (see DEMO_MODE on the server). */
  demo?: boolean;
  stats: { value: string; label: Bilingual }[];
  storyImage: string;
  bannerDefault: string;
  bannerEvents: string;
  bannerBlog: string;
  bannerGallery: string;
  bannerBoard: string;
  bannerContribute: string;
  bannerContact: string;
}
export interface PaymentSettings {
  accountName: string;
  iban: string;
  bic: string;
  bankName: string;
  epcEnabled: boolean;
  weroQr: string;
  weroHandle: string;
  instructions: Bilingual;
}
export interface HomeData {
  banners: Banner[];
  notifications: Notice[];
  events: EventItem[];
  blogs: BlogPost[];
  board: BoardMember[];
  sponsors: Sponsor[];
  albums: AlbumItem[];
  site: SiteSettings;
}
export interface RegistrationStatus {
  code: string;
  name: string;
  attendees: number;
  amount: number;
  status: PaymentStatus;
  event: { title: Bilingual; slug: string; startsAt: string; venue: Bilingual };
}
