// ---------------------------------------------------------------------------
// jsonrpc.test.ts — JsonRpcDatasource tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JsonRpcDatasource } from "./jsonrpc";

describe("JsonRpcDatasource", () => {
  let rpc: JsonRpcDatasource;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    // Mock fetch so we can control responses
    vi.stubGlobal("fetch", fetchMock);
    rpc = new JsonRpcDatasource("http://test.example/api/rpc");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("debounce behavior", () => {
    it("batches N calls issued synchronously into a single HTTP request", async () => {
      // Mock a successful response
      fetchMock.mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve([
            { jsonrpc: "2.0", id: "0", result: { id: "ann-1" } },
            { jsonrpc: "2.0", id: "1", result: { id: "ann-2" } },
          ]),
      });

      // Issue 3 calls synchronously — they should be debounced into 1 batch
      const p1 = rpc.call({ method: "create", params: { id: "ann-1" } });
      const p2 = rpc.call({ method: "create", params: { id: "ann-2" } });

      // No fetch should have been called yet (debounce timer not fired)
      expect(fetchMock).not.toHaveBeenCalled();

      // Advance past the debounce timeout (15ms)
      await vi.advanceTimersByTimeAsync(20);

      // The fetch should have been called exactly once with both requests
      expect(fetchMock).toHaveBeenCalledOnce();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(Array.isArray(callBody)).toBe(true);
      expect(callBody).toHaveLength(2);
      expect(callBody[0].method).toBe("create");
      expect(callBody[1].method).toBe("create");

      const r1 = await p1;
      const r2 = await p2;
      expect(r1).toEqual({ id: "ann-1" });
      expect(r2).toEqual({ id: "ann-2" });
    });

    it("queues calls issued after a batch is in flight for the next batch", async () => {
      let resolveFirstBatch!: (v: unknown) => void;
      fetchMock.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveFirstBatch = resolve;
        });
      });

      // First batch of calls
      const p1 = rpc.call({ method: "write_shape", params: { annotation_id: "a1", key: "tile-0x0", value: { rle: "A" } } });
      await vi.advanceTimersByTimeAsync(20); // flush the debounce

      // First batch is now in flight (processing = true, fetch was called)
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Issue more calls while the first batch is still in flight
      const p2 = rpc.call({ method: "write_shape", params: { annotation_id: "a1", key: "tile-0x1", value: { rle: "B" } } });
      const p3 = rpc.call({ method: "write_shape", params: { annotation_id: "a1", key: "tile-0x2", value: { rle: "C" } } });

      // Advance time — the debounce timer fires but process() should see
      // processing=true and skip. The second batch should not be sent yet.
      await vi.advanceTimersByTimeAsync(20);
      expect(fetchMock).toHaveBeenCalledTimes(1); // still only the first batch

      // Resolve the first batch
      resolveFirstBatch({
        status: 200,
        json: () =>
          Promise.resolve([
            { jsonrpc: "2.0", id: "0", result: {} },
          ]),
      });
      await vi.advanceTimersByTimeAsync(0);

      // The second batch should now be sent
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const callBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(Array.isArray(callBody)).toBe(true);
      expect(callBody).toHaveLength(2);
    });

    it("does not send a batch when there are no queued items", async () => {
      // Schedule a flush with no calls — should be a no-op
      // This is testing internal behavior: process() returns early
      // We can verify by checking that no fetch was ever called
      await vi.advanceTimersByTimeAsync(100);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not flush when paused", async () => {
      // Drive the RPC into a paused state by sending a request that gets a
      // non-retryable error response (e.g. a server-side validation error).
      fetchMock.mockResolvedValue({
        status: 422,
        json: () => Promise.resolve({ jsonrpc: "2.0", id: "0", error: { code: -32000, message: "Bad request" } }),
      });

      const errorObserver = vi.fn();
      rpc.setErrorObserver(errorObserver);

      // Send a call — it will fail with a non-network error, which pauses immediately
      rpc.call({ method: "create", params: { id: "ann-1" } });
      await vi.advanceTimersByTimeAsync(20); // flush
      await vi.advanceTimersByTimeAsync(0);  // process the failure

      // Confirm we're paused
      expect(rpc.isPaused).toBe(true);
      expect(errorObserver).toHaveBeenCalledOnce();

      // Now issue another call while paused — scheduleFlush should bail out
      // early because this.paused is true, so no fetch should fire.
      fetchMock.mockClear();
      rpc.call({ method: "create", params: { id: "ann-2" } });
      await vi.advanceTimersByTimeAsync(20);

      expect(fetchMock).not.toHaveBeenCalled();

      // Resume — the queued call should now flush
      rpc.resume();
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(rpc.isPaused).toBe(false);
    });
  });

  describe("call method", () => {
    it("queues a method call and resolves with the result", async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ jsonrpc: "2.0", id: "0", result: { id: "ann-1" } }),
      });

      const result = rpc.call({ method: "create", params: { id: "ann-1" } });
      await vi.advanceTimersByTimeAsync(20);

      const res = await result;
      expect(res).toEqual({ id: "ann-1" });
    });
  });
});