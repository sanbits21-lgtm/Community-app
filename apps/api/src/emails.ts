import { config } from './config';

interface Pay {
  accountName?: string | null;
  iban?: string | null;
  bic?: string | null;
  epcEnabled?: boolean | null;
}
interface Reg {
  code?: string | null;
  name?: string | null;
  attendees: number;
  amount: number;
  status: string;
}
interface Ev {
  title?: { en?: string | null; kn?: string | null } | null;
  startsAt: Date;
  venue?: { en?: string | null; kn?: string | null } | null;
}

const eur = (n: number) => `EUR ${n.toFixed(2)}`;
const groupIban = (s: string) => s.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

function eventLines(ev: Ev): string[] {
  return [
    `Event: ${ev.title?.en || ev.title?.kn || ''}`,
    `When:  ${ev.startsAt.toUTCString().replace(':00 GMT', ' UTC')}`,
    ...(ev.venue?.en || ev.venue?.kn ? [`Where: ${ev.venue.en || ev.venue.kn}`] : []),
  ];
}

export function registrationEmail(reg: Reg, ev: Ev, pay: Pay) {
  const link = `${config.publicUrl}/registration/${reg.code}`;
  const head = [`Hello ${reg.name ?? ''},`, ''];
  if (reg.amount <= 0 || reg.status === 'verified') {
    return {
      subject: `Registration confirmed ${reg.code}`,
      text: [...head, 'Your registration is confirmed.', '', ...eventLines(ev), `People: ${reg.attendees}`, `Reference: ${reg.code}`, '', `Status: ${link}`].join('\n'),
    };
  }
  const bank =
    pay.iban && pay.epcEnabled !== false
      ? ['', 'Pay by bank transfer (or scan the QR code on the website):', `  Beneficiary: ${pay.accountName ?? ''}`, `  IBAN:        ${groupIban(pay.iban)}`, ...(pay.bic ? [`  BIC:         ${pay.bic}`] : []), `  Amount:      ${eur(reg.amount)}`, `  Reference:   ${reg.code}  <- please include this`]
      : [];
  return {
    subject: `Your registration ${reg.code} — payment details`,
    text: [...head, 'Thank you for registering. Your seat is held until we receive your payment.', '', ...eventLines(ev), `People: ${reg.attendees}`, ...bank, '', `Check your status any time: ${link}`].join('\n'),
  };
}

export function verifiedEmail(reg: Reg, ev: Ev) {
  const link = `${config.publicUrl}/registration/${reg.code}`;
  return {
    subject: `Payment received — registration ${reg.code} confirmed`,
    text: [`Hello ${reg.name ?? ''},`, '', 'We have received your payment. Your registration is confirmed.', '', ...eventLines(ev), `People: ${reg.attendees}`, `Reference: ${reg.code}`, '', `Status: ${link}`].join('\n'),
  };
}

export function contributionEmail(c: { code?: string | null; name?: string | null; amount?: number | null }, pay: Pay) {
  const amount = c.amount ?? 0;
  const bank = pay.iban
    ? ['', 'Pay by bank transfer:', `  Beneficiary: ${pay.accountName ?? ''}`, `  IBAN:        ${groupIban(pay.iban)}`, ...(pay.bic ? [`  BIC:         ${pay.bic}`] : []), `  Amount:      ${eur(amount)}`, `  Reference:   ${c.code}  <- please include this`]
    : [];
  return {
    subject: `Thank you — contribution ${c.code}`,
    text: [`Hello ${c.name ?? ''},`, '', 'Thank you for supporting the Sangha.', ...bank].join('\n'),
  };
}
