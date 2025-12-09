import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(100, "Password must be at most 100 characters long"),
});

export const signUpSchema = z
  .object({
    email: z.email(),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(100, "Password must be at most 100 characters long"),

    confirmPassword: z
      .string()
      .min(8, "Confirm Password must be at least 8 characters long")
      .max(100, "Confirm Password must be at most 100 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const sendResetPasswordLinkSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(100, "Password must be at most 100 characters long"),

    confirmPassword: z
      .string()
      .min(8, "Confirm Password must be at least 8 characters long")
      .max(100, "Confirm Password must be at most 100 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
