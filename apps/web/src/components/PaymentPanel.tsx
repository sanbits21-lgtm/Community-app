import { useMutation, useQuery } from '@tanstack/react-query';
import { buildEpcPayload } from '@sangha/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, uploadImages } from '../lib/api';
import { eur } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { PaymentSettings } from '../lib/types';
import { useToast } from './toast';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label ? `${t('copy')} ${label}` : t('copy')}
      className="min-h-10 shrink-0 rounded-full border-2 border-line px-4 text-sm font-bold hover:bg-saffron/30"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the text is still on screen to copy by hand */
        }
      }}
    >
      {done ? `✓ ${t('copied')}` : t('copy')}
    </button>
  );
}

const groupIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();

/** Label above value, so long IBANs get the full width on a phone instead of being squeezed beside a button. */
function Field({ label, value, copy, mono, big }: { label: string; value: string; copy?: string; mono?: boolean; big?: boolean }) {
  return (
    <div className="border-b border-line py-2.5 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 flex items-center justify-between gap-3">
        <span className={`break-words font-semibold ${mono ? 'font-mono' : ''} ${big ? 'text-xl' : 'text-base'}`}>{value}</span>
        {copy && <CopyButton text={copy} label={label} />}
      </dd>
    </div>
  );
}

interface Props {
  kind: 'registrations' | 'contributions';
  /** Also the payment reference on the bank transfer, so the admin can match it on the statement. */
  code: string;
  amount: number;
  /** Short text added to the transfer message, e.g. the event title. */
  description: string;
  /** Tells the parent which step of the stepper to show. */
  onSent?: () => void;
  onLater?: () => void;
  /** True when the payer gave an email, so we can say the details were emailed. */
  emailed?: boolean;
  /** Where to send people once done (registrations get a status page, contributions go home). */
  doneLink?: { to: string; label: string };
}

/**
 * Step 2 of registering/contributing, laid out for a phone: the reference, amount and IBAN come first with
 * big copy buttons (people usually pay from the same phone, so scanning the screen isn't an option); the QR
 * is for paying from another device. Then Wero, then "I've paid" / "I'll pay later".
 */
