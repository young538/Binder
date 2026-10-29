export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** One writer per record. A failed request retains its patch beneath newer edits. */
export class AutosaveQueue<T> {
  private pending: T | undefined;
  private active: T | undefined;
  private running: Promise<void> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  status: SaveStatus = 'idle';

  constructor(
    private save: (patch: T) => Promise<unknown>,
    private merge: (previous: T, next: T) => T,
    private persist: (draft: T | undefined) => void = () => {},
    private delayMs = 1000,
  ) {}

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  draft(): T | undefined {
    if (this.active === undefined) return this.pending;
    return this.pending === undefined ? this.active : this.merge(this.active, this.pending);
  }

  private publish(status: SaveStatus) {
    this.status = status;
    this.persist(this.draft());
    this.listeners.forEach(listener => listener());
  }

  enqueue(patch: T) {
    this.pending = this.pending === undefined ? patch : this.merge(this.pending, patch);
    clearTimeout(this.timer);
    this.publish(this.running ? 'saving' : 'pending');
    this.timer = setTimeout(() => { void this.flush(); }, this.delayMs);
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (this.pending === undefined) return Promise.resolve();
    // Start in a microtask so running is assigned before callbacks can enqueue.
    this.running = Promise.resolve().then(async () => {
      while (this.pending !== undefined) {
        const patch = this.pending;
        this.pending = undefined;
        this.active = patch;
        this.publish('saving');
        try {
          await this.save(patch);
        } catch {
          this.pending = this.pending === undefined ? patch : this.merge(patch, this.pending);
          this.active = undefined;
          clearTimeout(this.timer);
          this.publish('error');
          return;
        }
        this.active = undefined;
      }
      this.publish('saved');
    }).finally(() => { this.running = undefined; });
    return this.running;
  }
}
