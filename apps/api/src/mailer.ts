import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config';

let transport: Transporter | null | undefined;

/** Tests inject a JSON transport; production builds one from SMTP_URL on first use. */
export function setTransport(t: Transporter | null): void {
  transport = t;
}

function getTransport(): Transporter | null {
  if (transport === undefined) transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;
  return transport;
}

/** Fire-and-forget safe: never throws, so a mail outage can't fail a registration. */
export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  const t = getTransport();
  if (!t || !msg.to) return false;
  try {
    await t.sendMail({ from: config.mailFrom, ...msg });
    return true;
  } catch (e) {
    console.error('[mail] send failed:', e instanceof Error ? e.message : e);
    return false;
  }
}

/** What the admin screen may show about the mail setup. Never includes the login or password from SMTP_URL. */
export function mailStatus(): { configured: boolean; host: string; from: string; fromLooksDefault: boolean } {
  let host = '';
  try {
    if (config.smtpUrl) host = new URL(config.smtpUrl).host;
  } catch {
    host = '(SMTP_URL is not a valid address)';
  }
  return { configured: Boolean(config.smtpUrl) || transport != null, host, from: config.mailFrom, fromLooksDefault: /@localhost>?$/.test(config.mailFrom) };
}

/** Like sendMail, but says why it failed so the admin can fix the setup. The error text is shortened and never contains the SMTP password. */
export async function sendTestMail(msg: { to: string; subject: string; text: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = getTransport();
  if (!t) return { ok: false, error: 'No mail server is set up. Add SMTP_URL to the server settings and restart the app.' };
  try {
    await t.sendMail({ from: config.mailFrom, ...msg });
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: raw.replace(/\/\/[^@\s/]+@/g, '//***@').slice(0, 300) };
  }
}
