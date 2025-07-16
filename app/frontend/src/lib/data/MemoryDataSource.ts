import type { ListOptions, Pagination, DataSource, GetOptions, DataParams } from "./DataSource";
import type { Filters } from "./filtering";
import type { CollectionResponse, RecordResponse } from "./model/types";
import type { Record, RecordClass } from "./model/Record";
import { makeCollection, makeSingleElement, parseCollectionReturn, parseSingleElementReturn } from "./model/json_api";
import type { Hash } from "@/utils/types";
import { IncludeSet } from "./model/includes";
import { sleep } from "@/utils/delayed";

async function gatherCollection<T extends Record>(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  dataSource: MemoryDataSource<T>,
  filters?: Filters,
  pagination?: Pagination,
  sort?: string[],
  included?: string[]
): Promise<[Array<Hash>, IncludeSet]> {
  let collection = dataSource.data;

  const relations = dataSource.relations;

  if (filters) collection = filterCollection(filters, collection);
  if (sort) collection = sortCollection(sort, collection);
  if (pagination) collection = paginateCollection(collection, pagination);

  const includedList = new IncludeSet(included || []);

  await processIncluded<T>(included, relations, collection, includedList, dataSource);

  return [collection, includedList];
}

function paginateCollection(collection: Hash[], pagination: Pagination) {
  collection = collection.slice(
    (pagination.page - 1) * pagination.itemsPerPage,
    pagination.page * pagination.itemsPerPage
  );
  return collection;
}

function sortCollection(sort: string[], collection: Hash[]) {
  let sortStr = "" + sort[0];

  let order = 1;
  if (sortStr[0] === "-") {
    order = -1;
    sortStr = sortStr.slice(1);
  }

  collection = collection.sort((a, b) => {
    if (a[sortStr] === undefined) return 0;

    if (a[sortStr] < b[sortStr]) {
      return -1 * order;
    } else if (a[sortStr] > b[sortStr]) {
      return order;
    } else {
      return 0;
    }
  });
  return collection;
}

function filterCollection(filters: Filters, collection: Hash[]) {
  Object.entries(filters).forEach(([key, filterValue]) => {
    collection = collection.filter((record) => {
      const keyValues = key.split("__");
      const keyName = keyValues[0];
      const keyOperator = keyValues[1] || "eq";
      const value = record[keyName];

      switch (keyOperator) {
        case "eq":
          return value === filterValue;
        case "ne":
          return value !== filterValue;
        case "lt":
          return value < filterValue;
        case "lte":
          return value <= filterValue;
        case "gt":
          return value > filterValue;
        case "gte":
          return value >= filterValue;
        case "in":
          return filterValue.includes(value);
        case "nin":
          return !filterValue.includes(value);
        case "contains":
          return value.includes(filterValue);
        case "ncontains":
          return !value.includes(filterValue);
        case "null":
          return value === null;
        case "nnull":
          return value !== null;
        case "match":
          return new RegExp(filterValue).test(value);
        default:
          return false;
      }
    });
  });
  return collection;
}

async function processIncluded<T extends Record>(
  included: string[] | undefined,
  relations: Hash<MemoryRelation<Record>>,
  collection: Hash[],
  includeSet: IncludeSet,
  dataSource: MemoryDataSource<T>
) {
  if (included && included.length > 0) {
    for await (const relation of included) {
      const [localRelation, ...remnant] = relation.split(".");

      let foreignRelation: string[];

      if (remnant.length > 0) foreignRelation = [remnant.join(".")];

      foreignRelation ||= [];

      const relationDataSource = relations[localRelation];

      if (!relationDataSource) throw `[processIncluded] Relation ${localRelation} not found`;

      let result;
      includeSet.setType(localRelation, relationDataSource.type);

      switch (relationDataSource.type) {
        case "belongsTo":
          result = await relationDataSource.foreignDataSource.list({
            filters: {
              id__in: collection.map((record) => record[relationDataSource.foreignKey])
            },
            included: foreignRelation
          });

          // Create a quick index by id for the results:
          const index: Hash = {};
          result.data.forEach((element) => {
            index[element.id] = element;
          });

          // Then add the relation to the included list:
          collection.forEach((record) => {
            includeSet.add(dataSource.type, relation, record.id, index[record[relationDataSource.foreignKey]]);
          });

          break;
        case "hasMany":
          result = await relationDataSource.foreignDataSource.list({
            filters: {
              [`${relationDataSource.foreignKey}__in`]: collection.map((record) => record.id)
            },
            included: foreignRelation
          });

          result.data.forEach((element) => {
            includeSet.add(
              dataSource.type,
              relation,
              element._jsonapiData.attributes[relationDataSource.foreignKey],
              element
            );
          });

          break;
        case "hasOne":
          result = await relationDataSource.foreignDataSource.list({
            filters: {
              [`${relationDataSource.foreignKey}__in`]: collection.map((record) => record.id)
            },
            included: foreignRelation
          });

          result.data.forEach((element) => {
            includeSet.add(
              dataSource.type,
              relation,
              element._jsonapiData.attributes[relationDataSource.foreignKey],
              element
            );
          });

          break;
        default:
          throw `Unknown relation type ${relationDataSource.type}`;
      }
    }
  }
}

