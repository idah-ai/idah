import type { Hash, Constructor } from "$idah/utils/types";
import type { FieldOptions, JsonApiRecord } from "$idah/data/types";

export class IncludeList {
  private _index: { [type: string]: Hash } = {};

  constructor (list: Array<JsonApiRecord<Hash>>) {
    list.forEach((element: any) => {
      const typeMap = (this._index[element.type] ||= {});
      typeMap[element.id] = element;
    });
  }

  public find (id: string, type: string): JsonApiRecord<Hash> | null {
    const typeMap = this._index[type];

    if (typeMap) {
      return typeMap[id];
    } else {
      return null;
    }
  }
}

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
