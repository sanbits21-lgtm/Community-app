import { EVENT_TZ, pick, type Bilingual } from '@sangha/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';


export type Lang = 'en' | 'kn';

/** UI strings. Content (events, blogs…) is bilingual in the database; only chrome lives here. */
const STR = {
  home: { en: 'Home', kn: 'ಮುಖಪುಟ' },
  events: { en: 'Events', kn: 'ಕಾರ್ಯಕ್ರಮಗಳು' },
  blog: { en: 'Blog', kn: 'ಬರಹಗಳು' },
  gallery: { en: 'Gallery', kn: 'ಚಿತ್ರಶಾಲೆ' },
  usefulLinks: { en: 'Useful links', kn: 'ಉಪಯುಕ್ತ ಕೊಂಡಿಗಳು' },
  eventSponsors: { en: 'Event sponsors', kn: 'ಕಾರ್ಯಕ್ರಮ ಪ್ರಾಯೋಜಕರು' },
  sponsorsForEvent: { en: 'Supporting this event', kn: 'ಈ ಕಾರ್ಯಕ್ರಮಕ್ಕೆ ಬೆಂಬಲ' },
  sponsors: { en: 'Our sponsors', kn: 'ನಮ್ಮ ಪ್ರಾಯೋಜಕರು' },
  sponsorsThanks: { en: 'Thank you to the businesses and friends who make our events possible.', kn: 'ನಮ್ಮ ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ಸಾಧ್ಯವಾಗಿಸುವ ಸಂಸ್ಥೆಗಳು ಮತ್ತು ಸ್ನೇಹಿತರಿಗೆ ಧನ್ಯವಾದಗಳು.' },
  tier_title: { en: 'Title sponsor', kn: 'ಮುಖ್ಯ ಪ್ರಾಯೋಜಕರು' },
  tier_gold: { en: 'Gold sponsors', kn: 'ಚಿನ್ನದ ಪ್ರಾಯೋಜಕರು' },
  tier_silver: { en: 'Silver sponsors', kn: 'ಬೆಳ್ಳಿ ಪ್ರಾಯೋಜಕರು' },
  tier_community: { en: 'Community partners', kn: 'ಸಮುದಾಯ ಪಾಲುದಾರರು' },
  journey: { en: 'Our journey', kn: 'ನಮ್ಮ ಪಯಣ' },
  journeyPeople: { en: 'Our founders', kn: 'ನಮ್ಮ ಸಂಸ್ಥಾಪಕರು' },
  board: { en: 'Our Board', kn: 'ನಮ್ಮ ಮಂಡಳಿ' },
  contribute: { en: 'Contribute', kn: 'ಕೊಡುಗೆ' },
  contact: { en: 'Contact', kn: 'ಸಂಪರ್ಕ' },
  menu: { en: 'Menu', kn: 'ಪಟ್ಟಿ' },
  whatsNew: { en: "What's new", kn: 'ಹೊಸ ಸೂಚನೆಗಳು' },
  newBadge: { en: 'NEW', kn: 'ಹೊಸ' },
  pinned: { en: 'Pinned', kn: 'ಮುಖ್ಯ' },
  upcoming: { en: 'Upcoming events', kn: 'ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು' },
  past: { en: 'Past events', kn: 'ಹಿಂದಿನ ಕಾರ್ಯಕ್ರಮಗಳು' },
  noEvents: { en: 'No events here yet. Check back soon!', kn: 'ಇನ್ನೂ ಯಾವುದೇ ಕಾರ್ಯಕ್ರಮಗಳಿಲ್ಲ. ಶೀಘ್ರದಲ್ಲೇ ನೋಡಿ!' },
  meetBoard: { en: 'Meet our board', kn: 'ನಮ್ಮ ಮಂಡಳಿಯನ್ನು ಭೇಟಿಯಾಗಿ' },
  boardIntro: { en: 'The volunteers who give their time to keep Kannada alive in our community.', kn: 'ನಮ್ಮ ಸಮುದಾಯದಲ್ಲಿ ಕನ್ನಡವನ್ನು ಜೀವಂತವಾಗಿಡಲು ಸಮಯ ನೀಡುವ ಸ್ವಯಂಸೇವಕರು.' },
  allBoard: { en: 'See the whole board', kn: 'ಎಲ್ಲಾ ಸದಸ್ಯರು' },
  latestBlogs: { en: 'From the blog', kn: 'ಬರಹಗಳಿಂದ' },
  moments: { en: 'Moments we shared', kn: 'ನಾವು ಕಳೆದ ಕ್ಷಣಗಳು' },
  viewAll: { en: 'View all', kn: 'ಎಲ್ಲಾ ನೋಡಿ' },
  readMore: { en: 'Read more', kn: 'ಇನ್ನಷ್ಟು ಓದಿ' },
  register: { en: 'Register', kn: 'ನೋಂದಣಿ' },
  registerNow: { en: 'Register now', kn: 'ಈಗ ನೋಂದಣಿ ಮಾಡಿ' },
  free: { en: 'Free', kn: 'ಉಚಿತ' },
  full: { en: 'Event is full', kn: 'ಸ್ಥಾನಗಳು ಭರ್ತಿ' },
  closed: { en: 'Registration closed', kn: 'ನೋಂದಣಿ ಮುಗಿದಿದೆ' },
  spotsLeft: { en: 'spots left', kn: 'ಸ್ಥಾನಗಳು ಉಳಿದಿವೆ' },
  name: { en: 'Full name', kn: 'ಪೂರ್ಣ ಹೆಸರು' },
  phone: { en: 'Phone', kn: 'ಫೋನ್' },
  email: { en: 'Email (optional)', kn: 'ಇಮೇಲ್ (ಐಚ್ಛಿಕ)' },
  attendees: { en: 'Number of people', kn: 'ಜನರ ಸಂಖ್ಯೆ' },
  ticket: { en: 'Ticket type', kn: 'ಟಿಕೆಟ್ ವಿಧ' },
  total: { en: 'Total', kn: 'ಒಟ್ಟು' },
  payTitle: { en: 'Pay your registration', kn: 'ನಿಮ್ಮ ಪಾವತಿ ಮಾಡಿ' },
  payBank: { en: 'Bank transfer (SEPA) — scan with your banking app', kn: 'ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ (SEPA) — ಬ್ಯಾಂಕಿಂಗ್ ಆ್ಯಪ್‌ನಲ್ಲಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ' },
  scanEpc: { en: 'Scan with your bank app. Amount and reference are filled in.', kn: 'ಬ್ಯಾಂಕ್ ಆ್ಯಪ್‌ನಲ್ಲಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ. ಮೊತ್ತ, ರೆಫರೆನ್ಸ್ ತಾನಾಗಿ ತುಂಬುತ್ತದೆ.' },
  payWero: { en: 'Pay with Wero', kn: 'Wero ಮೂಲಕ ಪಾವತಿಸಿ' },
  weroNote: { en: 'Open Wero, scan or send, and put this reference in the message:', kn: 'Wero ತೆರೆದು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಅಥವಾ ಕಳುಹಿಸಿ, ಸಂದೇಶದಲ್ಲಿ ಈ ರೆಫರೆನ್ಸ್ ಬರೆಯಿರಿ:' },
  beneficiary: { en: 'Beneficiary', kn: 'ಸ್ವೀಕರಿಸುವವರು' },
  reference: { en: 'Reference', kn: 'ರೆಫರೆನ್ಸ್' },
  amount: { en: 'Amount (€)', kn: 'ಮೊತ್ತ (€)' },
  noPayment: { en: 'Payment details have not been set up yet. Please contact us.', kn: 'ಪಾವತಿ ವಿವರಗಳನ್ನು ಇನ್ನೂ ಹೊಂದಿಸಿಲ್ಲ. ದಯವಿಟ್ಟು ಸಂಪರ್ಕಿಸಿ.' },
  afterPaying: { en: 'Done paying? Let us know', kn: 'ಪಾವತಿಸಿದ್ದೀರಾ? ನಮಗೆ ತಿಳಿಸಿ' },
  proofNumber: { en: 'Payment confirmation number (optional)', kn: 'ಪಾವತಿ ದೃಢೀಕರಣ ಸಂಖ್ಯೆ (ಐಚ್ಛಿಕ)' },
  iPaid: { en: "I've made the payment", kn: 'ನಾನು ಪಾವತಿಸಿದ್ದೇನೆ' },
  paidThanks: { en: 'Thank you! We will confirm your payment once it reaches our account.', kn: 'ಧನ್ಯವಾದಗಳು! ಪಾವತಿ ನಮ್ಮ ಖಾತೆಗೆ ತಲುಪಿದ ನಂತರ ದೃಢೀಕರಿಸುತ್ತೇವೆ.' },
  payNextStep: { en: 'On the next step you will get the bank transfer QR code, with this amount and your reference filled in.', kn: 'ಮುಂದಿನ ಹಂತದಲ್ಲಿ ಈ ಮೊತ್ತ ಮತ್ತು ರೆಫರೆನ್ಸ್ ಇರುವ ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ QR ಕೋಡ್ ಸಿಗುತ್ತದೆ.' },
  continuePay: { en: 'Continue to payment', kn: 'ಪಾವತಿಗೆ ಮುಂದುವರಿಯಿರಿ' },
  more: { en: 'More', kn: 'ಇನ್ನಷ್ಟು' },
  textSize: { en: 'Text size', kn: 'ಅಕ್ಷರ ಗಾತ್ರ' },
  nextEvent: { en: 'Next event', kn: 'ಮುಂದಿನ ಕಾರ್ಯಕ್ರಮ' },
  startsIn: { en: 'Starts in', kn: 'ಆರಂಭಕ್ಕೆ' },
  days: { en: 'days', kn: 'ದಿನ' },
  hours: { en: 'hours', kn: 'ಗಂಟೆ' },
  minutes: { en: 'min', kn: 'ನಿಮಿಷ' },
  happeningNow: { en: 'Happening now', kn: 'ಈಗ ನಡೆಯುತ್ತಿದೆ' },
  ourStory: { en: 'Our story', kn: 'ನಮ್ಮ ಕಥೆ' },
  joinTeam: { en: 'Join the team', kn: 'ತಂಡಕ್ಕೆ ಸೇರಿ' },
  joinTeamHint: { en: 'Want to help organise events? We would love to hear from you.', kn: 'ಕಾರ್ಯಕ್ರಮ ಸಂಘಟನೆಗೆ ಸಹಾಯ ಮಾಡಲು ಬಯಸುವಿರಾ? ನಿಮ್ಮಿಂದ ಕೇಳಲು ಖುಷಿ.' },
  readBio: { en: 'About', kn: 'ಪರಿಚಯ' },
  search: { en: 'Search', kn: 'ಹುಡುಕಿ' },
  allYears: { en: 'All years', kn: 'ಎಲ್ಲಾ ವರ್ಷಗಳು' },
  allCategories: { en: 'All categories', kn: 'ಎಲ್ಲಾ ವರ್ಗಗಳು' },
  noMatches: { en: 'Nothing matches your search.', kn: 'ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಹೊಂದುವುದು ಯಾವುದೂ ಇಲ್ಲ.' },
  clearFilters: { en: 'Clear filters', kn: 'ಫಿಲ್ಟರ್ ತೆಗೆಯಿರಿ' },
  noUpcoming: { en: 'No upcoming events right now', kn: 'ಸದ್ಯಕ್ಕೆ ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳಿಲ್ಲ' },
  noUpcomingHint: { en: 'Have a look at what we did before, or follow us to hear first.', kn: 'ಹಿಂದಿನ ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ನೋಡಿ, ಅಥವಾ ಮೊದಲು ತಿಳಿಯಲು ನಮ್ಮನ್ನು ಅನುಸರಿಸಿ.' },
  seePast: { en: 'See past events', kn: 'ಹಿಂದಿನ ಕಾರ್ಯಕ್ರಮಗಳು' },
  fewSpots: { en: 'Few spots left', kn: 'ಕೆಲವೇ ಸ್ಥಾನಗಳು' },
  pastBadge: { en: 'Past', kn: 'ಮುಗಿದಿದೆ' },
  stepDetails: { en: 'Details', kn: 'ವಿವರಗಳು' },
  stepPay: { en: 'Pay', kn: 'ಪಾವತಿ' },
  stepDone: { en: 'Confirmed', kn: 'ದೃಢ' },
  addCalendar: { en: 'Add to calendar', kn: 'ಕ್ಯಾಲೆಂಡರ್‌ಗೆ ಸೇರಿಸಿ' },
  shareWhatsapp: { en: 'Share on WhatsApp', kn: 'WhatsApp ನಲ್ಲಿ ಹಂಚಿ' },
  payLater: { en: "I'll pay later", kn: 'ನಂತರ ಪಾವತಿಸುತ್ತೇನೆ' },
  payLaterTitle: { en: 'Your seat is held', kn: 'ನಿಮ್ಮ ಸ್ಥಾನ ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ' },
  payLaterBody: { en: 'Pay any time with the reference below. Until we receive it, your registration stays pending.', kn: 'ಕೆಳಗಿನ ರೆಫರೆನ್ಸ್‌ನೊಂದಿಗೆ ಯಾವಾಗ ಬೇಕಾದರೂ ಪಾವತಿಸಿ. ನಮಗೆ ತಲುಪುವವರೆಗೆ ನೋಂದಣಿ ಬಾಕಿಯಲ್ಲಿರುತ್ತದೆ.' },
  shareDetails: { en: 'Share payment details', kn: 'ಪಾವತಿ ವಿವರ ಹಂಚಿ' },
  showQr: { en: 'Show QR code', kn: 'QR ಕೋಡ್ ತೋರಿಸಿ' },
  quickPay: { en: 'Pay from this phone: copy the details into your banking app.', kn: 'ಈ ಫೋನ್‌ನಿಂದಲೇ ಪಾವತಿಸಲು: ವಿವರಗಳನ್ನು ನಕಲಿಸಿ ಬ್ಯಾಂಕಿಂಗ್ ಆ್ಯಪ್‌ಗೆ ಹಾಕಿ.' },
  emailSent: { en: 'We also emailed these details to you.', kn: 'ಈ ವಿವರಗಳನ್ನು ನಿಮಗೆ ಇಮೇಲ್ ಕೂಡ ಮಾಡಿದ್ದೇವೆ.' },
  rememberMe: { en: 'Remember my details on this device', kn: 'ಈ ಸಾಧನದಲ್ಲಿ ನನ್ನ ವಿವರಗಳನ್ನು ನೆನಪಿಡಿ' },
  myRegs: { en: 'My registrations', kn: 'ನನ್ನ ನೋಂದಣಿಗಳು' },
  myRegsIntro: { en: 'Your codes, saved on this phone. They open even without internet.', kn: 'ನಿಮ್ಮ ಸಂಖ್ಯೆಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿದಿವೆ. ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದಿದ್ದರೂ ತೆರೆಯುತ್ತವೆ.' },
  myRegsEmpty: { en: 'Nothing saved on this device yet', kn: 'ಈ ಸಾಧನದಲ್ಲಿ ಇನ್ನೂ ಏನೂ ಉಳಿದಿಲ್ಲ' },
  myRegsEmptyHint: { en: 'When you register for an event or contribute from this phone, your code is saved here.', kn: 'ಈ ಫೋನ್‌ನಿಂದ ಕಾರ್ಯಕ್ರಮಕ್ಕೆ ನೋಂದಣಿ ಮಾಡಿದಾಗ ಅಥವಾ ಕೊಡುಗೆ ನೀಡಿದಾಗ, ನಿಮ್ಮ ಸಂಖ್ಯೆ ಇಲ್ಲಿ ಉಳಿಯುತ್ತದೆ.' },
  savedHere: { en: 'Stored only on this device, never shared. Removing it here does not cancel anything.', kn: 'ಈ ಸಾಧನದಲ್ಲಿ ಮಾತ್ರ ಉಳಿದಿದೆ, ಹಂಚಿಕೊಳ್ಳುವುದಿಲ್ಲ. ಇಲ್ಲಿಂದ ತೆಗೆದರೆ ಏನೂ ರದ್ದಾಗುವುದಿಲ್ಲ.' },
  statusNeedsNet: { en: 'Saved · status needs internet', kn: 'ಉಳಿದಿದೆ · ಸ್ಥಿತಿಗೆ ಇಂಟರ್ನೆಟ್ ಬೇಕು' },
  registerLabel: { en: 'Event registration', kn: 'ಕಾರ್ಯಕ್ರಮ ನೋಂದಣಿ' },
  openEvent: { en: 'Open event', kn: 'ಕಾರ್ಯಕ್ರಮ ತೆರೆಯಿರಿ' },
  remove: { en: 'Remove', kn: 'ತೆಗೆಯಿರಿ' },
  offlineBar: { en: "You're offline. Showing saved pages. Registering and paying need internet.", kn: 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ. ಉಳಿಸಿದ ಪುಟಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ. ನೋಂದಣಿ, ಪಾವತಿಗೆ ಇಂಟರ್ನೆಟ್ ಬೇಕು.' },
  installTitle: { en: 'Install the Sangha app', kn: 'ಸಂಘದ ಆ್ಯಪ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ' },
  installBody: { en: 'Add it to your home screen: opens fast, even with a weak signal.', kn: 'ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ: ದುರ್ಬಲ ಸಿಗ್ನಲ್‌ನಲ್ಲೂ ಬೇಗ ತೆರೆಯುತ್ತದೆ.' },
  installIos: { en: 'Tap the Share button, then "Add to Home Screen".', kn: 'ಶೇರ್ ಬಟನ್ ಒತ್ತಿ, ನಂತರ "Add to Home Screen" ಆಯ್ಕೆಮಾಡಿ.' },
  install: { en: 'Install', kn: 'ಇನ್‌ಸ್ಟಾಲ್' },
  notNow: { en: 'Not now', kn: 'ಈಗ ಬೇಡ' },
  updateReady: { en: 'A new version is ready.', kn: 'ಹೊಸ ಆವೃತ್ತಿ ಸಿದ್ಧವಾಗಿದೆ.' },
  refresh: { en: 'Refresh', kn: 'ರಿಫ್ರೆಶ್' },
  demoBanner: { en: 'DEMO SITE · sample content only · payments here are not real', kn: 'ಡೆಮೊ ಸೈಟ್ · ಮಾದರಿ ವಿಷಯ ಮಾತ್ರ · ಇಲ್ಲಿನ ಪಾವತಿಗಳು ನಿಜವಲ್ಲ' },
  copy: { en: 'Copy', kn: 'ನಕಲಿಸಿ' },
  copied: { en: 'Copied', kn: 'ನಕಲಾಯಿತು' },
  screenshot: { en: 'Payment screenshot (optional)', kn: 'ಪಾವತಿ ಸ್ಕ್ರೀನ್‌ಶಾಟ್ (ಐಚ್ಛಿಕ)' },
  submit: { en: 'Submit', kn: 'ಸಲ್ಲಿಸಿ' },
  submitting: { en: 'Submitting…', kn: 'ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…' },
  thanks: { en: 'Thank you!', kn: 'ಧನ್ಯವಾದಗಳು!' },
  yourCode: { en: 'Your registration code', kn: 'ನಿಮ್ಮ ನೋಂದಣಿ ಸಂಖ್ಯೆ' },
  keepCode: { en: 'Save this code. You can check your status with it any time.', kn: 'ಈ ಸಂಖ್ಯೆಯನ್ನು ಉಳಿಸಿಕೊಳ್ಳಿ. ಇದರಿಂದ ಸ್ಥಿತಿ ತಿಳಿಯಬಹುದು.' },
  pending: { en: 'Awaiting payment check', kn: 'ಪಾವತಿ ಪರಿಶೀಲನೆ ಬಾಕಿ' },
  verified: { en: 'Confirmed', kn: 'ಖಚಿತವಾಗಿದೆ' },
  rejected: { en: 'Payment not found', kn: 'ಪಾವತಿ ಸಿಗಲಿಲ್ಲ' },
  checkStatus: { en: 'Check registration status', kn: 'ನೋಂದಣಿ ಸ್ಥಿತಿ ನೋಡಿ' },
  message: { en: 'Message (optional)', kn: 'ಸಂದೇಶ (ಐಚ್ಛಿಕ)' },
  contributeIntro: { en: 'Every rupee keeps our cultural programmes, classes and festivals going.', kn: 'ನಿಮ್ಮ ಪ್ರತಿ ರೂಪಾಯಿ ನಮ್ಮ ಸಾಂಸ್ಕೃತಿಕ ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ನಡೆಸುತ್ತದೆ.' },
  loading: { en: 'Loading…', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…' },
  error: { en: 'Something went wrong. Please try again.', kn: 'ಏನೋ ತಪ್ಪಾಯಿತು. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },
  notFound: { en: 'We could not find that page.', kn: 'ಆ ಪುಟ ಸಿಗಲಿಲ್ಲ.' },
  empty: { en: 'Nothing here yet.', kn: 'ಇನ್ನೂ ಏನೂ ಇಲ್ಲ.' },
  photos: { en: 'photos', kn: 'ಚಿತ್ರಗಳು' },
  back: { en: 'Back', kn: 'ಹಿಂದೆ' },
  when: { en: 'When', kn: 'ಯಾವಾಗ' },
  where: { en: 'Where', kn: 'ಎಲ್ಲಿ' },
  code: { en: 'Code', kn: 'ಸಂಖ್ಯೆ' },
  lookup: { en: 'Look up', kn: 'ಹುಡುಕಿ' },
  namaskara: { en: 'ನಮಸ್ಕಾರ', kn: 'ನಮಸ್ಕಾರ' },
  footerNote: { en: 'Made with love for Kannada.', kn: 'ಕನ್ನಡದ ಪ್ರೀತಿಯೊಂದಿಗೆ.' },
  prev: { en: 'Previous', kn: 'ಹಿಂದಿನ' },
  next: { en: 'Next', kn: 'ಮುಂದಿನ' },
  close: { en: 'Close', kn: 'ಮುಚ್ಚಿ' },
  followUs: { en: 'Follow us', kn: 'ನಮ್ಮನ್ನು ಅನುಸರಿಸಿ' },
  credits: { en: 'Photo credits', kn: 'ಚಿತ್ರ ಕೃಪೆ' },
  creditsIntro: { en: 'Sample photos from Wikimedia Commons, shared under free licenses. Thank you to the photographers.', kn: 'ವಿಕಿಮೀಡಿಯಾ ಕಾಮನ್ಸ್‌ನ ಮಾದರಿ ಚಿತ್ರಗಳು, ಮುಕ್ತ ಪರವಾನಗಿಯಡಿ. ಛಾಯಾಗ್ರಾಹಕರಿಗೆ ಧನ್ಯವಾದಗಳು.' },
  nudi: { en: 'Word of the day', kn: 'ಇಂದಿನ ನುಡಿ' },
} satisfies Record<string, Bilingual>;

export type StrKey = keyof typeof STR;

/** Word of the day: rotates by date, so it needs no admin upkeep. */
export const NUDI: Array<{ kn: string; en: string }> = [
  { kn: 'ನಲ್ಮೆ', en: 'affection, warmth' },
  { kn: 'ಹೆಮ್ಮೆ', en: 'pride' },
  { kn: 'ಬಳಗ', en: 'a circle of kin and friends' },
  { kn: 'ಸೊಗಸು', en: 'elegance, beauty' },
  { kn: 'ನುಡಿ', en: 'language, speech' },
  { kn: 'ಒಲುಮೆ', en: 'love, fondness' },
  { kn: 'ಹಬ್ಬ', en: 'festival' },
  { kn: 'ಒಗ್ಗಟ್ಟು', en: 'unity' },
  { kn: 'ಬೆಳಕು', en: 'light' },
  { kn: 'ತಾಯ್ನುಡಿ', en: 'mother tongue' },
];

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: StrKey) => string;
  /** Pick from a bilingual database field. */
  L: (b: Bilingual | undefined | null) => string;
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  /** 19:30 style, 24-hour as is usual in Luxembourg. */
  time: (iso: string) => string;
}

const LangContext = createContext<Ctx | null>(null);

function readStored(): Lang {
  try {
    return localStorage.getItem('lang') === 'kn' ? 'kn' : 'en';
  } catch {
    return 'en';
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('lang', l);
    } catch {
      /* private mode: the choice just won't persist */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (k) => STR[k][lang],
      L: (b) => pick(b, lang),
      date: (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
        new Date(iso).toLocaleDateString(lang === 'kn' ? 'kn-IN' : 'en-GB', { timeZone: EVENT_TZ, ...opts }),
      time: (iso) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: EVENT_TZ, hour: '2-digit', minute: '2-digit' }),
    }),
    [lang, setLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const c = useContext(LangContext);
  if (!c) throw new Error('useLang outside LangProvider');
  return c;
}
