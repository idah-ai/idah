import { describe, it, expect } from "vitest";
import { Record, RecordFactory, field, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";
import { IncludeList } from "@/data/model/includes";

@type("test/posts")
class PostRecord extends Record {
  @field() public title!: string;
  @field() public content!: string;
  @field({ transformer: Transformers.Time, key: "created_at" }) public createdAt!: Date;
  @field({ transformer: Transformers.Time, key: "updated_at" }) public updatedAt!: Date;
}

@type("test/users")
class UserRecord extends Record {
  @field() public name!: string;
  @field() public email!: string;
  @field() public age!: number;
  @field({ transformer: Transformers.Time, key: "created_at" }) public createdAt!: Date;
  @field({ transformer: Transformers.Time, key: "updated_at" }) public updatedAt!: Date;

  @relationship() public posts!: PostRecord[];
}
RecordFactory.registerTypes(PostRecord, UserRecord);

describe("Record", () => {
  it("should parse a record", () => {
    const data = {
      type: "test/users",
      id: "1",
      attributes: {
        name: "John Doe",
        email: "admin@example.com",
        age: 42,
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2020-01-01T00:00:00Z"
      }
    };

    const record = new UserRecord(data);

    expect(record.id).toBe("1");
    expect(record.name).toBe("John Doe");
    expect(record.createdAt.constructor).toBe(Date);
  });

  describe("With relationship (array)", () => {
    const data = {
      type: "test/users",
      id: "1",
      attributes: {
        name: "John Doe",
        email: "admin@example.com",
        age: 42,
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2020-01-01T00:00:00Z"
      },
      relationships: {
        posts: {
          data: [
            {
              type: "test/posts",
              id: "1"
            }
          ]
        }
      }
    };

    const included = [
      {
        type: "test/posts",
        id: "1",
        attributes: {
          title: "Hello",
          content: "World",
          created_at: "2020-01-01T00:00:00Z",
          updated_at: "2020-01-01T00:00:00Z"
        }
      }
    ];

    const record = new UserRecord(data, new IncludeList(included));

    it("should parse a record with a relationship", () => {
      expect(record.id).toBe("1");
      expect(record.posts[0].type).toBe("test/posts");
      expect(record.posts[0].title).toBe("Hello");
      expect(record.posts[0].content).toBe("World");
      expect(record.posts[0].createdAt.constructor).toBe(Date);
    });
  });
});