export function PaymentStep({ kind, code, amount, description, onSent, onLater, emailed, doneLink }: Props) {
  const { t, L } = useLang();
  const toast = useToast();
  const { data: pay } = useQuery({ queryKey: ['payment'], queryFn: () => api<PaymentSettings>('/payment') });
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [later, setLater] = useState(false);
  const [showQr, setShowQr] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 640px)').matches);
  const sent = useMutation({
    mutationFn: () => api(`/${kind}/${code}/proof`, { method: 'POST', body: { utr, screenshot } }),
    onSuccess: () => onSent?.(),
  });

  const epc = Boolean(pay?.epcEnabled && pay.iban && pay.accountName);
  const wero = Boolean(pay?.weroQr || pay?.weroHandle);
  const reference = code;
  const payload = pay && epc ? buildEpcPayload({ name: pay.accountName, iban: pay.iban, bic: pay.bic, amount, remittance: `${reference} ${description}`.trim() }) : '';
  const link = doneLink ?? { to: '/', label: t('home') };

  const shareDetails = async () => {
    if (!pay) return;
    const text = [pay.accountName, `IBAN ${groupIban(pay.iban)}`, pay.bic && `BIC ${pay.bic}`, `${t('amount')} ${eur(amount)}`, `${t('reference')} ${reference}`].filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: description, text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t('copied'));
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  if (sent.isSuccess) {
    return (
      <div className="card rise space-y-3 p-6 text-center" role="status">
        <p className="text-5xl" aria-hidden="true">🎉</p>
        <h2 className="font-display text-2xl font-extrabold">{t('thanks')}</h2>
        <p className="rounded-xl bg-saffron/25 py-2 font-mono text-2xl font-bold tracking-widest">{code}</p>
        <p className="text-muted">{t('paidThanks')}</p>
        <Link to={link.to} className="btn btn-primary">{link.label}</Link>
      </div>
    );
  }

  if (later) {
    return (
      <div className="card rise space-y-3 p-6 text-center" role="status">
        <p className="text-5xl" aria-hidden="true">🕐</p>
        <h2 className="font-display text-2xl font-extrabold">{t('payLaterTitle')}</h2>
        <p className="text-muted">{t('payLaterBody')}</p>
        <p className="rounded-xl bg-saffron/25 py-2 font-mono text-2xl font-bold tracking-widest">{code}</p>
        <div className="flex justify-center gap-2"><CopyButton text={code} label={t('reference')} /></div>
        {emailed && <p className="text-sm text-muted">{t('emailSent')}</p>}
        <Link to={link.to} className="btn btn-primary">{link.label}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t('payTitle')}</h2>
          <p className="text-lg">
            {t('total')}: <strong className="text-3xl text-accent">{eur(amount)}</strong>
          </p>
          {pay && L(pay.instructions) && <p className="mt-1 text-muted">{L(pay.instructions)}</p>}
          {emailed && <p className="mt-1 text-sm text-muted">{t('emailSent')}</p>}
        </div>

        {epc && pay && (
          <section aria-labelledby="epc-h" className="space-y-3">
            <h3 id="epc-h" className="font-semibold">{t('payBank')}</h3>
            <p className="text-sm text-muted sm:hidden">{t('quickPay')}</p>
            <dl className="rounded-xl bg-soft px-4 py-1">
              <Field label={t('reference')} value={reference} copy={reference} mono big />
              <Field label={t('amount')} value={eur(amount)} copy={amount.toFixed(2)} big />
              <Field label="IBAN" value={groupIban(pay.iban)} copy={pay.iban} mono />
              {pay.bic && <Field label="BIC" value={pay.bic} copy={pay.bic} mono />}
              <Field label={t('beneficiary')} value={pay.accountName} />
            </dl>
            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={shareDetails}>↗ {t('shareDetails')}</button>

            <div>
              <button type="button" className="font-semibold text-accent underline sm:hidden" aria-expanded={showQr} onClick={() => setShowQr((s) => !s)}>
                {showQr ? '▲' : '▼'} {t('showQr')}
              </button>
              {showQr && (
                <figure className="mt-3 text-center">
                  {/* Error-correction M is what the EPC spec asks for; the white tile keeps scanners happy in dark mode. */}
                  <div className="inline-block rounded-xl border-4 border-saffron bg-white p-3">
                    <QRCodeSVG value={payload} size={176} level="M" marginSize={0} title="SEPA payment QR code" />
                  </div>
                  <figcaption className="mx-auto mt-1 max-w-56 text-sm text-muted">{t('scanEpc')}</figcaption>
                </figure>
              )}
            </div>
          </section>
        )}

        {wero && pay && (
          <section aria-labelledby="wero-h" className="space-y-3 border-t border-line pt-4">
            <h3 id="wero-h" className="font-semibold">{t('payWero')}</h3>
            <div className="flex flex-wrap items-center gap-4">
              {pay.weroQr && (
                <div className="rounded-xl border-4 border-saffron bg-white p-2">
                  <img src={pay.weroQr} alt="Wero QR code" className="size-40 object-contain" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                {pay.weroHandle && (
                  <p className="flex items-center gap-2 font-mono text-base font-semibold">
                    {pay.weroHandle}
                    <CopyButton text={pay.weroHandle} />
                  </p>
                )}
                <p className="text-muted">{t('weroNote')} <strong className="font-mono">{reference}</strong></p>
              </div>
            </div>
          </section>
        )}

        {!epc && !wero && <p className="text-muted">{t('noPayment')}</p>}
      </div>

      <div className="card space-y-4 p-5">
        <h3 className="font-semibold">{t('afterPaying')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">{t('proofNumber')}</span>
            <input className="input mt-1 font-mono" value={utr} onChange={(e) => setUtr(e.target.value)} maxLength={40} autoComplete="off" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{t('screenshot')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="input mt-1 py-2"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                setUploadError('');
                try {
                  const [url] = await uploadImages([f], false);
                  if (url) setScreenshot(url);
                } catch (err) {
                  setUploadError(err instanceof Error ? err.message : t('error'));
                } finally {
                  setUploading(false);
                }
              }}
            />
            {uploading && <span className="text-sm text-muted">{t('loading')}</span>}
            {uploadError && <span role="alert" className="text-sm text-accent">{uploadError}</span>}
            {screenshot && !uploading && <span className="text-sm text-green-700 dark:text-green-400">✓</span>}
          </label>
        </div>
        {sent.error && <p role="alert" className="rounded-xl bg-kred/10 p-3 text-accent">{sent.error.message}</p>}
        <button type="button" className="btn btn-primary w-full text-lg" disabled={sent.isPending || uploading} onClick={() => sent.mutate()}>
          {sent.isPending ? t('submitting') : t('iPaid')}
        </button>
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => {
            setLater(true);
            onLater?.();
          }}
        >
          {t('payLater')}
        </button>
        <p className="text-center text-sm text-muted">{t('keepCode')}</p>
      </div>
    </div>
  );
}
