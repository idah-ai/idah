import type { Hash } from "@/utils/types";
import { Record } from "@/data/model/Record";
import type { JsonApiRecord } from "@/data/model/types";

export type RelationType = "belongsTo" | "hasMany" | "hasOne";
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

export class IncludeSet {
  public data: Hash<Array<Record>> = {};
  public types: Hash<RelationType> = {};
  public included: string[];

  constructor (included: string[]) {
    this.included = included;
  }

  setType (relation: string, type: RelationType) {
    this.types[relation] = type;
  }

  getType (relation: string): RelationType {
    return this.types[relation];
  }

  add (modelType: string, modelRelation: string, modelId: string, record: Record) {
    const key = `${modelType}-${modelRelation}-${modelId}`;

    this.data[key] ||= [];
    this.data[key].push(record);
  }

  get (modelType: string, modelRelation: string, modelId: string) {
    const key = `${modelType}-${modelRelation}-${modelId}`;
    return this.data[key] || [];
  }

  toJSON () {
    let out: Array<Hash> = [];

    Object.entries(this.data).forEach(([_, value]) => {
      value.forEach(record => {
        out.push({
          id: record.id,
          type: record.type,
          attributes: record.attributes
        });
      });
    });

    return out;
  }
}
