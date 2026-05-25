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
};

// ── Datasou`rce ────────────────────────────────────────────────────────────

export class JsonRpcDatasource {
  private queue: QueueItem[] = [];
  private processing = false;
  private paused = false;

  private failedCount = 0;
  private readonly retry_base_delay = 1000;
  private readonly retry_max_delay = 30000;
  private readonly batch_size: number;

  readonly base_url: string;
  private errorObserver?: RpcErrorObserver;

  constructor(base_url: string, config?: JSONRpcConfig) {
    this.base_url = base_url;
    this.batch_size = config?.batch_size ?? 50;
  }

  setErrorObserver(fn: RpcErrorObserver): void {
    this.errorObserver = fn;
  }

  resume(): void {
    this.paused = false;
    this.process();
  }

  call(method: JsonRpcMethod): Promise<JsonRpcResult> {
    return new Promise<JsonRpcResult>((onResolve) => {
      this.queue.push({ method, onResolve });
      this.process();
    });
  }

  private process(): void {
    if (this.processing || this.paused || this.queue.length === 0) return;
    this.flush();
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
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
        this.processing = false;
        this.process();
      }).catch((failure: BatchFailure) => {
        this.queue.unshift(...failure.items);
        this.processing = false;
        this.failedCount++;
        if (failure.isNetworkError) {
          const delay = Math.min(
            this.retry_base_delay * Math.pow(2, this.failedCount),
            this.retry_max_delay,
          );
          setTimeout(() => {
            if (!this.paused && !this.processing) this.flush();
          }, delay);
        } else {
          this.paused = true;
          this.errorObserver?.({
            message: failure.error?.message ?? "Server rejected the request.",
            code: failure.error?.code.toString(),
            failedCount: this.failedCount
          });
        }
      });
  }

  private process_batch(batch: BatchItem[]): Promise<void> {
    return new Promise<void>(async (resolve, reject: (f: BatchFailure) => void) => {
      const requests: JsonRpcRequest[] = batch.map((item) => ({
        ...item.method,
        jsonrpc: "2.0",
        id: item.id,
      }));

      const response = await fetch(this.base_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requests.length === 1 ? requests[0] : requests),
      })
      if ([502, 503, 504, 511].includes(response.status)) {
        return reject({
          items: batch, isNetworkError: true, error: {
            code: response.status,
            message: "Network Issue",
            data: response
        }})
      }

      try {
        const body_response = await response.json() as unknown as JsonRpcResponse | JsonRpcResponse[];
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
          items: batch, isNetworkError: false, error: {
            message: "Error",
            code: -1,
            data: err as any
        }});
      }
    });
  }
}
