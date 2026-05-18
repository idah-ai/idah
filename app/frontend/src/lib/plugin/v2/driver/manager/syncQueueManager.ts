import type { ISyncErrorEvent, ISyncEvent } from "../../types";

export class SyncQueueManager {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private onSyncChange: (event: ISyncEvent) => void;
  private onSyncError: (event: ISyncErrorEvent) => void;

  constructor(onSyncChange: (event: ISyncEvent) => void, onSyncError: (event: ISyncErrorEvent) => void) {
    this.onSyncChange = onSyncChange;
    this.onSyncError = onSyncError;
  }

  enqueue(op: () => Promise<void>): void {
    this.queue.push(op);
    this.onSyncChange({ queued: this.queue.length });
    if (!this.processing) this.processNext();
  }

  flush(): void {
    if (!this.processing) this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;
    const op = this.queue.shift()!;
    try {
      await op();
      this.onSyncChange({ queued: this.queue.length });
      this.processNext();
    } catch (err) {
      console.error("[IdahDriverV2] sync error:", err);
      this.queue.unshift(op);
      this.onSyncError(err as ISyncErrorEvent);
    } finally {
      this.processing = false;
    }
  }
}
