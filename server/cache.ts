// In-memory TTL cache that also collapses concurrent requests for the same key,
// plus a small concurrency limit so we never hammer the Vahan server.

interface Entry<T> {
  expires: number;
  value: Promise<T>;
}

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries = 200,
  ) {}

  has(key: string): boolean {
    const e = this.entries.get(key);
    return !!e && e.expires > Date.now();
  }

  get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expires > now) return hit.value;

    const value = load();
    this.entries.set(key, { expires: now + this.ttlMs, value });
    value.catch(() => this.entries.delete(key)); // never cache failures
    if (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    return value;
  }
}

export function limit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}
