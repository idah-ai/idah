type JsonRpcMethod = {
  method: string;
  params?: any;
};

type JsonRpcRequest = {
  jsonrpc: string;
  id?: string;
} & JsonRpcMethod;

type JsonRpcError = {
  code: number;
  message: string;
  data?: any;
};
type JsonRpcResult = any; // let see

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
    setInterval(this.process.bind(this), config.time);
  }

  call(JsonRpcMethod: JsonRpcMethod): Promise<JsonRpcError | any> {
    return new Promise<any>((onResolve, onReject) => {
      this.queue.push({ JsonRpcMethod, onResolve, onReject });

      // full batch or wait for interval ?
      if (this.queue.length == this.batch_size) this.process();
      // or not
      // this.process()
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
        let x = this.queue.shift();
        if (!x) break;

        batch.push({ ...x, id: batch.length.toString() });
        // batch.push({ ...x, id: uuidv7() });
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
    }>(async (resolve, reject) => {
      const JsonRpcRequests: JsonRpcRequest[] = batch.map((q) => {
        return {
          ...q.JsonRpcMethod,
          jsonrpc: "2.0",
          id: q.id,
        };
      });

      try {
        let response = await fetch(this.base_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(JsonRpcRequests.length == 1 ? JsonRpcRequests[0] : JsonRpcRequests),
        });

        if (response == undefined) return reject(batch);

        const failed: Array<{
          JsonRpcMethod: JsonRpcMethod;
          onResolve?: (r: JsonRpcResult) => void;
          onReject?: (r: JsonRpcError) => void;
        }> = [];

        let body_response: JsonRpcResponse | JsonRpcResponse[] = await response.json();
        let body: JsonRpcResponse[];
        if (body_response.constructor == Array) body = body_response;
        else body = Array(body_response as JsonRpcResponse);

        batch.forEach((methodPromise) => {
          const JsonRpcMethod_res = body.find((c) => {
            return c.id == methodPromise.id;
          });

          if (!JsonRpcMethod_res) return console.error({ JsonRpcMethod_res }); //.?

          if (JsonRpcMethod_res.error) {
            failed.push(methodPromise);
            methodPromise.onReject?.(JsonRpcMethod_res.error);
          } else {
            methodPromise.onResolve?.(JsonRpcMethod_res.result);
          }
        });

        if (failed.length) reject({ batch: failed, retry: false });
        else resolve({ batch: [], retry: false });
      } catch (error) {
        reject({ batch, retry: true });
      }
    });
  }
}
