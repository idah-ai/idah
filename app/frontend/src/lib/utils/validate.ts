import { z } from "zod";

type AnyZodObject = z.ZodObject<any>;

export type ZodSchema = z.ZodUnion | AnyZodObject | z.ZodArray<AnyZodObject>;

export function validateData(schema: ZodSchema, data: any) {
  return schema.safeParse(data);
}

export function getFieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors;
}
