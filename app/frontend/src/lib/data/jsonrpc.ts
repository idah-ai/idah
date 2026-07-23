import type { ISyncErrorEvent } from "@/plugin/v2/types";
export type RpcErrorObserver = (err: ISyncErrorEvent) => void;

// ── Internal types ────────────────────────────────────────────────────────

type JsonRpcMethod = {
  method: string;
  params?: object;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string;
} & JsonRpcMethod;

type JsonRpcError = {
  code: number;
  message: string;
  data?: object;
};

type JsonRpcResult = Record<string, unknown> | undefined;

type JsonRpcResponse = {
  jsonrpc: string;
  id: string;
  result?: JsonRpcResult;
  error?: JsonRpcError;
};

type QueueItem = {
  method: JsonRpcMethod;
  onResolve: (r: JsonRpcResult) => void;
};

type BatchItem = QueueItem & { id: string };

type BatchFailure = {
  items: BatchItem[];
  isNetworkError: boolean;
  error?: JsonRpcError;
};

type JSONRpcConfig = {
  batch_size?: number;
  /** Max duration (ms) for which network errors are silently retried before
   *  escalating to a visible sync error (paused + onSyncError). Default: 120_000 (2 min). */
  network_retry_max_duration?: number;
};

// ── Datasource ────────────────────────────────────────────────────────────

export class JsonRpcDatasource {
  private queue: QueueItem[] = [];
  private processing = false;
  private paused = false;
  private flushScheduled = false;

  private failedCount = 0;
  private readonly retry_base_delay = 1000;
  private readonly retry_max_delay = 30000;
  private readonly batch_size: number;
  private readonly network_retry_max_duration: number;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Timestamp (Date.now()) of the first network failure in the current streak. */
  private networkFailureStart: number | null = null;

  /** @internal Test-only accessor — allows tests to observe paused state without exposing internals. */
  get isPaused(): boolean { return this.paused; }

  readonly base_url: string;
  private errorObserver?: RpcErrorObserver;

  constructor(base_url: string, config?: JSONRpcConfig) {
    this.base_url = base_url;
    this.batch_size = config?.batch_size ?? 50;
    this.network_retry_max_duration = config?.network_retry_max_duration ?? 120_000;
  }

  setErrorObserver(fn: RpcErrorObserver): void {
    this.errorObserver = fn;
  }

  resume(): void {
    this.paused = false;
    // Set networkFailureStart so the next network error immediately exceeds the
    // max duration cap — Retry means one attempt, escalate if it fails.
    this.networkFailureStart = Date.now() - this.network_retry_max_duration;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.process();
  }

  call(method: JsonRpcMethod): Promise<JsonRpcResult> {
    return new Promise<JsonRpcResult>((onResolve) => {
      this.queue.push({ method, onResolve });
      this.scheduleFlush();
    });
  }

  private scheduleFlush(): void {
    if (this.processing || this.paused || this.flushScheduled) return;
    this.flushScheduled = true;
    setTimeout(() => {
      this.flushScheduled = false;
      this.process();
    }, 15);
  }

  private process(): void {
    if (this.processing || this.paused || this.queue.length === 0 || this.flushScheduled) return;
    this.flush();
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    // If a retry timer is already pending, don't start another flush.
    if (this.retryTimer !== null) {
      this.processing = false;
      return;
    }

    this.processing = true;

    const batch: BatchItem[] = [];
    while (batch.length < this.batch_size) {
      const item = this.queue.shift();
      if (!item) break;
      batch.push({ ...item, id: String(batch.length) });
    }

    this.process_batch(batch)
      .then(() => {
        this.failedCount = 0;
        this.networkFailureStart = null;
        this.processing = false;
        this.process();
      })
      .catch((failure: BatchFailure) => {
        this.queue.unshift(...failure.items);
        this.processing = false;
        this.failedCount++;
        if (failure.isNetworkError) {
          // Track the start of the current network-failure streak.
          if (this.networkFailureStart === null) {
            this.networkFailureStart = Date.now();
          }

          // If we've been failing for longer than the max duration, escalate.
          const elapsed = Date.now() - this.networkFailureStart;
          if (elapsed >= this.network_retry_max_duration) {
            this.paused = true;
            this.networkFailureStart = null;
            this.errorObserver?.({
              message: "We're having trouble reaching the server.",
              code: "-32001",
              failedCount: this.failedCount,
            });
            return;
          }

          const delay = Math.min(this.retry_base_delay * Math.pow(2, this.failedCount), this.retry_max_delay);
          if (this.retryTimer !== null) {
            clearTimeout(this.retryTimer);
          }

          this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (!this.paused && !this.processing) this.flush();
          }, delay);
        } else {
          this.paused = true;
          this.errorObserver?.({
            message: failure.error?.message ?? "Server rejected the request.",
            code: failure.error?.code.toString(),
            failedCount: this.failedCount,
          });
        }
      });
  }

  private process_batch(batch: BatchItem[]): Promise<void> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<void>(async (resolve, reject: (f: BatchFailure) => void) => {
      const requests: JsonRpcRequest[] = batch.map((item) => ({
        ...item.method,
        jsonrpc: "2.0",
        id: item.id,
      }));

      let response;
      try {
        response = await fetch(this.base_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requests.length === 1 ? requests[0] : requests),
        });
      } catch (err) {
        console.error(err);
        return reject({
          items: batch,
          isNetworkError: true,
        });
      }

      if ([502, 503, 504, 511].includes(response.status)) {
        return reject({
          items: batch,
          isNetworkError: true,
        });
      }

      try {
        const body_response = (await response.json()) as unknown as JsonRpcResponse | JsonRpcResponse[];
        if (!Array.isArray(body_response) && !body_response.id && body_response.error) {
          return reject({ items: batch, isNetworkError: false, error: body_response.error });
        }

        const body: JsonRpcResponse[] = Array.isArray(body_response) ? body_response : [body_response];
        const failed: BatchItem[] = [];
        let representativeError: JsonRpcError | undefined;

        for (const item of batch) {
          const res = body.find((r) => r.id === item.id);
          if (!res) {
            failed.push(item);
          } else if (res.error) {
            failed.push(item);
            representativeError ??= res.error;
          } else {
            item.onResolve(res.result);
          }
        }

        if (failed.length > 0) {
          reject({ items: failed, isNetworkError: false, error: representativeError });
        } else {
          resolve();
        }
      } catch (err) {
        reject({
          items: batch,
          isNetworkError: false,
          error: {
            message: "Error",
            code: -1,
            data: err as object,
          },
        });
      }
    });
  }
}
