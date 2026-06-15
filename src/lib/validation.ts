import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address').min(1).max(254);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name is too long');

export const phoneSchema = z.string().max(20).optional();

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  attribution: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      ref: z.string().optional(),
      landingUrl: z.string().optional(),
    })
    .optional(),
});

export const clientRegisterSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const createClientSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(100).optional(),
});

export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  message: z.string().min(1, 'Message is required').max(5000),
  phone: z.string().max(20).optional(),
  subject: z.string().max(200).optional(),
});

export const deleteClientSchema = z.object({
  id: z.string().min(1, 'Client ID is required'),
});
