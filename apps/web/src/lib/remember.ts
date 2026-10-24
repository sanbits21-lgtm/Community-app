export interface Attendee {
  name: string;
  phone: string;
  email: string;
}

const KEY = 'attendee';

/** Saved only on this device, only if the person ticked "remember me". Never sent anywhere. */
export function loadAttendee(): Attendee | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Attendee>;
    return { name: String(v.name ?? ''), phone: String(v.phone ?? ''), email: String(v.email ?? '') };
  } catch {
    return null;
  }
}

export function saveAttendee(a: Attendee | null): void {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: just won't be remembered */
  }
}
