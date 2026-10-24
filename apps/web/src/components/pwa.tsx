import { useEffect, useState } from 'react';
import { useLang } from '../lib/i18n';
import { useToast } from './toast';

/** Chrome/Edge/Android fire this when the site is installable; it isn't in the standard DOM typings. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const safe = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

const isStandalone = () =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Safari on iPhone/iPad: no install event exists, so we can only explain the manual steps. */
const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

/** Registers the service worker (production builds only) and offers "Refresh" when a new version is waiting. */
export function PwaBoot() {
  const { t } = useLang();
  const toast = useToast();

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const offer = (worker: ServiceWorker) =>
          toast(t('updateReady'), { label: t('refresh'), run: () => worker.postMessage({ type: 'SKIP_WAITING' }) });
        // A worker already waiting from a previous visit, or one that finishes installing while the page is open.
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) offer(next);
          });
        });
      })
      .catch(() => {
        /* the site works fine without a service worker */
      });

    // Only reload after the visitor accepted the update (the new worker took over).
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register once; strings are read when the toast shows
  }, []);

  return null;
}

/** A thin bar above the header while the phone has no connection. */
export function OfflineBar() {
  const { t } = useLang();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="bg-neutral-900 px-4 py-1.5 text-center text-sm font-semibold text-white">
      <span aria-hidden="true">📡</span> {t('offlineBar')}
    </div>
  );
}

const VISITS_NEEDED = 3;
const SNOOZE_DAYS = 30;

/**
 * "Install the app" card. Shown only after a few visits (nobody installs on first sight), never inside the
 * installed app, and not again for 30 days after "Not now".
 */
export function InstallPrompt() {
  const { t } = useLang();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visits, setVisits] = useState(0);
  const [snoozed, setSnoozed] = useState(() => {
    const at = Number(safe.get('install-dismissed-at'));
    return at > 0 && Date.now() - at < SNOOZE_DAYS * 86_400_000;
  });
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Count a visit once per browser session, not once per page view.
    try {
      if (!sessionStorage.getItem('visit-counted')) {
        sessionStorage.setItem('visit-counted', '1');
        safe.set('visits', String(Number(safe.get('visits') ?? 0) + 1));
      }
    } catch {
      /* private mode: never prompts, which is fine */
    }
    setVisits(Number(safe.get('visits') ?? 0));

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button instead of the browser's mini-bar
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ios = isIosSafari();
  if (installed || snoozed || isStandalone() || visits < VISITS_NEEDED || (!deferred && !ios)) return null;

  const dismiss = () => {
    safe.set('install-dismissed-at', String(Date.now()));
    setSnoozed(true);
  };

  return (
    <aside
      aria-label={t('installTitle')}
      className="card rise fixed inset-x-3 bottom-20 z-40 flex items-start gap-3 p-4 shadow-xl md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-saffron font-display text-2xl text-neutral-900" aria-hidden="true">ಕ</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t('installTitle')}</p>
        <p className="text-sm text-muted">{deferred ? t('installBody') : t('installIos')}</p>
        <div className="mt-2 flex gap-2">
          {deferred && (
            <button
              type="button"
              className="btn btn-primary min-h-10 px-4 text-sm"
              onClick={async () => {
                await deferred.prompt();
                const { outcome } = await deferred.userChoice;
                setDeferred(null);
                if (outcome === 'dismissed') dismiss();
              }}
            >
              {t('install')}
            </button>
          )}
          <button type="button" className="btn btn-ghost min-h-10 px-4 text-sm" onClick={dismiss}>
            {t('notNow')}
          </button>
        </div>
      </div>
    </aside>
  );
}
