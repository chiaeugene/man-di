import { z } from "zod";
import type { Package, PackageAttachment } from "@prisma/client";
import { parseJson } from "@/lib/json";
import { serializeAttachment } from "@/lib/attachments";

export const PackageInputSchema = z.object({
  name: z.string().min(1).max(120),
  priceMyr: z.number().int().min(0),
  hours: z.number().int().min(0).nullish(),
  editedPhotos: z.number().int().min(0).nullish(),
  includesAlbum: z.boolean().default(false),
  includesVideo: z.boolean().default(false),
  deliverables: z.array(z.string().max(300)).default([]),
  addOns: z
    .array(z.object({ name: z.string().max(120), priceMyr: z.number().int().min(0) }))
    .default([]),
  description: z.string().max(2000).nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type PackageInput = z.infer<typeof PackageInputSchema>;

// JSON string columns → arrays for the client.
export function serializePackage(p: Package & { attachments?: PackageAttachment[] }) {
  return {
    ...p,
    deliverables: parseJson<string[]>(p.deliverables, []),
    addOns: parseJson<{ name: string; priceMyr: number }[]>(p.addOns, []),
    attachments: (p.attachments ?? []).map(serializeAttachment),
  };
}
