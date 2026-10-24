import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureOwner } from './auth';
import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { Album, Banner, Blog, BoardMember, Event, JourneyPage, Sponsor, Notification, PaymentSettings, Registration, SiteSettings } from './models';

const day = 24 * 3600 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * day);

/** Photos from Wikimedia Commons (credits in seed-assets/credits.json), copied where uploads are served from. */
const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed-assets');

export function installSeedImages(): void {
  mkdirSync(config.uploadDir, { recursive: true });
  for (const f of readdirSync(ASSETS).filter((n) => n.endsWith('.jpg'))) {
    copyFileSync(path.join(ASSETS, f), path.join(config.uploadDir, `seed-${f}`));
  }
}
const img = (name: string) => `/uploads/seed-${name}.jpg`;


/** Sample "Our journey" page (the KKL story). Edit or replace it in Admin > Our journey. */
export async function seedJourney(): Promise<void> {
  const ch = (label: string, heading: string, body: string) => ({ label, heading: { en: heading, kn: '' }, body: { en: body, kn: '' }, image: '' });
  await JourneyPage.findOneAndUpdate(
    { key: 'main' },
    {
      $set: {
        title: { en: 'KKL Journey', kn: 'ನಮ್ಮ ಪಯಣ' },
        intro: { en: 'The journey of the Kannada Koota Luxembourg Asbl (KKL) non-profit association.', kn: '' },
        numbers: [
          { value: '12', label: { en: 'Founding members', kn: 'ಸಂಸ್ಥಾಪಕ ಸದಸ್ಯರು' } },
          { value: '55', label: { en: 'Active volunteers', kn: 'ಸಕ್ರಿಯ ಸ್ವಯಂಸೇವಕರು' } },
          { value: '18', label: { en: 'Months of growth', kn: 'ತಿಂಗಳ ಬೆಳವಣಿಗೆ' } },
        ],
        chapters: [
          ch('22 Feb 2022', 'A serendipitous gathering', 'Twelve passionate individuals were bound by a shared dream. A small WhatsApp group that began by looking for a sports facility to play cricket and to organise Holi grew into a conversation about a community platform for Kannada speakers in Luxembourg.'),
          ch('13 Mar 2022', 'Hesper Park', 'The group invited friends to meet at Hesper Park one sunny weekend. A casual get-together turned into a robust discussion about their shared identity and the difference they could make together.'),
          ch('Spring 2022', 'Laying the foundation', 'They identified common goals: preserving Kannada language and culture, supporting community members, and taking part in philanthropic activities. The twelve founders decided to formalise the group as a non-profit association, and over the next weeks took care of the legal paperwork, the mission and objectives, and reaching out to the wider community.'),
          ch('18 months of growth', 'Success and growth', 'Community outreach: many cultural events and gatherings brought the community together.\n\nNetworking: collaborations with other non-profits and Kannada associations extended the reach.\n\nMembership grew within the first year.\n\nA group of 55 active volunteers now supports all KKL activities.'),
          ch('Looking forward', 'The road ahead', 'With continued dedication and support, KKL is poised to become an even more influential force in the community, ensuring that Kannada culture flourishes and that its people always have a strong and supportive platform to rely on.'),
        ],
        peopleTitle: { en: 'Our twelve founders', kn: 'ನಮ್ಮ ಹನ್ನೆರಡು ಸಂಸ್ಥಾಪಕರು' },
        people: ['Bhavani Shankar', 'Hitesh Chidgal', 'Karthik Ramamurthy', 'Manjunatha Prasad', 'Niranjan Vishwamurthy', 'Narasimha Hebbar', 'Prashanth Alavandi', 'Prabhu Srinivas', 'Ramesh Panduranga', 'Shashi Balaram', 'Vijay Nagaraj', 'Vinayak Bhat'].map((name) => ({ name })),
        credit: { en: 'Writer: Manjunatha Prasad', kn: '' },
      },
    },
    { upsert: true },
  );
}

