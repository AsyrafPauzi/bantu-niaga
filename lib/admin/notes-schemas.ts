import { z } from "zod";

export const adminNotePatchSchema = z
  .object({
    body: z.string().trim().min(1).max(4000).optional(),
    is_pinned: z.boolean().optional(),
    linked_task_id: z.string().uuid().nullable().optional(),
    linked_compliance_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data).length > 0 &&
      !(
        data.linked_task_id &&
        data.linked_compliance_id &&
        data.linked_task_id !== null &&
        data.linked_compliance_id !== null
      ),
    {
      message: "Link a note to either a task or a compliance item, not both.",
    },
  );
