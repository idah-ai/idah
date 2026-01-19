import type { Filters } from "../data/filtering";
import type { Hash } from "./types";

export const snakeCase = (text: string): string => {
  return text
    .split(/ |\B(?=[A-Z])/)
    .map((word: string) => word.toLowerCase())
    .join("_");
};

export const encodeUri = (obj: Hash, parentKey: string | null = null): string => {
  const queryArray = [];

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const encodedKey = parentKey ? `${parentKey}[${key}]` : key;

      if (value instanceof Array) {
        for (let i = 0; i < value.length; i++) {
          const arrayKey = `${encodedKey}[]`;
          const arrayValue = value[i];
          if (typeof arrayValue === "object" && arrayValue !== null) {
            // Recursively encode nested objects in arrays
            queryArray.push(encodeUri(arrayValue, arrayKey));
          } else {
            queryArray.push(`${encodeURIComponent(arrayKey)}=${encodeURIComponent(arrayValue)}`);
          }
        }
      } else if (value instanceof Object && value !== null) {
        // Recursively encode nested objects
        queryArray.push(encodeUri(value, encodedKey));
      } else {
        queryArray.push(`${encodeURIComponent(encodedKey)}=${encodeURIComponent(value)}`);
      }
    }
  }

  return queryArray.join("&");
};

export const filtersToHash = (filters: Filters): Hash => {
  let out: Hash = {};

  for (let key in filters) {
    let value = filters[key];

    if (value.op != "eq") {
      key = `${key}__${value.op}`;
    }

    if (out[key]) {
      if (!(out[key] instanceof Array)) {
        out[key].push(value.value);
      } else {
        out[key] = [out[key], value.value];
      }
    }
  }

  return out;
};

export const convertSearchParamsToHash = (searchParams: URLSearchParams): Hash => {
  /**
   * Regex to extract column key and operator from URL filter
   *
   * Example:
   * - key: "filters[name__match]"
   * - value: "John"
   * - match: ["filters[name__match]", "filters", "name__match"]
   * - listOptionsKey: "filters" (can be: filters, included, pagination, fields, sort, all, noCache, count)
   * - columnKeyWithOperator: "name__match"
   */
  const urlFilterRegex: RegExp = /^([^[]+)\[([^\]]+)\]$/;
  const hash: Hash = {};

  Object.entries(Object.fromEntries(searchParams.entries())).forEach(([key, value]) => {
    const match = key.match(urlFilterRegex);
    if (match) {
      const [, _listOptionsKey, columnKeyWithOperator] = match;
      if (hash[columnKeyWithOperator]) {
        /** If the key already exists, it means it's an array */
        if (!(hash[columnKeyWithOperator] instanceof Array)) {
          hash[columnKeyWithOperator] = [hash[columnKeyWithOperator]];
        }
        hash[columnKeyWithOperator].push(value);
      } else {
        hash[columnKeyWithOperator] = value;
      }
    }
  });

  return hash;
};
