import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZodObject = z.ZodObject<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchema = z.ZodType<any> | z.ZodUnion | AnyZodObject | z.ZodArray<AnyZodObject>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateData(schema: ZodSchema, data: any) {
  return schema.safeParse(data);
}

export function getFieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors;
}
