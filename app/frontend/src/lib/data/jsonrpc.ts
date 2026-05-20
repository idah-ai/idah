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

type JSONRpcBatchConfig = {
  size: number;
  time: number;
};

type QueueItem = {
  method: JsonRpcMethod;
  onResolve?: (r: JsonRpcResult) => void;
  onReject?: (e: JsonRpcError) => void;
};

type BatchItem = QueueItem & { id: string };

type BatchFailure = {
  batch: BatchItem[];
  retry: boolean;
};

export class JsonRpcDatasource {
  queue: QueueItem[] = [];
  processing = false;
  batch_size: number;
  base_url: string;
  retry_attempt = 0;
  retry_base_delay: number;
  retry_max_delay: number;

  constructor(base_url: string, config: JSONRpcBatchConfig = { size: 200, time: 5000 }) {
    this.base_url = base_url;
    this.batch_size = config.size;
    this.retry_base_delay = 1000;   // 1 second initial delay
    this.retry_max_delay = 30000;   // 30 seconds max delay
  }

  call(method: JsonRpcMethod): Promise<JsonRpcResult> {
    return new Promise<JsonRpcResult>((onResolve, onReject) => {
      this.queue.push({ method, onResolve, onReject });
      if (!this.processing) this.process();
    });
  }

  process() {
    if (this.processing || this.queue.length === 0 || this.retry_attempt) return;
    this.flush();
  }

  private async flush() {
    if (this.queue.length > 0) {
      this.processing = true;

      const batch: BatchItem[] = [];
      while (batch.length < this.batch_size) {
        const item = this.queue.shift();
        if (!item) break;
        batch.push({ ...item, id: String(batch.length) });
      }

      await this.process_batch(batch)
        .then(async () => {
          this.retry_attempt = 0;
          this.flush();
        })
        .catch((failure: BatchFailure) => {
          this.queue.unshift(...failure.batch);

          this.processing = false;
          if (failure.retry) {
            const delay = Math.min(
              this.retry_base_delay * Math.pow(2, this.retry_attempt),
              this.retry_max_delay
            );
            this.retry_attempt++;
            setTimeout(() => this.flush(), delay);
          }
        });    } else {
      this.processing = false;
    }
  }

  private process_batch(batch: BatchItem[]): Promise<void> {
    return new Promise<void>((resolve, reject: (f: BatchFailure) => void) => {
      const requests: JsonRpcRequest[] = batch.map((item) => ({
        ...item.method,
        jsonrpc: "2.0",
        id: item.id,
      }));

      fetch(this.base_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requests.length === 1 ? requests[0] : requests),
      })
        .then((response) => {
          return response.json()
        })
        .then((body_response: JsonRpcResponse | JsonRpcResponse[]) => {
          const body: JsonRpcResponse[] = Array.isArray(body_response) ? body_response : [body_response];

          for (const item of batch) {
            const res = body.find((r) => r.id === item.id);
            if (!res) {
              // review // authentication error json rpc param issue ? )
              item.onReject?.({ code: -4242, message: "No response found for rpc command" });
            } else if (res.error) {
              item.onReject?.(res.error);
            } else {
              item.onResolve?.(res.result);
            }
          }
          resolve();
        })
        .catch((err: unknown) => {
          console.error("JSON RPC error", err)
          reject({ batch, retry: true });
        });
    });
  }
}
