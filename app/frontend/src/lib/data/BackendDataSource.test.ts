import { describe, expect, it, vi } from "vitest";
import { createBackendDataSource, encodeModel } from "./BackendDataSource";
import { clearCache } from "./Cache";
import { Record, RecordFactory, field, type } from "./model/Record";

const TransformerTest = {
  from(value: any) {
    return value && value + "from";
  },
  to(value: any) {
    return value && value + "to";
  }
};

@type("test/backend_data_source")
class TestRecord extends Record {
  @field() foo!: string;
  @field() bar!: string;
  @field({ key: "under_score" }) camelCase!: string;
  @field({ transformer: TransformerTest }) transformed!: string;
}

RecordFactory.registerType(TestRecord);

describe(encodeModel, () => {
  it("simple", () => {
    const out = encodeModel(TestRecord, {
      attributes: {
        foo: "bar"
      }
    });
    expect(out).toBe('{"data":{"type":"test/backend_data_source","attributes":{"foo":"bar"}}}');
  });

  it("with transformer", () => {
    const out = encodeModel(TestRecord, {
      attributes: {
        transformed: "bar"
      }
    });
    expect(out).toBe('{"data":{"type":"test/backend_data_source","attributes":{"transformed":"barto"}}}');
  });

  it("with key", () => {
    const out = encodeModel(TestRecord, {
      attributes: {
        camelCase: "bar"
      }
    });
    expect(out).toBe('{"data":{"type":"test/backend_data_source","attributes":{"under_score":"bar"}}}');
  });

  it("with id", () => {
    const out = encodeModel(TestRecord, {
      attributes: {
        id: "1",
        foo: "bar"
      }
    });
    expect(out).toBe('{"data":{"type":"test/backend_data_source","id":"1","attributes":{"foo":"bar"}}}');
  });
});

