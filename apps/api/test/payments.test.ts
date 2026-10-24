import { buildEpcPayload, buildIcs, toSepaText, isValidIban, paymentSettingsInput, ticketAmount } from '@sangha/shared';
import { describe, expect, it } from 'vitest';

describe('IBAN validation', () => {
  it('accepts valid IBANs with or without spaces', () => {
    expect(isValidIban('LU28 0019 4006 4475 0000')).toBe(true);
    expect(isValidIban('lu280019400644750000')).toBe(true);
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
  });

  it('rejects a typo, wrong checksum, or junk', () => {
    expect(isValidIban('LU28 0019 4006 4475 0001')).toBe(false);
    expect(isValidIban('LU29 0019 4006 4475 0000')).toBe(false);
    expect(isValidIban('not an iban')).toBe(false);
  });

  it('payment settings normalise the IBAN and refuse an invalid one', () => {
    const ok = paymentSettingsInput.parse({ iban: 'lu28 0019 4006 4475 0000', bic: 'bceelull' });
    expect(ok.iban).toBe('LU280019400644750000');
    expect(ok.bic).toBe('BCEELULL');
    expect(paymentSettingsInput.safeParse({ iban: 'LU28 0019 4006 4475 0001' }).success).toBe(false);
    expect(paymentSettingsInput.safeParse({ iban: '' }).success).toBe(true);
  });
});

describe('EPC QR payload', () => {
  const lines = buildEpcPayload({
    name: 'Kannada Sangha Luxembourg a.s.b.l.',
    iban: 'LU28 0019 4006 4475 0000',
    bic: 'BCEELULL',
    amount: 62.5,
    remittance: 'KS-6M9PHD Rajyotsava',
  }).split('\n');

  it('follows the EPC069-12 line layout', () => {
    expect(lines).toHaveLength(12);
    expect(lines.slice(0, 4)).toEqual(['BCD', '002', '1', 'SCT']);
    expect(lines[4]).toBe('BCEELULL');
    expect(lines[6]).toBe('LU280019400644750000');
    expect(lines[7]).toBe('EUR62.50');
    expect(lines[10]).toBe('KS-6M9PHD Rajyotsava');
  });

  it('leaves the amount blank for an open-amount code and caps field lengths', () => {
    const p = buildEpcPayload({ name: 'x'.repeat(100), iban: 'LU280019400644750000', remittance: 'y'.repeat(300) }).split('\n');
    expect(p[7]).toBe('');
    expect(p[5]).toHaveLength(70);
    expect(p[10]).toHaveLength(140);
  });
});

describe('SEPA character set', () => {
  it('strips accents and drops characters banks do not accept', () => {
    expect(toSepaText('Müller & Café — ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ 🎉')).toBe('Muller & Cafe');
    expect(toSepaText('KS-6M9PHD  Rajyotsava')).toBe('KS-6M9PHD Rajyotsava');
  });

  it('keeps the payment reference even when the event title is entirely non-Latin', () => {
    const lines = buildEpcPayload({ name: 'Sangha', iban: 'LU280019400644750000', amount: 10, remittance: 'KS-6M9PHD ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ' }).split('\n');
    expect(lines[10]).toBe('KS-6M9PHD');
  });
});

describe('ticket amounts', () => {
  it('rounds to whole cents', () => {
    expect(ticketAmount(true, [{ name: 'Child', price: 12.5 }], 0, 3)).toBe(37.5);
    expect(ticketAmount(true, [{ name: 'x', price: 0.1 }], 0, 3)).toBe(0.3);
    expect(ticketAmount(false, [{ name: 'x', price: 10 }], 0, 2)).toBe(0);
  });
});

describe('calendar file', () => {
  const ics = buildIcs({
    uid: 'KS-6M9PHD@sangha',
    title: 'Rajyotsava; music, dance',
    start: new Date('2026-11-13T18:30:00Z'),
    location: 'Hall, Main Road',
    description: 'Line one\nLine two with a long tail ' + 'x'.repeat(120),
  });
  const lines = ics.split('\r\n');

  it('is a valid single-event calendar with UTC times and escaped text', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261113T183000Z');
    expect(lines).toContain('DTEND:20261113T203000Z');
    expect(lines).toContain('SUMMARY:Rajyotsava\\; music\\, dance');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('folds long lines at 75 octets, counting UTF-8 bytes', () => {
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    const kn = buildIcs({ uid: 'u', title: 'ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ '.repeat(8), start: new Date('2026-11-13T18:30:00Z') }).split('\r\n');
    for (const l of kn) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    // Unfolding must give back the original title.
    const unfolded = kn.join('\r\n').replace(/\r\n /g, '');
    expect(unfolded).toContain('SUMMARY:' + 'ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ '.repeat(8));
  });
});

describe('admin password rules', () => {
  it('accepts long, varied passwords and refuses weak ones', async () => {
    const { strongPassword } = await import('@sangha/shared');
    for (const ok of ['a-long-password-1', 'correct horse battery staple', 'Tr0ub4dor&3-and-more', 'ಕನ್ನಡ-ಸಂಘ-2026-xyz']) expect(strongPassword.safeParse(ok).success, ok).toBe(true);
    for (const bad of ['short1!', 'aaaaaaaaaaaa', 'abababababab', 'ChangeMe123!', 'password1234', 'Sangha2026!!', '12345678901234']) {
      expect(strongPassword.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('event time zone (what the admin types is what visitors see)', () => {
  it('reads a typed time as Luxembourg time, winter and summer', async () => {
    const { zonedLocalToIso } = await import('@sangha/shared');
    expect(zonedLocalToIso('2026-11-13T19:00')).toBe('2026-11-13T18:00:00.000Z'); // CET, UTC+1
    expect(zonedLocalToIso('2026-07-01T19:00')).toBe('2026-07-01T17:00:00.000Z'); // CEST, UTC+2
    expect(zonedLocalToIso('2026-12-31T23:30')).toBe('2026-12-31T22:30:00.000Z'); // year boundary
    expect(zonedLocalToIso('2026-11-13T19:00', 'Asia/Kolkata')).toBe('2026-11-13T13:30:00.000Z'); // another zone still works
    expect(zonedLocalToIso('')).toBe('');
    expect(zonedLocalToIso('not a date')).toBe('');
  });

  it('round-trips, so editing an event never moves it', async () => {
    const { isoToZonedLocal, zonedLocalToIso } = await import('@sangha/shared');
    for (const local of ['2026-01-05T00:00', '2026-03-29T12:00', '2026-06-15T18:45', '2026-10-24T23:59', '2027-02-28T09:05']) {
      expect(isoToZonedLocal(zonedLocalToIso(local)), local).toBe(local);
    }
    expect(isoToZonedLocal('2026-11-13T18:00:00.000Z')).toBe('2026-11-13T19:00');
    expect(isoToZonedLocal('garbage')).toBe('');
  });

  it('copes with the clock change: a time that does not exist moves forward, never to a wrong day', async () => {
    const { isoToZonedLocal, zonedLocalToIso } = await import('@sangha/shared');
    // 2027-03-28: clocks go from 02:00 straight to 03:00, so 02:30 does not exist in Luxembourg.
    expect(isoToZonedLocal(zonedLocalToIso('2027-03-28T02:30'))).toMatch(/^2027-03-28T0[23]:30$/);
    expect(isoToZonedLocal(zonedLocalToIso('2027-03-28T12:00'))).toBe('2027-03-28T12:00');
  });
});