/** Sample content so a fresh install looks alive. Re-running replaces it, so edit in the admin screen instead. */
export async function seedSampleContent(): Promise<void> {
  installSeedImages();
  // Registrations point at the events deleted below, so they go too (this is a dev/demo reset).
  await Promise.all([Banner.deleteMany(), Notification.deleteMany(), BoardMember.deleteMany(), Sponsor.deleteMany(), Event.deleteMany(), Blog.deleteMany(), Album.deleteMany(), Registration.deleteMany()]);

  await seedJourney();
  await SiteSettings.findOneAndUpdate(
    { key: 'main' },
    {
      $set: {
        name: { en: 'Kannada Sangha', kn: 'ಕನ್ನಡ ಸಂಘ' },
        tagline: { en: 'Our language, our roots, our people', kn: 'ನಮ್ಮ ನುಡಿ, ನಮ್ಮ ಬೇರು, ನಮ್ಮ ಜನ' },
        about: {
          en: 'A community of Kannadigas who celebrate our language, festivals and culture together — and keep the next generation connected to it.',
          kn: 'ಕನ್ನಡ ನುಡಿ, ಹಬ್ಬ ಹರಿದಿನ ಮತ್ತು ಸಂಸ್ಕೃತಿಯನ್ನು ಒಟ್ಟಿಗೆ ಆಚರಿಸುವ ಕನ್ನಡಿಗರ ಬಳಗ.',
        },
        // Sample numbers: edit or clear these in Admin > Site settings.
        stats: [
          { value: '100+', label: { en: 'Families', kn: 'ಕುಟುಂಬಗಳು' } },
          { value: '12', label: { en: 'Events a year', kn: 'ವಾರ್ಷಿಕ ಕಾರ್ಯಕ್ರಮಗಳು' } },
          { value: '2012', label: { en: 'Since', kn: 'ಸ್ಥಾಪನೆ' } },
        ],
        usefulLinks: [
          { label: { en: 'Indian Consulate Luxembourg', kn: '' }, url: 'https://www.hcgiluxembourg.lu/' },
          { label: { en: 'Embassy of India', kn: '' }, url: 'https://indianembassybrussels.gov.in' },
          { label: { en: 'Government of Karnataka, India', kn: '' }, url: 'https://www.karnataka.gov.in' },
          { label: { en: 'Karnataka Tourism', kn: '' }, url: 'https://karnatakatourism.org/' },
          { label: { en: 'Luxembourg Information', kn: '' }, url: 'https://guichet.public.lu/en/citoyens.html' },
        ],
        storyImage: img('banner-palace'),
        bannerDefault: img('banner-hampi'),
        bannerEvents: img('banner-palace'),
        bannerGallery: img('folk-1'),
        // Placeholders so the footer icons show; replace with the sangha's real pages in Admin > Site settings.
        facebook: 'https://www.facebook.com/',
        instagram: 'https://www.instagram.com/',
        youtube: 'https://www.youtube.com/',
        whatsapp: 'https://wa.me/',
        email: 'hello@sangha.local',
        phone: '+91 98765 43210',
        address: { en: 'Community Hall, Main Road', kn: 'ಸಮುದಾಯ ಭವನ, ಮುಖ್ಯ ರಸ್ತೆ' },
      },
    },
    { upsert: true },
  );

  await PaymentSettings.findOneAndUpdate(
    { key: 'main' },
    {
      $set: {
        // Placeholder account (a valid-format Luxembourg IBAN used in documentation). Replace in Admin > Payment options.
        accountName: config.demoMode ? 'DEMO ONLY - do not pay' : 'Kannada Sangha Luxembourg a.s.b.l.',
        iban: 'LU280019400644750000',
        bic: 'BCEELULL',
        bankName: 'Spuerkeess (BCEE)',
        epcEnabled: true,
        instructions: {
          en: 'Open your banking app and scan the QR code: the amount and reference are filled in for you. Please keep the reference so we can match your payment.',
          kn: 'ನಿಮ್ಮ ಬ್ಯಾಂಕಿಂಗ್ ಆ್ಯಪ್ ತೆರೆದು QR ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ: ಮೊತ್ತ ಮತ್ತು ರೆಫರೆನ್ಸ್ ತಾನಾಗಿಯೇ ತುಂಬುತ್ತದೆ. ಪಾವತಿಯನ್ನು ಹೊಂದಿಸಲು ರೆಫರೆನ್ಸ್ ಉಳಿಸಿ.',
        },
      },
    },
    { upsert: true },
  );

  await Banner.create([
    {
      order: 1,
      title: { en: 'Kannada Rajyotsava 2026', kn: 'ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ ೨೦೨೬' },
      subtitle: { en: 'Join us for an evening of music, dance and food.', kn: 'ಸಂಗೀತ, ನೃತ್ಯ ಮತ್ತು ಊಟದೊಂದಿಗೆ ಸಂಜೆ ಕಳೆಯೋಣ.' },
      ctaLabel: { en: 'Register now', kn: 'ನೋಂದಣಿ ಮಾಡಿ' },
      ctaLink: '/events',
      image: img('banner-rajyotsava'),
    },
    {
      order: 2,
      image: img('banner-palace'),
      title: { en: 'Kannada Kali for Kids', kn: 'ಮಕ್ಕಳಿಗಾಗಿ ಕನ್ನಡ ಕಲಿ' },
      subtitle: { en: 'Saturday classes — read, write and speak Kannada.', kn: 'ಶನಿವಾರದ ತರಗತಿಗಳು — ಕನ್ನಡ ಓದಿ, ಬರೆಯಿರಿ, ಮಾತನಾಡಿ.' },
      ctaLabel: { en: 'Know more', kn: 'ಇನ್ನಷ್ಟು ತಿಳಿಯಿರಿ' },
      ctaLink: '/blog',
    },
    {
      order: 3,
      image: img('banner-hampi'),
      title: { en: 'Support the Sangha', kn: 'ಸಂಘಕ್ಕೆ ಬೆಂಬಲ ನೀಡಿ' },
      subtitle: { en: 'Every contribution keeps our cultural programmes alive.', kn: 'ನಿಮ್ಮ ಕೊಡುಗೆ ನಮ್ಮ ಸಾಂಸ್ಕೃತಿಕ ಕಾರ್ಯಕ್ರಮಗಳಿಗೆ ಜೀವ ನೀಡುತ್ತದೆ.' },
      ctaLabel: { en: 'Contribute', kn: 'ಕೊಡುಗೆ ನೀಡಿ' },
      ctaLink: '/contribute',
    },
  ]);

  await Notification.create([
    { pinned: true, text: { en: 'Rajyotsava registrations are open — limited seats!', kn: 'ರಾಜ್ಯೋತ್ಸವ ನೋಂದಣಿ ಆರಂಭ — ಸೀಮಿತ ಸ್ಥಾನಗಳು!' }, link: '/events' },
    { text: { en: 'New photos from Ugadi are in the gallery.', kn: 'ಯುಗಾದಿ ಹೊಸ ಫೋಟೋಗಳು ಗ್ಯಾಲರಿಯಲ್ಲಿವೆ.' }, link: '/gallery' },
    { text: { en: 'Volunteers needed for the food stall.', kn: 'ಆಹಾರ ಮಳಿಗೆಗೆ ಸ್ವಯಂಸೇವಕರು ಬೇಕಾಗಿದ್ದಾರೆ.' } },
  ]);

  const board: Array<[string, string, string, string]> = [
    ['Ramesh Gowda', 'ರಮೇಶ್ ಗೌಡ', 'President', 'ಅಧ್ಯಕ್ಷರು'],
    ['Savitha Rao', 'ಸವಿತಾ ರಾವ್', 'Vice President', 'ಉಪಾಧ್ಯಕ್ಷರು'],
    ['Mahesh Kumar', 'ಮಹೇಶ್ ಕುಮಾರ್', 'Secretary', 'ಕಾರ್ಯದರ್ಶಿ'],
    ['Anitha Hegde', 'ಅನಿತಾ ಹೆಗಡೆ', 'Treasurer', 'ಖಜಾಂಚಿ'],
    ['Prakash Shetty', 'ಪ್ರಕಾಶ್ ಶೆಟ್ಟಿ', 'Cultural Lead', 'ಸಾಂಸ್ಕೃತಿಕ ಮುಖ್ಯಸ್ಥ'],
    ['Deepa Nayak', 'ದೀಪಾ ನಾಯಕ್', 'Youth Lead', 'ಯುವ ಮುಖ್ಯಸ್ಥೆ'],
  ];
  // Sample sponsors without logos (a name card is shown instead). Replace them in Admin > Sponsors.
  const sponsors: Array<[string, 'title' | 'gold' | 'silver' | 'community', string]> = [
    ['Sample Title Sponsor', 'title', 'Proud supporter of Kannada culture in Luxembourg'],
    ['Sample Gold Sponsor 1', 'gold', ''],
    ['Sample Gold Sponsor 2', 'gold', ''],
    ['Sample Silver Sponsor', 'silver', ''],
    ['Sample Community Partner', 'community', ''],
  ];
  await Sponsor.create(sponsors.map(([name, tier, note], i) => ({ name, tier, note: { en: note, kn: '' }, order: i + 1 })));
  await BoardMember.create(
    board.map(([en, kn, roleEn, roleKn], i) => ({
      order: i + 1,
      term: '2026–28',
      name: { en, kn },
      role: { en: roleEn, kn: roleKn },
      // Sample text: replace in Admin > Board members.
      bio: { en: 'Volunteers for the sangha and helps families feel at home.', kn: 'ಸಂಘದ ಸ್ವಯಂಸೇವಕರು; ಕುಟುಂಬಗಳಿಗೆ ತಮ್ಮ ಮನೆಯ ಅನುಭವ ನೀಡಲು ಸಹಾಯ ಮಾಡುತ್ತಾರೆ.' },
    })),
  );

  await Event.create([
    {
      title: { en: 'Kannada Rajyotsava Celebration', kn: 'ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ ಆಚರಣೆ' },
      description: {
        en: 'An evening of folk music, Yakshagana, children\'s performances and a traditional Karnataka dinner.\n\nBring your family and wear something traditional!',
        kn: 'ಜಾನಪದ ಸಂಗೀತ, ಯಕ್ಷಗಾನ, ಮಕ್ಕಳ ಕಾರ್ಯಕ್ರಮ ಮತ್ತು ಸಾಂಪ್ರದಾಯಿಕ ಕರ್ನಾಟಕ ಊಟ.\n\nಕುಟುಂಬದೊಂದಿಗೆ ಬನ್ನಿ!',
      },
      venue: { en: 'Community Hall, Main Road', kn: 'ಸಮುದಾಯ ಭವನ, ಮುಖ್ಯ ರಸ್ತೆ' },
      startsAt: inDays(21),
      cover: img('event-rajyotsava'),
      isPaid: true,
      tickets: [
        { name: 'Adult', price: 25 },
        { name: 'Child (under 12)', price: 12.5 },
      ],
      capacity: 250,
    },
    {
      title: { en: 'Kannada Kali Orientation', kn: 'ಕನ್ನಡ ಕಲಿ ಪರಿಚಯ' },
      description: { en: 'Free orientation for parents interested in weekend Kannada classes.', kn: 'ವಾರಾಂತ್ಯದ ಕನ್ನಡ ತರಗತಿಗಳ ಬಗ್ಗೆ ಪೋಷಕರಿಗೆ ಉಚಿತ ಪರಿಚಯ.' },
      venue: { en: 'Community Hall, Room 2', kn: 'ಸಮುದಾಯ ಭವನ, ಕೊಠಡಿ ೨' },
      startsAt: inDays(8),
      cover: img('event-kali'),
      isPaid: false,
    },
    {
      title: { en: 'Ugadi Celebration', kn: 'ಯುಗಾದಿ ಆಚರಣೆ' },
      description: { en: 'Bevu-bella, music and a community lunch.', kn: 'ಬೇವು-ಬೆಲ್ಲ, ಸಂಗೀತ ಮತ್ತು ಸಾಮೂಹಿಕ ಊಟ.' },
      venue: { en: 'Community Hall', kn: 'ಸಮುದಾಯ ಭವನ' },
      startsAt: inDays(-200),
      cover: img('event-ugadi'),
      registrationOpen: false,
    },
  ]);

  await Blog.create([
    {
      title: { en: 'Why we celebrate Rajyotsava', kn: 'ನಾವು ರಾಜ್ಯೋತ್ಸವ ಏಕೆ ಆಚರಿಸುತ್ತೇವೆ' },
      excerpt: { en: 'On 1 November 1956 the Kannada-speaking regions came together as one state.', kn: '೧೯೫೬ ನವೆಂಬರ್ ೧ ರಂದು ಕನ್ನಡ ಮಾತನಾಡುವ ಪ್ರದೇಶಗಳು ಒಂದಾದವು.' },
      body: {
        en: 'On 1 November 1956 the Kannada-speaking regions came together as one state.\n\nEvery year we mark the day with flag hoisting, songs and food — and a reminder to speak Kannada at home.',
        kn: '೧೯೫೬ ನವೆಂಬರ್ ೧ ರಂದು ಕನ್ನಡ ಮಾತನಾಡುವ ಪ್ರದೇಶಗಳು ಒಂದೇ ರಾಜ್ಯವಾಗಿ ಒಗ್ಗೂಡಿದವು.',
      },
      cover: img('blog-rajyotsava'),
      category: 'Culture',
      author: 'Mahesh Kumar',
      publishedAt: inDays(-3),
    },
    {
      title: { en: 'Five easy ways to keep kids speaking Kannada', kn: 'ಮಕ್ಕಳು ಕನ್ನಡ ಮಾತನಾಡಲು ಐದು ಸುಲಭ ಮಾರ್ಗಗಳು' },
      excerpt: { en: 'Small habits at home matter more than any class.', kn: 'ಮನೆಯ ಸಣ್ಣ ಅಭ್ಯಾಸಗಳು ತರಗತಿಗಿಂತ ಮುಖ್ಯ.' },
      body: { en: 'Small habits at home matter more than any class.\n\nStart with bedtime stories, songs in the car and a Kannada-only dinner on Sundays.', kn: '' },
      cover: img('blog-kids'),
      category: 'Parenting',
      author: 'Savitha Rao',
      publishedAt: inDays(-12),
    },
  ]);

  await Album.create([
    {
      title: { en: 'Ugadi Celebration', kn: 'ಯುಗಾದಿ ಆಚರಣೆ' },
      date: inDays(-200),
      cover: img('ugadi-1'),
      images: [
        { url: img('ugadi-1'), caption: 'Ugadi thali with mango leaves and bevu-bella' },
        { url: img('ugadi-2'), caption: 'Ugadi pachadi, the six-taste offering' },
        { url: img('event-ugadi'), caption: 'The festival feast' },
      ],
    },
    {
      title: { en: 'Folk Arts of Karnataka', kn: 'ಕರ್ನಾಟಕದ ಜಾನಪದ ಕಲೆಗಳು' },
      date: inDays(-90),
      cover: img('folk-1'),
      images: [
        { url: img('folk-1'), caption: 'Dollu Kunitha drummers' },
        { url: img('folk-2'), caption: 'Dollu Kunitha performance' },
        { url: img('folk-3'), caption: 'Yakshagana performance' },
        { url: img('event-rajyotsava'), caption: 'Folk dance on stage' },
        { url: img('blog-rajyotsava'), caption: 'Mysuru Dasara procession crowds' },
      ],
    },
  ]);
}

/** Dev convenience: a brand-new database gets sample content once; real data is never overwritten. */
export async function seedIfEmpty(): Promise<boolean> {
  const counts = await Promise.all([Banner.countDocuments(), Event.countDocuments(), BoardMember.countDocuments(), Blog.countDocuments()]);
  const empty = counts.every((n) => n === 0);
  if (empty) await seedSampleContent();
  return empty;
}

if (process.argv[1]?.endsWith('seed.ts')) {
  await connectDb();
  await ensureOwner();
  await seedSampleContent();
  console.log('[seed] sample content created');
  await disconnectDb();
}
