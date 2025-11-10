type JsonRpcMethod = {
  method: string;
  params?: object;
};

type JsonRpcRequest = {
  jsonrpc: string;
  id?: string;
} & JsonRpcMethod;

type JsonRpcError = {
  code: number;
  message: string;
  data?: object;
};
type JsonRpcResult = object; // let see

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

export class JsonRpcDatasource {
  queue: Array<{
    JsonRpcMethod: JsonRpcMethod;
    onResolve?: (r: JsonRpcResult) => void;
    onReject?: (r: JsonRpcError) => void;
  }> = [];
  processing = false;
  batch_size: number;
  base_url: string;
  constructor(base_url: string, config: JSONRpcBatchConfig = { size: 200, time: 5000 }) {
    this.base_url = base_url;
    this.batch_size = config.size;
  }

  call(JsonRpcMethod: JsonRpcMethod): Promise<JsonRpcError | object> {
    return new Promise<object>((onResolve, onReject) => {
      this.queue.push({ JsonRpcMethod, onResolve, onReject });

      if (!this.processing) this.process();
    });
  }

  process() {
    if (this.processing || this.queue.length == 0) return;

    this.flush();
  }

  private flush() {
    if (this.queue.length > 0) {
      this.processing = true;
      const batch: Array<{
        id: string;
        JsonRpcMethod: JsonRpcMethod;
        onResolve?: (r: JsonRpcResult) => void;
        onReject?: (r: JsonRpcError) => void;
      }> = [];
      while (batch.length < this.batch_size) {
        const x = this.queue.shift();
        if (!x) break;

        batch.push({ ...x, id: batch.length.toString() });
      }
      this.process_batch(batch).then(
        () => this.flush(),
        (failure) => {
          while (failure.batch.length) {
            this.queue.unshift(failure.batch.pop());
          }
          this.processing = false;
          //  \_o_/
          if (failure.retry) setTimeout(() => this.process(), 10000);
        },
      );
    } else this.processing = false;
  }

  private process_batch(
    batch: Array<{
      id: string;
      JsonRpcMethod: JsonRpcMethod;
      onResolve?: (r: JsonRpcResult) => void;
      onReject?: (r: JsonRpcError) => void;
    }>,
  ) {
    return new Promise<{
      batch: Array<{
        id: string;
        JsonRpcMethod: JsonRpcMethod;
        onResolve?: (r: JsonRpcResult) => void;
        onReject?: (r: JsonRpcError) => void;
      }>;
      retry: boolean;
    }>((resolve, reject) => {
      const JsonRpcRequests: JsonRpcRequest[] = batch.map((q) => {
        return {
          ...q.JsonRpcMethod,
          jsonrpc: "2.0",
          id: q.id,
        };
      });

      try {
        fetch(this.base_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(JsonRpcRequests.length == 1 ? JsonRpcRequests[0] : JsonRpcRequests),
        }).then((response) => {
          if (response == undefined) return reject(batch);

          const failed: Array<{
            JsonRpcMethod: JsonRpcMethod;
            onResolve?: (r: JsonRpcResult) => void;
            onReject?: (r: JsonRpcError) => void;
          }> = [];

          response.json().then((body_response: JsonRpcResponse | JsonRpcResponse[]) => {
            let body: JsonRpcResponse[];
            if (body_response.constructor == Array) body = body_response;
            else body = Array(body_response as JsonRpcResponse);

            batch.forEach((methodPromise) => {
              const JsonRpcMethod_res = body.find((c) => {
                return c.id == methodPromise.id;
              });

              if (!JsonRpcMethod_res) return reject(console.error({ JsonRpcMethod_res })); //.?

              if (JsonRpcMethod_res.error) {
                failed.push(methodPromise);
                methodPromise.onReject?.(JsonRpcMethod_res.error);
              } else if (JsonRpcMethod_res.result) {
                methodPromise.onResolve?.(JsonRpcMethod_res.result);
              } else {
                reject(console.error({ JsonRpcMethod_res }));
              }
            });

            if (failed.length) reject({ batch: failed, retry: false });
            else resolve({ batch: [], retry: false });
          }, reject);
        }, reject);
      } catch (rpc_error) {
        console.error({ rpc_error });
        reject({ batch, retry: true });
      }
    });
  }
}
