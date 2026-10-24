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
