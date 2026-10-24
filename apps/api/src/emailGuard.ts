const DAY = 86_400_000;

const PER_ADDRESS = 3; // a person needs one email; a retry or two is fine, a flood to one inbox is abuse
const PER_IP = 40; // a busy shared office/school network, but not a spam run

type Hits = Map<string, number[]>;
const byAddress: Hits = new Map();
const byIp: Hits = new Map();

function take(map: Hits, key: string, limit: number, now: number): boolean {
  const recent = (map.get(key) ?? []).filter((t) => now - t < DAY);
  const ok = recent.length < limit;
  if (ok) recent.push(now);
  map.set(key, recent);
  if (map.size > 5000) for (const [k, v] of map) if (v.every((t) => now - t >= DAY)) map.delete(k); // bounded memory
  return ok;
}

/**
 * Registering needs no account, so anyone could make us email any address. Cap how many messages one address
 * and one visitor can trigger per day. (In memory: right for a single server; resets on restart.)
 */
export function mayEmail(address: string, ip: string, now = Date.now()): boolean {
  return take(byAddress, address.trim().toLowerCase(), PER_ADDRESS, now) && take(byIp, ip, PER_IP, now);
}

export function resetEmailGuard(): void {
  byAddress.clear();
  byIp.clear();
}
