import { z } from "zod";

import { passwordRules } from "@/data/model/iam/accounts/auth-schema";

export const accountPasswordSchema = z
  .object({
    old_password: passwordRules,
    new_password: passwordRules,
    confirm_password: passwordRules,
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const updateAccountPasswordSchema = accountPasswordSchema;