describe(createBackendDataSource, () => {
  const fetch = vi.fn();
  global.fetch = <any>fetch;

  const ds = createBackendDataSource(TestRecord, "http://example.tld/test_records");

  describe("with custom method", () => {
    const ds = createBackendDataSource(TestRecord, "http://example.tld/test_records", {
      customMethod() {
        return "custom";
      }
    });

    it("simple", () => {
      expect(ds.customMethod()).toBe("custom");
    });
  });

  describe("#get", () => {
    const mockGet = () => {
      fetch.mockResolvedValue({
        body: JSON.stringify({
          data: {
            type: "test/backend_data_source",
            id: "1",
            attributes: {
              foo: "foo1",
              bar: "bar1",
              under_score: "camelCase1",
              transformed: "transformed1"
            }
          }
        }),
        json() {
          return JSON.parse(this.body);
        }
      });
    };

    it("simple", async () => {
      mockGet();
      const result = await ds.get("1");

      expect(result.data.id).toBe("1");
      expect(result.data.foo).toBe("foo1");
      expect(result.data.bar).toBe("bar1");
      expect(result.data.camelCase).toBe("camelCase1");
      expect(result.data.transformed).toBe("transformed1from");
    });
  });

  describe("#list", () => {
    const mockList = () => {
      fetch.mockResolvedValue(
        Response.json({
          data: [
            {
              type: "test/backend_data_source",
              id: "1",
              attributes: {
                foo: "foo1",
                bar: "bar1",
                under_score: "camelCase1",
                transformed: "transformed1"
              }
            },
            {
              type: "test/backend_data_source",
              id: "2",
              attributes: {
                foo: "foo2",
                bar: "bar2",
                under_score: "camelCase2",
                transformed: "transformed2"
              }
            }
          ]
        })
      );
    };

    it("simple", async () => {
      mockList();
      const ds = createBackendDataSource(TestRecord, "http://example.tld/test_records");

      const result = await ds.list();

      expect(result.data.length).toBe(2);
      expect(result.data[0].id).toBe("1");
      expect(result.data[0].foo).toBe("foo1");
      expect(result.data[0].bar).toBe("bar1");
      expect(result.data[0].camelCase).toBe("camelCase1");
      expect(result.data[0].transformed).toBe("transformed1from");

      expect(result.data[1].id).toBe("2");
      expect(result.data[1].foo).toBe("foo2");
      expect(result.data[1].bar).toBe("bar2");
      expect(result.data[1].camelCase).toBe("camelCase2");
      expect(result.data[1].transformed).toBe("transformed2from");
    });

    it("with filter", async () => {
      mockList();

      await ds.list({
        filters: {
          id: "2"
        }
      });

      expect(fetch).toHaveBeenCalledWith("http://example.tld/test_records?filter%5Bid%5D=2", { method: "GET" });
    });

    it("with eq filter", async () => {
      mockList();

      await ds.list({
        filters: {
          id: "2"
        }
      });

      expect(fetch).toHaveBeenCalledWith("http://example.tld/test_records?filter%5Bid%5D=2", { method: "GET" });
    });

    it("with array filter", async () => {
      mockList();

      await ds.list({
        filters: {
          id__in: ["1", "2"]
        }
      });

      expect(fetch).toHaveBeenCalledWith(
        "http://example.tld/test_records?filter%5Bid__in%5D%5B%5D=1&filter%5Bid__in%5D%5B%5D=2",
        { method: "GET" }
      );
    });

    it("with sort", async () => {
      mockList();

      await ds.list({
        sort: ["-id", "foo"]
      });

      expect(fetch).toHaveBeenCalledWith("http://example.tld/test_records?sort=-id%2Cfoo", {
        method: "GET"
      });
    });

    it("loads the requested page with its metadata", async () => {
      const paged = createBackendDataSource(TestRecord, "http://example.tld/paged_records");
      fetch.mockResolvedValueOnce(Response.json({ data: [], meta: { count: 12 } }));

      await expect(paged.list({ pagination: { page: 2, itemsPerPage: 10 }, count: true })).resolves.toEqual({
        data: [],
        meta: { count: 12 }
      });
      const [url] = fetch.mock.lastCall!;
      expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
        "page[number]": "2",
        "page[size]": "10",
        count: "true"
      });
    });

    it.each([
      { status: 404, body: '{"type":"Verse::Error::NotFound"}', message: "HTTP 404" },
      { status: 502, body: "<h1>Bad Gateway</h1>", message: "HTTP 502" },
      { status: 200, body: '{"data":{}}', message: "valid collection" },
      { status: 200, body: '{"data":[null]}', message: "valid collection" },
      { status: 200, body: "<h1>Unexpected HTML</h1>", message: "valid collection" }
    ])("rejects invalid collections ($status $body) and can reload", async ({ status, body, message }) => {
      const collection = createBackendDataSource(TestRecord, "http://example.tld/error_records");
      fetch
        .mockResolvedValueOnce(new Response(body, { status }))
        .mockResolvedValueOnce(Response.json({ data: [], meta: { count: 0 } }));
      const callsBefore = fetch.mock.calls.length;

      await expect(collection.list()).rejects.toThrow(message);
      await expect(collection.list()).resolves.toEqual({ data: [], meta: { count: 0 } });
      await expect(collection.list()).resolves.toEqual({ data: [], meta: { count: 0 } });
      expect(fetch.mock.calls).toHaveLength(callsBefore + 2);
      clearCache(collection.basePath);
    });

    it("preserves JSON:API errors and retries instead of caching them", async () => {
      const collection = createBackendDataSource(TestRecord, "http://example.tld/json_api_errors");
      const errors = [{ status: "502", title: "Bad Gateway" }];
      fetch
        .mockResolvedValueOnce(Response.json({ errors }, { status: 502 }))
        .mockResolvedValueOnce(Response.json({ data: [] }));

      await expect(collection.list()).rejects.toEqual({ status: 502, errors });
      await expect(collection.list()).resolves.toMatchObject({ data: [] });
    });
  });

  describe("#delete", () => {
    it("simple", async () => {
      fetch.mockResolvedValue({ body: "" });
      const result = await ds.delete("1");
      expect(result).toBe(true);
    });
  });

  describe("#update", () => {
    it("simple", async () => {
      fetch.mockResolvedValue({
        body: JSON.stringify({
          data: {
            type: "test/backend_data_source",
            id: "1",
            attributes: {
              foo: "foo1",
              bar: "bar1",
              under_score: "camelCase1",
              transformed: "transformed1"
            }
          }
        }),
        json() {
          return JSON.parse(this.body);
        }
      });

      const result = await ds.update("1", {
        attributes: {
          foo: "bar"
        }
      });
      expect(result.data.id).toBe("1");
    });
  });
});
