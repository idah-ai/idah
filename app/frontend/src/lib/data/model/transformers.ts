import { format } from "date-fns";

export const Transformers = {
  /**
   * Transform a string in ISO format to a Date object.
   * Usable as transformer function in a Record field decorator.
   *
   * @param value A string in ISO format
   * @returns A Date object
   */
  Time: {
    from (value?: string) {
      return value && new Date(value);
    },
    to (value?: Date | string) {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string") return new Date(value).toISOString();
      return value;
    }
  },
  Date: {
    from (value?: string) {
      // returns the Date object
      return value && new Date(value);
    },
    to (value?: Date) {
      // Set the time to 00:00:00
      return value && format(value, "yyyy-MM-dd");
    }
  }
};
