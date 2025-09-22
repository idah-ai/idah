import { identity, type Hash, type Constructor } from "@/utils/types";
import type { IncludeList } from "@/data/model/includes";
import type { FieldOptions, JsonApiRecord, JsonApiReference, RelationshipOptions } from "@/data/model/types";
import { camelToSnake } from "@/utils/string";

export function field(opts: FieldOptions = {}) {
  const transformerFunction = opts.transformer || { from: identity };

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  return function (target: any, key: string): void {
    const fields: { [name: string]: FieldOptions } = (target.constructor.fields ||= {});
    fields[key] = opts;

    Object.defineProperty(target, key, {
      get: function (this: Record) {
        const model = this._jsonapiData as JsonApiRecord<Hash>;
        return transformerFunction.from(model.attributes[opts.key || key]);
      },
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      set: function (this: Record, value: any) {
        const model = this._jsonapiData as JsonApiRecord<Hash>;
        model.attributes[opts.key || key] = value;
      },
    });
  };
}

export function relationship(opts: RelationshipOptions = {}) {
  const buildObject = (target: Record, record: JsonApiReference) => {
    const includeList = target._includeList;

    console.log({ opts, target, includeList, record });
    if (!includeList) throw `Include list not found`;

    const object = includeList.find(record.id || "", record.type);

    if (!object) throw `Object ${record.type}:${record.id} not found in include list`;

    return RecordFactory.create(object, includeList);
  };

  return function (target: Record, key: string) {
    Object.defineProperty(target, key, {
      get: function (this: Record) {
        // Convert camelCase to snake_case
        // as relationships are stored in snake_case in the JSON API response

        key = opts.key || key; // key = camelToSnake(key);

        if (this._relationshipCached[key]) {
          return this._relationshipCached[key];
        }

        const model = this._jsonapiData as JsonApiRecord<Hash>;

        const relationships = model.relationships;

        if (relationships && relationships[key]) {
          const relationship = relationships[key];

          if (Array.isArray(relationship.data)) {
            const arr: Record[] = relationship.data.map((record) => buildObject(this, record));

            return (this._relationshipCached[key] = arr);
          } else {
            const relationshipData = relationship.data as JsonApiRecord<Hash>;
            return (this._relationshipCached[key] = buildObject(this, relationshipData));
          }
        }
      },
    });
  };
}

export type FieldData = {
  name: string;
  key: string;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  transformer: (value: any) => any;
};

export class Record {
  // Helper for accessing the fields of the record.
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;

  private static _type: string;
  public static fields: { [name: string]: FieldOptions };

  // String defining the type of the record.
  public static get type(): string {
    if (!this._type) throw `type of record not defined`;
    return this._type;
  }

  public static set type(value: string) {
    this._type = value;
  }

  public errors: Hash;
  public _jsonapiData: JsonApiRecord<Hash>;
  public _includeList?: IncludeList;
  public _relationshipCached: Hash = {};

  constructor(data?: JsonApiRecord<Hash>, includeList?: IncludeList) {
    if (data) {
      this._jsonapiData = data;
    } else {
      this._jsonapiData = {
        type: (this.constructor as typeof Record).type,
        attributes: {},
      };
    }
    this.errors = {};
    this._includeList = includeList;
  }

  public get id(): string {
    return this._jsonapiData.id || "";
  }
  public get type(): string {
    return this._jsonapiData.type;
  }

  public attributes(): Partial<Record> {
    const entries = Object.entries(this._jsonapiData.attributes).filter(([_, value]) => {
      return value !== undefined;
    });

    return Object.fromEntries(entries);
  }

  public getValueByKey(key: string) {
    if (key === "id") return this.id;

    const keys = key.split("."); // "quiz.session.name" => ["quiz", "session", "name"]

    if (keys.length > 1) {
      const recordKey = keys[0]; // "quiz"
      const record = this[recordKey]; // instance.quiz or row.quiz

      if (!record) return undefined;

      return record.getValueByKey(keys.slice(1).join(".")); // "session.name"
    }

    return this._jsonapiData.attributes[key];
  }
}

export type RecordClass<T extends Record> = {
  new (data?: JsonApiRecord<Hash>, includeList?: IncludeList): T;
  get type(): string;
  fields: { [name: string]: FieldOptions };
};

export class RecordFactory {
  private static typeMap: Hash = {};

  public static registerType(klass: typeof Record) {
    this.typeMap[klass.type] = klass;
  }

  public static registerTypes(...klasses: (typeof Record)[]) {
    klasses.forEach((klass) => this.registerType(klass));
  }

  public static create<T extends Record>(data: JsonApiRecord<Hash>, includeList?: IncludeList): T {
    const constructor = this.typeMap[data.type] as Constructor<T>;

    if (constructor) {
      return new constructor(data, includeList);
    } else {
      throw `Type ${data.type} not registered`;
    }
  }
}

export const type = (type: string) => {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  return (target: any) => {
    target.type = type;
  };
};