export interface MemoryDataSource<T extends Record> extends DataSource<T> {
  data: Array<Hash>;
  type: string;
  delay: number;
  error: boolean;
  relations: Hash<MemoryRelation<Record>>;
}

export interface MemoryRelation<T extends Record> {
  type: "belongsTo" | "hasMany" | "hasOne";
  primaryKey: string;
  foreignKey: string;
  foreignDataSource: MemoryDataSource<T>;
}

export function belongsTo<T extends Record>(
  foreignDataSource: MemoryDataSource<T>,
  foreignKey: string,
  primaryKey = "id"
): MemoryRelation<T> {
  return {
    type: "belongsTo",
    primaryKey: primaryKey,
    foreignKey,
    foreignDataSource
  };
}

export function hasMany<T extends Record>(
  foreignDataSource: MemoryDataSource<T>,
  foreignKey: string,
  primaryKey = "id"
): MemoryRelation<T> {
  return {
    type: "hasMany",
    primaryKey: primaryKey,
    foreignKey,
    foreignDataSource
  };
}

export function hasOne<T extends Record>(
  foreignDataSource: MemoryDataSource<T>,
  foreignKey: string,
  primaryKey = "id"
): MemoryRelation<T> {
  return {
    type: "hasOne",
    primaryKey: primaryKey,
    foreignKey,
    foreignDataSource
  };
}

export interface MemoryDataSourceOptions<T> {
  delay?: number;
  initialData?: Array<Hash>;
  error?: boolean;
  customMethods?: T;
  relations?: Hash<MemoryRelation<Record>>;
}

export function createMemoryDataSource<T extends Record, U>(
  recordClass: RecordClass<T>,
  options: MemoryDataSourceOptions<U> = {}
): MemoryDataSource<T> & U {
  let obj = <MemoryDataSource<T> & U>{
    type: recordClass.type,
    delay: options.delay || 0,
    error: options.error || false,
    data: options.initialData || [],
    relations: options.relations || {},

    async create(data: DataParams<T>): Promise<string> {
      await sleep(this.delay);

      if (this.error) throw "error";

      const findMaxId = () => {
        let maxId = 0;
        this.data.forEach((record) => {
          if (Number.parseInt(record.id) > maxId) {
            maxId = Number.parseInt(record.id);
          }
        });
        return maxId.toString();
      };

      const id = `${parseInt(findMaxId()) + 1}`;
      data.attributes = { id, ...data.attributes };

      this.data.push(data.attributes);

      return id;
    },

    async list(options: ListOptions = {}): Promise<CollectionResponse<T>> {
      await sleep(this.delay);

      if (this.error) throw "error";
      const [out, included] = await gatherCollection(
        this,
        options.filters,
        options.pagination,
        options.sort,
        options.included || []
      );

      return parseCollectionReturn(makeCollection<T>(out as T[], this.type, options.included || [], included));
    },

    async get(id: string, options: GetOptions = {}): Promise<RecordResponse<T>> {
      await sleep(this.delay);

      if (this.error) throw "error";

      const [out, includeSet] = await gatherCollection(
        this,
        { id },
        { itemsPerPage: 1, page: 1 },
        [],
        options.included
      );

      if (!out[0]) throw "not found!";

      return parseSingleElementReturn(makeSingleElement(out[0], this.type, {}, options.included, includeSet));
    },

    async update(id: string, data: DataParams<T>): Promise<RecordResponse<T>> {
      await sleep(this.delay);

      if (this.error) throw "error";

      const index = this.data.findIndex((record) => record.id.toString() === id);

      if (index == -1) throw "not found!";

      this.data[index] = { ...this.data[index], ...data.attributes };
      return parseSingleElementReturn(makeSingleElement(this.data[index], this.type, {}));
    },

    async delete(id: string): Promise<boolean> {
      await sleep(this.delay);

      if (this.error) throw "error";

      const index = this.data.findIndex((record) => record.id.toString() === id);

      if (index == -1) throw "not found!";

      this.data.splice(index, 1);
      return true;
    }
  };

  obj = Object.assign(obj, options.customMethods || {});
  return obj;
}
