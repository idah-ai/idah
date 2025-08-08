import { describe, it, expect } from "vitest";
import { Record, RecordFactory, field, relationship, type } from "./model/Record";
import { belongsTo, createMemoryDataSource, hasMany, hasOne, type MemoryDataSource } from "./MemoryDataSource";

// Create a complex example to test all inclusions rules.

@type("test/users")
class UserRecord extends Record {
  @field() name!: string;

  @relationship() posts!: PostRecord[];
  @relationship() comments!: CommentRecord[];
  @relationship() userInfos!: UserInfoRecord;
}

@type("test/user_infos")
class UserInfoRecord extends Record {
  @field() description!: string;

  @relationship() user!: UserRecord;
}

@type("test/posts")
class PostRecord extends Record {
  @field() title!: string;
  @field() body!: string;

  @relationship() author!: UserRecord;
  @relationship() comments!: CommentRecord[];
  @relationship() category!: CategoryRecord;
}

@type("test/comments")
class CommentRecord extends Record {
  @field() body!: string;

  @relationship() post!: PostRecord;
  @relationship() author!: UserRecord;
}

@type("test/categories")
class CategoryRecord extends Record {
  @field() name!: string;

  @relationship() posts!: PostRecord[];
}

RecordFactory.registerTypes(PostRecord, UserRecord, CommentRecord, CategoryRecord, UserInfoRecord);

const makeDataSources = () => {
  const users = createMemoryDataSource(UserRecord, {
    delay: 0,
    initialData: [
      { id: "101", name: "John" },
      { id: "102", name: "Jane" },
      { id: "103", name: "Jack" },
      { id: "104", name: "Jill" },
      { id: "105", name: "Jim" }
    ],
    customMethods: {
      someExample: async () => {
        return "example";
      }
    }
  });

  const userInfos = createMemoryDataSource(UserInfoRecord, {
    delay: 0,
    initialData: [
      { id: "201", description: "Description 1", user_id: "101" },
      { id: "202", description: "Description 2", user_id: "102" }
    ],
    relations: {
      user: belongsTo(users, "user_id")
    }
  });

  users.relations["userInfos"] = hasOne(userInfos, "user_id");

  const categories = createMemoryDataSource(CategoryRecord, {
    delay: 0,
    initialData: [
      { id: "301", name: "Category 1" },
      { id: "302", name: "Category 2" }
    ]
  });

  const posts = createMemoryDataSource(PostRecord, {
    delay: 0,
    initialData: [
      { id: "401", title: "Post 1", body: "Body 1", author_id: "101", category_id: "301" },
      { id: "402", title: "Post 2", body: "Body 2", author_id: "102", category_id: "301" }
    ],
    relations: {
      author: belongsTo(users, "author_id"),
      category: belongsTo(categories, "category_id")
    }
  });

  categories.relations["posts"] = hasMany(posts, "category_id");

  const comments = createMemoryDataSource(CommentRecord, {
    delay: 0,
    initialData: [
      { id: "501", body: "Comment 1", post_id: "401", author_id: "101" },
      { id: "502", body: "Comment 2", post_id: "401", author_id: "102" }
    ],
    relations: {
      post: belongsTo(posts, "post_id"),
      author: belongsTo(users, "author_id")
    }
  });

  posts.relations["comments"] = hasMany(comments, "post_id");
  users.relations["posts"] = hasMany(posts, "author_id");

  return { users, userInfos, posts, comments, categories };
};

