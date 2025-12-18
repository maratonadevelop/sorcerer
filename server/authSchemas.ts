import { z } from 'zod';

// Password policy: min 8 chars, at least one letter and one number
export const passwordSchema = z.string()
  .min(8, 'Senha mínima de 8 caracteres')
  .max(200, 'Senha muito longa')
  .regex(/[A-Za-z]/, 'Precisa de uma letra')
  .regex(/[0-9]/, 'Precisa de um número');

export const registerSchema = z.object({
  id: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, 'ID inválido'),
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  firstName: z.string().min(1).max(120),
  lastName: z.string().max(120).optional(),
});

export const loginSchema = z.object({
  id: z.string().min(1), // can be email or id
  password: z.string().min(6).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
