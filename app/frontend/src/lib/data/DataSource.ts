import type { Filters } from "@/data/filtering";
import type { Record } from "@/data/model/Record";
import type { CollectionResponse, RecordResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

export type Included = Array<string>;

export interface Pagination {
  page: number;
  itemsPerPage: number;
}

export interface Field {
  [key: string]: string[];
}

export interface DataParams<T> {
  attributes: Partial<T>;
  relationships?: Partial<Hash>;
}

export type Sort = Array<string>;

export type ListOptions = {
  filters?: Filters;
  included?: Included;
  pagination?: Pagination;
  fields?: Field;
  sort?: Sort;
  all?: boolean;
  noCache?: boolean; // By default, the cache is used
  count?: boolean; // By default, count is false
};

export type GetOptions = {
  included?: Included;
  fields?: Field;
  noCache?: boolean; // By default, the cache is used
};

// export type CustomSingleSource<T extends Hash> = {
//   /**
//    * Call get and return a Single Element
//    */
//   get(): Promise<JsonApiSingleModelResponse<T>>;
// };

// export type CustomCollectionSource<T extends Hash> = {
//   get(): Promise<JsonApiCollectionModelResponse<T>>;
// };

export interface DataSourceOptions {
  showErrorToast?: boolean; // By default, the error toast is shown
}

export type DataListSource<T extends Record> = {
  list(options?: ListOptions): Promise<CollectionResponse<T>>;
};

export type DataGetSource<T extends Record> = {
  /**
   * @param id The id of the element to get
   * @returns A promise that resolves to the element or rejects to an error
   * @param options The options to get the element
   */
  get(id: string, options?: GetOptions): Promise<RecordResponse<T>>;
};

export type DataUpdateSource<T extends Record> = {
  /**
   * @param id The id of the element to update
   * @param data The data to update
   *
   * @param options The options to update the element
   * @param options.showErrorToast Whether to show an error toast if the update fails
   *
   * @returns A promise that resolves to true if the update was successful or rejects to an error
   */
  update(id: string, data: DataParams<T>, options?: DataSourceOptions): Promise<RecordResponse<T>>;
};

export type DataCreateSource<T extends Record> = {
  /**
   * @param data The data to create
   * @returns A promise that resolves to the id of the created element (as string) or rejects to an error
   *
   * @param options The options to create the element
   * @param options.showErrorToast Whether to show an error toast if the create fails
   */
  create(data: DataParams<T>, options?: DataSourceOptions): Promise<RecordResponse<T>>;
};

export type DataDeleteSource = {
  /**
   * @param id The id of the element to delete
   * @returns A promise that resolves to true if the delete was successful or rejects to an error
   *
   * @param options The options to delete the element
   * @param options.showErrorToast Whether to show an error toast if the delete fails
   */
  delete(id: string, options?: DataSourceOptions): Promise<boolean>;
};

export type DataSource<T extends Record> = DataListSource<T> &
  DataGetSource<T> &
  DataUpdateSource<T> &
  DataCreateSource<T> &
  DataDeleteSource;
