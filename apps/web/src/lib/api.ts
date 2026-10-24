export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Upload images; `admin` picks the authenticated endpoint (no rate limit) over the public one. */
export async function uploadImages(files: File[], admin: boolean): Promise<string[]> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const res = await fetch(admin ? '/api/admin/upload' : '/api/upload', { method: 'POST', body: form, credentials: 'same-origin' });
  const data = (await res.json().catch(() => null)) as { urls?: string[]; error?: string } | null;
  if (!res.ok || !data?.urls) throw new ApiError(data?.error ?? 'Upload failed', res.status);
  return data.urls;
}
