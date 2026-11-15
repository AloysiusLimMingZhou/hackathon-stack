import { z } from "zod";

// Shared by client forms and server code — keep it free of server-only imports.
export const createItemInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateItemInput = z.infer<typeof createItemInput>;
