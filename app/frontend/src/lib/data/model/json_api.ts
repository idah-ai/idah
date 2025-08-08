/**
 * @author Yacine
 *
 * This code need a complete rework. Because of lack of time, it has been patched to simulate MemoryDataSource as close
 * as possible to the BackendDataSource. The management of included is disastrous and probably buggy and need a complete rework.
 */
import type { Hash } from "@/utils/types";
import { IncludeList, IncludeSet } from "@/data/model/includes";
import { Record, RecordFactory } from "@/data/model/Record";
import type {
  CollectionResponse,
  JsonApiCollectionModelResponse,
  JsonApiErrorResponse,
  JsonApiRecord,
  JsonApiReference,
  JsonApiSingleModelResponse,
  RecordResponse
} from "./types";

export const parseSingleElementError = (dataRaw: Hash): JsonApiErrorResponse => {
  return {
    status: dataRaw.status,
    errors: dataRaw.errors
  };
};

export const parseSingleElementReturn = <T extends Record>(dataRaw: Hash): RecordResponse<T> => {
  if (dataRaw.errors) throw "TODO: Handle error output";

  const data = dataRaw.data as JsonApiRecord<Hash>;
  if (dataRaw.included) {
    const includeList = new IncludeList(dataRaw.included);

    return {
      data: RecordFactory.create<T>(data, includeList),
      meta: dataRaw.meta
    };
  } else {
    return {
      data: RecordFactory.create<T>(data),
      meta: dataRaw.meta
    };
  }
};

export const parseCollectionReturn = <T extends Record>(dataRaw: Hash): CollectionResponse<T> => {
  if (dataRaw.errors) throw "TODO: Handle error output";

  const data = dataRaw.data as Array<JsonApiRecord<Hash>>;

  if (dataRaw.included) {
    const includeList = new IncludeList(dataRaw.included);

    return {
      data: data.map(record => RecordFactory.create<T>(record, includeList)),
      meta: dataRaw.meta
    };
  } else {
    return {
      data: data.map(record => RecordFactory.create<T>(record)),
      meta: dataRaw.meta
    };
  }
};

export function makeSingleElement<T extends Hash>(
  data: T,
  type: string,
  opts: Hash,
  included: string[] = [],
  includeSet?: IncludeSet
): JsonApiSingleModelResponse<T> {
  let out: JsonApiSingleModelResponse<T> = {
    data: {
      type: type,
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      id: (data as any).id,
      attributes: data
    },
    ...opts
  };

  if (includeSet) {
    let includedList: JsonApiRecord<Hash>[] = [];
    included.forEach(relation => {
      let [localRelation, ...foreignRelations] = relation.split(".");

      console.log("try to get", type, localRelation, <string>out.data.id);
      console.log(includeSet);
      console.log(includeSet.get(type, localRelation, <string>out.data.id));
      includeSet.get(type, localRelation, <string>out.data.id).forEach((record: Record) => {
        out.data.relationships ||= {};

        if (includeSet.getType(relation) == "hasMany") {
          out.data.relationships[localRelation] ||= {
            data: []
          };

          let data = out.data.relationships[localRelation].data as JsonApiReference[];
          data.push({
            type: record.type,
            id: record.id
          });

          let foreignIncluded = foreignRelations.length > 0 ? [foreignRelations.join(".")] : [];

          let object = makeSingleElement(
            Object.assign({ id: record.id }, record._jsonapiData.attributes),
            record.type,
            {},
            foreignIncluded,
            includeSet
          );
          includedList.push(object.data);
        } else {
          out.data.relationships[localRelation] = {
            data: {
              type: record.type,
              id: record.id
            }
          };

          let object = makeSingleElement(
            Object.assign({ id: record.id }, record._jsonapiData.attributes),
            record.type,
            {},
            foreignRelations,
            includeSet
          );

          includedList.push(object.data);
        }
      });
    });

    if (includedList.length > 0) {
      out.included = includedList;
    }
  }

  return out;
}

export function makeCollection<T extends Hash>(
  data: Array<T>,
  type: string,
  included: string[] = [],
  includeSet: IncludeSet,
  opts: Hash = {}
): JsonApiCollectionModelResponse<T> {
  let includedList: JsonApiRecord<Hash>[] = [];

  let result: JsonApiCollectionModelResponse<T> = {
    data: data.map(item => {
      let out: JsonApiRecord<T> = {
        type: type,
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        id: (item as any).id,
        attributes: item
      };

      if (includeSet) {
        included.forEach(relation => {
          let [localRelation, ...foreignRelations] = relation.split(".");

          includeSet.get(type, localRelation, <string>out.id).forEach((record: Record) => {
            out.relationships ||= {};

            if (includeSet.getType(relation) == "hasMany") {
              out.relationships[localRelation] ||= {
                data: []
              };

              let data = out.relationships[localRelation].data as JsonApiReference[];
              data.push({
                type: record.type,
                id: record.id
              });

              let foreignIncluded = foreignRelations.length > 0 ? [foreignRelations.join(".")] : [];

              let object = makeSingleElement(
                Object.assign({ id: record.id }, record._jsonapiData.attributes),
                record.type,
                {},
                foreignIncluded,
                includeSet
              );
              includedList.push(object.data);
            } else {
              out.relationships[localRelation] = {
                data: {
                  type: record.type,
                  id: record.id
                }
              };

              let object = makeSingleElement(
                Object.assign({ id: record.id }, record._jsonapiData.attributes),
                record.type,
                {},
                foreignRelations,
                includeSet
              );

              includedList.push(object.data);
            }
          });
        });
      }

      return out;
    }),
    ...opts
  };

  if (includedList.length > 0) {
    result.included = includedList;
  }

  return result;
}
