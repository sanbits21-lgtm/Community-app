import type { Bilingual } from '@sangha/shared';

/** A registration or contribution the visitor made on this device, kept so its code works with no signal. */
export interface SavedItem {
  kind: 'registration' | 'contribution';
  code: string;
  amount: number;
  /** Registrations only. */
  eventSlug?: string;
  title?: Bilingual;
  venue?: Bilingual;
  startsAt?: string;
  attendees?: number;
  savedAt: string;
}

const KEY = 'my-items';
const MAX = 30;

export function loadSaved(): SavedItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as SavedItem[]).filter((i) => i && typeof i.code === 'string') : [];
  } catch {
    return [];
  }
}

function write(items: SavedItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new Event('sangha-saved-changed'));
  } catch {
    /* private mode or full storage: the code is still shown on screen and in the email */
  }
}

/** Newest first; saving the same code twice just refreshes it. */
export function saveItem(item: SavedItem): void {
  write([item, ...loadSaved().filter((i) => i.code !== item.code)]);
}

export function removeSaved(code: string): void {
  write(loadSaved().filter((i) => i.code !== code));
}