describe("MemoryDataSource", () => {
  it("#get", async () => {
    const ds = makeDataSources().users;
    const result = await ds.get("101");

    expect(result.data.id).toBe("101");
    expect(result.data.name).toBe("John");
  });

  describe("#list", () => {
    it("simple", async () => {
      const ds = makeDataSources().users;
      const result = await ds.list();

      expect(result.data.length).toBe(5);
      expect(result.data[0].id).toBe("101");
      expect(result.data[0].name).toBe("John");
      expect(result.data[1].id).toBe("102");
      expect(result.data[1].name).toBe("Jane");
    });

    it("with filter", async () => {
      const ds = makeDataSources().users;
      const result = await ds.list({
        filters: {
          id: "102"
        }
      });

      expect(result.data.length).toBe(1);
    });

    it("with pagination", async () => {
      const ds = makeDataSources().users;
      const result = await ds.list({
        pagination: {
          page: 2,
          itemsPerPage: 2
        }
      });

      expect(result.data.length).toBe(2);
      expect(result.data[0].id).toBe("103");
      expect(result.data[1].id).toBe("104");
    });

    it("with sort", async () => {
      const ds = makeDataSources().users;
      const result = await ds.list({
        sort: ["-id"]
      });

      expect(result.data.length).toBe(5);
      expect(result.data[0].id).toBe("105");
      expect(result.data[1].id).toBe("104");
      expect(result.data[2].id).toBe("103");
      expect(result.data[3].id).toBe("102");
      expect(result.data[4].id).toBe("101");
    });

    describe("with included", () => {
      describe("get (single object)", () => {
        it("belongsTo", async () => {
          const ds = makeDataSources().posts;
          const result = await ds.get("401", {
            included: ["author"]
          });

          expect(result.data.author.id).toBe("101");
          expect(result.data.author.name).toBe("John");
        });

        it("hasMany", async () => {
          const ds = makeDataSources().users;
          const result = await ds.get("101", {
            included: ["posts"]
          });

          expect(result.data.posts.length).toBe(1);
          expect(result.data.posts[0].id).toBe("401");
          expect(result.data.posts[0].title).toBe("Post 1");
        });

        it("hasOne", async () => {
          const ds = makeDataSources().users;
          const result = await ds.get("101", {
            included: ["userInfos"]
          });

          expect(result.data.userInfos.id).toBe("201");
          expect(result.data.userInfos.description).toBe("Description 1");
        });
      });

      describe("list (multiple objects)", () => {
        it("belongsTo", async () => {
          const ds = makeDataSources().posts;
          const result = await ds.list({
            included: ["author"]
          });

          expect(result.data[0].author.id).toBe("101");
          expect(result.data[0].author.name).toBe("John");
          expect(result.data[1].author.id).toBe("102");
          expect(result.data[1].author.name).toBe("Jane");
        });

        it("hasMany", async () => {
          const ds = makeDataSources().users;
          const result = await ds.list({
            included: ["posts"]
          });

          expect(result.data[0].posts.length).toBe(1);
          expect(result.data[0].posts[0].id).toBe("401");
          expect(result.data[0].posts[0].title).toBe("Post 1");
        });

        it("hasOne", async () => {
          const ds = makeDataSources().users;
          const result = await ds.list({
            included: ["userInfos"]
          });

          expect(result.data[0].userInfos.id).toBe("201");
          expect(result.data[0].userInfos.description).toBe("Description 1");
          expect(result.data[1].userInfos.id).toBe("202");
          expect(result.data[1].userInfos.description).toBe("Description 2");
        });
      });
    });
  });
  it("#update", async () => {
    const ds = makeDataSources().users;
    const result = await ds.update("101", { attributes: { name: "new name" } });

    // Expect the result to be a UserRecord
    expect(result.data).toBeInstanceOf(UserRecord);
    expect(result.data.name).toBe("new name")
  });

  it("#create", async () => {
    const ds = makeDataSources().users;
    const id = await ds.create({
      attributes: {
        name: "new name"
      }
    });

    expect(id).toBe("106");

    const created = await ds.get("106");

    expect(created.data.name).toBe("new name");
  });

  it("#delete", async () => {
    const ds = makeDataSources().users;
    const result = await ds.delete("101");

    expect(result).toBe(true);

    try {
      await ds.get("101");
    } catch (e) {
      expect(e).toBe("not found!");
    }
  });

  it("custom methods", async () => {
    const ds = makeDataSources().users;
    const result = await ds.someExample();

    expect(result).toBe("example");
  });
});
