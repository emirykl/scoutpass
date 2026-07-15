import { z } from "zod";

export const nonEmptyTextSchema = z.string().trim().min(1).max(2_000);
export const shortTextSchema = z.string().trim().min(1).max(200);
export const publicKeySchema = z.string().trim().min(32).max(256);
export const idSchema = z.string().trim().min(3).max(128);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const percentageSchema = z.number().finite().min(0).max(100);
export const nonNegativeNumberSchema = z.number().finite().min(0);
export const nonNegativeIntegerSchema = z.number().int().min(0);

export const appRoleSchema = z.enum(["player", "scout"]);
export type AppRole = z.infer<typeof appRoleSchema>;
