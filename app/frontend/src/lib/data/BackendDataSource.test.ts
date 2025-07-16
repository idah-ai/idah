import { describe, expect, it, vi } from "vitest";
import { createBackendDataSource, encodeModel } from "./BackendDataSource";
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
      fetch.mockResolvedValue({
        body: JSON.stringify({
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
        }),
        json() {
          return JSON.parse(this.body);
        }
      });
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
