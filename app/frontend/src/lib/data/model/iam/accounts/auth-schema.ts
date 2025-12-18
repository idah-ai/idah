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

const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
  );

export const resetPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: passwordRules,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
