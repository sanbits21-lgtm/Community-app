import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config';

let transport: Transporter | null | undefined;

/** Tests inject a JSON transport; production builds one from SMTP_URL on first use. */
export function setTransport(t: Transporter | null): void {
  transport = t;
}

/** "Kannada Sangha <hello@x.lu>" -> { name, email }. A bare address works too. */
function parseFrom(from: string): { name?: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return m ? { ...(m[1] ? { name: m[1] } : {}), email: m[2]!.trim() } : { email: from.trim() };
}

/** Sends over HTTPS (port 443) through Brevo's API, shaped like a nodemailer transport so the rest of the code is unchanged. */
function brevoApiTransport(apiKey: string): Transporter {
  return {
    sendMail: async (msg: { from: string; to: string; subject: string; text: string }) => {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: parseFrom(msg.from), to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
      if (!res.ok) throw new Error(`Brevo API ${res.status}: ${body.message ?? 'request refused'}`);
      return { accepted: [msg.to], rejected: [], response: `Brevo API accepted it (id ${body.messageId ?? 'n/a'})` };
    },
  } as unknown as Transporter;
}

function getTransport(): Transporter | null {
  if (transport === undefined) {
    if (config.brevoApiKey) transport = brevoApiTransport(config.brevoApiKey);
    // Short timeouts: a blocked SMTP port must fail in seconds with a message, not hang a request for minutes.
    else if (config.smtpUrl) transport = nodemailer.createTransport({ url: config.smtpUrl, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
    else transport = null;
  }
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
    if (config.brevoApiKey) host = 'api.brevo.com (HTTPS API)';
    else if (config.smtpUrl) host = new URL(config.smtpUrl).host;
  } catch {
    host = '(SMTP_URL is not a valid address)';
  }
  return { configured: Boolean(config.smtpUrl || config.brevoApiKey) || transport != null, host, from: config.mailFrom, fromLooksDefault: /@localhost>?$/.test(config.mailFrom) };
}

/** Like sendMail, but says why it failed so the admin can fix the setup. The error text is shortened and never contains the SMTP password. */
export async function sendTestMail(msg: { to: string; subject: string; text: string }): Promise<{ ok: true; accepted: string[]; rejected: string[]; response: string; server: string } | { ok: false; error: string }> {
  const t = getTransport();
  if (!t) return { ok: false, error: 'No mail server is set up. Add BREVO_API_KEY (or SMTP_URL) to the server settings and restart the app.' };
  try {
    const info = await t.sendMail({ from: config.mailFrom, ...msg });
    // What the mail server actually answered (e.g. "250 OK queued as ..."): proves the hand-off, unlike a bare "sent".
    return { ok: true, accepted: (info?.accepted ?? []).map(String), rejected: (info?.rejected ?? []).map(String), response: String(info?.response ?? '').slice(0, 200), server: mailStatus().host };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const hint = /ETIMEDOUT|ECONNREFUSED|timeout|timed out|ESOCKET/i.test(raw) && !config.brevoApiKey ? ' (The connection to the mail server did not complete. Some hosts, including Render\'s free plan, block SMTP ports: use BREVO_API_KEY instead.)' : '';
    const safe = raw.replace(/\/\/[^@\s/]+@/g, '//***@').replace(/xkeysib-[\w-]+/g, 'xkeysib-***').replace(/xsmtpsib-[\w-]+/g, 'xsmtpsib-***');
    return { ok: false, error: (safe.slice(0, 250) + hint).slice(0, 400) };
  }
}
