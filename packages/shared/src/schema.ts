import { z } from "zod";

export const eventContextSchema = z.object({
  platform: z.enum(["web", "react-native"]),
  sdk_version: z.string(),
  os: z.string().optional(),
  browser: z.string().optional(),
  screen_width: z.number().optional(),
  screen_height: z.number().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  app_version: z.string().optional(),
  page_url: z.string().optional(),
  page_title: z.string().optional(),
  screen_name: z.string().optional(),
});

export const eventCategorySchema = z.enum([
  "activation",
  "engagement",
  "monetization",
  "referral",
  "noise",
]);

export const eventSchema = z.object({
  event_id: z.string().uuid(),
  project_id: z.string().min(1),
  user_id: z.string().optional(),
  anonymous_id: z.string().min(1),
  event_name: z.string().min(1).max(256),
  event_type: z.enum(["track", "identify", "page", "screen"]),
  properties: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  context: eventContextSchema.optional(),
  timestamp: z.string().datetime(),
  category: eventCategorySchema.optional(),
});

export const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(10000),
});

export const timeRangeSchema = z.union([
  z.object({ start: z.string().datetime(), end: z.string().datetime() }),
  z.enum(["last_24h", "last_7d", "last_30d", "last_90d"]),
]);

export const filterSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "neq", "gt", "lt", "gte", "lte", "contains"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type EventInput = z.infer<typeof eventSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
