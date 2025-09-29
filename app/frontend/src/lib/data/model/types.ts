import type { Hash } from "@/utils/types";
import type { Record } from "@/data/model/Record";

export type JsonApiReference = {
  type: string;
  id?: string;
};

export type JsonApiRecord<T extends Hash> = JsonApiReference & {
  attributes: T;
  relationships?: {
    [key: string]: {
      data: JsonApiReference | Array<JsonApiReference>;
    };
  };
};

export type JsonApiMeta = {
  count?: number;
  more?: boolean;
  [key: string]: unknown;
};

export type LinkObject = {
  href: string;
  meta?: JsonApiMeta;
};

export type Link = string | LinkObject;
export type Links = Hash<Link>;

export type JsonApiSuccessResponse<T extends Hash = Hash> = {
  data: T;
  included?: Array<JsonApiRecord<Hash>>;
  meta?: Hash;
  links?: Links;
};

export type JsonApiSingleModelResponse<T extends Hash = Hash> = JsonApiSuccessResponse<JsonApiRecord<T>>;
export type JsonApiCollectionModelResponse<T extends Hash = Hash> = JsonApiSuccessResponse<Array<JsonApiRecord<T>>>;

export type JsonApiErrorResponse = {
  status: number;
  errors: Array<{
    status: string;
    source?: {
      parameter?: string;
      pointer?: string;
    };
    title?: string;
    detail?: string;
  }>;
};

export type RecordResponse<T extends Record = Record> = {
  data: T;
  meta?: Hash;
};

export type CollectionResponse<T extends Record = Record> = {
  data: T[];
  meta?: JsonApiMeta;
};

export type FieldOptions = {
  key?: string;
  transformer?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (value?: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    to: (value?: any) => any;
  };
};

export type RelationshipOptions = {
  key?: string;
};

export type CustomMethodResponse<T extends Record = Record> = Promise<RecordResponse<T> | JsonApiErrorResponse>;
