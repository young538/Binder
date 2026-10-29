export interface ResourceSnapshot<T> {
  value?: T;
  loading: boolean;
  error: unknown;
}

/** Owns one view's asynchronous read; older requests cannot replace newer results. */
export class AsyncResource<T> {
  private state: ResourceSnapshot<T> = { loading: true, error: null };
  private version = 0;
  private listeners = new Set<() => void>();

  constructor(readonly key: string) { }

  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(state: ResourceSnapshot<T>) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }

  async load(read: () => Promise<T>, showLoading = false): Promise<void> {
    const version = ++this.version;
    this.publish({ ...this.state, loading: showLoading || this.state.value === undefined, error: null });
    try {
      const value = await read();
      if (version === this.version) this.publish({ value, loading: false, error: null });
    } catch (error) {
      if (version === this.version) this.publish({ ...this.state, loading: false, error });
    }
  }

  set(value: T) {
    this.cancel();
    this.publish({ value, loading: false, error: null });
  }

  cancel() { this.version++; }
}
